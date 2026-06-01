import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Building2, ChevronDown, ChevronRight, Plus, Edit2, Trash2,
  Lock, Unlock, TrendingDown, DollarSign, Calendar, Percent,
  X, Check, AlertTriangle, Search, TableProperties, FileText, RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import compiledCsv from '../assets/Compiled_Amortization_Schedules.csv?raw';

// ── Types ──────────────────────────────────────────────────────────────────

interface DebtLoan {
  id: string;
  tab_id: string;
  lender: string;
  loan_number: string;
  description: string;
  entity: string;
  balance: number;
  origination_date: string | null;
  maturity_date: string | null;
  term_months: number | null;
  interest_rate: number;
  monthly_payment: number;
  beginning_balance: number;
  loan_type: string;
  unit_numbers: string;
  auto_pull: boolean;
  notes: string;
  sort_order: number;
}

interface LenderGroup {
  lender: string;
  loans: DebtLoan[];
  totalBalance: number;
  totalMonthlyPayment: number;
}

interface EditForm {
  lender: string;
  loan_number: string;
  description: string;
  entity: string;
  balance: string;
  origination_date: string;
  maturity_date: string;
  term_months: string;
  interest_rate: string;
  monthly_payment: string;
  beginning_balance: string;
  loan_type: string;
  unit_numbers: string;
  auto_pull: boolean;
  notes: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  if (n < 0) return `(${Math.abs(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })})`;
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtFull(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function fmtRate(r: number): string {
  return (r * 100).toFixed(2) + '%';
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const parts = d.split('T')[0].split('-');
  if (parts.length < 3) return d;
  return `${parts[1]}/${parts[2]}/${parts[0]}`;
}

function blankEditForm(tabId?: string, lender?: string): EditForm {
  return {
    lender: lender ?? '',
    loan_number: '',
    description: '',
    entity: '',
    balance: '',
    origination_date: '',
    maturity_date: '',
    term_months: '',
    interest_rate: '',
    monthly_payment: '',
    beginning_balance: '',
    loan_type: 'Debt',
    unit_numbers: '',
    auto_pull: false,
    notes: '',
  };
  void tabId;
}

function loanToForm(loan: DebtLoan): EditForm {
  return {
    lender: loan.lender,
    loan_number: loan.loan_number,
    description: loan.description,
    entity: loan.entity,
    balance: loan.balance === 0 ? '0' : String(loan.balance),
    origination_date: loan.origination_date?.split('T')[0] ?? '',
    maturity_date: loan.maturity_date?.split('T')[0] ?? '',
    term_months: loan.term_months != null ? String(loan.term_months) : '',
    interest_rate: (loan.interest_rate * 100).toFixed(4),
    monthly_payment: String(loan.monthly_payment),
    beginning_balance: String(loan.beginning_balance),
    loan_type: loan.loan_type,
    unit_numbers: loan.unit_numbers,
    auto_pull: loan.auto_pull,
    notes: loan.notes,
  };
}

const ENTITIES = ['Bros', 'Enterprise', 'WHS', 'SAE', 'Logistics', 'MH1', 'MH2', 'MH3', 'MH5', ''];
const LOAN_TYPES = ['Debt', 'Capital Lease', 'Lease'];

// ── Loan Form Modal ────────────────────────────────────────────────────────

function LoanModal({
  form, setForm, onSave, onClose, title, saving
}: {
  form: EditForm;
  setForm: (f: EditForm) => void;
  onSave: () => void;
  onClose: () => void;
  title: string;
  saving: boolean;
}) {
  function field(label: string, key: keyof EditForm, type = 'text', opts?: { placeholder?: string; options?: string[] }) {
    const val = form[key];
    if (opts?.options) {
      return (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: '#9A9690' }}>{label}</label>
          <select
            value={String(val)}
            onChange={e => setForm({ ...form, [key]: e.target.value })}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: '#1A1917', border: '1px solid #2C2A27', color: '#F5F3EE' }}
          >
            {opts.options.map(o => <option key={o} value={o}>{o || '(none)'}</option>)}
          </select>
        </div>
      );
    }
    if (type === 'checkbox') {
      return (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={`field-${key}`}
            checked={Boolean(val)}
            onChange={e => setForm({ ...form, [key]: e.target.checked })}
            className="w-4 h-4 rounded"
            style={{ accentColor: '#C8A96E' }}
          />
          <label htmlFor={`field-${key}`} className="text-sm" style={{ color: '#C8C4BC' }}>{label}</label>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" style={{ color: '#9A9690' }}>{label}</label>
        <input
          type={type}
          value={String(val)}
          onChange={e => setForm({ ...form, [key]: e.target.value })}
          placeholder={opts?.placeholder}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: '#1A1917', border: '1px solid #2C2A27', color: '#F5F3EE' }}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]" style={{ background: '#141210', border: '1px solid #2C2A27' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #2C2A27' }}>
          <h2 className="text-base font-semibold" style={{ color: '#F5F3EE' }}>{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-white/5">
            <X className="w-4 h-4" style={{ color: '#9A9690' }} />
          </button>
        </div>

        <div className="overflow-y-auto p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            {field('Lender', 'lender', 'text', { placeholder: 'e.g. BMO' })}
            {field('Loan Number', 'loan_number', 'text', { placeholder: 'e.g. 05-2938-000-000-00' })}
          </div>
          {field('Description', 'description', 'text', { placeholder: 'e.g. 25 Trailers' })}
          <div className="grid grid-cols-2 gap-4">
            {field('Entity', 'entity', 'text', { options: ENTITIES })}
            {field('Loan Type', 'loan_type', 'text', { options: LOAN_TYPES })}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {field('Current Balance ($)', 'balance', 'number', { placeholder: '0.00' })}
            {field('Beginning Balance ($)', 'beginning_balance', 'number', { placeholder: '0.00' })}
          </div>
          <div className="grid grid-cols-3 gap-4">
            {field('Monthly Payment ($)', 'monthly_payment', 'number', { placeholder: '0.00' })}
            {field('Interest Rate (%)', 'interest_rate', 'number', { placeholder: '3.80' })}
            {field('Term (months)', 'term_months', 'number', { placeholder: '84' })}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {field('Origination Date', 'origination_date', 'date')}
            {field('Maturity Date', 'maturity_date', 'date')}
          </div>
          {field('Unit Numbers', 'unit_numbers', 'text', { placeholder: 'e.g. 53337-53361' })}
          {field('Notes', 'notes', 'text', { placeholder: 'Optional notes' })}
          {field('Auto Pull', 'auto_pull', 'checkbox')}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid #2C2A27' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm transition-colors hover:bg-white/5"
            style={{ color: '#9A9690' }}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving || !form.lender.trim() || !form.description.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-opacity disabled:opacity-50"
            style={{ background: '#C8A96E', color: '#141210' }}
          >
            <Check className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save Loan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Amortization Schedule ──────────────────────────────────────────────────

interface AmortRow {
  n: number;
  date: string;
  rawDate: Date | null;
  opening: number | null;
  interest: number | null;
  principal: number | null;
  ending: number | null;
  payment: number | null;
  notes: string;
  fromCsv: boolean;
}

function parseMoney(s: string): number | null {
  if (!s || s.trim() === '') return null;
  const cleaned = s.replace(/[$,\s]/g, '');
  const n = parseFloat(cleaned);
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

// Parse the compiled CSV once and index by GL# (column index 2)
function parseCsvSchedules(csv: string): Map<string, AmortRow[]> {
  const map = new Map<string, AmortRow[]>();
  const lines = csv.split('\n');
  // skip header (line 0)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted fields with commas
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

    const pmtNumStr = cols[16]?.trim();
    const pmtNum = parseInt(pmtNumStr, 10);
    if (isNaN(pmtNum)) continue;

    const rawDate = parseDate(cols[17]?.trim());
    const payment = parseMoney(cols[18]);
    const principal = parseMoney(cols[19]);
    const interest = parseMoney(cols[20]);
    const ending = parseMoney(cols[21]);
    const notes = cols[22]?.trim() ?? '';

    // opening balance = ending + principal (if both present)
    const opening = (ending !== null && principal !== null) ? ending + principal : null;

    let dateLabel = '';
    if (rawDate) {
      dateLabel = rawDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } else if (cols[17]?.trim()) {
      dateLabel = cols[17].trim();
    }

    const row: AmortRow = {
      n: pmtNum,
      date: dateLabel,
      rawDate,
      opening,
      interest,
      principal,
      ending,
      payment,
      notes,
      fromCsv: true,
    };

    if (!map.has(glNum)) map.set(glNum, []);
    map.get(glNum)!.push(row);
  }

  // Sort each loan's rows by payment number
  for (const rows of map.values()) {
    rows.sort((a, b) => a.n - b.n);
  }

  return map;
}

function buildFallbackSchedule(loan: DebtLoan): AmortRow[] {
  const rows: AmortRow[] = [];
  const monthlyRate = loan.interest_rate / 12;
  let balance = loan.balance;
  if (balance <= 0) return [];

  let cursor: Date;
  if (loan.origination_date) {
    const orig = new Date(loan.origination_date + 'T00:00:00');
    cursor = new Date(orig.getFullYear(), orig.getMonth() + 1, orig.getDate());
  } else {
    const now = new Date();
    cursor = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (cursor < today) {
    cursor = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  }

  let n = 1;
  const maxPayments = 600;
  while (balance > 0.005 && n <= maxPayments) {
    const interest = monthlyRate > 0 ? balance * monthlyRate : 0;
    const payment = Math.min(loan.monthly_payment, balance + interest);
    const principal = payment - interest;
    const ending = Math.max(0, balance - principal);
    const mo = cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    rows.push({ n, date: mo, rawDate: new Date(cursor), opening: balance, interest, principal, ending, payment, notes: '', fromCsv: false });
    balance = ending;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate());
    n++;
  }
  return rows;
}

interface DateOverride {
  id: string;
  payment_number: number;
  override_date: string; // ISO yyyy-mm-dd
  recurring: boolean;
}

/** Apply overrides to a schedule. Recurring overrides shift the day-of-month
 *  for that payment and all subsequent ones. One-off overrides only move
 *  the specific payment row. */
function applyOverrides(schedule: AmortRow[], overrides: DateOverride[]): AmortRow[] {
  if (overrides.length === 0) return schedule;

  const result = schedule.map(r => ({ ...r }));

  // Sort overrides by payment_number ascending so we apply them in order
  const sorted = [...overrides].sort((a, b) => a.payment_number - b.payment_number);

  for (const ov of sorted) {
    const idx = result.findIndex(r => r.n === ov.payment_number);
    if (idx === -1) continue;

    const newDate = new Date(ov.override_date + 'T12:00:00');

    if (ov.recurring) {
      // Compute day-of-month from the override date
      const newDay = newDate.getDate();
      for (let i = idx; i < result.length; i++) {
        const orig = result[i].rawDate;
        if (orig) {
          const shifted = new Date(orig.getFullYear(), orig.getMonth(), newDay);
          result[i] = {
            ...result[i],
            rawDate: shifted,
            date: shifted.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          };
        }
      }
    } else {
      result[idx] = {
        ...result[idx],
        rawDate: newDate,
        date: newDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      };
    }
  }

  return result;
}

// ── Date edit dialog ──────────────────────────────────────────────────────

function DateEditDialog({ row, loan, existing, onSave, onCancel }: {
  row: AmortRow;
  loan: DebtLoan;
  existing: DateOverride | undefined;
  onSave: (override: { payment_number: number; override_date: string; recurring: boolean }) => Promise<void>;
  onCancel: () => void;
}) {
  const initialDate = existing?.override_date
    ?? (row.rawDate ? row.rawDate.toISOString().slice(0, 10) : '');
  const [dateVal, setDateVal] = useState(initialDate);
  const [step, setStep] = useState<'pick' | 'recurring'>('pick');
  const [saving, setSaving] = useState(false);

  async function handleRecurring(recurring: boolean) {
    setSaving(true);
    await onSave({ payment_number: row.n, override_date: dateVal, recurring });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: '#141210', border: '1px solid #2C2A27' }}>
        {step === 'pick' ? (
          <>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid #2C2A27' }}>
              <div className="text-sm font-semibold" style={{ color: '#F5F3EE' }}>
                Edit Payment Date — #{row.n}
              </div>
              <div className="text-xs mt-0.5" style={{ color: '#6B6865' }}>
                {loan.lender} · {loan.description}
              </div>
            </div>
            <div className="p-5">
              <label className="text-xs font-medium block mb-1.5" style={{ color: '#9A9690' }}>Payment Date</label>
              <input
                type="date"
                value={dateVal}
                onChange={e => setDateVal(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: '#1A1917', border: '1px solid #2C2A27', color: '#F5F3EE' }}
              />
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={onCancel}
                className="flex-1 py-2 rounded-lg text-sm transition-colors hover:bg-white/5"
                style={{ border: '1px solid #2C2A27', color: '#9A9690' }}
              >
                Cancel
              </button>
              <button
                disabled={!dateVal}
                onClick={() => setStep('recurring')}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ background: dateVal ? '#C8A96E' : '#2C2A27', color: dateVal ? '#0F0E0C' : '#4A4844' }}
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid #2C2A27' }}>
              <div className="text-sm font-semibold" style={{ color: '#F5F3EE' }}>Apply to future payments?</div>
              <div className="text-xs mt-0.5" style={{ color: '#6B6865' }}>
                New date: {new Date(dateVal + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
            <div className="p-5 space-y-3">
              <button
                disabled={saving}
                onClick={() => handleRecurring(true)}
                className="w-full flex items-start gap-3 p-4 rounded-xl text-left transition-colors hover:bg-white/5"
                style={{ border: '1px solid #2C2A27', background: '#1A1917' }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(200,169,110,0.12)' }}>
                  <RefreshCw className="w-4 h-4" style={{ color: '#C8A96E' }} />
                </div>
                <div>
                  <div className="text-sm font-medium" style={{ color: '#F5F3EE' }}>Recurring</div>
                  <div className="text-xs mt-0.5 leading-snug" style={{ color: '#6B6865' }}>
                    Shift payment #{row.n} and all future payments to the {new Date(dateVal + 'T12:00:00').getDate()}{ordinal(new Date(dateVal + 'T12:00:00').getDate())} of each month
                  </div>
                </div>
              </button>
              <button
                disabled={saving}
                onClick={() => handleRecurring(false)}
                className="w-full flex items-start gap-3 p-4 rounded-xl text-left transition-colors hover:bg-white/5"
                style={{ border: '1px solid #2C2A27', background: '#1A1917' }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(168,197,218,0.1)' }}>
                  <Calendar className="w-4 h-4" style={{ color: '#A8C5DA' }} />
                </div>
                <div>
                  <div className="text-sm font-medium" style={{ color: '#F5F3EE' }}>This payment only</div>
                  <div className="text-xs mt-0.5" style={{ color: '#6B6865' }}>Only move payment #{row.n}</div>
                </div>
              </button>
            </div>
            <div className="px-5 pb-5">
              <button
                onClick={() => setStep('pick')}
                className="w-full py-2 rounded-lg text-sm transition-colors hover:bg-white/5"
                style={{ border: '1px solid #2C2A27', color: '#9A9690' }}
              >
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ordinal(n: number): string {
  if (n >= 11 && n <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function AmortModal({ loan, onClose, csvSchedules }: { loan: DebtLoan; onClose: () => void; csvSchedules: Map<string, AmortRow[]> }) {
  const csvRows = csvSchedules.get(loan.loan_number) ?? [];
  const hasCsv = csvRows.length > 0;
  const baseSchedule = hasCsv ? csvRows : buildFallbackSchedule(loan);

  const [overrides, setOverrides] = useState<DateOverride[]>([]);
  const [editingRow, setEditingRow] = useState<AmortRow | null>(null);
  const [loadingOverrides, setLoadingOverrides] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('loan_payment_date_overrides')
        .select('id, payment_number, override_date, recurring')
        .eq('loan_id', loan.id)
        .order('payment_number');
      setOverrides((data ?? []) as DateOverride[]);
      setLoadingOverrides(false);
    }
    load();
  }, [loan.id]);

  const schedule = useMemo(
    () => applyOverrides(baseSchedule, overrides),
    [baseSchedule, overrides]
  );

  async function handleSaveOverride({ payment_number, override_date, recurring }: {
    payment_number: number; override_date: string; recurring: boolean;
  }) {
    const existing = overrides.find(o => o.payment_number === payment_number);

    if (existing) {
      await supabase
        .from('loan_payment_date_overrides')
        .update({ override_date, recurring, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('loan_payment_date_overrides')
        .insert({ loan_id: loan.id, loan_number: loan.loan_number, payment_number, override_date, recurring });
    }

    // Reload overrides
    const { data } = await supabase
      .from('loan_payment_date_overrides')
      .select('id, payment_number, override_date, recurring')
      .eq('loan_id', loan.id)
      .order('payment_number');
    setOverrides((data ?? []) as DateOverride[]);
    setEditingRow(null);
  }

  const totalInterest = schedule.reduce((s, r) => s + (r.interest ?? 0), 0);
  const totalPrincipal = schedule.reduce((s, r) => s + (r.principal ?? 0), 0);
  const payoffDate = schedule.length > 0 ? schedule[schedule.length - 1].date : '—';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayIdx = schedule.findIndex(r => {
    if (!r.rawDate) return false;
    const d = new Date(r.rawDate);
    d.setHours(0, 0, 0, 0);
    return d >= today && r.payment !== null;
  });

  const currentBalanceRow = todayIdx > 0 ? schedule[todayIdx - 1].ending : null;
  const displayBalance = currentBalanceRow !== null ? currentBalanceRow : loan.balance;

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-5xl rounded-2xl flex flex-col overflow-hidden" style={{ background: '#0F0E0C', border: '1px solid #2C2A27', maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #2C2A27' }}>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold" style={{ color: '#F5F3EE' }}>
                Amortization Schedule — {loan.lender}
              </h2>
              {hasCsv ? (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ADE80' }}>
                  <FileText className="w-3 h-3" />
                  Actual Data
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(200,169,110,0.1)', color: '#C8A96E' }}>
                  Calculated
                </span>
              )}
              {overrides.length > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(168,197,218,0.1)', color: '#A8C5DA' }}>
                  <Calendar className="w-3 h-3" />
                  {overrides.length} date override{overrides.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color: '#6B6865' }}>
              {loan.description}{loan.entity ? ` · ${loan.entity}` : ''} · {fmtRate(loan.interest_rate)} · {fmtFull(loan.monthly_payment)}/mo
              {!loadingOverrides && <span style={{ color: '#4A4844' }}> · Click any date to edit</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-white/5 flex-shrink-0 ml-4">
            <X className="w-4 h-4" style={{ color: '#9A9690' }} />
          </button>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-4 gap-px flex-shrink-0" style={{ background: '#2C2A27' }}>
          {[
            { label: 'Current Balance', value: fmtFull(displayBalance), color: '#F5F3EE' },
            { label: 'Total Interest', value: fmt(totalInterest), color: '#F87171' },
            { label: 'Total Principal', value: fmt(totalPrincipal), color: '#4ADE80' },
            { label: 'Payoff Date', value: payoffDate, color: '#C8A96E' },
          ].map(s => (
            <div key={s.label} className="px-5 py-3" style={{ background: '#141210' }}>
              <div className="text-xs mb-0.5" style={{ color: '#6B6865' }}>{s.label}</div>
              <div className="text-sm font-semibold" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        {schedule.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm" style={{ color: '#4A4844' }}>
            No schedule available — balance is zero or no payment data.
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-xs">
              <thead className="sticky top-0" style={{ background: '#141210', borderBottom: '1px solid #2C2A27' }}>
                <tr>
                  {['#', 'Date', 'Payment', 'Opening Balance', 'Interest', 'Principal', 'Ending Balance'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-right first:text-left font-medium whitespace-nowrap" style={{ color: '#6B6865' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schedule.map((row, i) => {
                  const isCurrentPayment = i === todayIdx;
                  const isFinal = i === schedule.length - 1;
                  const hasData = row.payment !== null || row.principal !== null;
                  const hasOverride = overrides.some(o => o.payment_number === row.n);
                  const recurringOverride = overrides.find(o => o.payment_number === row.n && o.recurring);
                  return (
                    <tr
                      key={row.n}
                      style={{
                        borderBottom: '1px solid #1A1917',
                        background: isCurrentPayment ? 'rgba(200,169,110,0.07)' : isFinal ? 'rgba(74,222,128,0.05)' : 'transparent',
                        opacity: hasData ? 1 : 0.4,
                      }}
                    >
                      <td className="px-4 py-2 font-mono" style={{ color: isCurrentPayment ? '#C8A96E' : '#4A4844' }}>{row.n}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <button
                          onClick={() => setEditingRow(row)}
                          className="flex items-center gap-1.5 group transition-colors rounded px-1.5 py-0.5 -mx-1.5"
                          style={{ color: isCurrentPayment ? '#C8A96E' : hasOverride ? '#A8C5DA' : '#9A9690' }}
                          title="Click to edit payment date"
                        >
                          <span className="font-medium">{row.date}</span>
                          {hasOverride && (
                            recurringOverride
                              ? <RefreshCw className="w-3 h-3 flex-shrink-0" style={{ color: '#A8C5DA' }} />
                              : <Calendar className="w-3 h-3 flex-shrink-0" style={{ color: '#A8C5DA' }} />
                          )}
                          {!hasOverride && (
                            <Edit2 className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-40 transition-opacity" />
                          )}
                          {isCurrentPayment && <span className="ml-1 text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(200,169,110,0.15)', color: '#C8A96E' }}>Current</span>}
                          {isFinal && !isCurrentPayment && <span className="ml-1 text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(74,222,128,0.12)', color: '#4ADE80' }}>Payoff</span>}
                        </button>
                      </td>
                      <td className="px-4 py-2 text-right font-mono" style={{ color: '#C8C4BC' }}>{row.payment !== null ? fmtFull(row.payment) : '—'}</td>
                      <td className="px-4 py-2 text-right font-mono" style={{ color: '#C8C4BC' }}>{row.opening !== null ? fmtFull(row.opening) : '—'}</td>
                      <td className="px-4 py-2 text-right font-mono" style={{ color: '#F87171' }}>{row.interest !== null ? fmtFull(row.interest) : '—'}</td>
                      <td className="px-4 py-2 text-right font-mono" style={{ color: '#4ADE80' }}>{row.principal !== null ? fmtFull(row.principal) : '—'}</td>
                      <td className="px-4 py-2 text-right font-mono font-semibold" style={{ color: row.ending !== null && row.ending <= 0 ? '#4ADE80' : '#F5F3EE' }}>
                        {row.ending !== null ? fmtFull(row.ending) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>

    {editingRow && (
      <DateEditDialog
        row={editingRow}
        loan={loan}
        existing={overrides.find(o => o.payment_number === editingRow.n)}
        onSave={handleSaveOverride}
        onCancel={() => setEditingRow(null)}
      />
    )}
    </>
  );
}

// ── Lender Row ─────────────────────────────────────────────────────────────

function LenderGroup({
  group, canEdit, onEdit, onDelete, onAdd, onAmortize
}: {
  group: LenderGroup;
  canEdit: boolean;
  onEdit: (loan: DebtLoan) => void;
  onDelete: (id: string) => void;
  onAdd: (lender: string) => void;
  onAmortize: (loan: DebtLoan) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const highRate = group.loans.some(l => l.interest_rate >= 0.08);


  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2C2A27' }}>
      {/* Lender header */}
      <div
        className="w-full flex items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.02] cursor-pointer"
        style={{ background: '#1A1917' }}
        onClick={group.loans.length === 1 ? undefined : () => setExpanded(e => !e)}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#242220', border: '1px solid #2C2A27' }}>
          <Building2 className="w-4 h-4" style={{ color: '#C8A96E' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: '#F5F3EE' }}>{group.lender}</span>
            {highRate && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(239,68,68,0.12)', color: '#F87171' }}>
                <AlertTriangle className="w-3 h-3" />
                High Rate
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-0.5">
            <span className="text-xs" style={{ color: '#9A9690' }}>
              {group.loans.length} {group.loans.length === 1 ? 'loan' : 'loans'}
            </span>
            <span className="text-xs" style={{ color: '#9A9690' }}>
              {fmt(group.totalMonthlyPayment)}/mo
            </span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-bold" style={{ color: group.totalBalance > 0 ? '#F5F3EE' : '#4ADE80' }}>
            {fmt(group.totalBalance)}
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#4A4844' }}>balance</div>
        </div>
        {/* Single loan: show schedule icon; multi-loan: show expand chevron */}
        {group.loans.length === 1 ? (
          <button
            onClick={e => { e.stopPropagation(); onAmortize(group.loans[0]); }}
            className="ml-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0"
            style={{ background: 'rgba(200,169,110,0.1)', border: '1px solid rgba(200,169,110,0.2)', color: '#C8A96E' }}
          >
            <TableProperties className="w-3.5 h-3.5" />
            Schedule
          </button>
        ) : (
          <div className="ml-3 flex-shrink-0">
            {expanded
              ? <ChevronDown className="w-4 h-4" style={{ color: '#9A9690' }} />
              : <ChevronRight className="w-4 h-4" style={{ color: '#9A9690' }} />}
          </div>
        )}
      </div>

      {/* Loans table */}
      {expanded && (
        <div style={{ background: '#111009', borderTop: '1px solid #2C2A27' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: '1px solid #1E1C1A' }}>
                  {['Description', 'Entity', 'Loan #', 'Type', 'Orig. Date', 'Mat. Date', 'Rate', 'Monthly Pmt', 'Beg. Balance', 'Balance', 'Units', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium whitespace-nowrap" style={{ color: '#6B6865' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.loans.map(loan => (
                  <tr
                    key={loan.id}
                    className="transition-colors hover:bg-white/[0.03] cursor-pointer"
                    style={{ borderBottom: '1px solid #1A1917' }}
                    onClick={() => onAmortize(loan)}
                  >
                    <td className="px-4 py-3" style={{ color: '#C8C4BC' }}>
                      <div className="font-medium">{loan.description}</div>
                      {loan.notes && <div className="text-xs mt-0.5" style={{ color: '#4A4844' }}>{loan.notes}</div>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {loan.entity ? (
                        <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: '#1E1C1A', color: '#9A9690', border: '1px solid #2C2A27' }}>
                          {loan.entity}
                        </span>
                      ) : <span style={{ color: '#4A4844' }}>—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono whitespace-nowrap" style={{ color: '#6B6865' }}>{loan.loan_number || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-xs" style={{
                        background: loan.loan_type === 'Capital Lease' ? 'rgba(99,102,241,0.12)' : 'rgba(200,169,110,0.1)',
                        color: loan.loan_type === 'Capital Lease' ? '#A5B4FC' : '#C8A96E'
                      }}>
                        {loan.loan_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#9A9690' }}>{fmtDate(loan.origination_date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#9A9690' }}>{fmtDate(loan.maturity_date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium" style={{ color: loan.interest_rate >= 0.08 ? '#F87171' : loan.interest_rate >= 0.05 ? '#FCD34D' : '#C8C4BC' }}>
                      {fmtRate(loan.interest_rate)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right font-medium" style={{ color: '#C8C4BC' }}>{fmtFull(loan.monthly_payment)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-right" style={{ color: '#6B6865' }}>{fmtFull(loan.beginning_balance)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-right font-bold" style={{ color: loan.balance <= 0 ? '#4ADE80' : '#F5F3EE' }}>
                      {fmtFull(loan.balance)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap max-w-[140px]" style={{ color: '#9A9690' }}>
                      <div className="truncate">{loan.unit_numbers || '—'}</div>
                      {loan.auto_pull && <div className="text-xs" style={{ color: '#4ADE80' }}>Auto Pull</div>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onAmortize(loan)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors hover:bg-white/[0.06]"
                          title="Amortization schedule"
                          style={{ background: 'rgba(200,169,110,0.08)', color: '#C8A96E' }}
                        >
                          <TableProperties className="w-3 h-3" />
                          Schedule
                        </button>
                        {canEdit && (
                          <>
                            <button onClick={() => onEdit(loan)} className="p-1.5 rounded-lg transition-colors hover:bg-white/[0.06]">
                              <Edit2 className="w-3.5 h-3.5" style={{ color: '#6B6865' }} />
                            </button>
                            <button onClick={() => onDelete(loan.id)} className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10">
                              <Trash2 className="w-3.5 h-3.5" style={{ color: '#6B6865' }} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canEdit && (
            <div className="px-4 py-2.5" style={{ borderTop: '1px solid #1E1C1A' }}>
              <button
                onClick={() => onAdd(group.lender)}
                className="flex items-center gap-1.5 text-xs transition-colors hover:opacity-80"
                style={{ color: '#C8A96E' }}
              >
                <Plus className="w-3.5 h-3.5" /> Add loan to {group.lender}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

interface DebtReportProps {
  tabId: string;
  uploaderName: string;
}

export default function DebtReport({ tabId, uploaderName }: DebtReportProps) {
  const [loans, setLoans] = useState<DebtLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [locked, setLocked] = useState(false);
  const [togglingLock, setTogglingLock] = useState(false);
  const [editingLoan, setEditingLoan] = useState<DebtLoan | null>(null);
  const [addingLender, setAddingLender] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm>(blankEditForm());
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [amortLoan, setAmortLoan] = useState<DebtLoan | null>(null);

  const csvSchedules = useMemo(() => parseCsvSchedules(compiledCsv), []);

  const canEdit = !locked;

  const loadLoans = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('debt_loans')
      .select('*')
      .eq('tab_id', tabId)
      .order('sort_order')
      .order('lender');
    if (err) { setError(err.message); setLoading(false); return; }
    setLoans((data ?? []) as DebtLoan[]);
    setLoading(false);
  }, [tabId]);

  useEffect(() => { loadLoans(); }, [loadLoans]);

  // ── Derived state ──

  const filtered = search
    ? loans.filter(l =>
        l.lender.toLowerCase().includes(search.toLowerCase()) ||
        l.description.toLowerCase().includes(search.toLowerCase()) ||
        l.unit_numbers.toLowerCase().includes(search.toLowerCase()) ||
        l.loan_number.toLowerCase().includes(search.toLowerCase()) ||
        l.entity.toLowerCase().includes(search.toLowerCase())
      )
    : loans;

  const groups: LenderGroup[] = [];
  const lenderMap = new Map<string, LenderGroup>();
  for (const loan of filtered) {
    if (!lenderMap.has(loan.lender)) {
      const g: LenderGroup = { lender: loan.lender, loans: [], totalBalance: 0, totalMonthlyPayment: 0 };
      lenderMap.set(loan.lender, g);
      groups.push(g);
    }
    const g = lenderMap.get(loan.lender)!;
    g.loans.push(loan);
    g.totalBalance += loan.balance;
    g.totalMonthlyPayment += loan.monthly_payment;
  }

  const totalBalance = loans.reduce((s, l) => s + l.balance, 0);
  const totalMonthly = loans.reduce((s, l) => s + l.monthly_payment, 0);
  const weightedRate = loans.reduce((s, l) => s + l.interest_rate * l.balance, 0) / (totalBalance || 1);
  const lenderCount = new Set(loans.map(l => l.lender)).size;

  // ── Handlers ──

  async function toggleLock() {
    setTogglingLock(true);
    setLocked(l => !l);
    setTogglingLock(false);
  }

  function openEdit(loan: DebtLoan) {
    setEditingLoan(loan);
    setForm(loanToForm(loan));
  }

  function openAdd(lender: string) {
    setAddingLender(lender);
    setForm(blankEditForm(tabId, lender));
  }

  async function handleSave() {
    setSaving(true);
    const payload = {
      tab_id: tabId,
      lender: form.lender.trim(),
      loan_number: form.loan_number.trim(),
      description: form.description.trim(),
      entity: form.entity,
      balance: parseFloat(form.balance) || 0,
      origination_date: form.origination_date || null,
      maturity_date: form.maturity_date || null,
      term_months: form.term_months ? parseInt(form.term_months) : null,
      interest_rate: parseFloat(form.interest_rate) / 100 || 0,
      monthly_payment: parseFloat(form.monthly_payment) || 0,
      beginning_balance: parseFloat(form.beginning_balance) || 0,
      loan_type: form.loan_type,
      unit_numbers: form.unit_numbers.trim(),
      auto_pull: form.auto_pull,
      notes: form.notes.trim(),
      sort_order: editingLoan?.sort_order ?? (loans.length + 1) * 10,
      updated_at: new Date().toISOString(),
    };

    if (editingLoan) {
      const { error: err } = await supabase
        .from('debt_loans')
        .update(payload)
        .eq('id', editingLoan.id);
      if (err) { setSaving(false); return; }
    } else {
      const { error: err } = await supabase
        .from('debt_loans')
        .insert({ ...payload });
      if (err) { setSaving(false); return; }
    }

    setSaving(false);
    setEditingLoan(null);
    setAddingLender(null);
    loadLoans();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this loan?')) return;
    setDeletingId(id);
    await supabase.from('debt_loans').delete().eq('id', id);
    setDeletingId(id);
    setLoans(prev => prev.filter(l => l.id !== id));
    setDeletingId(null);
  }

  // ── Render ──

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#0F0E0C' }}>
      {/* Header */}
      <div className="flex-shrink-0 px-8 pt-8 pb-6">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#F5F3EE' }}>Debt Schedule</h1>
            <p className="text-sm mt-1" style={{ color: '#6B6865' }}>
              As of January 31, 2026 · Effective avg rate: {(weightedRate * 100).toFixed(2)}%
            </p>
          </div>
          <div className="flex items-center gap-3">
            {canEdit !== undefined && (
              <button
                onClick={toggleLock}
                disabled={togglingLock}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{ background: locked ? 'rgba(200,169,110,0.1)' : '#1A1917', border: '1px solid #2C2A27', color: locked ? '#C8A96E' : '#9A9690' }}
              >
                {locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                {locked ? 'Locked' : 'Unlocked'}
              </button>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Debt', value: fmt(totalBalance), icon: DollarSign, color: '#F5F3EE', sub: `${loans.length} loans` },
            { label: 'Monthly Payments', value: fmt(totalMonthly), icon: Calendar, color: '#C8A96E', sub: `${fmt(totalMonthly * 12)}/yr` },
            { label: 'Weighted Avg Rate', value: (weightedRate * 100).toFixed(2) + '%', icon: Percent, color: weightedRate >= 0.07 ? '#F87171' : '#4ADE80', sub: 'effective rate' },
            { label: 'Lenders', value: String(lenderCount), icon: Building2, color: '#A8C5DA', sub: `${groups.length} active` },
          ].map(card => (
            <div key={card.label} className="rounded-xl p-4" style={{ background: '#141210', border: '1px solid #2C2A27' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium" style={{ color: '#6B6865' }}>{card.label}</span>
                <card.icon className="w-4 h-4" style={{ color: card.color }} />
              </div>
              <div className="text-xl font-bold" style={{ color: card.color }}>{card.value}</div>
              <div className="text-xs mt-1" style={{ color: '#4A4844' }}>{card.sub}</div>
            </div>
          ))}
        </div>

        {/* Search + Add */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#4A4844' }} />
            <input
              type="text"
              placeholder="Search lender, description, units…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg text-sm outline-none"
              style={{ background: '#141210', border: '1px solid #2C2A27', color: '#F5F3EE' }}
            />
          </div>
          {canEdit && (
            <button
              onClick={() => openAdd('')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: '#C8A96E', color: '#141210' }}
            >
              <Plus className="w-4 h-4" /> Add Loan
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: '#2C2A27', borderTopColor: '#C8A96E' }} />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 p-4 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: '#F87171' }} />
            <span className="text-sm" style={{ color: '#F87171' }}>{error}</span>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <TrendingDown className="w-10 h-10" style={{ color: '#2C2A27' }} />
            <p className="text-sm" style={{ color: '#4A4844' }}>
              {search ? 'No results found.' : 'No debt records found.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map(group => (
              <LenderGroup
                key={group.lender}
                group={group}
                canEdit={canEdit}
                onEdit={openEdit}
                onDelete={handleDelete}
                onAdd={openAdd}
                onAmortize={setAmortLoan}
              />
            ))}

            {/* Grand total */}
            <div className="rounded-xl px-5 py-4 flex items-center justify-between" style={{ background: '#1A1917', border: '1px solid #2C2A27' }}>
              <div>
                <div className="text-sm font-semibold" style={{ color: '#F5F3EE' }}>Grand Total</div>
                <div className="text-xs mt-0.5" style={{ color: '#6B6865' }}>{loans.length} loans across {lenderCount} lenders</div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold" style={{ color: '#F5F3EE' }}>{fmtFull(totalBalance)}</div>
                <div className="text-xs mt-0.5" style={{ color: '#6B6865' }}>{fmtFull(totalMonthly)}/mo</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Loan form modal */}
      {(editingLoan || addingLender !== null) && (
        <LoanModal
          form={form}
          setForm={setForm}
          onSave={handleSave}
          onClose={() => { setEditingLoan(null); setAddingLender(null); }}
          title={editingLoan ? 'Edit Loan' : 'Add New Loan'}
          saving={saving}
        />
      )}

      {/* Delete spinner overlay */}
      {deletingId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: '#2C2A27', borderTopColor: '#C8A96E' }} />
        </div>
      )}

      {/* Amortization schedule modal */}
      {amortLoan && (
        <AmortModal loan={amortLoan} onClose={() => setAmortLoan(null)} csvSchedules={csvSchedules} />
      )}
    </div>
  );
}
