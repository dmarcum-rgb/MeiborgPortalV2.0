import { useState, useEffect, useRef, FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { Department } from '../types';
import {
  ArrowLeft, Shield, Eye, EyeOff, AlertCircle,
  Plus, Trash2, UserCircle, Upload, ChevronDown,
  Check, X, Users, Search, Pencil,
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const SK_ADMIN = 'tc_admin_code';

interface TeamMember {
  id: string;
  full_name: string;
  email: string | null;
  position: string;
  department_id: string | null;
  supervisor_id: string | null;
  avatar_url: string | null;
  start_date: string | null;
}

interface MemberForm {
  full_name: string;
  email: string;
  position: string;
  department_id: string;
  supervisor_id: string;
  avatar_url: string;
  start_date: string;
}

const BLANK: MemberForm = {
  full_name: '', email: '', position: '',
  department_id: '', supervisor_id: '', avatar_url: '', start_date: '',
};

async function callAdmin(action: string, payload: Record<string, unknown> = {}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ action, admin_code: sessionStorage.getItem(SK_ADMIN) ?? '', ...payload }),
  });
  return res.json();
}

// ─── Login Screen ───────────────────────────────────────────────
function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [code, setCode] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true); setErr('');
    const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ action: 'verify_code', code }),
    });
    const { valid } = await res.json();
    if (valid) { sessionStorage.setItem(SK_ADMIN, code); onSuccess(); }
    else { setErr('Incorrect admin code.'); setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#ECEAE4' }}>
      <div className="w-full max-w-sm rounded-2xl shadow-xl overflow-hidden"
        style={{ background: '#F5F3EE', border: '1px solid #DDDBD5' }}>
        <div className="px-8 py-8">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
            style={{ background: '#2C2A27' }}>
            <Shield className="w-5 h-5" style={{ color: '#F5F3EE' }} strokeWidth={1.5} />
          </div>
          <h1 className="font-display italic text-2xl mb-1" style={{ color: '#2C2A27' }}>Admin Access</h1>
          <p className="text-sm mb-6" style={{ color: '#9A9690' }}>Enter your admin code to continue.</p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9A9690' }}>
                Admin Code
              </label>
              <div className="relative">
                <input
                  autoFocus type={show ? 'text' : 'password'}
                  value={code} onChange={e => { setCode(e.target.value); setErr(''); }}
                  placeholder="Enter admin code..."
                  className="w-full rounded-xl pl-4 pr-10 py-2.5 text-sm focus:outline-none"
                  style={{ background: '#ECEAE4', border: `1px solid ${err ? '#DC6B6B' : '#DDDBD5'}`, color: '#2C2A27' }} />
                <button type="button" onClick={() => setShow(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#B0ADA7' }}>
                  {show
                    ? <EyeOff className="w-4 h-4" strokeWidth={1.5} />
                    : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                </button>
              </div>
              {err && (
                <p className="flex items-center gap-1.5 mt-2 text-xs" style={{ color: '#C05454' }}>
                  <AlertCircle className="w-3.5 h-3.5" strokeWidth={1.5} /> {err}
                </p>
              )}
            </div>
            <button type="submit" disabled={!code || loading}
              className="w-full rounded-xl py-2.5 text-sm font-medium transition-opacity"
              style={{ background: '#2C2A27', color: '#F5F3EE', opacity: (!code || loading) ? 0.5 : 1 }}>
              {loading ? 'Verifying...' : 'Enter Admin Panel'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Supervisor Picker ──────────────────────────────────────────
function SupervisorPicker({
  members, value, onChange,
}: {
  members: TeamMember[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = members.find(m => m.id === value) ?? null;

  const filtered = query.trim()
    ? members.filter(m => m.full_name.toLowerCase().includes(query.toLowerCase()))
    : [];

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  function select(m: TeamMember) {
    onChange(m.id);
    setQuery('');
    setOpen(false);
  }

  function clear() {
    onChange('');
    setQuery('');
  }

  return (
    <Field label="Supervisor">
      <div ref={ref} className="relative">
        {selected ? (
          <div className="flex items-center gap-2 rounded-xl px-3 py-2"
            style={{ background: '#ECEAE4', border: '1px solid #DDDBD5' }}>
            {selected.avatar_url
              ? <div style={{
                  width: '1.75rem', height: '1.75rem', minWidth: '1.75rem', borderRadius: '50%',
                  backgroundImage: `url(${selected.avatar_url})`,
                  backgroundSize: 'cover', backgroundPosition: 'center',
                }} />
              : <div style={{
                  width: '1.75rem', height: '1.75rem', minWidth: '1.75rem', borderRadius: '50%',
                  background: '#DDD9D0', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '0.7rem', fontWeight: 600, color: '#6B6865',
                }}>{selected.full_name[0]?.toUpperCase()}</div>
            }
            <span className="text-sm flex-1" style={{ color: '#2C2A27' }}>{selected.full_name}</span>
            <button type="button" onClick={clear} className="p-0.5 rounded-full hover:bg-black/10 transition-colors">
              <X className="w-3.5 h-3.5" style={{ color: '#6B6865' }} strokeWidth={2} />
            </button>
          </div>
        ) : (
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Search by name…"
            className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
            style={{ background: '#ECEAE4', border: '1px solid #DDDBD5', color: '#2C2A27' }}
          />
        )}

        {open && filtered.length > 0 && (
          <div className="absolute z-50 w-full mt-1 rounded-xl overflow-hidden shadow-lg"
            style={{ background: '#FAFAF8', border: '1px solid #DDDBD5' }}>
            {filtered.map(m => (
              <button key={m.id} type="button" onMouseDown={() => select(m)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[#F0EDE8] transition-colors">
                {m.avatar_url
                  ? <div style={{
                      width: '2rem', height: '2rem', minWidth: '2rem', borderRadius: '50%',
                      backgroundImage: `url(${m.avatar_url})`,
                      backgroundSize: 'cover', backgroundPosition: 'center',
                    }} />
                  : <div style={{
                      width: '2rem', height: '2rem', minWidth: '2rem', borderRadius: '50%',
                      background: '#DDD9D0', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#6B6865',
                    }}>{m.full_name[0]?.toUpperCase()}</div>
                }
                <div>
                  <div className="text-sm font-medium" style={{ color: '#2C2A27' }}>{m.full_name}</div>
                  {m.position && <div className="text-xs" style={{ color: '#9B9892' }}>{m.position}</div>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Field>
  );
}

// ─── Add Member Drawer ──────────────────────────────────────────
function AddMemberModal({
  departments, members, onClose, onSaved,
}: {
  departments: Department[];
  members: TeamMember[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<MemberForm>(BLANK);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadAvatar(file: File) {
    const ext = file.name.split('.').pop();
    const path = `member-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return data.publicUrl;
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim()) { setErr('Name is required.'); return; }
    setSaving(true); setErr('');
    let avatar_url = form.avatar_url;
    if (avatarFile) {
      try { avatar_url = await uploadAvatar(avatarFile); }
      catch { setErr('Photo upload failed.'); setSaving(false); return; }
    }
    const result = await callAdmin('add_member', {
      full_name: form.full_name.trim(),
      email: form.email.trim() || null,
      position: form.position.trim(),
      department_id: form.department_id || null,
      supervisor_id: form.supervisor_id || null,
      avatar_url: avatar_url || null,
    });
    if (result.error) { setErr(result.error); setSaving(false); return; }
    onSaved();
  }

  function set(k: keyof MemberForm, v: string) {
    setForm(f => ({ ...f, [k]: v }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(44,42,39,0.55)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]"
        style={{ background: '#F5F3EE', border: '1px solid #DDDBD5' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #ECEAE4' }}>
          <h2 className="font-semibold text-base" style={{ color: '#2C2A27' }}>Add Team Member</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg"
            style={{ color: '#9A9690' }} onMouseEnter={e => (e.currentTarget.style.background = '#E4E2DC')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={save} className="p-7 space-y-5 overflow-y-auto flex-1">

          {/* Avatar */}
          <div className="flex items-center gap-5">
            <div onClick={() => fileRef.current?.click()}
              className="relative w-20 h-20 rounded-full overflow-hidden flex-shrink-0 cursor-pointer"
              style={{ background: '#E4E2DC', border: '2px dashed #C8C5BF' }}>
              {preview
                ? <img src={preview} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center">
                    <UserCircle className="w-9 h-9" style={{ color: '#C8C5BF' }} strokeWidth={1} />
                  </div>}
              <div className="absolute inset-0 flex items-center justify-center rounded-full opacity-0 hover:opacity-100 transition-opacity"
                style={{ background: 'rgba(44,42,39,0.4)' }}>
                <Upload className="w-5 h-5 text-white" strokeWidth={1.5} />
              </div>
            </div>
            <div>
              <button type="button" onClick={() => fileRef.current?.click()}
                className="block text-sm font-semibold mb-0.5 hover:opacity-70 transition-opacity"
                style={{ color: '#2C2A27' }}>
                {preview ? 'Change photo' : 'Upload photo'}
              </button>
              <p className="text-xs" style={{ color: '#B0ADA7' }}>JPG, PNG · Max 5MB</p>
              {preview && (
                <button type="button" onClick={() => { setAvatarFile(null); setPreview(''); set('avatar_url', ''); }}
                  className="text-xs mt-1 hover:opacity-70 transition-opacity" style={{ color: '#C05454' }}>
                  Remove
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) { setAvatarFile(f); setPreview(URL.createObjectURL(f)); } }} />
          </div>

          {/* Name */}
          <Field label="Full Name" required>
            <input type="text" value={form.full_name} required
              onChange={e => {
                const name = e.target.value;
                set('full_name', name);
                const parts = name.trim().split(/\s+/);
                if (parts.length >= 2) {
                  const first = parts[0];
                  const last = parts[parts.length - 1];
                  const email = `${first[0].toUpperCase()}${last}@meiborginc.com`;
                  setForm(f => ({ ...f, full_name: name, email }));
                } else {
                  setForm(f => ({ ...f, full_name: name }));
                }
              }} placeholder="e.g. Jane Smith"
              className="field-input w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
              style={{ background: '#ECEAE4', border: '1px solid #DDDBD5', color: '#2C2A27' }} />
          </Field>

          {/* Email */}
          <Field label="Email Address">
            <input type="email" value={form.email}
              onChange={e => set('email', e.target.value)} placeholder="e.g. jane@company.com"
              className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
              style={{ background: '#ECEAE4', border: '1px solid #DDDBD5', color: '#2C2A27' }} />
          </Field>

          {/* Job Position */}
          <Field label="Job Position">
            <input type="text" value={form.position}
              onChange={e => set('position', e.target.value)} placeholder="e.g. Senior Dispatcher"
              className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
              style={{ background: '#ECEAE4', border: '1px solid #DDDBD5', color: '#2C2A27' }} />
          </Field>

          {/* Department */}
          <Field label="Department">
            <div className="relative">
              <select value={form.department_id} onChange={e => set('department_id', e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none appearance-none"
                style={{ background: '#ECEAE4', border: '1px solid #DDDBD5', color: form.department_id ? '#2C2A27' : '#B0ADA7' }}>
                <option value="">— Select department —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                style={{ color: '#B0ADA7' }} strokeWidth={1.5} />
            </div>
          </Field>

          {/* Supervisor */}
          <SupervisorPicker
            members={members}
            value={form.supervisor_id}
            onChange={id => set('supervisor_id', id)}
          />

          {err && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
              style={{ background: '#FAEAEA', color: '#C05454' }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} /> {err}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl py-2.5 text-sm font-medium"
              style={{ background: '#E4E2DC', color: '#6B6865' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-opacity"
              style={{ background: '#2C2A27', color: '#F5F3EE', opacity: saving ? 0.6 : 1 }}>
              {saving
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><Check className="w-3.5 h-3.5" strokeWidth={2.5} /> Add Member</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9A9690' }}>
        {label}{required && <span style={{ color: '#C05454' }}> *</span>}
      </label>
      {children}
    </div>
  );
}

// ─── Edit Member Modal ──────────────────────────────────────────
function EditMemberModal({
  member, departments, members, onClose, onSaved,
}: {
  member: TeamMember;
  departments: Department[];
  members: TeamMember[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<MemberForm>({
    full_name: member.full_name,
    email: member.email ?? '',
    position: member.position,
    department_id: member.department_id ?? '',
    supervisor_id: member.supervisor_id ?? '',
    avatar_url: member.avatar_url ?? '',
    start_date: member.start_date ?? '',
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(member.avatar_url ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadAvatar(file: File) {
    const ext = file.name.split('.').pop();
    const path = `member-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return data.publicUrl;
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim()) { setErr('Name is required.'); return; }
    setSaving(true); setErr('');
    let avatar_url = form.avatar_url;
    if (avatarFile) {
      try { avatar_url = await uploadAvatar(avatarFile); }
      catch { setErr('Photo upload failed.'); setSaving(false); return; }
    }
    const result = await callAdmin('update_member', {
      id: member.id,
      full_name: form.full_name.trim(),
      email: form.email.trim() || null,
      position: form.position.trim(),
      department_id: form.department_id || null,
      supervisor_id: form.supervisor_id || null,
      avatar_url: avatar_url || null,
      start_date: form.start_date || null,
    });
    if (result.error) { setErr(result.error); setSaving(false); return; }
    onSaved();
  }

  function set(k: keyof MemberForm, v: string) {
    setForm(f => ({ ...f, [k]: v }));
  }

  // Exclude self from supervisor options
  const supervisorCandidates = members.filter(m => m.id !== member.id);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(44,42,39,0.55)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]"
        style={{ background: '#F5F3EE', border: '1px solid #DDDBD5' }}>

        <div className="flex items-center justify-between px-7 pt-6 pb-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #ECEAE4' }}>
          <h2 className="font-semibold text-base" style={{ color: '#2C2A27' }}>Edit Team Member</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg"
            style={{ color: '#9A9690' }} onMouseEnter={e => (e.currentTarget.style.background = '#E4E2DC')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={save} className="p-7 space-y-5 overflow-y-auto flex-1">

          {/* Avatar */}
          <div className="flex items-center gap-5">
            <div onClick={() => fileRef.current?.click()}
              className="relative w-20 h-20 rounded-full overflow-hidden flex-shrink-0 cursor-pointer"
              style={{ background: '#E4E2DC', border: '2px dashed #C8C5BF' }}>
              {preview
                ? <img src={preview} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center">
                    <UserCircle className="w-9 h-9" style={{ color: '#C8C5BF' }} strokeWidth={1} />
                  </div>}
              <div className="absolute inset-0 flex items-center justify-center rounded-full opacity-0 hover:opacity-100 transition-opacity"
                style={{ background: 'rgba(44,42,39,0.4)' }}>
                <Upload className="w-5 h-5 text-white" strokeWidth={1.5} />
              </div>
            </div>
            <div>
              <button type="button" onClick={() => fileRef.current?.click()}
                className="block text-sm font-semibold mb-0.5 hover:opacity-70 transition-opacity"
                style={{ color: '#2C2A27' }}>
                {preview ? 'Change photo' : 'Upload photo'}
              </button>
              <p className="text-xs" style={{ color: '#B0ADA7' }}>JPG, PNG · Max 5MB</p>
              {preview && (
                <button type="button" onClick={() => { setAvatarFile(null); setPreview(''); set('avatar_url', ''); }}
                  className="text-xs mt-1 hover:opacity-70 transition-opacity" style={{ color: '#C05454' }}>
                  Remove
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) { setAvatarFile(f); setPreview(URL.createObjectURL(f)); } }} />
          </div>

          <Field label="Full Name" required>
            <input type="text" value={form.full_name} required
              onChange={e => set('full_name', e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
              style={{ background: '#ECEAE4', border: '1px solid #DDDBD5', color: '#2C2A27' }} />
          </Field>

          <Field label="Email Address">
            <input type="email" value={form.email}
              onChange={e => set('email', e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
              style={{ background: '#ECEAE4', border: '1px solid #DDDBD5', color: '#2C2A27' }} />
          </Field>

          <Field label="Job Position">
            <input type="text" value={form.position}
              onChange={e => set('position', e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
              style={{ background: '#ECEAE4', border: '1px solid #DDDBD5', color: '#2C2A27' }} />
          </Field>

          <Field label="Department">
            <div className="relative">
              <select value={form.department_id} onChange={e => set('department_id', e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none appearance-none"
                style={{ background: '#ECEAE4', border: '1px solid #DDDBD5', color: form.department_id ? '#2C2A27' : '#B0ADA7' }}>
                <option value="">— Select department —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                style={{ color: '#B0ADA7' }} strokeWidth={1.5} />
            </div>
          </Field>

          <SupervisorPicker
            members={supervisorCandidates}
            value={form.supervisor_id}
            onChange={id => set('supervisor_id', id)}
          />

          <Field label="START DATE">
            <input type="date" value={form.start_date}
              onChange={e => set('start_date', e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
              style={{ background: '#ECEAE4', border: '1px solid #DDDBD5', color: '#2C2A27' }} />
          </Field>

          {err && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
              style={{ background: '#FAEAEA', color: '#C05454' }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} /> {err}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl py-2.5 text-sm font-medium"
              style={{ background: '#E4E2DC', color: '#6B6865' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-opacity"
              style={{ background: '#2C2A27', color: '#F5F3EE', opacity: saving ? 0.6 : 1 }}>
              {saving
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><Check className="w-3.5 h-3.5" strokeWidth={2.5} /> Save Changes</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirm ─────────────────────────────────────────────
function DeleteConfirm({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(44,42,39,0.55)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-sm rounded-2xl p-7 shadow-2xl"
        style={{ background: '#F5F3EE', border: '1px solid #DDDBD5' }}>
        <h3 className="font-semibold text-base mb-2" style={{ color: '#2C2A27' }}>Remove Member</h3>
        <p className="text-sm mb-6" style={{ color: '#9A9690' }}>
          Remove <span className="font-medium" style={{ color: '#2C2A27' }}>{name}</span> from the directory? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 rounded-xl py-2.5 text-sm font-medium"
            style={{ background: '#E4E2DC', color: '#6B6865' }}>Cancel</button>
          <button onClick={onConfirm}
            className="flex-1 rounded-xl py-2.5 text-sm font-medium"
            style={{ background: '#C05454', color: 'white' }}>Remove</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Panel ───────────────────────────────────────────
export default function AdminPage({ onGoToChat }: { onGoToChat: () => void }) {
  const [authed, setAuthed] = useState(() => !!sessionStorage.getItem(SK_ADMIN));
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<TeamMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (authed) load(); }, [authed]);

  async function load() {
    setLoading(true);
    const [{ data: m }, { data: d }] = await Promise.all([
      supabase.from('team_members').select('*').order('full_name'),
      supabase.from('departments').select('*').order('name'),
    ]);
    if (m) setMembers(m as TeamMember[]);
    if (d) setDepartments(d as Department[]);
    setLoading(false);
  }

  async function deleteMember(id: string) {
    await callAdmin('delete_member', { id });
    setDeleteTarget(null);
    await load();
  }

  const getDeptName = (id: string | null) => departments.find(d => d.id === id)?.name ?? null;
  const getDeptColor = (id: string | null) => departments.find(d => d.id === id)?.color ?? '#9A9690';

  const filtered = members.filter(m =>
    !search ||
    m.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (m.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (m.position ?? '').toLowerCase().includes(search.toLowerCase())
  );

  if (!authed) return <LoginScreen onSuccess={() => setAuthed(true)} />;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#ECEAE4' }}>

      {/* Top bar */}
      <header className="flex items-center justify-between px-8 py-4 flex-shrink-0"
        style={{ background: '#F5F3EE', borderBottom: '1px solid #DDDBD5' }}>
        <button onClick={onGoToChat}
          className="flex items-center gap-2 text-sm transition-opacity hover:opacity-60"
          style={{ color: '#6B6865' }}>
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} /> Back to Portal
        </button>
        <span className="font-display italic text-xl tracking-wide" style={{ color: '#2C2A27', fontSize: '1.5rem' }}>
          Admin Panel
        </span>
        <button onClick={() => { sessionStorage.removeItem(SK_ADMIN); setAuthed(false); }}
          className="text-sm transition-opacity hover:opacity-60" style={{ color: '#9A9690' }}>
          Lock
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 px-8 py-6 overflow-y-auto">
        <div className="max-w-3xl mx-auto">

          {/* Toolbar */}
          <div className="flex items-center gap-3 mb-5">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                style={{ color: '#B0ADA7' }} strokeWidth={1.5} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search users..."
                className="w-full rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none"
                style={{ background: '#F5F3EE', border: '1px solid #DDDBD5', color: '#2C2A27' }} />
            </div>
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium flex-shrink-0 transition-opacity hover:opacity-85"
              style={{ background: '#2C2A27', color: '#F5F3EE' }}>
              <Plus className="w-4 h-4" strokeWidth={2} /> Add User
            </button>
          </div>

          {/* User count */}
          <p className="text-xs font-medium mb-3" style={{ color: '#B0ADA7' }}>
            {filtered.length} {filtered.length === 1 ? 'user' : 'users'}
          </p>

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 rounded-2xl"
              style={{ background: '#F5F3EE', border: '1px solid #DDDBD5' }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: '#E4E2DC' }}>
                <Users className="w-5 h-5" style={{ color: '#C0BDB7' }} strokeWidth={1.5} />
              </div>
              <p className="font-medium text-sm mb-1" style={{ color: '#6B6865' }}>
                {search ? 'No users match your search' : 'No users yet'}
              </p>
              {!search && (
                <p className="text-xs" style={{ color: '#B0ADA7' }}>
                  Click "Add User" to add your first team member.
                </p>
              )}
            </div>
          )}

          {/* User list */}
          {filtered.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #DDDBD5' }}>
              {filtered.map((m, i) => {
                const deptName = getDeptName(m.department_id);
                const deptColor = getDeptColor(m.department_id);
                const supervisorName = m.supervisor_id
                  ? members.find(x => x.id === m.supervisor_id)?.full_name ?? null
                  : null;

                return (
                  <div key={m.id}
                    className="flex items-center gap-4 px-5 py-4"
                    style={{
                      background: '#F5F3EE',
                      borderTop: i === 0 ? 'none' : '1px solid #ECEAE4',
                    }}>

                    {/* Avatar */}
                    {m.avatar_url
                      ? <div style={{
                          width: '2.5rem', height: '2.5rem', minWidth: '2.5rem', minHeight: '2.5rem',
                          borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                          backgroundImage: `url(${m.avatar_url})`,
                          backgroundSize: 'cover', backgroundPosition: 'center',
                        }} />
                      : <div style={{
                          width: '2.5rem', height: '2.5rem', minWidth: '2.5rem', minHeight: '2.5rem',
                          borderRadius: '50%', flexShrink: 0, background: '#DDD9D0',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.875rem', fontWeight: 600, color: '#6B6865',
                        }}>
                          {m.full_name[0]?.toUpperCase() ?? '?'}
                        </div>
                    }

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold" style={{ color: '#2C2A27' }}>{m.full_name}</span>
                        {m.email && (
                          <span className="text-xs" style={{ color: '#B0ADA7' }}>{m.email}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {m.position && (
                          <span className="text-xs" style={{ color: '#9A9690' }}>{m.position}</span>
                        )}
                        {deptName && (
                          <>
                            {m.position && <span style={{ color: '#DDDBD5', fontSize: '10px' }}>•</span>}
                            <span className="inline-flex items-center gap-1 text-xs font-medium"
                              style={{ color: deptColor }}>
                              <span className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0"
                                style={{ background: deptColor }} />
                              {deptName}
                            </span>
                          </>
                        )}
                        {supervisorName && (
                          <>
                            <span style={{ color: '#DDDBD5', fontSize: '10px' }}>•</span>
                            <span className="text-xs" style={{ color: '#B0ADA7' }}>
                              Reports to {supervisorName}
                            </span>
                          </>
                        )}
                        {m.start_date && (
                          <>
                            <span style={{ color: '#DDDBD5', fontSize: '10px' }}>•</span>
                            <span className="text-xs" style={{ color: '#B0ADA7' }}>
                              Since {new Date(m.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => setEditTarget(m)}
                        className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors"
                        style={{ color: '#9A9690' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#E4E2DC')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                      <button onClick={() => setDeleteTarget(m)}
                        className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors"
                        style={{ color: '#C08080' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#FAEAEA')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
      </div>

      {showAdd && (
        <AddMemberModal
          departments={departments}
          members={members}
          onClose={() => setShowAdd(false)}
          onSaved={async () => { setShowAdd(false); await load(); }}
        />
      )}

      {editTarget && (
        <EditMemberModal
          member={editTarget}
          departments={departments}
          members={members}
          onClose={() => setEditTarget(null)}
          onSaved={async () => { setEditTarget(null); await load(); }}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          name={deleteTarget.full_name}
          onConfirm={() => deleteMember(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
