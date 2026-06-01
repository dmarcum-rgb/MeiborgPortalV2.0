import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, DollarSign, Building2, AlertCircle, FileText
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import compiledCsv from '../assets/Compiled_Amortization_Schedules.csv?raw';

// ── Types ──────────────────────────────────────────────────────────────────

interface DebtLoan {
  id: string;
  lender: string;
  loan_number: string;
  description: string;
  entity: string;
  balance: number;
  origination_date: string | null;
  maturity_date: string | null;
  monthly_payment: number;
  interest_rate: number;
  loan_type: string;
  auto_pull: boolean;
}

interface CsvPaymentRow {
  glNum: string;
  lender: string;
  description: string;
  pmtNum: number;
  date: Date;
  payment: number | null;
  principal: number | null;
  interest: number | null;
  ending: number | null;
}

interface PaymentEvent {
  lender: string;
  description: string;
  entity: string;
  amount: number;
  balance: number | null;
  interest_rate: number;
  loan_type: string;
  auto_pull: boolean;
  maturity_date: string | null;
  interest: number | null;
  principal: number | null;
  ending: number | null;
  isFinal: boolean;
  fromCsv: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function fmt(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtFull(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function parseMoney(s: string): number | null {
  if (!s || s.trim() === '') return null;
  const n = parseFloat(s.replace(/[$,\s]/g, ''));
  return isNaN(n) ? null : n;
}

function parseDate(s: string): Date | null {
  if (!s || s.trim() === '') return null;
  const parts = s.trim().split('/');
  if (parts.length === 3) {
    const m = parseInt(parts[0], 10);
    const d = parseInt(parts[1], 10);
    const y = parseInt(parts[2], 10);
    if (!isNaN(m) && !isNaN(d) && !isNaN(y)) return new Date(y, m - 1, d);
  }
  return null;
}

function parseCsvPayments(csv: string): Map<string, CsvPaymentRow[]> {
  const map = new Map<string, CsvPaymentRow[]>();
  const lines = csv.split('\n');
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { cols.push(cur); cur = ''; }
      else { cur += ch; }
    }
    cols.push(cur);

    const glNum = cols[2]?.trim();
    if (!glNum) continue;
    const pmtNum = parseInt(cols[16]?.trim(), 10);
    if (isNaN(pmtNum)) continue;
    const date = parseDate(cols[17]?.trim());
    if (!date) continue;

    const payment = parseMoney(cols[18]);
    const principal = parseMoney(cols[19]);
    const interest = parseMoney(cols[20]);
    const ending = parseMoney(cols[21]);

    const row: CsvPaymentRow = {
      glNum,
      lender: cols[1]?.trim() ?? '',
      description: cols[4]?.trim() ?? '',
      pmtNum,
      date,
      payment,
      principal,
      interest,
      ending,
    };

    if (!map.has(glNum)) map.set(glNum, []);
    map.get(glNum)!.push(row);
  }
  return map;
}

/** Build a map of day → payments for a given year/month using CSV data */
function buildCsvPaymentMap(
  loans: DebtLoan[],
  csvMap: Map<string, CsvPaymentRow[]>,
  year: number,
  month: number
): Map<number, PaymentEvent[]> {
  const map = new Map<number, PaymentEvent[]>();

  // Build a lookup from loan_number → loan info
  const loanByGl = new Map<string, DebtLoan>();
  for (const loan of loans) {
    if (loan.loan_number) loanByGl.set(loan.loan_number, loan);
  }

  for (const [glNum, rows] of csvMap.entries()) {
    const loan = loanByGl.get(glNum);
    if (!loan) continue;

    // Find all rows for this month/year that have payment data
    for (const row of rows) {
      if (row.date.getFullYear() !== year || row.date.getMonth() + 1 !== month) continue;
      // Include rows even if payment is null (scheduled but not yet paid)
      const day = row.date.getDate();
      if (!map.has(day)) map.set(day, []);

      // Find the last row with data to determine if this is the final payment
      const lastDataRow = [...rows].reverse().find(r => r.ending !== null && r.ending <= 0.01);
      const isFinal = lastDataRow
        ? lastDataRow.date.getFullYear() === year && lastDataRow.date.getMonth() + 1 === month
        : false;

      map.get(day)!.push({
        lender: loan.lender,
        description: loan.description,
        entity: loan.entity,
        amount: row.payment ?? loan.monthly_payment,
        balance: row.ending,
        interest_rate: loan.interest_rate,
        loan_type: loan.loan_type,
        auto_pull: loan.auto_pull,
        maturity_date: loan.maturity_date,
        interest: row.interest,
        principal: row.principal,
        ending: row.ending,
        isFinal,
        fromCsv: true,
      });
    }
  }

  // Also add loans not in CSV using origination-date fallback
  for (const loan of loans) {
    if (loan.loan_number && csvMap.has(loan.loan_number)) continue;
    if (!loan.origination_date) continue;
    if (loan.balance <= 0 && loan.monthly_payment <= 0) continue;

    const orig = new Date(loan.origination_date + 'T12:00:00');
    const origYear = orig.getFullYear();
    const origMonth = orig.getMonth() + 1;
    const startYear = origMonth === 12 ? origYear + 1 : origYear;
    const startMonth = origMonth === 12 ? 1 : origMonth + 1;
    if (year < startYear || (year === startYear && month < startMonth)) continue;

    if (loan.maturity_date) {
      const mat = new Date(loan.maturity_date + 'T12:00:00');
      if (year > mat.getFullYear() || (year === mat.getFullYear() && month > mat.getMonth() + 1)) continue;
    }

    const day = orig.getDate();
    if (!map.has(day)) map.set(day, []);
    const isFinal = loan.maturity_date
      ? new Date(loan.maturity_date + 'T12:00:00').getFullYear() === year && new Date(loan.maturity_date + 'T12:00:00').getMonth() + 1 === month
      : false;
    map.get(day)!.push({
      lender: loan.lender,
      description: loan.description,
      entity: loan.entity,
      amount: loan.monthly_payment,
      balance: loan.balance,
      interest_rate: loan.interest_rate,
      loan_type: loan.loan_type,
      auto_pull: loan.auto_pull,
      maturity_date: loan.maturity_date,
      interest: null,
      principal: null,
      ending: null,
      isFinal,
      fromCsv: false,
    });
  }

  return map;
}

// ── Day Detail Panel ───────────────────────────────────────────────────────

function DayDetail({ day, year, month, events, onClose }: {
  day: number;
  year: number;
  month: number;
  events: PaymentEvent[];
  onClose: () => void;
}) {
  const total = events.reduce((s, e) => s + e.amount, 0);
  const dateStr = new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const csvCount = events.filter(e => e.fromCsv).length;

  return (
    <div className="flex flex-col h-full" style={{ background: '#141210', borderLeft: '1px solid #2C2A27' }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #2C2A27' }}>
        <div>
          <div className="text-sm font-semibold" style={{ color: '#F5F3EE' }}>{dateStr}</div>
          <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: '#6B6865' }}>
            <span>{events.length} payment{events.length !== 1 ? 's' : ''} · {fmt(total)} total</span>
            {csvCount > 0 && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: 'rgba(74,222,128,0.08)', color: '#4ADE80', fontSize: '10px' }}>
                <FileText className="w-2.5 h-2.5" />
                Actual
              </span>
            )}
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-white/5">
          <ChevronRight className="w-4 h-4" style={{ color: '#6B6865' }} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {events.map((e, i) => (
          <div key={i} className="rounded-xl p-3.5" style={{ background: '#1A1917', border: '1px solid #2C2A27' }}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold leading-tight" style={{ color: '#F5F3EE' }}>{e.lender}</div>
                <div className="text-xs mt-0.5 leading-snug" style={{ color: '#9A9690' }}>{e.description}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold" style={{ color: '#C8A96E' }}>{fmtFull(e.amount)}</div>
              </div>
            </div>

            {/* Principal / Interest breakdown if available */}
            {(e.principal !== null || e.interest !== null) && (
              <div className="grid grid-cols-2 gap-2 mb-2 p-2 rounded-lg" style={{ background: '#141210' }}>
                <div>
                  <div className="text-xs" style={{ color: '#4A4844' }}>Principal</div>
                  <div className="text-xs font-medium" style={{ color: '#4ADE80' }}>{e.principal !== null ? fmtFull(e.principal) : '—'}</div>
                </div>
                <div>
                  <div className="text-xs" style={{ color: '#4A4844' }}>Interest</div>
                  <div className="text-xs font-medium" style={{ color: '#F87171' }}>{e.interest !== null ? fmtFull(e.interest) : '—'}</div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5 mt-2">
              {e.entity && (
                <span className="px-2 py-0.5 rounded text-xs" style={{ background: '#242220', border: '1px solid #2C2A27', color: '#9A9690' }}>
                  {e.entity}
                </span>
              )}
              <span className="px-2 py-0.5 rounded text-xs" style={{ background: '#242220', border: '1px solid #2C2A27', color: '#9A9690' }}>
                {(e.interest_rate * 100).toFixed(2)}%
              </span>
              <span className="px-2 py-0.5 rounded text-xs" style={{
                background: e.loan_type === 'Capital Lease' ? 'rgba(99,102,241,0.1)' : 'rgba(200,169,110,0.08)',
                color: e.loan_type === 'Capital Lease' ? '#A5B4FC' : '#C8A96E',
              }}>
                {e.loan_type}
              </span>
              {e.auto_pull && (
                <span className="px-2 py-0.5 rounded text-xs" style={{ background: 'rgba(74,222,128,0.08)', color: '#4ADE80' }}>
                  Auto Pull
                </span>
              )}
              {e.isFinal && (
                <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: 'rgba(248,113,113,0.1)', color: '#F87171' }}>
                  Final Payment
                </span>
              )}
            </div>
            <div className="mt-2 pt-2 flex justify-between" style={{ borderTop: '1px solid #242220' }}>
              <span className="text-xs" style={{ color: '#4A4844' }}>Ending Balance</span>
              <span className="text-xs font-medium" style={{ color: '#C8C4BC' }}>
                {e.ending !== null ? fmt(e.ending) : e.balance !== null ? fmt(e.balance) : '—'}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: '1px solid #2C2A27', background: '#1A1917' }}>
        <span className="text-xs font-medium" style={{ color: '#9A9690' }}>Day Total</span>
        <span className="text-sm font-bold" style={{ color: '#C8A96E' }}>{fmtFull(total)}</span>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

interface DebtCalendarProps {
  tabId: string;
}

export default function DebtCalendar({ tabId }: DebtCalendarProps) {
  const [loans, setLoans] = useState<DebtLoan[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1); // 1-based
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const csvPayments = useMemo(() => parseCsvPayments(compiledCsv), []);

  const loadLoans = useCallback(async () => {
    const { data: debtTab } = await supabase
      .from('portal_tabs')
      .select('id')
      .eq('label', 'Debts')
      .maybeSingle();

    if (!debtTab) { setLoading(false); return; }

    const { data } = await supabase
      .from('debt_loans')
      .select('id, lender, loan_number, description, entity, balance, origination_date, maturity_date, monthly_payment, interest_rate, loan_type, auto_pull')
      .eq('tab_id', debtTab.id)
      .order('lender');

    setLoans((data ?? []) as DebtLoan[]);
    setLoading(false);
  }, [tabId]);

  useEffect(() => { loadLoans(); }, [loadLoans]);

  // Navigation
  function prevMonth() {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12); }
    else setViewMonth(m => m - 1);
    setSelectedDay(null);
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1); }
    else setViewMonth(m => m + 1);
    setSelectedDay(null);
  }
  function goToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth() + 1);
    setSelectedDay(null);
  }

  const paymentMap = useMemo(
    () => buildCsvPaymentMap(loans, csvPayments, viewYear, viewMonth),
    [loans, csvPayments, viewYear, viewMonth]
  );

  // Calendar grid
  const firstDayOfMonth = new Date(viewYear, viewMonth - 1, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth - 1, 0).getDate();

  const cells: Array<{ day: number; currentMonth: boolean }> = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    cells.push({ day: daysInPrevMonth - firstDayOfMonth + 1 + i, currentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, currentMonth: true });
  }
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, currentMonth: false });
  }

  // Monthly summary
  const allEvents = Array.from(paymentMap.values()).flat();
  const monthlyTotal = allEvents.reduce((s, e) => s + e.amount, 0);
  const paymentDays = paymentMap.size;
  const autoCount = allEvents.filter(e => e.auto_pull).length;
  const finalCount = allEvents.filter(e => e.isFinal).length;
  const csvCount = allEvents.filter(e => e.fromCsv).length;

  const isToday = (day: number) =>
    day === today.getDate() && viewMonth === today.getMonth() + 1 && viewYear === today.getFullYear();

  const selectedEvents = selectedDay ? (paymentMap.get(selectedDay) ?? []) : [];

  return (
    <div className="flex h-full overflow-hidden" style={{ background: '#0F0E0C' }}>
      {/* Main calendar area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-8 pt-8 pb-5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#F5F3EE' }}>Payment Calendar</h1>
              <p className="text-sm mt-1" style={{ color: '#6B6865' }}>Monthly debt payment schedule — actual dates from amortization data</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={goToday}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-white/5"
                style={{ border: '1px solid #2C2A27', color: '#9A9690' }}
              >
                Today
              </button>
              <button onClick={prevMonth} className="p-2 rounded-lg transition-colors hover:bg-white/5" style={{ border: '1px solid #2C2A27' }}>
                <ChevronLeft className="w-4 h-4" style={{ color: '#9A9690' }} />
              </button>
              <div className="text-sm font-semibold w-36 text-center" style={{ color: '#F5F3EE' }}>
                {MONTHS[viewMonth - 1]} {viewYear}
              </div>
              <button onClick={nextMonth} className="p-2 rounded-lg transition-colors hover:bg-white/5" style={{ border: '1px solid #2C2A27' }}>
                <ChevronRight className="w-4 h-4" style={{ color: '#9A9690' }} />
              </button>
            </div>
          </div>

          {/* Monthly summary pills */}
          {!loading && (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: '#141210', border: '1px solid #2C2A27' }}>
                <DollarSign className="w-3.5 h-3.5" style={{ color: '#C8A96E' }} />
                <span className="text-xs font-medium" style={{ color: '#F5F3EE' }}>{fmt(monthlyTotal)}</span>
                <span className="text-xs" style={{ color: '#6B6865' }}>due this month</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: '#141210', border: '1px solid #2C2A27' }}>
                <Building2 className="w-3.5 h-3.5" style={{ color: '#A8C5DA' }} />
                <span className="text-xs font-medium" style={{ color: '#F5F3EE' }}>{paymentDays}</span>
                <span className="text-xs" style={{ color: '#6B6865' }}>payment days</span>
              </div>
              {csvCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)' }}>
                  <FileText className="w-3.5 h-3.5" style={{ color: '#4ADE80' }} />
                  <span className="text-xs font-medium" style={{ color: '#4ADE80' }}>{csvCount}</span>
                  <span className="text-xs" style={{ color: '#4ADE80' }}>from schedule</span>
                </div>
              )}
              {autoCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: '#141210', border: '1px solid #2C2A27' }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: '#4ADE80' }} />
                  <span className="text-xs font-medium" style={{ color: '#F5F3EE' }}>{autoCount}</span>
                  <span className="text-xs" style={{ color: '#6B6865' }}>auto-pull</span>
                </div>
              )}
              {finalCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)' }}>
                  <AlertCircle className="w-3.5 h-3.5" style={{ color: '#F87171' }} />
                  <span className="text-xs font-medium" style={{ color: '#F87171' }}>{finalCount}</span>
                  <span className="text-xs" style={{ color: '#F87171' }}>final payment{finalCount !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Calendar grid */}
        <div className="flex-1 overflow-hidden px-8 pb-8 flex flex-col">
          {loading ? (
            <div className="flex items-center justify-center flex-1">
              <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: '#2C2A27', borderTopColor: '#C8A96E' }} />
            </div>
          ) : (
            <div className="flex flex-col flex-1 rounded-xl overflow-hidden" style={{ border: '1px solid #2C2A27' }}>
              {/* Day headers */}
              <div className="grid grid-cols-7 flex-shrink-0" style={{ background: '#1A1917', borderBottom: '1px solid #2C2A27' }}>
                {DAYS.map(d => (
                  <div key={d} className="py-2.5 text-center text-xs font-medium" style={{ color: '#6B6865' }}>{d}</div>
                ))}
              </div>

              {/* Calendar cells */}
              <div className="grid grid-cols-7 flex-1" style={{ gridTemplateRows: 'repeat(6, 1fr)' }}>
                {cells.map((cell, idx) => {
                  const events = cell.currentMonth ? (paymentMap.get(cell.day) ?? []) : [];
                  const total = events.reduce((s, e) => s + e.amount, 0);
                  const hasFinal = events.some(e => e.isFinal);
                  const isSelected = cell.currentMonth && selectedDay === cell.day;
                  const todayCell = cell.currentMonth && isToday(cell.day);

                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        if (!cell.currentMonth || events.length === 0) { setSelectedDay(null); return; }
                        setSelectedDay(isSelected ? null : cell.day);
                      }}
                      className="relative flex flex-col p-2 text-left transition-colors"
                      style={{
                        borderRight: (idx + 1) % 7 !== 0 ? '1px solid #1E1C1A' : 'none',
                        borderBottom: idx < 35 ? '1px solid #1E1C1A' : 'none',
                        background: isSelected ? '#1E1C1A' : 'transparent',
                        cursor: events.length > 0 ? 'pointer' : 'default',
                        minHeight: 0,
                      }}
                    >
                      {/* Day number */}
                      <div className="flex items-center justify-between w-full mb-1">
                        <span
                          className="text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0"
                          style={{
                            color: !cell.currentMonth ? '#2C2A27' : todayCell ? '#141210' : '#9A9690',
                            background: todayCell ? '#C8A96E' : 'transparent',
                            fontWeight: todayCell ? 700 : undefined,
                          }}
                        >
                          {cell.day}
                        </span>
                        {events.length > 0 && (
                          <span className="text-xs font-bold" style={{ color: hasFinal ? '#F87171' : '#C8A96E' }}>
                            {fmt(total)}
                          </span>
                        )}
                      </div>

                      {/* Payment pills — show up to 2 */}
                      {events.slice(0, 2).map((e, i) => (
                        <div
                          key={i}
                          className="w-full rounded px-1.5 py-0.5 mb-0.5 truncate text-left"
                          style={{
                            background: e.isFinal ? 'rgba(248,113,113,0.12)' : 'rgba(200,169,110,0.1)',
                            fontSize: '10px',
                            color: e.isFinal ? '#F87171' : '#C8A96E',
                            lineHeight: '1.4',
                          }}
                        >
                          {e.lender}
                        </div>
                      ))}
                      {events.length > 2 && (
                        <div className="text-left" style={{ fontSize: '10px', color: '#4A4844' }}>
                          +{events.length - 2} more
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Day detail panel */}
      {selectedDay !== null && selectedEvents.length > 0 && (
        <div className="w-80 flex-shrink-0 overflow-hidden">
          <DayDetail
            day={selectedDay}
            year={viewYear}
            month={viewMonth}
            events={selectedEvents}
            onClose={() => setSelectedDay(null)}
          />
        </div>
      )}
    </div>
  );
}
