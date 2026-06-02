import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, ChevronDown, ChevronRight, AlertTriangle,
  Lock, Unlock, Search, Users, FileText, Phone, Mail,
  DollarSign, X, RefreshCw,
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

function mcleodAgeDays(dateStr: string | null | undefined): number | null {
  if (!dateStr || dateStr.length < 8) return null;
  const y = parseInt(dateStr.slice(0, 4));
  const mo = parseInt(dateStr.slice(4, 6)) - 1;
  const d = parseInt(dateStr.slice(6, 8));
  return Math.floor((new Date().getTime() - new Date(y, mo, d).getTime()) / 86400000);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMcleodCollections(rows: any[]): CollReportData {
  const today = new Date().toLocaleDateString('en-US');
  const custMap = new Map<string, CollCustomer>();

  for (const row of rows) {
    const custId: string = row.customer_id ?? '';
    const custName: string = row.customer_id_row?.name ?? custId;
    const amount = parseFloat(row.amount) || 0;
    const days = mcleodAgeDays(row.bill_date);

    let current = 0, over30 = 0, over60 = 0, over90 = 0, over120 = 0;
    if (days == null || days <= 30) current = amount;
    else if (days <= 60) over30 = amount;
    else if (days <= 90) over60 = amount;
    else if (days <= 120) over90 = amount;
    else over120 = amount;

    if (!custMap.has(custId)) {
      custMap.set(custId, {
        code: custId,
        name: custName,
        contact: '',
        phone: row.customer_id_row?.phone ?? '',
        email: '',
        invoices: [],
        totals: { balance: 0, current: 0, over30: 0, over60: 0, over90: 0, over120: 0, invoiceCount: 0 },
      });
    }
    const cust = custMap.get(custId)!;
    cust.invoices.push({
      invoiceNum: row.invoice_no_string ?? row.invoice_id ?? '',
      invoiceDate: parseMcleodDate(row.bill_date),
      dueDate: '',
      orderNum: row.order_id ?? '',
      amount,
      balance: amount,
      current, over30, over60, over90, over120,
    });
  }

  const customers = Array.from(custMap.values()).map(c => {
    c.totals = {
      balance: c.invoices.reduce((s, i) => s + i.balance, 0),
      current: c.invoices.reduce((s, i) => s + i.current, 0),
      over30: c.invoices.reduce((s, i) => s + i.over30, 0),
      over60: c.invoices.reduce((s, i) => s + i.over60, 0),
      over90: c.invoices.reduce((s, i) => s + i.over90, 0),
      over120: c.invoices.reduce((s, i) => s + i.over120, 0),
      invoiceCount: c.invoices.length,
    };
    return c;
  }).filter(c => c.totals.balance > 0).sort((a, b) => b.totals.balance - a.totals.balance);

  return { reportDate: today, customers };
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface CollInvoice {
  invoiceNum: string;
  invoiceDate: string;
  dueDate: string;
  orderNum: string;
  amount: number;
  balance: number;
  current: number;
  over30: number;
  over60: number;
  over90: number;
  over120: number;
}

export interface CollCustomer {
  code: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  invoices: CollInvoice[];
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

export interface CollReportData {
  reportDate: string;
  customers: CollCustomer[];
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
  return idx >= 0 ? (row[idx] ?? '').trim() : '';
}

// Column index map populated from the CSV header row
interface ColMap {
  customerCode: number;
  customerName: number;
  contact: number;
  phone: number;
  email: number;
  invoiceNum: number;
  invoiceDate: number;
  dueDate: number;
  orderNum: number;
  amount: number;
  balance: number;
  current: number;
  over30: number;
  over60: number;
  over90: number;
  over120: number;
}

function buildColMap(header: string[]): ColMap {
  const m: ColMap = {
    customerCode: -1, customerName: -1, contact: -1, phone: -1, email: -1,
    invoiceNum: -1, invoiceDate: -1, dueDate: -1, orderNum: -1,
    amount: -1, balance: -1, current: -1, over30: -1, over60: -1, over90: -1, over120: -1,
  };
  header.forEach((cell, i) => {
    const c = cell.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (c === 'custno' || c === 'customercode' || c === 'custcode' || c === 'cust' || c === 'code') m.customerCode = i;
    else if (c === 'custname' || c === 'customername' || c === 'customer' || c === 'name') m.customerName = i;
    else if (c === 'contact' || c === 'contactname' || c === 'payablescontact') m.contact = i;
    else if (c === 'phone' || c === 'telephone' || c === 'tel') m.phone = i;
    else if (c === 'email' || c === 'emailaddress') m.email = i;
    else if (c === 'invoiceno' || c === 'invoicenum' || c === 'invoice' || c === 'invoicenumber' || c === 'inv') m.invoiceNum = i;
    else if (c === 'invoicedate' || c === 'invdate' || c === 'date') m.invoiceDate = i;
    else if (c === 'duedate' || c === 'due') m.dueDate = i;
    else if (c === 'orderno' || c === 'ordernum' || c === 'order' || c === 'po' || c === 'ponumber') m.orderNum = i;
    else if (c === 'amount' || c === 'invoiceamt' || c === 'invamt') m.amount = i;
    else if (c === 'balance' || c === 'openbalance' || c === 'openamt') m.balance = i;
    else if (c === 'current' || c === 'notdue' || c === 'current0') m.current = i;
    else if (c === 'over30' || c === '3060' || c === 'days3060' || c === '31to60' || c === 'past30' || c === 'past31') m.over30 = i;
    else if (c === 'over60' || c === '6090' || c === 'days6090' || c === '61to90' || c === 'past60' || c === 'past61') m.over60 = i;
    else if (c === 'over90' || c === '90120' || c === 'days90120' || c === '91to120' || c === 'past90' || c === 'past91') m.over90 = i;
    else if (c === 'over120' || c === 'over120days' || c === 'past120' || c === 'days120') m.over120 = i;
  });
  return m;
}

// Fallback: positional detection if header-based lookup finds nothing useful
// Typical LME collections CSV layout (no guaranteed header):
//   col0=custCode, col1=custName, col2=invoiceNo, col3=invoiceDate, col4=dueDate,
//   col5=amount, col6=balance, col7=current, col8=over30, col9=over60, col10=over90, col11=over120
function fallbackColMap(): ColMap {
  return {
    customerCode: 0, customerName: 1, contact: -1, phone: -1, email: -1,
    invoiceNum: 2, invoiceDate: 3, dueDate: 4, orderNum: -1,
    amount: 5, balance: 6, current: 7, over30: 8, over60: 9, over90: 10, over120: 11,
  };
}

export function parseCollectionsCsv(text: string): CollReportData {
  const lines = text.split('\n').map(l => l.replace(/\r$/, ''));
  const parsed = lines.map(parseCsvLine);

  // Extract report date from first 10 lines
  let reportDate = '';
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const m = lines[i].match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (m) { reportDate = m[1]; break; }
  }

  // Find header row (contains recognizable column names)
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(20, parsed.length); i++) {
    const joined = parsed[i].join('|').toLowerCase();
    if (
      joined.includes('cust') || joined.includes('invoice') ||
      joined.includes('balance') || joined.includes('over 30') ||
      joined.includes('over30') || joined.includes('current')
    ) {
      headerRowIdx = i;
      break;
    }
  }

  let colMap: ColMap;
  let dataStart: number;

  if (headerRowIdx >= 0) {
    colMap = buildColMap(parsed[headerRowIdx]);
    dataStart = headerRowIdx + 1;
    // If header detection didn't find key columns, try fallback
    if (colMap.balance < 0 && colMap.customerCode < 0) {
      colMap = fallbackColMap();
    }
  } else {
    colMap = fallbackColMap();
    dataStart = 0;
  }

  const customers: CollCustomer[] = [];
  const custMap = new Map<string, CollCustomer>();

  for (let i = dataStart; i < parsed.length; i++) {
    const row = parsed[i];
    if (row.every(c => !c.trim())) continue;
    if (row.join('').replace(/[,\s]/g, '') === '') continue;

    // Skip separator / totals / report footer lines
    const rowText = row.join('|');
    if (/^_{3,}/.test(rowText) || /report\s+total/i.test(rowText)) continue;
    if (row.some(c => c.includes('%'))) continue;

    const custCode = g(row, colMap.customerCode);
    const custName = g(row, colMap.customerName);
    const balance = colMap.balance >= 0 ? parseNum(g(row, colMap.balance)) : 0;
    const invoiceNum = colMap.invoiceNum >= 0 ? g(row, colMap.invoiceNum) : '';

    // Must have at least a customer code or invoice number to be a data row
    if (!custCode && !invoiceNum) continue;

    // Get or create customer
    const key = custCode || custName || `row-${i}`;
    if (!custMap.has(key)) {
      const cust: CollCustomer = {
        code: custCode,
        name: custName || custCode,
        contact: colMap.contact >= 0 ? g(row, colMap.contact) : '',
        phone: colMap.phone >= 0 ? g(row, colMap.phone) : '',
        email: colMap.email >= 0 ? g(row, colMap.email) : '',
        invoices: [],
        totals: { balance: 0, current: 0, over30: 0, over60: 0, over90: 0, over120: 0, invoiceCount: 0 },
      };
      custMap.set(key, cust);
      customers.push(cust);
    }

    const cust = custMap.get(key)!;

    // Update contact info if blank and this row has it
    if (!cust.contact && colMap.contact >= 0) cust.contact = g(row, colMap.contact);
    if (!cust.phone && colMap.phone >= 0) cust.phone = g(row, colMap.phone);
    if (!cust.email && colMap.email >= 0) cust.email = g(row, colMap.email);

    if (invoiceNum || balance !== 0) {
      const inv: CollInvoice = {
        invoiceNum: invoiceNum || '—',
        invoiceDate: colMap.invoiceDate >= 0 ? g(row, colMap.invoiceDate) : '',
        dueDate: colMap.dueDate >= 0 ? g(row, colMap.dueDate) : '',
        orderNum: colMap.orderNum >= 0 ? g(row, colMap.orderNum) : '',
        amount: colMap.amount >= 0 ? parseNum(g(row, colMap.amount)) : balance,
        balance,
        current: colMap.current >= 0 ? parseNum(g(row, colMap.current)) : 0,
        over30: colMap.over30 >= 0 ? parseNum(g(row, colMap.over30)) : 0,
        over60: colMap.over60 >= 0 ? parseNum(g(row, colMap.over60)) : 0,
        over90: colMap.over90 >= 0 ? parseNum(g(row, colMap.over90)) : 0,
        over120: colMap.over120 >= 0 ? parseNum(g(row, colMap.over120)) : 0,
      };
      cust.invoices.push(inv);
    }
  }

  // Compute totals from invoices
  for (const c of customers) {
    c.totals = {
      balance: c.invoices.reduce((s, v) => s + v.balance, 0),
      current: c.invoices.reduce((s, v) => s + v.current, 0),
      over30: c.invoices.reduce((s, v) => s + v.over30, 0),
      over60: c.invoices.reduce((s, v) => s + v.over60, 0),
      over90: c.invoices.reduce((s, v) => s + v.over90, 0),
      over120: c.invoices.reduce((s, v) => s + v.over120, 0),
      invoiceCount: c.invoices.length,
    };
  }

  // Remove customers with no meaningful data
  return {
    reportDate,
    customers: customers.filter(c => c.totals.balance !== 0 || c.invoices.length > 0),
  };
}

// ── Summary Cards ──────────────────────────────────────────────────────────

function SummaryCards({ customers, reportDate }: { customers: CollCustomer[]; reportDate: string }) {
  const total = customers.reduce((s, c) => s + c.totals.balance, 0);
  const current = customers.reduce((s, c) => s + c.totals.current, 0);
  const over30 = customers.reduce((s, c) => s + c.totals.over30, 0);
  const over60 = customers.reduce((s, c) => s + c.totals.over60, 0);
  const over90 = customers.reduce((s, c) => s + c.totals.over90, 0);
  const over120 = customers.reduce((s, c) => s + c.totals.over120, 0);
  const pastDue = over30 + over60 + over90 + over120;

  const cards = [
    { label: 'Total Balance', value: fmt(total), icon: <DollarSign className="w-4 h-4" />, color: '#C8A96E' },
    { label: 'Current', value: fmt(current), icon: <FileText className="w-4 h-4" />, color: '#4ADE80' },
    { label: 'Past Due (30+)', value: fmt(pastDue), icon: <AlertTriangle className="w-4 h-4" />, color: '#FCD34D' },
    { label: 'Over 90 Days', value: fmt(over90 + over120), icon: <AlertTriangle className="w-4 h-4" />, color: '#F87171' },
    { label: 'Customers', value: customers.length.toString(), icon: <Users className="w-4 h-4" />, color: '#60A5FA' },
  ];

  return (
    <div className="flex-shrink-0">
      <div className="px-6 py-3 flex items-center gap-4" style={{ borderBottom: '1px solid #1E1C1A' }}>
        {reportDate && <span className="text-xs" style={{ color: '#6B6865' }}>Report date: {reportDate}</span>}
        {reportDate && <span className="text-xs" style={{ color: '#4A4844' }}>·</span>}
        <span className="text-xs" style={{ color: '#6B6865' }}>{customers.length} customers</span>
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

// ── Customer Row ───────────────────────────────────────────────────────────

function CustomerRow({ customer }: { customer: CollCustomer }) {
  const [open, setOpen] = useState(false);
  const t = customer.totals;
  const hasAging = t.over30 > 0 || t.over60 > 0 || t.over90 > 0 || t.over120 > 0;
  const isCredit = t.balance < 0;

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
            <span className="text-sm font-medium truncate" style={{ color: '#F5F3EE' }}>{customer.name}</span>
            {customer.code && customer.code !== customer.name && (
              <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: '#1E1C1A', color: '#6B6865', border: '1px solid #262422' }}>
                {customer.code}
              </span>
            )}
            {isCredit && (
              <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: '#0A2A1A', color: '#4ADE80', border: '1px solid #166534' }}>Credit</span>
            )}
            {hasAging && !isCredit && (
              <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: '#2A1A0A', color: '#FB923C', border: '1px solid #92400E' }}>Past Due</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {customer.contact && (
              <span className="text-xs flex items-center gap-1" style={{ color: '#4A4844' }}>
                <Users className="w-3 h-3" />{customer.contact}
              </span>
            )}
            {customer.phone && (
              <span className="text-xs flex items-center gap-1" style={{ color: '#4A4844' }}>
                <Phone className="w-3 h-3" />{customer.phone}
              </span>
            )}
            {customer.email && (
              <span className="text-xs flex items-center gap-1" style={{ color: '#4A4844' }}>
                <Mail className="w-3 h-3" />{customer.email}
              </span>
            )}
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
            <div className="text-sm font-semibold" style={{ color: isCredit ? '#4ADE80' : hasAging ? '#FB923C' : '#F5F3EE' }}>{fmt(t.balance)}</div>
          </div>
        </div>
      </button>

      {open && (
        <div className="px-6 pb-4">
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2C2A27' }}>
            <div
              className="grid text-xs font-medium py-2 px-3"
              style={{
                gridTemplateColumns: '1fr 90px 90px 100px 110px 110px 110px 110px 110px',
                background: '#1A1917', color: '#6B6865', borderBottom: '1px solid #2C2A27',
              }}
            >
              <span>Invoice #</span>
              <span>Inv Date</span>
              <span>Due Date</span>
              <span className="text-right">Balance</span>
              <span className="text-right">Current</span>
              <span className="text-right pr-1" style={{ color: agingColor('over30') }}>30+</span>
              <span className="text-right pr-1" style={{ color: agingColor('over60') }}>60+</span>
              <span className="text-right pr-1" style={{ color: agingColor('over90') }}>90+</span>
              <span className="text-right pr-1" style={{ color: agingColor('over120') }}>120+</span>
            </div>
            {customer.invoices.map((inv, idx) => (
              <div
                key={idx}
                className="grid text-xs py-2 px-3 border-b last:border-0"
                style={{
                  gridTemplateColumns: '1fr 90px 90px 100px 110px 110px 110px 110px 110px',
                  borderColor: '#1A1917',
                  background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                }}
              >
                <span className="truncate pr-2" style={{ color: '#C8A96E', fontFamily: 'monospace' }}>{inv.invoiceNum}</span>
                <span style={{ color: '#6B6865' }}>{inv.invoiceDate || '—'}</span>
                <span style={{ color: inv.dueDate && inv.dueDate < new Date().toLocaleDateString('en-US') ? '#F87171' : '#6B6865' }}>
                  {inv.dueDate || '—'}
                </span>
                <span className="text-right font-medium" style={{ color: inv.balance < 0 ? '#4ADE80' : '#C8C4BC' }}>{fmt(inv.balance)}</span>
                <span className="text-right" style={{ color: inv.current !== 0 ? agingColor('current') : '#4A4844' }}>{inv.current !== 0 ? fmt(inv.current) : '—'}</span>
                <span className="text-right" style={{ color: inv.over30 !== 0 ? agingColor('over30') : '#4A4844' }}>{inv.over30 !== 0 ? fmt(inv.over30) : '—'}</span>
                <span className="text-right" style={{ color: inv.over60 !== 0 ? agingColor('over60') : '#4A4844' }}>{inv.over60 !== 0 ? fmt(inv.over60) : '—'}</span>
                <span className="text-right" style={{ color: inv.over90 !== 0 ? agingColor('over90') : '#4A4844' }}>{inv.over90 !== 0 ? fmt(inv.over90) : '—'}</span>
                <span className="text-right" style={{ color: inv.over120 !== 0 ? agingColor('over120') : '#4A4844' }}>{inv.over120 !== 0 ? fmt(inv.over120) : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Totals Bar ─────────────────────────────────────────────────────────────

function TotalsBar({ customers }: { customers: CollCustomer[] }) {
  const t = {
    balance: customers.reduce((s, c) => s + c.totals.balance, 0),
    current: customers.reduce((s, c) => s + c.totals.current, 0),
    over30: customers.reduce((s, c) => s + c.totals.over30, 0),
    over60: customers.reduce((s, c) => s + c.totals.over60, 0),
    over90: customers.reduce((s, c) => s + c.totals.over90, 0),
    over120: customers.reduce((s, c) => s + c.totals.over120, 0),
  };

  return (
    <div className="flex items-center gap-8 px-6 py-3 flex-shrink-0 sticky bottom-0" style={{ background: '#1A1917', borderTop: '1px solid #2C2A27' }}>
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

interface CollectionsReportProps {
  tabId: string;
  uploaderName: string;
}

export default function CollectionsReport({ tabId, uploaderName }: CollectionsReportProps) {
  const [report, setReport] = useState<CollReportData | null>(null);
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
      .from('collections_reports')
      .select('id, report_date, report_data, locked')
      .eq('tab_id', tabId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setReport({ reportDate: data.report_date, customers: data.report_data as CollCustomer[] });
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
      const res = await fetch(`${MCLEOD_FN}?report=ar`, { headers: MCLEOD_HEADERS });
      if (!res.ok) throw new Error(`McLeod pull failed: ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const parsed = mapMcleodCollections(json.rows ?? []);
      if (!parsed.customers.length) { setError('No collections data returned from McLeod.'); setPulling(false); return; }

      await supabase.from('collections_reports').delete().eq('tab_id', tabId);
      const { data: inserted } = await supabase.from('collections_reports').insert({
        tab_id: tabId,
        report_date: parsed.reportDate,
        report_data: parsed.customers,
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

      let parsed: CollReportData;
      if (isCsv) {
        const text = await file.text();
        parsed = parseCollectionsCsv(text);
      } else {
        const { default: XLSX } = await import('xlsx');
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const csvText = XLSX.utils.sheet_to_csv(ws);
        parsed = parseCollectionsCsv(csvText);
      }

      if (!parsed.customers.length) {
        setError('No customer data found in the file. Please verify the format.');
        setUploading(false);
        return;
      }

      await supabase.from('collections_reports').delete().eq('tab_id', tabId);
      const { data: inserted } = await supabase
        .from('collections_reports')
        .insert({
          tab_id: tabId,
          report_date: parsed.reportDate,
          report_data: parsed.customers,
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
        .from('collections_reports')
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
    ? report.customers.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase())
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
          <h1 className="text-base font-bold" style={{ color: '#F5F3EE' }}>Collections</h1>
          {report && (
            <p className="text-xs mt-0.5" style={{ color: '#6B6865' }}>
              {report.reportDate ? `Report date: ${report.reportDate} · ` : ''}{report.customers.length} customers
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {report && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#4A4844' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search customers..."
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

      {/* Drop zone — no report yet */}
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
              <p className="text-sm font-medium" style={{ color: '#F5F3EE' }}>Upload Collections Report</p>
              <p className="text-xs mt-1" style={{ color: '#6B6865' }}>Drag & drop or click to select</p>
              <p className="text-xs mt-0.5" style={{ color: '#4A4844' }}>Supports CSV or Excel (.xlsx)</p>
            </div>
          </div>
        </div>
      )}

      {/* Report content */}
      {report && (
        <>
          <SummaryCards customers={report.customers} reportDate={report.reportDate} />
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#2C2A27 transparent' }}>
            {filtered.length === 0 && search ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-sm" style={{ color: '#4A4844' }}>No customers match "{search}"</p>
              </div>
            ) : (
              filtered.map((c, i) => <CustomerRow key={c.code || i} customer={c} />)
            )}
          </div>
          <TotalsBar customers={filtered.length > 0 ? filtered : report.customers} />
        </>
      )}
    </div>
  );
}
