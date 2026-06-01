import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, ChevronDown, ChevronRight, Phone, User, Clock, CreditCard, AlertTriangle, TrendingUp, X, Lock, Unlock } from 'lucide-react';
import { supabase } from '../lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ARInvoice {
  shipDate: string;
  billDate: string;
  glDate: string;
  order: string;
  age: number | null;
  amount: number;
  balance: number;
  current: number;
  over30: number;
  over45: number;
  over60: number;
  over90: number;
  lastCallDate: string;
}

export interface ARCustomer {
  code: string;
  name: string;
  location: string;
  payablesContact: string;
  phone: string;
  avgPayDays: number | null;
  lastPmtDate: string;
  invoices: ARInvoice[];
  totals: {
    balance: number;
    current: number;
    over30: number;
    over45: number;
    over60: number;
    over90: number;
  };
}

export interface ARReportData {
  reportDate: string;
  customers: ARCustomer[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function fmtNum(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseNum(v: unknown): number {
  if (v == null || v === '') return 0;
  const s = String(v).replace(/[$,\s]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function parseDate(v: unknown): string {
  if (v == null || v === '') return '';
  if (typeof v === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.m}/${d.d}/${d.y}`;
  }
  return String(v);
}

function parseOptNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  const s = String(v).replace(/[$,\s]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function agingColor(label: string): string {
  if (label === 'Current') return '#4ADE80';
  if (label === 'Over 30') return '#FCD34D';
  if (label === 'Over 45') return '#FB923C';
  if (label === 'Over 60') return '#F87171';
  if (label === 'Over 90') return '#EF4444';
  return '#9A9690';
}

// ── XLSX Parser ────────────────────────────────────────────────────────────

export function parseARXlsx(buffer: ArrayBuffer): ARReportData {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Find report date from first rows
  let reportDate = '';
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows[i];
    const joined = row.join(' ').trim();
    if (joined.match(/\d{2}\/\d{2}\/\d{4}/)) {
      const match = joined.match(/(\d{2}\/\d{2}\/\d{4})/);
      if (match) { reportDate = match[1]; break; }
    }
  }

  // Find header row (contains "Ship Date" or "GL Date" or "Balance")
  let headerRow = -1;
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const joined = rows[i].join('|').toLowerCase();
    if (joined.includes('ship date') || (joined.includes('gl date') && joined.includes('balance'))) {
      headerRow = i;
      break;
    }
  }

  // Column index mapping — scan the header row
  const colMap = { shipDate: -1, billDate: -1, glDate: -1, order: -1, age: -1, amount: -1, balance: -1, current: -1, over30: -1, over45: -1, over60: -1, over90: -1, lastCall: -1 };
  if (headerRow >= 0) {
    const h = rows[headerRow];
    h.forEach((cell, ci) => {
      const c = String(cell).toLowerCase().trim();
      if (c === 'ship date') colMap.shipDate = ci;
      else if (c === 'bill date') colMap.billDate = ci;
      else if (c === 'gl date') colMap.glDate = ci;
      else if (c === 'order') colMap.order = ci;
      else if (c === 'age') colMap.age = ci;
      else if (c === 'amount') colMap.amount = ci;
      else if (c === 'balance') colMap.balance = ci;
      else if (c === 'current') colMap.current = ci;
      else if (c === 'over 30') colMap.over30 = ci;
      else if (c === 'over 45') colMap.over45 = ci;
      else if (c === 'over 60') colMap.over60 = ci;
      else if (c === 'over 90') colMap.over90 = ci;
      else if (c.includes('last call')) colMap.lastCall = ci;
    });
  }

  function getCol(row: unknown[], idx: number): unknown {
    return idx >= 0 ? row[idx] ?? '' : '';
  }

  const customers: ARCustomer[] = [];
  let current: ARCustomer | null = null;
  const dataStart = headerRow >= 0 ? headerRow + 1 : 0;

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i];
    const joined = String(row.join('')).trim();
    if (!joined) continue;

    // Detect "Customer X totals:" row
    const totalsMatch = joined.match(/customer\s+\S+\s+totals/i);
    if (totalsMatch && current) {
      // Try to extract totals from this row — look for numeric columns
      // Totals row format: "Customer  CODE  totals:" then balance, current, over30...
      // Find which column has the balance-looking value
      current.totals = {
        balance: parseNum(getCol(row, colMap.balance > 0 ? colMap.balance : 7)),
        current: parseNum(getCol(row, colMap.current > 0 ? colMap.current : 8)),
        over30: parseNum(getCol(row, colMap.over30 > 0 ? colMap.over30 : 9)),
        over45: parseNum(getCol(row, colMap.over45 > 0 ? colMap.over45 : 10)),
        over60: parseNum(getCol(row, colMap.over60 > 0 ? colMap.over60 : 11)),
        over90: parseNum(getCol(row, colMap.over90 > 0 ? colMap.over90 : 12)),
      };
      // If totals not found from row, compute from invoices
      if (current.totals.balance === 0 && current.invoices.length > 0) {
        current.totals = current.invoices.reduce((acc, inv) => ({
          balance: acc.balance + inv.balance,
          current: acc.current + inv.current,
          over30: acc.over30 + inv.over30,
          over45: acc.over45 + inv.over45,
          over60: acc.over60 + inv.over60,
          over90: acc.over90 + inv.over90,
        }), { balance: 0, current: 0, over30: 0, over45: 0, over60: 0, over90: 0 });
      }
      customers.push(current);
      current = null;
      continue;
    }

    // Detect customer header block:
    // Col 0 = customer code (e.g. "M-18BUBC"), no ship date in this row
    // Following row: company name, city/state
    // Following row: contact name, phone
    const col0 = String(row[0] ?? '').trim();
    const isCustomerCode = /^[A-Z0-9]+-[A-Z0-9]+$/.test(col0) ||
      (col0.length > 2 && !col0.includes(' ') && String(row[1] ?? '').trim() === '' && String(getCol(row, colMap.shipDate > 0 ? colMap.shipDate : 0)).trim() === '');

    if (isCustomerCode && col0 !== 'Customer') {
      if (current) customers.push(current);

      // Next rows: look ahead for company name, location, contact, phone
      let companyName = '';
      let location = '';
      let payablesContact = '';
      let phone = '';
      let avgPayDays: number | null = null;
      let lastPmtDate = '';

      for (let j = i + 1; j < Math.min(i + 6, rows.length); j++) {
        const nr = rows[j];
        const nrJoined = String(nr.join('')).trim();
        if (!nrJoined) continue;
        // Company row: typically has company name in a mid-column
        const nr3 = String(nr[3] ?? '').trim();
        const nr4 = String(nr[4] ?? '').trim();
        const nr5 = String(nr[5] ?? '').trim();
        const nr6 = String(nr[6] ?? '').trim();
        const nrFull = [nr3, nr4, nr5, nr6].filter(Boolean).join(' ');

        // Check if this row has "Payables contact:" marker
        const nrStr = nr.join('|').toLowerCase();
        if (nrStr.includes('payables contact')) {
          // Company name is before payables contact
          if (!companyName) companyName = nrFull;
          // Find contact value after "Payables contact:"
          for (let k = 0; k < nr.length; k++) {
            if (String(nr[k]).toLowerCase().includes('payables contact')) {
              payablesContact = String(nr[k + 1] ?? '').trim();
              break;
            }
          }
          // Avg Pay Days
          for (let k = 0; k < nr.length; k++) {
            if (String(nr[k]).toLowerCase().includes('avg pay days')) {
              avgPayDays = parseOptNum(nr[k + 1]);
              break;
            }
          }
        } else if (nrStr.includes('phone:')) {
          if (!location && companyName) location = nrFull;
          else if (!companyName) companyName = nrFull;
          for (let k = 0; k < nr.length; k++) {
            if (String(nr[k]).toLowerCase().includes('phone')) {
              phone = String(nr[k + 1] ?? '').trim();
              break;
            }
          }
          // Last Pmt Date
          for (let k = 0; k < nr.length; k++) {
            if (String(nr[k]).toLowerCase().includes('last pmt date')) {
              lastPmtDate = parseDate(nr[k + 1]);
              break;
            }
          }
          break; // phone row is end of header
        } else if (!companyName) {
          // First non-empty continuation = company name
          const val = nr.map(c => String(c).trim()).filter(Boolean).join(' ');
          if (val && !val.match(/^[\d.$/]+$/)) companyName = val;
        } else if (!location) {
          const val = nr.map(c => String(c).trim()).filter(Boolean).join(' ');
          if (val) location = val;
        }
      }

      current = {
        code: col0,
        name: companyName,
        location,
        payablesContact,
        phone,
        avgPayDays,
        lastPmtDate,
        invoices: [],
        totals: { balance: 0, current: 0, over30: 0, over45: 0, over60: 0, over90: 0 },
      };
      continue;
    }

    // Detect invoice row: has a date-like or # value in glDate column, and numeric amount
    if (current) {
      const orderVal = String(getCol(row, colMap.order > 0 ? colMap.order : 4)).trim();
      const ageVal = getCol(row, colMap.age > 0 ? colMap.age : 5);
      const amtVal = getCol(row, colMap.amount > 0 ? colMap.amount : 6);

      const hasOrder = orderVal.length > 2;
      const hasAmount = parseNum(amtVal) !== 0 || String(amtVal).trim() !== '';
      const hasAge = parseOptNum(ageVal) !== null;

      if (hasOrder && (hasAmount || hasAge)) {
        current.invoices.push({
          shipDate: parseDate(getCol(row, colMap.shipDate > 0 ? colMap.shipDate : 0)),
          billDate: parseDate(getCol(row, colMap.billDate > 0 ? colMap.billDate : 1)),
          glDate: parseDate(getCol(row, colMap.glDate > 0 ? colMap.glDate : 2)),
          order: orderVal,
          age: parseOptNum(ageVal),
          amount: parseNum(amtVal),
          balance: parseNum(getCol(row, colMap.balance > 0 ? colMap.balance : 7)),
          current: parseNum(getCol(row, colMap.current > 0 ? colMap.current : 8)),
          over30: parseNum(getCol(row, colMap.over30 > 0 ? colMap.over30 : 9)),
          over45: parseNum(getCol(row, colMap.over45 > 0 ? colMap.over45 : 10)),
          over60: parseNum(getCol(row, colMap.over60 > 0 ? colMap.over60 : 11)),
          over90: parseNum(getCol(row, colMap.over90 > 0 ? colMap.over90 : 12)),
          lastCallDate: parseDate(getCol(row, colMap.lastCall > 0 ? colMap.lastCall : 13)),
        });
      }
    }
  }

  if (current) customers.push(current);

  // Recompute totals from invoices for any customer where totals are all zero
  for (const c of customers) {
    const allZero = Object.values(c.totals).every(v => v === 0);
    if (allZero && c.invoices.length > 0) {
      c.totals = c.invoices.reduce((acc, inv) => ({
        balance: acc.balance + inv.balance,
        current: acc.current + inv.current,
        over30: acc.over30 + inv.over30,
        over45: acc.over45 + inv.over45,
        over60: acc.over60 + inv.over60,
        over90: acc.over90 + inv.over90,
      }), { balance: 0, current: 0, over30: 0, over45: 0, over60: 0, over90: 0 });
    }
  }

  return { reportDate, customers };
}

// ── Summary cards ──────────────────────────────────────────────────────────

function SummaryCards({ customers }: { customers: ARCustomer[] }) {
  const totalBalance = customers.reduce((s, c) => s + c.totals.balance, 0);
  const totalOver30 = customers.reduce((s, c) => s + c.totals.over30 + c.totals.over45 + c.totals.over60 + c.totals.over90, 0);
  const totalOver90 = customers.reduce((s, c) => s + c.totals.over90, 0);
  const totalCurrent = customers.reduce((s, c) => s + c.totals.current, 0);

  const cards = [
    { label: 'Total AR Balance', value: fmt(totalBalance), icon: <CreditCard className="w-4 h-4" />, color: '#C8A96E' },
    { label: 'Current', value: fmt(totalCurrent), icon: <TrendingUp className="w-4 h-4" />, color: '#4ADE80' },
    { label: 'Past Due (30+)', value: fmt(totalOver30), icon: <AlertTriangle className="w-4 h-4" />, color: '#FB923C' },
    { label: 'Over 90 Days', value: fmt(totalOver90), icon: <AlertTriangle className="w-4 h-4" />, color: '#EF4444' },
    { label: 'Customers', value: String(customers.length), icon: <User className="w-4 h-4" />, color: '#60A5FA' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      {cards.map(c => (
        <div key={c.label} className="rounded-xl p-4" style={{ background: '#1A1917', border: '1px solid #262422' }}>
          <div className="flex items-center gap-2 mb-2" style={{ color: c.color }}>
            {c.icon}
            <span className="text-xs font-medium">{c.label}</span>
          </div>
          <p className="text-base font-semibold" style={{ color: '#F5F3EE' }}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Customer Row ───────────────────────────────────────────────────────────

function CustomerRow({ customer }: { customer: ARCustomer }) {
  const [open, setOpen] = useState(false);

  const hasPastDue = customer.totals.over30 + customer.totals.over45 + customer.totals.over60 + customer.totals.over90 > 0;
  const hasCredit = customer.totals.balance < 0;

  const aging = [
    { label: 'Current', val: customer.totals.current },
    { label: 'Over 30', val: customer.totals.over30 },
    { label: 'Over 45', val: customer.totals.over45 },
    { label: 'Over 60', val: customer.totals.over60 },
    { label: 'Over 90', val: customer.totals.over90 },
  ].filter(a => a.val !== 0);

  return (
    <div className="rounded-xl overflow-hidden mb-2" style={{ border: `1px solid ${open ? '#3D3A36' : '#262422'}` }}>
      {/* Header row */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left transition-all"
        style={{ background: open ? '#1E1D1B' : '#141412' }}
        onMouseEnter={e => { if (!open) (e.currentTarget as HTMLElement).style.background = '#1A1917'; }}
        onMouseLeave={e => { if (!open) (e.currentTarget as HTMLElement).style.background = '#141412'; }}
      >
        {/* Chevron */}
        <div style={{ color: '#6B6865', flexShrink: 0 }}>
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" strokeWidth={2} />}
        </div>

        {/* Customer name + code */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm" style={{ color: '#F5F3EE' }}>
              {customer.name || customer.code}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#2C2A27', color: '#9A9690' }}>
              {customer.code}
            </span>
            {hasCredit && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#0A2A1A', color: '#4ADE80', border: '1px solid #166534' }}>
                Credit
              </span>
            )}
            {hasPastDue && !hasCredit && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#2A1A0A', color: '#FB923C', border: '1px solid #92400E' }}>
                Past Due
              </span>
            )}
          </div>
          {customer.location && (
            <p className="text-xs mt-0.5 truncate" style={{ color: '#6B6865' }}>{customer.location}</p>
          )}
        </div>

        {/* Aging pills */}
        <div className="hidden md:flex items-center gap-2 flex-shrink-0">
          {aging.map(a => (
            <div key={a.label} className="text-right">
              <p className="text-xs" style={{ color: agingColor(a.label) }}>{a.label}</p>
              <p className="text-xs font-medium" style={{ color: agingColor(a.label) }}>{fmtNum(a.val)}</p>
            </div>
          ))}
        </div>

        {/* Total balance */}
        <div className="flex-shrink-0 text-right ml-4">
          <p className="text-xs mb-0.5" style={{ color: '#6B6865' }}>Balance</p>
          <p className="text-base font-semibold" style={{ color: hasCredit ? '#4ADE80' : hasPastDue ? '#FB923C' : '#F5F3EE' }}>
            {fmt(customer.totals.balance)}
          </p>
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div style={{ background: '#0F0E0C', borderTop: '1px solid #1E1D1B' }}>
          {/* Customer info bar */}
          <div className="flex flex-wrap gap-6 px-5 py-3" style={{ borderBottom: '1px solid #1E1D1B' }}>
            {customer.payablesContact && (
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5" style={{ color: '#6B6865' }} strokeWidth={1.5} />
                <span className="text-xs" style={{ color: '#9A9690' }}>{customer.payablesContact}</span>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5" style={{ color: '#6B6865' }} strokeWidth={1.5} />
                <span className="text-xs" style={{ color: '#9A9690' }}>{customer.phone}</span>
              </div>
            )}
            {customer.avgPayDays != null && (
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" style={{ color: '#6B6865' }} strokeWidth={1.5} />
                <span className="text-xs" style={{ color: '#9A9690' }}>Avg Pay: <span style={{ color: '#C8A96E' }}>{customer.avgPayDays} days</span></span>
              </div>
            )}
            {customer.lastPmtDate && (
              <div className="flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5" style={{ color: '#6B6865' }} strokeWidth={1.5} />
                <span className="text-xs" style={{ color: '#9A9690' }}>Last Pmt: <span style={{ color: '#C8A96E' }}>{customer.lastPmtDate}</span></span>
              </div>
            )}
          </div>

          {/* Invoice table */}
          {customer.invoices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ minWidth: '700px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1E1D1B' }}>
                    {['GL Date', 'Order', 'Age', 'Amount', 'Balance', 'Current', '30+', '45+', '60+', '90+'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-medium" style={{ color: '#6B6865' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customer.invoices.map((inv, i) => {
                    const isOld = inv.over90 !== 0;
                    const isCredit = inv.balance < 0;
                    return (
                      <tr key={i}
                        style={{ borderBottom: '1px solid #1A1917' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#1A1917')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td className="px-4 py-2.5" style={{ color: '#9A9690' }}>{inv.glDate || inv.shipDate || '—'}</td>
                        <td className="px-4 py-2.5 font-medium" style={{ color: '#C8A96E' }}>{inv.order}</td>
                        <td className="px-4 py-2.5" style={{ color: isOld ? '#EF4444' : '#9A9690' }}>{inv.age ?? '—'}</td>
                        <td className="px-4 py-2.5" style={{ color: '#E4E2DC' }}>{fmtNum(inv.amount)}</td>
                        <td className="px-4 py-2.5 font-medium" style={{ color: isCredit ? '#4ADE80' : '#E4E2DC' }}>{fmtNum(inv.balance)}</td>
                        <td className="px-4 py-2.5" style={{ color: inv.current !== 0 ? '#4ADE80' : '#4A4844' }}>{inv.current !== 0 ? fmtNum(inv.current) : '—'}</td>
                        <td className="px-4 py-2.5" style={{ color: inv.over30 !== 0 ? '#FCD34D' : '#4A4844' }}>{inv.over30 !== 0 ? fmtNum(inv.over30) : '—'}</td>
                        <td className="px-4 py-2.5" style={{ color: inv.over45 !== 0 ? '#FB923C' : '#4A4844' }}>{inv.over45 !== 0 ? fmtNum(inv.over45) : '—'}</td>
                        <td className="px-4 py-2.5" style={{ color: inv.over60 !== 0 ? '#F87171' : '#4A4844' }}>{inv.over60 !== 0 ? fmtNum(inv.over60) : '—'}</td>
                        <td className="px-4 py-2.5" style={{ color: inv.over90 !== 0 ? '#EF4444' : '#4A4844' }}>{inv.over90 !== 0 ? fmtNum(inv.over90) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Totals footer */}
                <tfoot>
                  <tr style={{ borderTop: '1px solid #2C2A27', background: '#141412' }}>
                    <td className="px-4 py-2.5 font-semibold text-xs" style={{ color: '#9A9690' }} colSpan={4}>Totals</td>
                    <td className="px-4 py-2.5 font-semibold" style={{ color: customer.totals.balance < 0 ? '#4ADE80' : '#F5F3EE' }}>{fmtNum(customer.totals.balance)}</td>
                    <td className="px-4 py-2.5 font-semibold" style={{ color: '#4ADE80' }}>{customer.totals.current !== 0 ? fmtNum(customer.totals.current) : '—'}</td>
                    <td className="px-4 py-2.5 font-semibold" style={{ color: '#FCD34D' }}>{customer.totals.over30 !== 0 ? fmtNum(customer.totals.over30) : '—'}</td>
                    <td className="px-4 py-2.5 font-semibold" style={{ color: '#FB923C' }}>{customer.totals.over45 !== 0 ? fmtNum(customer.totals.over45) : '—'}</td>
                    <td className="px-4 py-2.5 font-semibold" style={{ color: '#F87171' }}>{customer.totals.over60 !== 0 ? fmtNum(customer.totals.over60) : '—'}</td>
                    <td className="px-4 py-2.5 font-semibold" style={{ color: '#EF4444' }}>{customer.totals.over90 !== 0 ? fmtNum(customer.totals.over90) : '—'}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="px-5 py-4 text-xs italic" style={{ color: '#4A4844' }}>No invoice detail found for this customer.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Totals Row ─────────────────────────────────────────────────────────────

function TotalsRow({ customers }: { customers: ARCustomer[] }) {
  const totalBalance = customers.reduce((s, c) => s + c.totals.balance, 0);
  const totalCurrent = customers.reduce((s, c) => s + c.totals.current, 0);
  const totalOver30 = customers.reduce((s, c) => s + c.totals.over30, 0);
  const totalOver45 = customers.reduce((s, c) => s + c.totals.over45, 0);
  const totalOver60 = customers.reduce((s, c) => s + c.totals.over60, 0);
  const totalOver90 = customers.reduce((s, c) => s + c.totals.over90, 0);

  const cols = [
    { label: 'Balance', value: totalBalance, color: '#C8A96E' },
    { label: 'Current', value: totalCurrent, color: '#4ADE80' },
    { label: 'Over 30', value: totalOver30, color: '#FCD34D' },
    { label: 'Over 45', value: totalOver45, color: '#FDBA74' },
    { label: 'Over 60', value: totalOver60, color: '#FB923C' },
    { label: 'Over 90', value: totalOver90, color: '#EF4444' },
  ].filter(c => c.value !== 0);

  return (
    <div className="rounded-xl mt-3 px-5 py-4 flex items-center justify-between gap-4"
      style={{ background: '#1E1D1B', border: '1px solid #3D3A36' }}>
      <span className="text-xs font-semibold flex-shrink-0" style={{ color: '#9A9690' }}>
        TOTALS — {customers.length} customers
      </span>
      <div className="flex items-center gap-6 flex-wrap">
        {cols.map(c => (
          <div key={c.label} className="text-right">
            <p className="text-xs mb-0.5" style={{ color: '#6B6865' }}>{c.label}</p>
            <p className="text-sm font-semibold tabular-nums" style={{ color: c.color }}>{fmt(c.value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ARReport component ────────────────────────────────────────────────

interface Props {
  tabId: string;
  uploaderName: string;
}

export default function ARReport({ tabId, uploaderName }: Props) {
  const [report, setReport] = useState<ARReportData | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [lockToggling, setLockToggling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Load persisted report on mount
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('ar_reports')
        .select('*')
        .eq('tab_id', tabId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setReport({ reportDate: data.report_date, customers: data.report_data as ARCustomer[] });
        setReportId(data.id);
        setLocked(data.locked ?? false);
      }
      setLoading(false);
    })();
  }, [tabId]);

  async function toggleLock() {
    setLockToggling(true);
    try {
      let id = reportId;

      // If we somehow lost the id, re-fetch it
      if (!id) {
        const { data } = await supabase
          .from('ar_reports')
          .select('id')
          .eq('tab_id', tabId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        id = data?.id ?? null;
        if (id) setReportId(id);
      }

      if (!id) {
        console.error('toggleLock: could not find report id');
        return;
      }

      const next = !locked;
      const { error: err } = await supabase
        .from('ar_reports')
        .update({ locked: next })
        .eq('id', id);

      if (err) {
        console.error('Lock toggle failed:', err);
      } else {
        setLocked(next);
      }
    } finally {
      setLockToggling(false);
    }
  }

  async function handleFile(file: File) {
    if (locked) return;
    if (!file.name.match(/\.xlsx?$/i)) { setError('Please upload an .xlsx file.'); return; }
    setError(null);
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseARXlsx(buf);
      if (parsed.customers.length === 0) { setError('No customer data found. Make sure this is an AR Aging report.'); setUploading(false); return; }

      await supabase.from('ar_reports').delete().eq('tab_id', tabId);
      await supabase.from('ar_reports').insert({
        tab_id: tabId,
        report_date: parsed.reportDate,
        report_data: parsed.customers,
        uploaded_by: uploaderName,
        locked: false,
      });

      // Fetch back the inserted row to get its id
      const { data: inserted } = await supabase
        .from('ar_reports')
        .select('id')
        .eq('tab_id', tabId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setReport(parsed);
      setReportId(inserted?.id ?? null);
      setLocked(false);
    } catch (e) {
      setError('Failed to parse file. Make sure it is a valid AR Aging xlsx report.');
      console.error(e);
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (locked) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  const filtered = report
    ? report.customers.filter(c =>
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: '#2C2A27', borderTopColor: '#C8A96E' }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #1E1D1B' }}>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold" style={{ color: '#F5F3EE' }}>Accounts Receivable</h2>
          </div>
          {report && (
            <p className="text-xs mt-0.5" style={{ color: '#6B6865' }}>
              {report.reportDate ? `Report date: ${report.reportDate} · ` : ''}{report.customers.length} customers
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {report && (
            <input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg outline-none"
              style={{ background: '#1A1917', border: '1px solid #2C2A27', color: '#F5F3EE', width: '180px' }}
            />
          )}
          {/* Lock / Unlock — only when report exists */}
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
          {/* Upload button — hidden when locked */}
          {!locked && (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
              style={{ background: '#C8A96E', color: '#1A1410' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#D4B87A')}
              onMouseLeave={e => (e.currentTarget.style.background = '#C8A96E')}
            >
              {uploading ? (
                <><div className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: '#A07830', borderTopColor: '#1A1410' }} />Processing…</>
              ) : (
                <><Upload className="w-3 h-3" strokeWidth={2} />{report ? 'Replace Report' : 'Upload Report'}</>
              )}
            </button>
          )}
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 flex items-start gap-3 px-4 py-3 rounded-xl" style={{ background: '#2A1010', border: '1px solid #7F1D1D' }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#EF4444' }} />
          <p className="text-xs" style={{ color: '#FCA5A5' }}>{error}</p>
          <button onClick={() => setError(null)} className="ml-auto flex-shrink-0" style={{ color: '#6B6865' }}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5" style={{ scrollbarWidth: 'thin', scrollbarColor: '#2C2A27 transparent' }}>
        {!report ? (
          /* Drop zone — disabled when locked (no report yet so lock can't be active, but guard anyway) */
          <div
            className="flex flex-col items-center justify-center h-64 rounded-2xl border-2 border-dashed transition-all cursor-pointer"
            style={{ borderColor: dragOver ? '#C8A96E' : '#2C2A27', background: dragOver ? '#1E1A10' : '#141412' }}
            onDragOver={e => { e.preventDefault(); if (!locked) setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => { if (!locked) fileRef.current?.click(); }}
          >
            <Upload className="w-8 h-8 mb-3" style={{ color: dragOver ? '#C8A96E' : '#3D3A36' }} strokeWidth={1.5} />
            <p className="text-sm font-medium mb-1" style={{ color: dragOver ? '#C8A96E' : '#6B6865' }}>Drop AR Aging xlsx here</p>
            <p className="text-xs" style={{ color: '#4A4844' }}>or click to browse</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-center py-16" style={{ color: '#4A4844' }}>No customers match your search.</p>
        ) : (
          <>
            <SummaryCards customers={filtered} />
            {filtered.map(c => <CustomerRow key={c.code} customer={c} />)}
            {filtered.length > 1 && <TotalsRow customers={filtered} />}
          </>
        )}
      </div>
    </div>
  );
}
