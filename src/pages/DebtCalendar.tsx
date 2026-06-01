import { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, DollarSign, Building2, AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────

interface DebtLoan {
  id: string;
  lender: string;
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

interface PaymentEvent {
  lender: string;
  description: string;
  entity: string;
  amount: number;
  balance: number;
  interest_rate: number;
  loan_type: string;
  auto_pull: boolean;
  maturity_date: string | null;
  /** true if this month is the final payment */
  isFinal: boolean;
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

/** Returns day-of-month (1-based) that payment is due for a loan, based on origination_date. */
function paymentDay(loan: DebtLoan): number {
  if (loan.origination_date) {
    const d = new Date(loan.origination_date + 'T12:00:00');
    return d.getDate();
  }
  return 1;
}

/** Check if a loan has an active payment in a given year/month (1-based) */
function loanActiveInMonth(loan: DebtLoan, year: number, month: number): boolean {
  if (!loan.origination_date) return false;
  if (loan.balance <= 0 && loan.monthly_payment <= 0) return false;

  const orig = new Date(loan.origination_date + 'T12:00:00');
  const origYear = orig.getFullYear();
  const origMonth = orig.getMonth() + 1;

  // Payment starts the month after origination (or same month)
  const startYear = origMonth === 12 ? origYear + 1 : origYear;
  const startMonth = origMonth === 12 ? 1 : origMonth + 1;

  if (year < startYear || (year === startYear && month < startMonth)) return false;

  if (loan.maturity_date) {
    const mat = new Date(loan.maturity_date + 'T12:00:00');
    const matYear = mat.getFullYear();
    const matMonth = mat.getMonth() + 1;
    if (year > matYear || (year === matYear && month > matMonth)) return false;
  }

  return true;
}

function isFinalPaymentMonth(loan: DebtLoan, year: number, month: number): boolean {
  if (!loan.maturity_date) return false;
  const mat = new Date(loan.maturity_date + 'T12:00:00');
  return mat.getFullYear() === year && mat.getMonth() + 1 === month;
}

/** Build a map of day → payments for a given year/month */
function buildPaymentMap(loans: DebtLoan[], year: number, month: number): Map<number, PaymentEvent[]> {
  const map = new Map<number, PaymentEvent[]>();
  for (const loan of loans) {
    if (!loanActiveInMonth(loan, year, month)) continue;
    const day = paymentDay(loan);
    if (!map.has(day)) map.set(day, []);
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
      isFinal: isFinalPaymentMonth(loan, year, month),
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

  return (
    <div className="flex flex-col h-full" style={{ background: '#141210', borderLeft: '1px solid #2C2A27' }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #2C2A27' }}>
        <div>
          <div className="text-sm font-semibold" style={{ color: '#F5F3EE' }}>{dateStr}</div>
          <div className="text-xs mt-0.5" style={{ color: '#6B6865' }}>
            {events.length} payment{events.length !== 1 ? 's' : ''} · {fmt(total)} total
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
              <span className="text-xs" style={{ color: '#4A4844' }}>Balance</span>
              <span className="text-xs font-medium" style={{ color: '#C8C4BC' }}>{fmt(e.balance)}</span>
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

  const loadLoans = useCallback(async () => {
    // Fetch from the Debts tab — get tab_id for the Debts tab in the same folder
    const { data: debtTab } = await supabase
      .from('portal_tabs')
      .select('id')
      .eq('label', 'Debts')
      .maybeSingle();

    if (!debtTab) { setLoading(false); return; }

    const { data } = await supabase
      .from('debt_loans')
      .select('id, lender, description, entity, balance, origination_date, maturity_date, monthly_payment, interest_rate, loan_type, auto_pull')
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

  const paymentMap = buildPaymentMap(loans, viewYear, viewMonth);

  // Calendar grid
  const firstDayOfMonth = new Date(viewYear, viewMonth - 1, 1).getDay(); // 0=Sun
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
  const monthlyTotal = Array.from(paymentMap.values()).flat().reduce((s, e) => s + e.amount, 0);
  const paymentDays = paymentMap.size;
  const autoCount = Array.from(paymentMap.values()).flat().filter(e => e.auto_pull).length;
  const finalCount = Array.from(paymentMap.values()).flat().filter(e => e.isFinal).length;

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
              <p className="text-sm mt-1" style={{ color: '#6B6865' }}>Monthly debt payment schedule from the Debt Schedule</p>
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
