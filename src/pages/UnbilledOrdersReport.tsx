import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, ChevronDown, ChevronRight, AlertTriangle,
  Lock, Unlock, Search, X, Truck, MapPin, User,
  FileText, DollarSign, Clock,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────

export interface UBOMovement {
  movementNum: string;
  origin: string;
  destination: string;
  tractorNum: string;
  driver: string;
  carrier: string;
  carrierContact: string;
  carrierPay: number;
  carrierPhone: string;
  dispatcher: string;
  carrierEmail: string;
}

export interface UBOOrder {
  orderNum: string;
  schedShipDate: string;
  onHold: boolean;
  readyToBill: boolean;
  transferred: boolean;
  customerCode: string;
  customerName: string;
  totalCharges: number;
  revCode: string;
  ageSinceDelivery: number | null;
  movements: UBOMovement[];
}

export interface UBOReportData {
  reportDate: string;
  orders: UBOOrder[];
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

function parseBool(v: string): boolean {
  return v.toLowerCase() === 'yes';
}

function ageColor(age: number | null): string {
  if (age == null) return '#6B6865';
  if (age > 90) return '#EF4444';
  if (age > 60) return '#F87171';
  if (age > 30) return '#FB923C';
  if (age > 0) return '#FCD34D';
  return '#4ADE80';
}

// ── CSV Parser ─────────────────────────────────────────────────────────────
// Column layout confirmed from the CSV:
//
// Order header row (col1 = order# numeric):
//   col1=orderNum, col4=schedShipDate, col5=onHold, col6=readyToBill,
//   col8=transferred, col11=customerCode+name, col13=totalCharges,
//   col15=revCode, col16=ageSinceDelivery
//
// Movement row (col1 empty, col2 = movement# numeric):
//   col2=movementNum, col4=origin, col5=destination, col6=tractorNum,
//   col8=driver, col9=carrier, col12=carrierContact, col13=totalCarrierPay,
//   col15=carrierPhone, col16=dispatcher, col17=carrierEmail

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

function g(row: string[], idx: number): string {
  return (row[idx] ?? '').trim();
}

function splitCustomer(raw: string): { code: string; name: string } {
  // "M-FRGFND - FreightEx Freight Services, LLC"
  const m = raw.match(/^([A-Z0-9]+-[A-Z0-9]+)\s+-\s+(.+)$/);
  if (m) return { code: m[1], name: m[2] };
  return { code: raw, name: raw };
}

export function parseUnbilledOrdersCsv(text: string): UBOReportData {
  const lines = text.split('\n').map(l => l.replace(/\r$/, ''));
  const parsed = lines.map(parseCsvLine);

  // Report date from first line
  let reportDate = '';
  const m = lines[0].match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
  if (m) reportDate = m[1];

  const orders: UBOOrder[] = [];
  let current: UBOOrder | null = null;

  // Skip header rows (first ~6 lines)
  // Data starts after "Status:,,,, Delivered" line
  let dataStart = 0;
  for (let i = 0; i < Math.min(20, parsed.length); i++) {
    if (parsed[i].join('').toLowerCase().includes('status:')) {
      dataStart = i + 1;
      break;
    }
  }

  for (let i = dataStart; i < parsed.length; i++) {
    const row = parsed[i];
    if (row.every(c => !c)) continue;

    const col0 = g(row, 0);
    const col1 = g(row, 1);
    const col2 = g(row, 2);
    const col3 = g(row, 3);

    // Footer: stop at totals/report totals
    if (/^report totals/i.test(col0) || /status.*totals/i.test(col3)) break;
    if (/^\d+$/.test(col0) && col3.toLowerCase().includes('totals')) break;

    // Order header row: col1 is numeric order#, col0 empty
    if (!col0 && /^\d{7}$/.test(col1)) {
      if (current) orders.push(current);
      const custRaw = g(row, 11);
      const { code, name } = splitCustomer(custRaw);
      current = {
        orderNum: col1,
        schedShipDate: g(row, 4),
        onHold: parseBool(g(row, 5)),
        readyToBill: parseBool(g(row, 6)),
        transferred: parseBool(g(row, 8)),
        customerCode: code,
        customerName: name,
        totalCharges: parseNum(g(row, 13)),
        revCode: g(row, 15),
        ageSinceDelivery: g(row, 16) ? parseInt(g(row, 16)) || null : null,
        movements: [],
      };
      continue;
    }

    // Movement row: col1 empty, col2 is numeric movement#
    if (current && !col1 && /^\d{6}$/.test(col2)) {
      current.movements.push({
        movementNum: col2,
        origin: g(row, 4),
        destination: g(row, 5),
        tractorNum: g(row, 6),
        driver: g(row, 8),
        carrier: g(row, 9),
        carrierContact: g(row, 12),
        carrierPay: parseNum(g(row, 13)),
        carrierPhone: g(row, 15),
        dispatcher: g(row, 16),
        carrierEmail: g(row, 17),
      });
      continue;
    }
  }

  if (current) orders.push(current);
  return { reportDate, orders };
}

// ── Summary Cards ──────────────────────────────────────────────────────────

function SummaryCards({ orders, reportDate }: { orders: UBOOrder[]; reportDate: string }) {
  const totalCharges = orders.reduce((s, o) => s + o.totalCharges, 0);
  const readyToBill = orders.filter(o => o.readyToBill).length;
  const onHold = orders.filter(o => o.onHold).length;
  const notReady = orders.filter(o => !o.readyToBill).length;
  const over30 = orders.filter(o => o.ageSinceDelivery != null && o.ageSinceDelivery > 30).length;

  const cards = [
    { label: 'Total Charges', value: fmt(totalCharges), icon: <DollarSign className="w-4 h-4" />, color: '#C8A96E' },
    { label: 'Total Orders', value: orders.length.toString(), icon: <FileText className="w-4 h-4" />, color: '#60A5FA' },
    { label: 'Ready to Bill', value: readyToBill.toString(), icon: <FileText className="w-4 h-4" />, color: '#4ADE80' },
    { label: 'Not Ready', value: notReady.toString(), icon: <AlertTriangle className="w-4 h-4" />, color: '#FCD34D' },
    { label: 'On Hold', value: onHold.toString(), icon: <Clock className="w-4 h-4" />, color: '#F87171' },
    { label: 'Age 30+ Days', value: over30.toString(), icon: <AlertTriangle className="w-4 h-4" />, color: '#EF4444' },
  ];

  return (
    <div className="flex-shrink-0">
      {reportDate && (
        <div className="px-6 py-3 flex items-center gap-4" style={{ borderBottom: '1px solid #1E1C1A' }}>
          <span className="text-xs" style={{ color: '#6B6865' }}>Report date: {reportDate}</span>
          <span className="text-xs" style={{ color: '#4A4844' }}>·</span>
          <span className="text-xs" style={{ color: '#6B6865' }}>{orders.length} orders</span>
        </div>
      )}
      <div className="grid grid-cols-6 gap-3 px-6 py-4">
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

// ── Order Row ──────────────────────────────────────────────────────────────

function OrderRow({ order }: { order: UBOOrder }) {
  const [open, setOpen] = useState(false);

  const statusBadges: { label: string; bg: string; color: string; border: string }[] = [];
  if (order.onHold) statusBadges.push({ label: 'On Hold', bg: '#2A1010', color: '#F87171', border: '#7F1D1D' });
  if (!order.readyToBill) statusBadges.push({ label: 'Not Ready', bg: '#2A200A', color: '#FCD34D', border: '#854D0E' });
  if (order.readyToBill) statusBadges.push({ label: 'Ready to Bill', bg: '#0A2A1A', color: '#4ADE80', border: '#166534' });

  return (
    <div className="border-b" style={{ borderColor: '#1A1917' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-6 py-3 text-left transition-colors hover:bg-white/[0.02]"
      >
        <span style={{ color: '#4A4844', flexShrink: 0 }}>
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </span>

        {/* Order # */}
        <div style={{ flexShrink: 0, minWidth: '72px' }}>
          <div className="text-xs font-mono font-semibold" style={{ color: '#C8A96E' }}>{order.orderNum}</div>
          <div className="text-xs" style={{ color: '#4A4844' }}>{order.revCode}</div>
        </div>

        {/* Customer */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate" style={{ color: '#F5F3EE' }}>{order.customerName}</div>
          <div className="text-xs" style={{ color: '#6B6865' }}>{order.customerCode} · Ship: {order.schedShipDate}</div>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {statusBadges.map(b => (
            <span key={b.label} className="text-xs px-1.5 py-0.5 rounded" style={{ background: b.bg, color: b.color, border: `1px solid ${b.border}` }}>
              {b.label}
            </span>
          ))}
        </div>

        {/* Age */}
        {order.ageSinceDelivery != null && (
          <div className="flex-shrink-0 text-right" style={{ minWidth: '52px' }}>
            <div className="text-xs" style={{ color: '#4A4844' }}>Age</div>
            <div className="text-sm font-semibold" style={{ color: ageColor(order.ageSinceDelivery) }}>{order.ageSinceDelivery}d</div>
          </div>
        )}

        {/* Total charges */}
        <div className="flex-shrink-0 text-right" style={{ minWidth: '90px' }}>
          <div className="text-xs" style={{ color: '#6B6865' }}>Charges</div>
          <div className="text-sm font-semibold" style={{ color: '#F5F3EE' }}>{fmt(order.totalCharges)}</div>
        </div>
      </button>

      {open && order.movements.length > 0 && (
        <div className="px-6 pb-4">
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2C2A27' }}>
            {/* Header */}
            <div
              className="grid text-xs font-medium py-2 px-3"
              style={{
                gridTemplateColumns: '80px 1fr 1fr 80px 1fr 1fr',
                background: '#1A1917', color: '#6B6865', borderBottom: '1px solid #2C2A27',
              }}
            >
              <span>Move #</span>
              <span>Origin</span>
              <span>Destination</span>
              <span>Tractor</span>
              <span>Driver / Carrier</span>
              <span className="text-right">Carrier Pay</span>
            </div>
            {order.movements.map((mv, idx) => (
              <div key={idx}>
                <div
                  className="grid text-xs py-2 px-3"
                  style={{
                    gridTemplateColumns: '80px 1fr 1fr 80px 1fr 1fr',
                    borderBottom: idx < order.movements.length - 1 ? '1px solid #1A1917' : 'none',
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                  }}
                >
                  <span style={{ color: '#9A9690', fontFamily: 'monospace' }}>{mv.movementNum}</span>
                  <span className="flex items-center gap-1 truncate pr-2" style={{ color: '#C0BDB7' }}>
                    <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: '#4A4844' }} />
                    {mv.origin || '—'}
                  </span>
                  <span className="flex items-center gap-1 truncate pr-2" style={{ color: '#C0BDB7' }}>
                    <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: '#4A4844' }} />
                    {mv.destination || '—'}
                  </span>
                  <span style={{ color: '#6B6865' }}>{mv.tractorNum || '—'}</span>
                  <div className="min-w-0">
                    {mv.driver && (
                      <div className="flex items-center gap-1 truncate">
                        <User className="w-3 h-3 flex-shrink-0" style={{ color: '#4A4844' }} />
                        <span style={{ color: '#9A9690' }}>{mv.driver}</span>
                      </div>
                    )}
                    {mv.carrier && (
                      <div className="flex items-center gap-1 truncate">
                        <Truck className="w-3 h-3 flex-shrink-0" style={{ color: '#4A4844' }} />
                        <span style={{ color: '#6B6865' }}>{mv.carrier}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    {mv.carrierPay > 0 ? (
                      <span className="font-medium" style={{ color: '#C8C4BC' }}>{fmt(mv.carrierPay)}</span>
                    ) : (
                      <span style={{ color: '#4A4844' }}>—</span>
                    )}
                    {mv.dispatcher && (
                      <div className="text-xs" style={{ color: '#4A4844' }}>{mv.dispatcher.split(' - ')[1] || mv.dispatcher}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Totals Bar ─────────────────────────────────────────────────────────────

function TotalsBar({ orders }: { orders: UBOOrder[] }) {
  const totalCharges = orders.reduce((s, o) => s + o.totalCharges, 0);
  const readyCharges = orders.filter(o => o.readyToBill).reduce((s, o) => s + o.totalCharges, 0);

  return (
    <div className="flex items-center gap-8 px-6 py-3 flex-shrink-0 sticky bottom-0" style={{ background: '#1A1917', borderTop: '1px solid #2C2A27' }}>
      <span className="text-xs font-semibold" style={{ color: '#9A9690' }}>TOTALS</span>
      <div className="flex items-center gap-6 text-xs">
        <div>
          <div style={{ color: '#4A4844' }}>Orders</div>
          <div className="font-semibold" style={{ color: '#60A5FA' }}>{orders.length}</div>
        </div>
        <div>
          <div style={{ color: '#4A4844' }}>Total Charges</div>
          <div className="font-semibold" style={{ color: '#C8A96E' }}>{fmt(totalCharges)}</div>
        </div>
        <div>
          <div style={{ color: '#4A4844' }}>Ready to Bill</div>
          <div className="font-semibold" style={{ color: '#4ADE80' }}>{fmt(readyCharges)}</div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

interface UnbilledOrdersReportProps {
  tabId: string;
  uploaderName: string;
}

export default function UnbilledOrdersReport({ tabId, uploaderName }: UnbilledOrdersReportProps) {
  const [report, setReport] = useState<UBOReportData | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [lockToggling, setLockToggling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'ready' | 'notready' | 'hold'>('all');
  const fileRef = useRef<HTMLInputElement>(null);

  const loadReport = useCallback(async () => {
    const { data } = await supabase
      .from('unbilled_orders_reports')
      .select('id, report_date, report_data, locked')
      .eq('tab_id', tabId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setReport({ reportDate: data.report_date, orders: data.report_data as UBOOrder[] });
      setReportId(data.id);
      setLocked(data.locked ?? false);
    }
    setLoading(false);
  }, [tabId]);

  useEffect(() => { loadReport(); }, [loadReport]);

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

      let parsed: UBOReportData;
      if (isCsv) {
        const text = await file.text();
        parsed = parseUnbilledOrdersCsv(text);
      } else {
        const { default: XLSX } = await import('xlsx');
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        parsed = parseUnbilledOrdersCsv(XLSX.utils.sheet_to_csv(ws));
      }

      if (!parsed.orders.length) {
        setError('No order data found in the file. Please verify the format.');
        setUploading(false);
        return;
      }

      await supabase.from('unbilled_orders_reports').delete().eq('tab_id', tabId);
      const { data: inserted } = await supabase
        .from('unbilled_orders_reports')
        .insert({
          tab_id: tabId,
          report_date: parsed.reportDate,
          report_data: parsed.orders,
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
        .from('unbilled_orders_reports')
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
    ? report.orders.filter(o => {
        const matchSearch =
          o.orderNum.includes(search) ||
          o.customerName.toLowerCase().includes(search.toLowerCase()) ||
          o.customerCode.toLowerCase().includes(search.toLowerCase());
        const matchFilter =
          filter === 'all' ? true :
          filter === 'ready' ? o.readyToBill :
          filter === 'notready' ? !o.readyToBill :
          filter === 'hold' ? o.onHold : true;
        return matchSearch && matchFilter;
      })
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
          <h1 className="text-base font-bold" style={{ color: '#F5F3EE' }}>Unbilled Orders</h1>
          {report && (
            <p className="text-xs mt-0.5" style={{ color: '#6B6865' }}>
              {report.reportDate ? `Report date: ${report.reportDate} · ` : ''}{report.orders.length} orders
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {report && (
            <>
              {/* Filter pills */}
              <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: '#141210', border: '1px solid #2C2A27' }}>
                {(['all', 'ready', 'notready', 'hold'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className="px-2.5 py-1 rounded text-xs font-medium transition-colors"
                    style={{
                      background: filter === f ? '#2C2A27' : 'transparent',
                      color: filter === f ? '#F5F3EE' : '#6B6865',
                    }}
                  >
                    {f === 'all' ? 'All' : f === 'ready' ? 'Ready' : f === 'notready' ? 'Not Ready' : 'On Hold'}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#4A4844' }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search orders..."
                  className="pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none"
                  style={{ background: '#1A1917', border: '1px solid #2C2A27', color: '#F5F3EE', width: '180px' }}
                />
              </div>
            </>
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
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: '#1A1917', border: '1px solid #2C2A27', color: uploading ? '#4A4844' : '#C8A96E' }}
            >
              <Upload className="w-3 h-3" />
              {uploading ? 'Uploading...' : report ? 'Replace Report' : 'Upload Report'}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ''; }}
          />
        </div>
      </div>

      {error && (
        <div className="flex-shrink-0 mx-6 mt-3 flex items-start gap-3 px-4 py-2 rounded-lg text-xs" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#F87171' }}>
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} style={{ color: '#6B6865' }}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Drop zone */}
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
              <p className="text-sm font-medium" style={{ color: '#F5F3EE' }}>Upload Unbilled Orders Report</p>
              <p className="text-xs mt-1" style={{ color: '#6B6865' }}>Drag & drop or click to select</p>
              <p className="text-xs mt-0.5" style={{ color: '#4A4844' }}>Supports CSV or Excel (.xlsx)</p>
            </div>
          </div>
        </div>
      )}

      {/* Report content */}
      {report && (
        <>
          <SummaryCards orders={report.orders} reportDate={report.reportDate} />
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#2C2A27 transparent' }}>
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-sm" style={{ color: '#4A4844' }}>
                  {search ? `No orders match "${search}"` : 'No orders in this filter.'}
                </p>
              </div>
            ) : (
              filtered.map(o => <OrderRow key={o.orderNum} order={o} />)
            )}
          </div>
          <TotalsBar orders={filtered} />
        </>
      )}
    </div>
  );
}
