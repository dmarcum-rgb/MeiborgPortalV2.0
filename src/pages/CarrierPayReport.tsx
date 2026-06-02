import { useState, useCallback, useEffect } from 'react';
import {
  RefreshCw, ChevronDown, ChevronRight, AlertTriangle,
  Truck, DollarSign, Clock, CheckCircle, XCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const MCLEOD_FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcleod-pull`;
const MCLEOD_HEADERS = {
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

// ── Types ──────────────────────────────────────────────────────────────────

export interface CarrierSettlement {
  payeeId: string;
  payeeName: string;
  movementId: string;
  orderId: string;
  originCity: string;
  originState: string;
  destCity: string;
  destState: string;
  shipDate: string;
  deliveryDate: string;
  totalPay: number;
  readyToPay: boolean;
  status: 'OPEN' | 'PAID';
}

export interface CarrierPayee {
  payeeId: string;
  payeeName: string;
  settlements: CarrierSettlement[];
  totals: {
    open: number;
    paid: number;
    readyToPay: number;
    count: number;
  };
}

export interface CarrierPayReportData {
  pulledAt: string;
  payees: CarrierPayee[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function parseMcleodDate(s: string | null | undefined): string {
  if (!s || s.length < 8) return '';
  const y = s.slice(0, 4), mo = s.slice(4, 6), d = s.slice(6, 8);
  return `${parseInt(mo)}/${parseInt(d)}/${y}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRows(rows: any[], status: 'OPEN' | 'PAID'): CarrierSettlement[] {
  return rows.map(row => ({
    payeeId: String(row.payee_id ?? ''),
    payeeName: typeof row.payee === 'string' ? row.payee : (row.payee?.name ?? row.payee_id ?? ''),
    movementId: String(row.movement_id ?? ''),
    orderId: String(row.order_id ?? ''),
    originCity: String(row.origin_city ?? ''),
    originState: String(row.origin_state ?? ''),
    destCity: String(row.destination_city ?? ''),
    destState: String(row.destination_state ?? ''),
    shipDate: parseMcleodDate(row.ship_date),
    deliveryDate: parseMcleodDate(row.delivery_date),
    totalPay: parseFloat(row.total_pay) || 0,
    readyToPay: row.ready_to_pay_flag === 'Y',
    status,
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildReport(openRows: any[], histRows: any[]): CarrierPayReportData {
  const all = [
    ...mapRows(openRows, 'OPEN'),
    ...mapRows(histRows, 'PAID'),
  ];

  const payeeMap = new Map<string, CarrierPayee>();
  for (const s of all) {
    if (!payeeMap.has(s.payeeId)) {
      payeeMap.set(s.payeeId, {
        payeeId: s.payeeId,
        payeeName: s.payeeName,
        settlements: [],
        totals: { open: 0, paid: 0, readyToPay: 0, count: 0 },
      });
    }
    const p = payeeMap.get(s.payeeId)!;
    if (s.payeeName && !p.payeeName) p.payeeName = s.payeeName;
    p.settlements.push(s);
  }

  const payees = Array.from(payeeMap.values()).map(p => {
    p.totals = {
      open: p.settlements.filter(s => s.status === 'OPEN').reduce((sum, s) => sum + s.totalPay, 0),
      paid: p.settlements.filter(s => s.status === 'PAID').reduce((sum, s) => sum + s.totalPay, 0),
      readyToPay: p.settlements.filter(s => s.status === 'OPEN' && s.readyToPay).reduce((sum, s) => sum + s.totalPay, 0),
      count: p.settlements.length,
    };
    return p;
  }).sort((a, b) => b.totals.open - a.totals.open);

  return { pulledAt: new Date().toLocaleString('en-US'), payees };
}

// ── Summary Cards ──────────────────────────────────────────────────────────

function SummaryCards({ payees, pulledAt }: { payees: CarrierPayee[]; pulledAt: string }) {
  const totalOpen = payees.reduce((s, p) => s + p.totals.open, 0);
  const totalPaid = payees.reduce((s, p) => s + p.totals.paid, 0);
  const totalReady = payees.reduce((s, p) => s + p.totals.readyToPay, 0);
  const totalSettlements = payees.reduce((s, p) => s + p.totals.count, 0);

  const cards = [
    { label: 'Open Settlements', value: fmt(totalOpen), icon: <DollarSign className="w-4 h-4" />, color: '#C8A96E' },
    { label: 'Ready to Pay', value: fmt(totalReady), icon: <CheckCircle className="w-4 h-4" />, color: '#4ADE80' },
    { label: 'Paid History', value: fmt(totalPaid), icon: <Clock className="w-4 h-4" />, color: '#60A5FA' },
    { label: 'Carriers', value: String(payees.length), icon: <Truck className="w-4 h-4" />, color: '#A8C5DA' },
    { label: 'Total Settlements', value: String(totalSettlements), icon: <DollarSign className="w-4 h-4" />, color: '#9A9690' },
  ];

  return (
    <div className="flex-shrink-0">
      <div className="px-6 py-3 flex items-center gap-4" style={{ borderBottom: '1px solid #1E1C1A' }}>
        <span className="text-xs" style={{ color: '#6B6865' }}>Pulled: {pulledAt}</span>
        <span className="text-xs" style={{ color: '#4A4844' }}>·</span>
        <span className="text-xs" style={{ color: '#6B6865' }}>{payees.length} carriers</span>
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

// ── Payee Row ──────────────────────────────────────────────────────────────

function PayeeRow({ payee, showFilter }: { payee: CarrierPayee; showFilter: 'all' | 'open' | 'paid' }) {
  const [open, setOpen] = useState(false);

  const shown = payee.settlements.filter(s =>
    showFilter === 'all' ? true :
    showFilter === 'open' ? s.status === 'OPEN' : s.status === 'PAID'
  );

  const displayOpen = payee.totals.open;
  const displayReady = payee.totals.readyToPay;

  return (
    <div className="border-b" style={{ borderColor: '#1A1917' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-6 py-3 text-left transition-colors hover:bg-white/[0.02]"
      >
        <span style={{ color: '#4A4844', flexShrink: 0 }}>
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </span>
        <Truck className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#6B6865' }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate" style={{ color: '#F5F3EE' }}>{payee.payeeName || payee.payeeId}</span>
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#1E1C1A', color: '#6B6865', border: '1px solid #262422', flexShrink: 0 }}>
              {payee.payeeId}
            </span>
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#4A4844' }}>
            {payee.totals.count} settlement{payee.totals.count !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="flex items-center gap-6 flex-shrink-0 text-xs">
          {displayReady > 0 && (
            <div className="text-right">
              <div style={{ color: '#4A4844' }}>Ready to Pay</div>
              <div className="font-semibold" style={{ color: '#4ADE80' }}>{fmt(displayReady)}</div>
            </div>
          )}
          {displayOpen > 0 && (
            <div className="text-right">
              <div style={{ color: '#4A4844' }}>Open</div>
              <div className="font-semibold" style={{ color: '#C8A96E' }}>{fmt(displayOpen)}</div>
            </div>
          )}
          {payee.totals.paid > 0 && (
            <div className="text-right">
              <div style={{ color: '#4A4844' }}>Paid</div>
              <div className="font-semibold" style={{ color: '#60A5FA' }}>{fmt(payee.totals.paid)}</div>
            </div>
          )}
        </div>
      </button>

      {open && shown.length > 0 && (
        <div className="px-6 pb-4">
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2C2A27' }}>
            <div className="grid text-xs font-medium py-2 px-3" style={{
              gridTemplateColumns: '90px 90px 1fr 1fr 90px 90px 110px',
              background: '#1A1917', color: '#6B6865', borderBottom: '1px solid #2C2A27',
            }}>
              <span>Order</span>
              <span>Movement</span>
              <span>Origin</span>
              <span>Destination</span>
              <span>Ship Date</span>
              <span>Status</span>
              <span className="text-right">Pay</span>
            </div>
            {shown.map((s, idx) => (
              <div key={idx} className="grid text-xs py-2 px-3 border-b last:border-0" style={{
                gridTemplateColumns: '90px 90px 1fr 1fr 90px 90px 110px',
                borderColor: '#1A1917',
                background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
              }}>
                <span style={{ color: '#C8A96E', fontFamily: 'monospace' }}>{s.orderId || '—'}</span>
                <span style={{ color: '#9A9690', fontFamily: 'monospace' }}>{s.movementId || '—'}</span>
                <span className="truncate pr-2" style={{ color: '#C0BDB7' }}>
                  {[s.originCity, s.originState].filter(Boolean).join(', ') || '—'}
                </span>
                <span className="truncate pr-2" style={{ color: '#C0BDB7' }}>
                  {[s.destCity, s.destState].filter(Boolean).join(', ') || '—'}
                </span>
                <span style={{ color: '#6B6865' }}>{s.shipDate || '—'}</span>
                <span>
                  {s.status === 'OPEN'
                    ? s.readyToPay
                      ? <span style={{ color: '#4ADE80' }} className="flex items-center gap-1"><CheckCircle className="w-3 h-3" />Ready</span>
                      : <span style={{ color: '#FCD34D' }}>Open</span>
                    : <span style={{ color: '#60A5FA' }} className="flex items-center gap-1"><XCircle className="w-3 h-3" />Paid</span>
                  }
                </span>
                <span className="text-right font-medium" style={{ color: s.status === 'PAID' ? '#60A5FA' : s.readyToPay ? '#4ADE80' : '#C8C4BC' }}>
                  {fmt(s.totalPay)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Totals Bar ─────────────────────────────────────────────────────────────

function TotalsBar({ payees }: { payees: CarrierPayee[] }) {
  const totalOpen = payees.reduce((s, p) => s + p.totals.open, 0);
  const totalReady = payees.reduce((s, p) => s + p.totals.readyToPay, 0);
  const totalPaid = payees.reduce((s, p) => s + p.totals.paid, 0);

  return (
    <div className="flex items-center gap-8 px-6 py-3 flex-shrink-0 sticky bottom-0" style={{ background: '#1A1917', borderTop: '1px solid #2C2A27' }}>
      <span className="text-xs font-semibold" style={{ color: '#9A9690' }}>TOTALS</span>
      <div className="flex items-center gap-6 text-xs">
        <div>
          <div style={{ color: '#4A4844' }}>Open</div>
          <div className="font-semibold" style={{ color: '#C8A96E' }}>{fmt(totalOpen)}</div>
        </div>
        <div>
          <div style={{ color: '#4A4844' }}>Ready to Pay</div>
          <div className="font-semibold" style={{ color: '#4ADE80' }}>{fmt(totalReady)}</div>
        </div>
        <div>
          <div style={{ color: '#4A4844' }}>Paid History</div>
          <div className="font-semibold" style={{ color: '#60A5FA' }}>{fmt(totalPaid)}</div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

interface CarrierPayReportProps {
  tabId: string;
  uploaderName: string;
}

export default function CarrierPayReport({ tabId, uploaderName }: CarrierPayReportProps) {
  const [report, setReport] = useState<CarrierPayReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pulling, setPulling] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'paid'>('open');
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    const { data } = await supabase
      .from('carrier_pay_reports')
      .select('pulled_at, report_data')
      .eq('tab_id', tabId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setReport({ pulledAt: data.pulled_at, payees: data.report_data as CarrierPayee[] });
    }
    setLoading(false);
  }, [tabId]);

  useEffect(() => { loadReport(); }, [loadReport]);

  async function pullFromMcLeod() {
    setError(null);
    setPulling(true);
    try {
      const res = await fetch(`${MCLEOD_FN}?report=carrier`, { headers: MCLEOD_HEADERS });
      if (!res.ok) throw new Error(`McLeod pull failed: ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      const parsed = buildReport(json.open ?? [], json.history ?? []);
      if (!parsed.payees.length) { setError('No carrier pay data returned from McLeod.'); setPulling(false); return; }

      await supabase.from('carrier_pay_reports').delete().eq('tab_id', tabId);
      await supabase.from('carrier_pay_reports').insert({
        tab_id: tabId,
        pulled_at: parsed.pulledAt,
        report_data: parsed.payees,
        pulled_by: uploaderName,
      });

      setReport(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to pull from McLeod.');
    } finally {
      setPulling(false);
    }
  }

  const filtered = report
    ? report.payees.filter(p => {
        if (!search) return true;
        return p.payeeName.toLowerCase().includes(search.toLowerCase()) ||
               p.payeeId.toLowerCase().includes(search.toLowerCase());
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
          <h1 className="text-base font-bold" style={{ color: '#F5F3EE' }}>Carrier Pay</h1>
          {report && (
            <p className="text-xs mt-0.5" style={{ color: '#6B6865' }}>
              Pulled: {report.pulledAt} · {report.payees.length} carriers
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {report && (
            <>
              {/* Filter pills */}
              <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: '#141210', border: '1px solid #2C2A27' }}>
                {(['all', 'open', 'paid'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className="px-2.5 py-1 rounded text-xs font-medium transition-colors capitalize"
                    style={{ background: filter === f ? '#2C2A27' : 'transparent', color: filter === f ? '#F5F3EE' : '#6B6865' }}
                  >
                    {f === 'all' ? 'All' : f === 'open' ? 'Open' : 'Paid History'}
                  </button>
                ))}
              </div>
              <div className="relative">
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search carriers..."
                  className="pl-3 pr-3 py-1.5 rounded-lg text-xs outline-none"
                  style={{ background: '#1A1917', border: '1px solid #2C2A27', color: '#F5F3EE', width: '180px' }}
                />
              </div>
            </>
          )}
          <button
            onClick={pullFromMcLeod}
            disabled={pulling}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            style={{ background: '#1A2A1A', color: '#4ADE80', border: '1px solid #166534' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#1E3A1E'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#1A2A1A'; }}
          >
            {pulling
              ? <><div className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: '#166534', borderTopColor: '#4ADE80' }} />Pulling…</>
              : <><RefreshCw className="w-3 h-3" />{report ? 'Refresh' : 'Pull from McLeod'}</>}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex-shrink-0 mx-6 mt-3 flex items-start gap-3 px-4 py-2 rounded-lg text-xs" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#F87171' }}>
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} style={{ color: '#6B6865' }}><XCircle className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Empty state */}
      {!report && !pulling && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: '#1A1917', border: '1px solid #2C2A27' }}>
              <Truck className="w-6 h-6" style={{ color: '#C8A96E' }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: '#F5F3EE' }}>No data yet</p>
              <p className="text-xs mt-1" style={{ color: '#6B6865' }}>Click "Pull from McLeod" to load carrier settlements</p>
            </div>
          </div>
        </div>
      )}

      {pulling && !report && (
        <div className="flex-1 flex items-center justify-center gap-3">
          <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: '#166534', borderTopColor: '#4ADE80' }} />
          <span className="text-sm" style={{ color: '#6B6865' }}>Pulling from McLeod… this may take a moment</span>
        </div>
      )}

      {/* Report content */}
      {report && (
        <>
          <SummaryCards payees={report.payees} pulledAt={report.pulledAt} />
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#2C2A27 transparent' }}>
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-sm" style={{ color: '#4A4844' }}>
                  {search ? `No carriers match "${search}"` : 'No data in this filter.'}
                </p>
              </div>
            ) : (
              filtered.map(p => <PayeeRow key={p.payeeId} payee={p} showFilter={filter} />)
            )}
          </div>
          <TotalsBar payees={filtered.length > 0 ? filtered : report.payees} />
        </>
      )}
    </div>
  );
}
