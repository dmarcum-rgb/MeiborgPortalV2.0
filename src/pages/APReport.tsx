import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, ChevronDown, ChevronRight, AlertTriangle,
  Lock, Unlock, Search, Building2, FileText, RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const MCLEOD_FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcleod-pull`;
const MCLEOD_HEADERS = {
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

function parseMcleodDate(s: string | null | undefined): string {
  if (!s || s.length < 8) return '';
  const y = s.slice(0, 4), mo = s.slice(4, 6), d = s.slice(6, 8);
  return `${parseInt(mo)}/${parseInt(d)}/${y}`;
}

function mcleodAPDueDays(dueDateStr: string | null | undefined): number | null {
  if (!dueDateStr || dueDateStr.length < 8) return null;
  const y = parseInt(dueDateStr.slice(0, 4));
  const mo = parseInt(dueDateStr.slice(4, 6)) - 1;
  const d = parseInt(dueDateStr.slice(6, 8));
  const then = new Date(y, mo, d);
  return Math.floor((new Date().getTime() - then.getTime()) / 86400000);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMcleodAP(rows: any[]): APReportData {
  const today = new Date().toLocaleDateString('en-US');
  const vendorMap = new Map<string, APVendor>();

  for (const row of rows) {
    const vendorId: string = row.vendor_id ?? '';
    const vendorName: string = row.vendor_id_row?.name ?? vendorId;
    const balance = parseFloat(row.balance) || 0;
    const dueDate: string = row.due_date ?? '';
    const days = mcleodAPDueDays(dueDate);

    let current = 0, over30 = 0, over60 = 0, over90 = 0, over120 = 0;
    if (days == null || days <= 0) current = balance;
    else if (days <= 30) current = balance;
    else if (days <= 60) over30 = balance;
    else if (days <= 90) over60 = balance;
    else if (days <= 120) over90 = balance;
    else over120 = balance;

    if (!vendorMap.has(vendorId)) {
      vendorMap.set(vendorId, {
        code: vendorId,
        name: vendorName,
        invoices: [],
        totals: { balance: 0, current: 0, over30: 0, over60: 0, over90: 0, over120: 0, invoiceCount: 0 },
      });
    }
    const vendor = vendorMap.get(vendorId)!;
    vendor.invoices.push({
      voucherNum: row.invoice_number ?? '',
      invoiceNum: row.invoice_number ?? '',
      invoiceDate: parseMcleodDate(row.invoice_date),
      glDate: '',
      dueDate: parseMcleodDate(dueDate),
      addrCode: '',
      poNumber: '',
      balance, current, over30, over60, over90, over120,
    });
  }

  const vendors = Array.from(vendorMap.values()).map(v => {
    v.totals = {
      balance: v.invoices.reduce((s, i) => s + i.balance, 0),
      current: v.invoices.reduce((s, i) => s + i.current, 0),
      over30: v.invoices.reduce((s, i) => s + i.over30, 0),
      over60: v.invoices.reduce((s, i) => s + i.over60, 0),
      over90: v.invoices.reduce((s, i) => s + i.over90, 0),
      over120: v.invoices.reduce((s, i) => s + i.over120, 0),
      invoiceCount: v.invoices.length,
    };
    return v;
  }).sort((a, b) => b.totals.balance - a.totals.balance);

  return { reportDate: today, vendors };
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface APInvoice {
  voucherNum: string;
  invoiceNum: string;
  invoiceDate: string;
  glDate: string;
  dueDate: string;
  addrCode: string;
  poNumber: string;
  balance: number;
  current: number;
  over30: number;
  over60: number;
  over90: number;
  over120: number;
}

export interface APVendor {
  code: string;
  name: string;
  invoices: APInvoice[];
  totals: {
    balance: number;
    current: number;
    over30: number;
    over60: number;
    over90: number;
    over120: number;
    invoiceCount: number;
  };
}

export interface APReportData {
  reportDate: string;
  vendors: APVendor[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function parseNum(v: unknown): number {
  if (v == null || v === '') return 0;
  const s = String(v).replace(/[$,"]/g, '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function agingColor(key: string): string {
  if (key === 'current') return '#4ADE80';
  if (key === 'over30') return '#FCD34D';
  if (key === 'over60') return '#FB923C';
  if (key === 'over90') return '#F87171';
  if (key === 'over120') return '#EF4444';
  return '#9A9690';
}

// ── CSV Parser ─────────────────────────────────────────────────────────────
// Parses the Meiborg "Aged Accounts Payable Report" CSV format.
//
// Confirmed column layout from AP44.csv:
//   Vendor header row: col0=vendorCode, col4=vendorName (cell1 empty)
//   Invoice detail row: col1=voucher#, col3=invDate, col6=glDate, col9=dueDate,
//                       col11=balance, col15=current, col19=over30, col22=over60,
//                       col25=over90, col28=over120
//   Invoice sub-row:    col3=invoiceNumber (col1 empty)
//   Vendor totals row:  col2="Vendor", col3="VENDORCODE  totals:", col7=invoiceCount,
//                       col11=balance, col15=current, col19=over30, col22=over60,
//                       col25=over90, col28=over120
//   Percentage row follows each totals row (contains %)

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQ = false;
  for (const ch of line) {
    if (ch === '"' && !inQ) { inQ = true; }
    else if (ch === '"' && inQ) { inQ = false; }
    else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur.trim());
  return result;
}

// Column positions — confirmed from AP44.csv analysis
const C = {
  vendorCode: 0,
  vendorName: 4,
  voucher: 1,
  invDate: 3,
  glDate: 6,
  dueDate: 9,
  balance: 11,
  current: 15,
  over30: 19,
  over60: 22,
  over90: 25,
  over120: 28,
  totalsLabel: 3,  // "VENDORCODE  totals:"
  invoiceCount: 7,
};

function g(row: string[], idx: number): string {
  return (row[idx] ?? '').trim();
}

export function parseAPCsv(text: string): APReportData {
  const lines = text.split('\n').map(l => l.replace(/\r$/, ''));
  const parsed = lines.map(parseCsvLine);

  // Extract report date from first 10 lines
  let reportDate = '';
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const m = lines[i].match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (m) { reportDate = m[1]; break; }
  }

  const vendors: APVendor[] = [];
  let currentVendor: APVendor | null = null;

  // Skip to after first separator line
  let i = 0;
  while (i < parsed.length && !g(parsed[i], 0).startsWith('____')) i++;
  i++; // skip separator itself

  // Skip column header rows and next separator (rows 6, 7, 8 in the file)
  while (i < parsed.length) {
    const row = parsed[i];
    const cell0 = g(row, 0);
    const rowText = row.join('|');
    if (cell0.startsWith('____')) { i++; break; } // second separator = end of headers
    if (rowText.toLowerCase().includes('voucher') || rowText.toLowerCase().includes('invoice #')) { i++; continue; }
    i++;
  }

  while (i < parsed.length) {
    const row = parsed[i];
    const cell0 = g(row, 0);
    const cell1 = g(row, 1);
    const cell2 = g(row, 2);
    const cell3 = g(row, 3);

    // Skip empty rows
    if (row.every(c => !c.trim())) { i++; continue; }

    // Skip separator lines
    if (cell0.startsWith('____')) { i++; continue; }

    // Report totals / footer — stop
    if (/^(Report totals|Number of (vendors|invoices)|Average invoice|Net Accounts)/i.test(cell0) ||
        /^(Report totals|Number of (vendors|invoices)|Average invoice|Net Accounts)/i.test(cell3)) break;

    // Percentage row — skip
    if (row.some(c => c.includes('%'))) { i++; continue; }

    // Vendor totals row: col2="Vendor" and col3 ends with "totals:"
    if (cell2 === 'Vendor' && cell3.toLowerCase().endsWith('totals:')) {
      if (currentVendor) {
        const invoiceCount = parseInt(g(row, C.invoiceCount)) || currentVendor.invoices.length;
        currentVendor.totals = {
          balance: parseNum(g(row, C.balance)),
          current: parseNum(g(row, C.current)),
          over30: parseNum(g(row, C.over30)),
          over60: parseNum(g(row, C.over60)),
          over90: parseNum(g(row, C.over90)),
          over120: parseNum(g(row, C.over120)),
          invoiceCount,
        };
        vendors.push(currentVendor);
      }
      currentVendor = null;
      i++;
      continue;
    }

    // Vendor header row: col0 has vendor code, col1 empty, col4 has vendor name
    if (cell0 && !cell1 && !cell0.startsWith('____')) {
      const vendorName = g(row, C.vendorName) || cell0;
      currentVendor = {
        code: cell0,
        name: vendorName,
        invoices: [],
        totals: { balance: 0, current: 0, over30: 0, over60: 0, over90: 0, over120: 0, invoiceCount: 0 },
      };
      i++;
      continue;
    }

    // Invoice detail row: col1 has voucher number (numeric), col11 has balance ($)
    if (currentVendor && cell1 && /^\d+$/.test(cell1) && g(row, C.balance).startsWith('$')) {
      const voucherNum = cell1;
      const invoiceDate = g(row, C.invDate);
      const glDate = g(row, C.glDate);
      const dueDate = g(row, C.dueDate);
      const balance = parseNum(g(row, C.balance));
      const current = parseNum(g(row, C.current));
      const over30 = parseNum(g(row, C.over30));
      const over60 = parseNum(g(row, C.over60));
      const over90 = parseNum(g(row, C.over90));
      const over120 = parseNum(g(row, C.over120));

      // Invoice number is on the next sub-row at col3 (col1 is empty on sub-rows)
      let invoiceNum = '';
      if (i + 1 < parsed.length) {
        const next = parsed[i + 1];
        if (!g(next, 1) && g(next, C.invDate)) {
          invoiceNum = g(next, C.invDate);
          i += 2;
        } else {
          i++;
        }
      } else {
        i++;
      }

      currentVendor.invoices.push({
        voucherNum, invoiceNum, invoiceDate, glDate, dueDate, addrCode: '',
        poNumber: '',
        balance, current, over30, over60, over90, over120,
      });
      continue;
    }

    i++;
  }

  // Flush last vendor if file ended without a totals row
  if (currentVendor && currentVendor.invoices.length > 0) {
    currentVendor.totals = {
      balance: currentVendor.invoices.reduce((s, v) => s + v.balance, 0),
      current: currentVendor.invoices.reduce((s, v) => s + v.current, 0),
      over30: currentVendor.invoices.reduce((s, v) => s + v.over30, 0),
      over60: currentVendor.invoices.reduce((s, v) => s + v.over60, 0),
      over90: currentVendor.invoices.reduce((s, v) => s + v.over90, 0),
      over120: currentVendor.invoices.reduce((s, v) => s + v.over120, 0),
      invoiceCount: currentVendor.invoices.length,
    };
    vendors.push(currentVendor);
  }

  return { reportDate, vendors };
}

// ── Summary Cards ─────────────────────────────────────────────────────────

function SummaryCards({ vendors, reportDate }: { vendors: APVendor[]; reportDate: string }) {
  const total = vendors.reduce((s, v) => s + v.totals.balance, 0);
  const current = vendors.reduce((s, v) => s + v.totals.current, 0);
  const over30 = vendors.reduce((s, v) => s + v.totals.over30, 0);
  const over60 = vendors.reduce((s, v) => s + v.totals.over60, 0);
  const over90 = vendors.reduce((s, v) => s + v.totals.over90, 0);
  const over120 = vendors.reduce((s, v) => s + v.totals.over120, 0);
  const past = over30 + over60 + over90 + over120;
  const vendorCount = vendors.length;

  const cards = [
    { label: 'Total AP Balance', value: fmt(total), icon: <FileText className="w-4 h-4" />, color: '#C8A96E' },
    { label: 'Current', value: fmt(current), icon: <AlertTriangle className="w-4 h-4" />, color: '#4ADE80' },
    { label: 'Past Due (30+)', value: fmt(past), icon: <AlertTriangle className="w-4 h-4" />, color: '#FCD34D' },
    { label: 'Over 90 Days', value: fmt(over90 + over120), icon: <AlertTriangle className="w-4 h-4" />, color: '#F87171' },
    { label: 'Vendors', value: vendorCount.toString(), icon: <Building2 className="w-4 h-4" />, color: '#A8C5DA' },
  ];

  return (
    <div className="flex-shrink-0">
      <div className="px-6 py-3 flex items-center gap-4" style={{ borderBottom: '1px solid #1E1C1A' }}>
        <span className="text-xs" style={{ color: '#6B6865' }}>Report date: {reportDate}</span>
        <span className="text-xs" style={{ color: '#4A4844' }}>·</span>
        <span className="text-xs" style={{ color: '#6B6865' }}>{vendorCount} vendors</span>
      </div>
      <div className="grid grid-cols-5 gap-3 px-6 py-4">
        {cards.map(c => (
          <div key={c.label} className="rounded-xl p-4" style={{ background: '#141210', border: '1px solid #2C2A27' }}>
            <div className="flex items-center gap-2 mb-2">
              <span style={{ color: c.color }}>{c.icon}</span>
              <span className="text-xs" style={{ color: '#6B6865' }}>{c.label}</span>
            </div>
            <div className="text-lg font-bold" style={{ color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Vendor Row ─────────────────────────────────────────────────────────────

function VendorRow({ vendor }: { vendor: APVendor }) {
  const [open, setOpen] = useState(false);
  const t = vendor.totals;
  const hasAging = t.over30 > 0 || t.over60 > 0 || t.over90 > 0 || t.over120 > 0;

  return (
    <div className="border-b" style={{ borderColor: '#1A1917' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-6 py-3 text-left transition-colors hover:bg-white/[0.02]"
      >
        <span style={{ color: '#4A4844', flexShrink: 0 }}>
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate" style={{ color: '#F5F3EE' }}>{vendor.name}</span>
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#1E1C1A', color: '#6B6865', border: '1px solid #262422', flexShrink: 0 }}>
              {vendor.code}
            </span>
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#4A4844' }}>
            {t.invoiceCount} invoice{t.invoiceCount !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="flex items-center gap-6 flex-shrink-0">
          {hasAging && (
            <div className="flex items-center gap-3 text-xs">
              {t.over30 > 0 && <span style={{ color: agingColor('over30') }}>30+ {fmt(t.over30)}</span>}
              {t.over60 > 0 && <span style={{ color: agingColor('over60') }}>60+ {fmt(t.over60)}</span>}
              {t.over90 > 0 && <span style={{ color: agingColor('over90') }}>90+ {fmt(t.over90)}</span>}
              {t.over120 > 0 && <span style={{ color: agingColor('over120') }}>120+ {fmt(t.over120)}</span>}
            </div>
          )}
          <div className="text-right" style={{ minWidth: '90px' }}>
            <div className="text-xs" style={{ color: '#6B6865' }}>Balance</div>
            <div className="text-sm font-semibold" style={{ color: t.balance < 0 ? '#4ADE80' : '#F5F3EE' }}>{fmt(t.balance)}</div>
          </div>
        </div>
      </button>

      {open && (
        <div className="px-6 pb-4">
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2C2A27' }}>
            <div className="grid text-xs font-medium py-2 px-3" style={{
              gridTemplateColumns: '80px 1fr 90px 90px 90px 110px 110px 110px 110px 110px',
              background: '#1A1917', color: '#6B6865', borderBottom: '1px solid #2C2A27',
            }}>
              <span>Voucher</span>
              <span>Invoice #</span>
              <span>Inv Date</span>
              <span>GL Date</span>
              <span>Due Date</span>
              <span className="text-right">Balance</span>
              <span className="text-right">Current</span>
              <span className="text-right pr-1" style={{ color: agingColor('over30') }}>30+</span>
              <span className="text-right pr-1" style={{ color: agingColor('over60') }}>60+</span>
              <span className="text-right pr-1" style={{ color: agingColor('over90') }}>90+</span>
            </div>
            {vendor.invoices.map((inv, idx) => (
              <div key={idx} className="grid text-xs py-2 px-3 border-b last:border-0" style={{
                gridTemplateColumns: '80px 1fr 90px 90px 90px 110px 110px 110px 110px 110px',
                borderColor: '#1A1917',
                background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
              }}>
                <span style={{ color: '#9A9690', fontFamily: 'monospace' }}>{inv.voucherNum}</span>
                <span className="truncate pr-2" style={{ color: '#C0BDB7' }}>{inv.invoiceNum}</span>
                <span style={{ color: '#6B6865' }}>{inv.invoiceDate}</span>
                <span style={{ color: '#6B6865' }}>{inv.glDate}</span>
                <span style={{ color: inv.dueDate < new Date().toLocaleDateString('en-US') ? '#F87171' : '#6B6865' }}>{inv.dueDate}</span>
                <span className="text-right font-medium" style={{ color: inv.balance < 0 ? '#4ADE80' : '#C8C4BC' }}>{fmt(inv.balance)}</span>
                <span className="text-right" style={{ color: inv.current !== 0 ? agingColor('current') : '#4A4844' }}>{inv.current !== 0 ? fmt(inv.current) : '—'}</span>
                <span className="text-right" style={{ color: inv.over30 !== 0 ? agingColor('over30') : '#4A4844' }}>{inv.over30 !== 0 ? fmt(inv.over30) : '—'}</span>
                <span className="text-right" style={{ color: inv.over60 !== 0 ? agingColor('over60') : '#4A4844' }}>{inv.over60 !== 0 ? fmt(inv.over60) : '—'}</span>
                <span className="text-right" style={{ color: (inv.over90 !== 0 || inv.over120 !== 0) ? agingColor('over90') : '#4A4844' }}>
                  {(inv.over90 !== 0 || inv.over120 !== 0) ? fmt(inv.over90 + inv.over120) : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Totals Row ─────────────────────────────────────────────────────────────

function TotalsRow({ vendors }: { vendors: APVendor[] }) {
  const t = {
    balance: vendors.reduce((s, v) => s + v.totals.balance, 0),
    current: vendors.reduce((s, v) => s + v.totals.current, 0),
    over30: vendors.reduce((s, v) => s + v.totals.over30, 0),
    over60: vendors.reduce((s, v) => s + v.totals.over60, 0),
    over90: vendors.reduce((s, v) => s + v.totals.over90, 0),
    over120: vendors.reduce((s, v) => s + v.totals.over120, 0),
  };

  return (
    <div className="flex items-center gap-8 px-6 py-3 sticky bottom-0" style={{ background: '#1A1917', borderTop: '1px solid #2C2A27' }}>
      <span className="text-xs font-semibold" style={{ color: '#9A9690' }}>TOTALS</span>
      <div className="flex items-center gap-6 text-xs">
        {[
          { k: 'Balance', v: t.balance, c: '#F5F3EE' },
          { k: 'Current', v: t.current, c: agingColor('current') },
          { k: '30+', v: t.over30, c: agingColor('over30') },
          { k: '60+', v: t.over60, c: agingColor('over60') },
          { k: '90+', v: t.over90, c: agingColor('over90') },
          { k: '120+', v: t.over120, c: agingColor('over120') },
        ].map(({ k, v, c }) => (
          <div key={k}>
            <div style={{ color: '#4A4844' }}>{k}</div>
            <div className="font-semibold" style={{ color: c }}>{fmt(v)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

interface APReportProps {
  tabId: string;
  uploaderName: string;
}

export default function APReport({ tabId, uploaderName }: APReportProps) {
  const [report, setReport] = useState<APReportData | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [lockToggling, setLockToggling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [search, setSearch] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadReport = useCallback(async () => {
    const { data } = await supabase
      .from('ap_reports')
      .select('id, report_date, report_data, locked')
      .eq('tab_id', tabId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setReport({ reportDate: data.report_date, vendors: data.report_data as APVendor[] });
      setReportId(data.id);
      setLocked(data.locked ?? false);
    }
    setLoading(false);
  }, [tabId]);

  useEffect(() => { loadReport(); }, [loadReport]);

  async function pullFromMcLeod() {
    if (locked) return;
    setError(null);
    setPulling(true);
    try {
      const res = await fetch(`${MCLEOD_FN}?report=ap`, { headers: MCLEOD_HEADERS });
      if (!res.ok) throw new Error(`McLeod pull failed: ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const parsed = mapMcleodAP(json.rows ?? []);
      if (!parsed.vendors.length) { setError('No AP data returned from McLeod.'); setPulling(false); return; }

      await supabase.from('ap_reports').delete().eq('tab_id', tabId);
      const { data: inserted } = await supabase.from('ap_reports').insert({
        tab_id: tabId,
        report_date: parsed.reportDate,
        report_data: parsed.vendors,
        uploaded_by: uploaderName,
        locked: false,
      }).select('id').single();

      setReport(parsed);
      setReportId(inserted?.id ?? null);
      setLocked(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to pull from McLeod.');
    } finally {
      setPulling(false);
    }
  }

  async function handleFile(file: File) {
    if (locked) return;
    setError(null);
    setUploading(true);
    try {
      const isCsv = file.name.toLowerCase().endsWith('.csv');
      const isXlsx = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
      if (!isCsv && !isXlsx) {
        setError('Please upload a CSV or Excel (.xlsx) file.');
        setUploading(false);
        return;
      }

      let parsed: APReportData;
      if (isCsv) {
        const text = await file.text();
        parsed = parseAPCsv(text);
      } else {
        const { default: XLSX } = await import('xlsx');
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const csvText = XLSX.utils.sheet_to_csv(ws);
        parsed = parseAPCsv(csvText);
      }

      if (!parsed.vendors.length) {
        setError('No vendor data found in the file. Please verify the format.');
        setUploading(false);
        return;
      }

      // Replace existing report
      await supabase.from('ap_reports').delete().eq('tab_id', tabId);
      const { data: inserted } = await supabase
        .from('ap_reports')
        .insert({
          tab_id: tabId,
          report_date: parsed.reportDate,
          report_data: parsed.vendors,
          uploaded_by: uploaderName,
          locked: false,
        })
        .select('id')
        .single();

      setReport(parsed);
      setReportId(inserted?.id ?? null);
      setLocked(false);
    } catch (e) {
      setError('Failed to parse file. Please check the format.');
      console.error(e);
    }
    setUploading(false);
  }

  async function toggleLock() {
    if (!reportId) return;
    setLockToggling(true);
    try {
      const next = !locked;
      const { error: err } = await supabase
        .from('ap_reports')
        .update({ locked: next })
        .eq('id', reportId);

      if (err) {
        console.error('Lock toggle failed:', err);
      } else {
        setLocked(next);
      }
    } finally {
      setLockToggling(false);
    }
  }

  const filtered = report
    ? report.vendors.filter(v =>
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        v.code.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: '#2C2A27', borderTopColor: '#C8A96E' }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#0F0E0C' }}>
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #1E1C1A', background: '#0F0E0C' }}>
        <div>
          <h1 className="text-base font-bold" style={{ color: '#F5F3EE' }}>Accounts Payable</h1>
          {report && <p className="text-xs mt-0.5" style={{ color: '#6B6865' }}>Report date: {report.reportDate} · {report.vendors.length} vendors</p>}
        </div>
        <div className="flex items-center gap-2">
          {report && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#4A4844' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search vendors..."
                className="pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none"
                style={{ background: '#1A1917', border: '1px solid #2C2A27', color: '#F5F3EE', width: '200px' }}
              />
            </div>
          )}
          {report && !locked && (
            <button
              onClick={toggleLock}
              disabled={lockToggling}
              title="Lock report"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              style={{ background: '#1A1917', color: '#9A9690', border: '1px solid #2C2A27' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#2A1010'; e.currentTarget.style.color = '#FCA5A5'; e.currentTarget.style.borderColor = '#7F1D1D'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#1A1917'; e.currentTarget.style.color = '#9A9690'; e.currentTarget.style.borderColor = '#2C2A27'; }}
            >
              {lockToggling
                ? <div className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: '#4A4844', borderTopColor: '#9A9690' }} />
                : <><Unlock className="w-3 h-3" strokeWidth={2} />Lock</>}
            </button>
          )}
          {report && locked && (
            <button
              onClick={toggleLock}
              disabled={lockToggling}
              title="Unlock report"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              style={{ background: '#2A1010', color: '#EF4444', border: '1px solid #7F1D1D' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#1A2A1A'; e.currentTarget.style.color = '#4ADE80'; e.currentTarget.style.borderColor = '#166534'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#2A1010'; e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.borderColor = '#7F1D1D'; }}
            >
              {lockToggling
                ? <div className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: '#7F1D1D', borderTopColor: '#EF4444' }} />
                : <><Lock className="w-3 h-3" strokeWidth={2} />Locked — Unlock</>}
            </button>
          )}
          {!locked && (
            <button
              onClick={pullFromMcLeod}
              disabled={pulling || uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              style={{ background: '#1A2A1A', color: '#4ADE80', border: '1px solid #166534' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#1E3A1E'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#1A2A1A'; }}
            >
              {pulling
                ? <><div className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: '#166534', borderTopColor: '#4ADE80' }} />Pulling…</>
                : <><RefreshCw className="w-3 h-3" />Pull from McLeod</>}
            </button>
          )}
          {!locked && (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: '#1A1917', border: '1px solid #2C2A27', color: uploading ? '#4A4844' : '#C8A96E' }}
            >
              <Upload className="w-3 h-3" />
              {uploading ? 'Uploading...' : 'Upload Report'}
            </button>
          )}
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ''; }} />
        </div>
      </div>

      {error && (
        <div className="flex-shrink-0 mx-6 mt-3 px-4 py-2 rounded-lg text-xs" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#F87171' }}>
          {error}
        </div>
      )}

      {/* No report yet — drop zone */}
      {!report && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div
            className="w-full max-w-md rounded-2xl p-12 flex flex-col items-center gap-4 transition-colors cursor-pointer"
            style={{
              border: `2px dashed ${dragOver ? '#C8A96E' : '#2C2A27'}`,
              background: dragOver ? 'rgba(200,169,110,0.04)' : '#141210',
            }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => fileRef.current?.click()}
          >
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: '#1A1917', border: '1px solid #2C2A27' }}>
              <Upload className="w-6 h-6" style={{ color: '#C8A96E' }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: '#F5F3EE' }}>Upload AP Report</p>
              <p className="text-xs mt-1" style={{ color: '#6B6865' }}>Drag & drop or click to select</p>
              <p className="text-xs mt-0.5" style={{ color: '#4A4844' }}>Supports CSV or Excel (.xlsx)</p>
            </div>
          </div>
        </div>
      )}

      {/* Report content */}
      {report && (
        <>
          <SummaryCards vendors={report.vendors} reportDate={report.reportDate} />
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#2C2A27 transparent' }}>
            {filtered.length === 0 && search ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-sm" style={{ color: '#4A4844' }}>No vendors match "{search}"</p>
              </div>
            ) : (
              filtered.map(v => <VendorRow key={v.code} vendor={v} />)
            )}
          </div>
          <TotalsRow vendors={filtered.length > 0 ? filtered : report.vendors} />
        </>
      )}
    </div>
  );
}
