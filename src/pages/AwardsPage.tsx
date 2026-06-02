import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, Edit2, Trash2, X, Check, Search, ChevronDown,
  Award, MapPin, Truck, DollarSign, AlertTriangle, Filter,
  ChevronUp, Save
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────

interface AwardLane {
  id: string;
  tab_id: string;
  customer: string;
  carrier: string;
  scac: string;
  lane_id: string;
  origin_city: string;
  origin_state: string;
  origin_zip: string;
  dest_city: string;
  dest_state: string;
  dest_zip: string;
  mode: string;
  equipment: string;
  rpm: number | null;
  min_charge: number | null;
  award_type: string;
  annual_volume: number;
  annual_volume_pct: number;
  shipper_city: string;
  receiver_city: string;
  miles: number | null;
  weekly_volume: string;
  rate: number | null;
  notes: string;
  sort_order: number;
  created_at: string;
}

interface AwardsPageProps {
  tabId: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function fmtRpm(n: number | null | undefined): string {
  if (n == null) return '—';
  return '$' + n.toFixed(2);
}

function blankLane(tabId: string): Omit<AwardLane, 'id' | 'created_at'> {
  return {
    tab_id: tabId,
    customer: '',
    carrier: 'Meiborg Inc',
    scac: 'MEBR',
    lane_id: '',
    origin_city: '',
    origin_state: '',
    origin_zip: '',
    dest_city: '',
    dest_state: '',
    dest_zip: '',
    mode: 'OTR',
    equipment: 'RUCKLOAD',
    rpm: null,
    min_charge: null,
    award_type: 'Primary',
    annual_volume: 0,
    annual_volume_pct: 0,
    shipper_city: '',
    receiver_city: '',
    miles: null,
    weekly_volume: '',
    rate: null,
    notes: '',
    sort_order: 0,
  };
}

// ── Form Modal ─────────────────────────────────────────────────────────────

function LaneFormModal({
  initial,
  tabId,
  onSave,
  onClose,
  saving,
}: {
  initial: Partial<AwardLane> | null;
  tabId: string;
  onSave: (data: Omit<AwardLane, 'id' | 'created_at'>) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Omit<AwardLane, 'id' | 'created_at'>>(() =>
    initial ? { ...blankLane(tabId), ...initial } : blankLane(tabId)
  );

  function set(field: keyof typeof form, value: unknown) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function numField(field: keyof typeof form, value: string) {
    const n = parseFloat(value.replace(/[$,]/g, ''));
    set(field, isNaN(n) ? null : n);
  }

  function intField(field: keyof typeof form, value: string) {
    const n = parseInt(value.replace(/[,%]/g, ''), 10);
    set(field, isNaN(n) ? 0 : n);
  }

  const inputCls = "w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors";
  const inputStyle = { background: '#1A1917', border: '1px solid #2C2A27', color: '#F5F3EE' };

  function label(text: string, required = false) {
    return (
      <label className="block text-xs font-medium mb-1" style={{ color: '#9A9690' }}>
        {text}{required && <span style={{ color: '#F87171' }}> *</span>}
      </label>
    );
  }

  const selectCls = "w-full px-3 py-2 rounded-lg text-sm outline-none appearance-none cursor-pointer";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-3xl rounded-2xl flex flex-col overflow-hidden" style={{ background: '#0F0E0C', border: '1px solid #2C2A27', maxHeight: '92vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #2C2A27' }}>
          <div>
            <h2 className="text-base font-semibold" style={{ color: '#F5F3EE' }}>
              {initial?.id ? 'Edit Award Lane' : 'Add Award Lane'}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#6B6865' }}>Customer lane award information</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-white/5">
            <X className="w-4 h-4" style={{ color: '#9A9690' }} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* Customer / Carrier */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#4A4844' }}>Customer & Carrier</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                {label('Customer', true)}
                <input className={inputCls} style={inputStyle} value={form.customer}
                  onChange={e => set('customer', e.target.value)} placeholder="e.g. AMERICAS" />
              </div>
              <div>
                {label('Carrier')}
                <input className={inputCls} style={inputStyle} value={form.carrier}
                  onChange={e => set('carrier', e.target.value)} placeholder="e.g. Meiborg Inc" />
              </div>
              <div>
                {label('SCAC')}
                <input className={inputCls} style={inputStyle} value={form.scac}
                  onChange={e => set('scac', e.target.value.toUpperCase())} placeholder="e.g. MEBR" maxLength={4} />
              </div>
              <div>
                {label('Lane ID')}
                <input className={inputCls} style={inputStyle} value={form.lane_id}
                  onChange={e => set('lane_id', e.target.value)} placeholder="e.g. 1002" />
              </div>
            </div>
          </div>

          {/* Origin */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#4A4844' }}>Origin</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                {label('City')}
                <input className={inputCls} style={inputStyle} value={form.origin_city}
                  onChange={e => set('origin_city', e.target.value)} placeholder="e.g. INDIANAPOLIS" />
              </div>
              <div>
                {label('State')}
                <input className={inputCls} style={inputStyle} value={form.origin_state}
                  onChange={e => set('origin_state', e.target.value.toUpperCase())} placeholder="IN" maxLength={2} />
              </div>
              <div>
                {label('Zip')}
                <input className={inputCls} style={inputStyle} value={form.origin_zip}
                  onChange={e => set('origin_zip', e.target.value)} placeholder="46201" maxLength={5} />
              </div>
            </div>
          </div>

          {/* Destination */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#4A4844' }}>Destination</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                {label('City')}
                <input className={inputCls} style={inputStyle} value={form.dest_city}
                  onChange={e => set('dest_city', e.target.value)} placeholder="e.g. HOUSTON" />
              </div>
              <div>
                {label('State')}
                <input className={inputCls} style={inputStyle} value={form.dest_state}
                  onChange={e => set('dest_state', e.target.value.toUpperCase())} placeholder="TX" maxLength={2} />
              </div>
              <div>
                {label('Zip')}
                <input className={inputCls} style={inputStyle} value={form.dest_zip}
                  onChange={e => set('dest_zip', e.target.value)} placeholder="77001" maxLength={5} />
              </div>
            </div>
          </div>

          {/* Freight details */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#4A4844' }}>Freight Details</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                {label('Mode')}
                <select className={selectCls} style={inputStyle} value={form.mode}
                  onChange={e => set('mode', e.target.value)}>
                  <option value="OTR">OTR</option>
                  <option value="LTL">LTL</option>
                  <option value="Intermodal">Intermodal</option>
                  <option value="Drayage">Drayage</option>
                  <option value="Flatbed">Flatbed</option>
                </select>
              </div>
              <div>
                {label('Equipment')}
                <input className={inputCls} style={inputStyle} value={form.equipment}
                  onChange={e => set('equipment', e.target.value)} placeholder="e.g. RUCKLOAD" />
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#4A4844' }}>Pricing</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                {label('RPM (Rate/Mile)')}
                <input className={inputCls} style={inputStyle}
                  value={form.rpm ?? ''}
                  onChange={e => numField('rpm', e.target.value)}
                  placeholder="2.49" type="number" step="0.01" min="0" />
              </div>
              <div>
                {label('Min Charge')}
                <input className={inputCls} style={inputStyle}
                  value={form.min_charge ?? ''}
                  onChange={e => numField('min_charge', e.target.value)}
                  placeholder="748.74" type="number" step="0.01" min="0" />
              </div>
              <div>
                {label('Award Type')}
                <select className={selectCls} style={inputStyle} value={form.award_type}
                  onChange={e => set('award_type', e.target.value)}>
                  <option value="Primary">Primary</option>
                  <option value="Backup">Backup</option>
                </select>
              </div>
            </div>
          </div>

          {/* Volume */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#4A4844' }}>Volume Allocation</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                {label('Annual Volume (loads)')}
                <input className={inputCls} style={inputStyle}
                  value={form.annual_volume || ''}
                  onChange={e => intField('annual_volume', e.target.value)}
                  placeholder="0" type="number" min="0" />
              </div>
              <div>
                {label('Annual Volume %')}
                <input className={inputCls} style={inputStyle}
                  value={form.annual_volume_pct || ''}
                  onChange={e => numField('annual_volume_pct', e.target.value)}
                  placeholder="100" type="number" step="1" min="0" max="100" />
              </div>
              <div>
                {label('Weekly Volume')}
                <input className={inputCls} style={inputStyle} value={form.weekly_volume}
                  onChange={e => set('weekly_volume', e.target.value)} placeholder="e.g. 1 to 3" />
              </div>
            </div>
          </div>

          {/* Transfer lane details */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#4A4844' }}>Transfer / Detail Lane</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                {label('Shipper City')}
                <input className={inputCls} style={inputStyle} value={form.shipper_city}
                  onChange={e => set('shipper_city', e.target.value)} placeholder="Fort Worth, TX" />
              </div>
              <div>
                {label('Receiver City')}
                <input className={inputCls} style={inputStyle} value={form.receiver_city}
                  onChange={e => set('receiver_city', e.target.value)} placeholder="Erlanger, KY" />
              </div>
              <div>
                {label('Miles')}
                <input className={inputCls} style={inputStyle}
                  value={form.miles ?? ''}
                  onChange={e => { const n = parseInt(e.target.value); set('miles', isNaN(n) ? null : n); }}
                  placeholder="955" type="number" min="0" />
              </div>
              <div className="col-span-2">
                {label('Flat Rate')}
                <input className={inputCls} style={inputStyle}
                  value={form.rate ?? ''}
                  onChange={e => numField('rate', e.target.value)}
                  placeholder="2350.00" type="number" step="0.01" min="0" />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#4A4844' }}>Notes</div>
            <textarea
              className={inputCls}
              style={{ ...inputStyle, resize: 'vertical', minHeight: '72px' }}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="e.g. PUs scheduled through email – delivery scheduled through email..."
              rows={3}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid #2C2A27' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm transition-colors hover:bg-white/5"
            style={{ border: '1px solid #2C2A27', color: '#9A9690' }}>
            Cancel
          </button>
          <button
            disabled={saving || !form.customer.trim()}
            onClick={() => onSave(form)}
            className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-opacity disabled:opacity-50"
            style={{ background: '#C8A96E', color: '#0F0E0C' }}>
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving…' : 'Save Lane'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete confirm ─────────────────────────────────────────────────────────

function DeleteConfirm({ lane, onConfirm, onCancel }: {
  lane: AwardLane;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: '#141210', border: '1px solid #2C2A27' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #2C2A27' }}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: '#F87171' }} />
            <span className="text-sm font-semibold" style={{ color: '#F5F3EE' }}>Delete Lane</span>
          </div>
          <p className="text-xs mt-2 leading-relaxed" style={{ color: '#6B6865' }}>
            Remove lane <strong style={{ color: '#C8C4BC' }}>{lane.lane_id || lane.customer}</strong> from{' '}
            <strong style={{ color: '#C8C4BC' }}>{lane.origin_city}, {lane.origin_state}</strong> →{' '}
            <strong style={{ color: '#C8C4BC' }}>{lane.dest_city}, {lane.dest_state}</strong>? This cannot be undone.
          </p>
        </div>
        <div className="px-5 py-4 flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2 rounded-lg text-sm transition-colors hover:bg-white/5"
            style={{ border: '1px solid #2C2A27', color: '#9A9690' }}>Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#F87171' }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

type SortKey = 'customer' | 'lane_id' | 'origin_state' | 'dest_state' | 'award_type' | 'rpm' | 'annual_volume';

export default function AwardsPage({ tabId }: AwardsPageProps) {
  const [lanes, setLanes] = useState<AwardLane[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterAwardType, setFilterAwardType] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('customer');
  const [sortAsc, setSortAsc] = useState(true);
  const [editingLane, setEditingLane] = useState<AwardLane | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [deletingLane, setDeletingLane] = useState<AwardLane | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('awards_lanes')
      .select('*')
      .eq('tab_id', tabId)
      .order('sort_order')
      .order('customer');
    if (err) { setError(err.message); setLoading(false); return; }
    setLanes((data ?? []) as AwardLane[]);
    setLoading(false);
  }, [tabId]);

  useEffect(() => { load(); }, [load]);

  // ── Derived ──

  const customers = useMemo(() => [...new Set(lanes.map(l => l.customer))].sort(), [lanes]);

  const filtered = useMemo(() => {
    let list = lanes;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        l.customer.toLowerCase().includes(q) ||
        l.lane_id.toLowerCase().includes(q) ||
        l.origin_city.toLowerCase().includes(q) ||
        l.dest_city.toLowerCase().includes(q) ||
        l.origin_state.toLowerCase().includes(q) ||
        l.dest_state.toLowerCase().includes(q) ||
        l.notes.toLowerCase().includes(q) ||
        l.scac.toLowerCase().includes(q)
      );
    }
    if (filterCustomer) list = list.filter(l => l.customer === filterCustomer);
    if (filterAwardType) list = list.filter(l => l.award_type === filterAwardType);
    return [...list].sort((a, b) => {
      let va: string | number = a[sortKey] ?? '';
      let vb: string | number = b[sortKey] ?? '';
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [lanes, search, filterCustomer, filterAwardType, sortKey, sortAsc]);

  // Group by customer for summary
  const summaryByCustomer = useMemo(() => {
    const map = new Map<string, { primary: number; backup: number; totalVolume: number }>();
    for (const l of lanes) {
      if (!map.has(l.customer)) map.set(l.customer, { primary: 0, backup: 0, totalVolume: 0 });
      const s = map.get(l.customer)!;
      if (l.award_type === 'Primary') s.primary++;
      else s.backup++;
      s.totalVolume += l.annual_volume;
    }
    return map;
  }, [lanes]);

  // ── Handlers ──

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  }

  async function handleSave(data: Omit<AwardLane, 'id' | 'created_at'>) {
    setSaving(true);
    if (editingLane) {
      const { error: err } = await supabase
        .from('awards_lanes')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', editingLane.id);
      if (err) { alert(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase
        .from('awards_lanes')
        .insert({ ...data, sort_order: lanes.length * 10 });
      if (err) { alert(err.message); setSaving(false); return; }
    }
    setSaving(false);
    setEditingLane(null);
    setAddingNew(false);
    load();
  }

  async function handleDelete(lane: AwardLane) {
    const { error: err } = await supabase.from('awards_lanes').delete().eq('id', lane.id);
    if (err) { alert(err.message); return; }
    setDeletingLane(null);
    load();
  }

  // ── Sort header ──

  function SortTh({ col, label: lbl, className }: { col: SortKey; label: string; className?: string }) {
    const active = sortKey === col;
    return (
      <th
        className={`px-3 py-2.5 text-left font-medium whitespace-nowrap cursor-pointer select-none transition-colors hover:bg-white/5 ${className ?? ''}`}
        style={{ color: active ? '#C8A96E' : '#6B6865' }}
        onClick={() => handleSort(col)}
      >
        <span className="flex items-center gap-1">
          {lbl}
          {active
            ? sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
            : <ChevronDown className="w-3 h-3 opacity-30" />}
        </span>
      </th>
    );
  }

  // ── Stats ──
  const totalPrimary = lanes.filter(l => l.award_type === 'Primary').length;
  const totalBackup = lanes.filter(l => l.award_type === 'Backup').length;
  const totalVolume = lanes.reduce((s, l) => s + l.annual_volume, 0);
  const avgRpm = lanes.filter(l => l.rpm != null).reduce((s, l) => s + (l.rpm ?? 0), 0) /
    (lanes.filter(l => l.rpm != null).length || 1);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#0F0E0C' }}>

      {/* Header */}
      <div className="flex-shrink-0 px-8 pt-8 pb-5">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#F5F3EE' }}>Awards</h1>
            <p className="text-sm mt-1" style={{ color: '#6B6865' }}>
              Customer lane award information · {lanes.length} lane{lanes.length !== 1 ? 's' : ''} across {customers.length} customer{customers.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setAddingNew(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80 flex-shrink-0"
            style={{ background: '#C8A96E', color: '#141210' }}>
            <Plus className="w-4 h-4" /> Add Lane
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total Lanes', value: lanes.length.toString(), icon: Truck, color: '#F5F3EE' },
            { label: 'Primary Awards', value: totalPrimary.toString(), icon: Award, color: '#4ADE80' },
            { label: 'Backup Awards', value: totalBackup.toString(), icon: Award, color: '#C8A96E' },
            { label: 'Avg RPM', value: lanes.length ? '$' + avgRpm.toFixed(2) : '—', icon: DollarSign, color: '#60A5FA' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: '#141210', border: '1px solid #1E1C1A' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(200,169,110,0.08)' }}>
                <s.icon className="w-4 h-4" style={{ color: '#C8A96E' }} />
              </div>
              <div>
                <div className="text-xs" style={{ color: '#6B6865' }}>{s.label}</div>
                <div className="text-base font-bold" style={{ color: s.color }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Search + filter bar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#4A4844' }} />
            <input
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: '#1A1917', border: '1px solid #2C2A27', color: '#F5F3EE' }}
              placeholder="Search lanes…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowFilters(f => !f)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: (filterCustomer || filterAwardType) ? 'rgba(200,169,110,0.12)' : '#1A1917',
              border: '1px solid #2C2A27',
              color: (filterCustomer || filterAwardType) ? '#C8A96E' : '#9A9690',
            }}>
            <Filter className="w-3.5 h-3.5" />
            Filters
            {(filterCustomer || filterAwardType) && (
              <span className="w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold" style={{ background: '#C8A96E', color: '#0F0E0C' }}>
                {[filterCustomer, filterAwardType].filter(Boolean).length}
              </span>
            )}
          </button>
          {(filterCustomer || filterAwardType) && (
            <button onClick={() => { setFilterCustomer(''); setFilterAwardType(''); }}
              className="flex items-center gap-1 px-2 py-2 rounded-lg text-xs transition-colors hover:bg-white/5"
              style={{ color: '#6B6865' }}>
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>

        {/* Filter dropdowns */}
        {showFilters && (
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <div>
              <label className="text-xs mr-2" style={{ color: '#6B6865' }}>Customer</label>
              <select
                className="px-3 py-1.5 rounded-lg text-xs outline-none appearance-none cursor-pointer"
                style={{ background: '#1A1917', border: '1px solid #2C2A27', color: '#F5F3EE' }}
                value={filterCustomer}
                onChange={e => setFilterCustomer(e.target.value)}>
                <option value="">All</option>
                {customers.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs mr-2" style={{ color: '#6B6865' }}>Award Type</label>
              <select
                className="px-3 py-1.5 rounded-lg text-xs outline-none appearance-none cursor-pointer"
                style={{ background: '#1A1917', border: '1px solid #2C2A27', color: '#F5F3EE' }}
                value={filterAwardType}
                onChange={e => setFilterAwardType(e.target.value)}>
                <option value="">All</option>
                <option value="Primary">Primary</option>
                <option value="Backup">Backup</option>
              </select>
            </div>
          </div>
        )}
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
        ) : lanes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: '#141210', border: '1px solid #262422' }}>
              <Award className="w-7 h-7" style={{ color: '#2C2A27' }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: '#F5F3EE' }}>No award lanes yet</p>
              <p className="text-xs mt-1" style={{ color: '#4A4844' }}>Click "Add Lane" to enter the first customer award.</p>
            </div>
            <button
              onClick={() => setAddingNew(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium mt-2"
              style={{ background: '#C8A96E', color: '#141210' }}>
              <Plus className="w-4 h-4" /> Add First Lane
            </button>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1E1C1A' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead style={{ background: '#141210', borderBottom: '1px solid #2C2A27' }}>
                  <tr>
                    <SortTh col="customer" label="Customer" />
                    <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap" style={{ color: '#6B6865' }}>Carrier / SCAC</th>
                    <SortTh col="lane_id" label="Lane ID" />
                    <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap" style={{ color: '#6B6865' }}>Origin</th>
                    <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap" style={{ color: '#6B6865' }}>Destination</th>
                    <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap" style={{ color: '#6B6865' }}>Mode / Equip</th>
                    <SortTh col="rpm" label="RPM" />
                    <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap" style={{ color: '#6B6865' }}>Min Charge</th>
                    <SortTh col="award_type" label="Award" />
                    <SortTh col="annual_volume" label="Ann. Vol" />
                    <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap" style={{ color: '#6B6865' }}>Vol %</th>
                    <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap" style={{ color: '#6B6865' }}>Notes</th>
                    <th className="px-3 py-2.5" style={{ color: '#6B6865' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((lane, i) => (
                    <tr
                      key={lane.id}
                      className="transition-colors hover:bg-white/[0.025] cursor-pointer group"
                      style={{ borderBottom: '1px solid #1A1917', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
                      onClick={() => setEditingLane(lane)}
                    >
                      <td className="px-3 py-2.5 font-medium whitespace-nowrap" style={{ color: '#F5F3EE' }}>
                        {lane.customer || '—'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div style={{ color: '#C8C4BC' }}>{lane.carrier || '—'}</div>
                        {lane.scac && <div className="text-xs mt-0.5 font-mono" style={{ color: '#6B6865' }}>{lane.scac}</div>}
                      </td>
                      <td className="px-3 py-2.5 font-mono whitespace-nowrap" style={{ color: '#6B6865' }}>
                        {lane.lane_id || '—'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: '#4A4844' }} />
                          <span style={{ color: '#C8C4BC' }}>
                            {[lane.origin_city, lane.origin_state].filter(Boolean).join(', ') || '—'}
                          </span>
                        </div>
                        {lane.origin_zip && <div className="text-xs mt-0.5 ml-4 font-mono" style={{ color: '#4A4844' }}>{lane.origin_zip}</div>}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: '#4A4844' }} />
                          <span style={{ color: '#C8C4BC' }}>
                            {[lane.dest_city, lane.dest_state].filter(Boolean).join(', ') || '—'}
                          </span>
                        </div>
                        {lane.dest_zip && <div className="text-xs mt-0.5 ml-4 font-mono" style={{ color: '#4A4844' }}>{lane.dest_zip}</div>}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-xs" style={{ background: 'rgba(200,169,110,0.08)', color: '#C8A96E' }}>
                          {lane.mode}
                        </span>
                        {lane.equipment && (
                          <div className="text-xs mt-0.5" style={{ color: '#6B6865' }}>{lane.equipment}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-mono font-medium" style={{ color: '#60A5FA' }}>
                        {fmtRpm(lane.rpm)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-mono" style={{ color: '#C8C4BC' }}>
                        {fmtMoney(lane.min_charge)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{
                          background: lane.award_type === 'Primary' ? 'rgba(74,222,128,0.1)' : 'rgba(200,169,110,0.1)',
                          color: lane.award_type === 'Primary' ? '#4ADE80' : '#C8A96E',
                        }}>
                          {lane.award_type}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-mono text-right" style={{ color: '#C8C4BC' }}>
                        {lane.annual_volume > 0 ? lane.annual_volume.toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-mono text-right" style={{
                        color: lane.annual_volume_pct >= 100 ? '#4ADE80' : lane.annual_volume_pct > 0 ? '#C8A96E' : '#4A4844'
                      }}>
                        {lane.annual_volume_pct > 0 ? lane.annual_volume_pct + '%' : '—'}
                      </td>
                      <td className="px-3 py-2.5 max-w-[200px]">
                        <div className="truncate" style={{ color: '#6B6865' }}>{lane.notes || '—'}</div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditingLane(lane)}
                            className="p-1.5 rounded-lg transition-colors hover:bg-white/[0.06]"
                            title="Edit lane">
                            <Edit2 className="w-3.5 h-3.5" style={{ color: '#6B6865' }} />
                          </button>
                          <button
                            onClick={() => setDeletingLane(lane)}
                            className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10"
                            title="Delete lane">
                            <Trash2 className="w-3.5 h-3.5" style={{ color: '#6B6865' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer row */}
            <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#141210', borderTop: '1px solid #2C2A27' }}>
              <span className="text-xs" style={{ color: '#4A4844' }}>
                {filtered.length} of {lanes.length} lane{lanes.length !== 1 ? 's' : ''}
                {(filterCustomer || filterAwardType || search) && ' (filtered)'}
              </span>
              <div className="flex items-center gap-4 text-xs">
                <span style={{ color: '#6B6865' }}>
                  Primary: <strong style={{ color: '#4ADE80' }}>{totalPrimary}</strong>
                </span>
                <span style={{ color: '#6B6865' }}>
                  Backup: <strong style={{ color: '#C8A96E' }}>{totalBackup}</strong>
                </span>
                {totalVolume > 0 && (
                  <span style={{ color: '#6B6865' }}>
                    Total Vol: <strong style={{ color: '#F5F3EE' }}>{totalVolume.toLocaleString()}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {(editingLane || addingNew) && (
        <LaneFormModal
          initial={editingLane}
          tabId={tabId}
          onSave={handleSave}
          onClose={() => { setEditingLane(null); setAddingNew(false); }}
          saving={saving}
        />
      )}

      {deletingLane && (
        <DeleteConfirm
          lane={deletingLane}
          onConfirm={() => handleDelete(deletingLane)}
          onCancel={() => setDeletingLane(null)}
        />
      )}
    </div>
  );
}
