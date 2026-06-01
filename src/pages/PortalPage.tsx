import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import ARReport from './ARReport';
import APReport from './APReport';
import DebtReport from './DebtReport';
import DebtCalendar from './DebtCalendar';
import CollectionsReport from './CollectionsReport';
import UnbilledOrdersReport from './UnbilledOrdersReport';
import {
  MessageSquare, Shield, Network, Home, FileText, Users, Star, Bell,
  BookOpen, Briefcase, Calendar, Heart, Image,
  Plus, Pencil, Trash2, Check, X, LogOut,
  Upload, Download, File, FileSpreadsheet,
  Paperclip, Folder, FolderOpen, ChevronRight, ChevronDown as ChevronDownIcon,
  GripVertical, Globe, Link as LinkIcon, ExternalLink, Send, Loader2,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface PortalFolder {
  id: string;
  label: string;
  sort_order: number;
  is_open: boolean;
  department_access: string | null;
}

interface PortalTab {
  id: string;
  label: string;
  icon: string;
  sort_order: number;
  folder_id: string | null;
}

interface TabFile {
  id: string;
  tab_id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  file_type: string;
  sort_order: number;
}

interface LoggedInMember {
  full_name: string;
  avatar_url: string | null;
  position: string | null;
  department: string | null;
  org_level: number | null;
}

type SidebarItem =
  | { kind: 'tab'; tab: PortalTab }
  | { kind: 'folder'; folder: PortalFolder; tabs: PortalTab[] };

// ── Constants ──────────────────────────────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const MAX_FILE_BYTES = 50 * 1024 * 1024;

// ── Icon map ───────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  Home, FileText, Users, Star, Bell, BookOpen, Briefcase, Calendar, Heart,
  MessageSquare, Shield, Network,
};
const ICON_OPTIONS = Object.keys(ICON_MAP);

function TabIcon({ name, className, strokeWidth }: { name: string; className?: string; strokeWidth?: number }) {
  const Comp = ICON_MAP[name] ?? FileText;
  return <Comp className={className} strokeWidth={strokeWidth ?? 1.5} />;
}

// ── File helpers ───────────────────────────────────────────────────────────

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mime: string) {
  if (mime === 'text/uri-list') return <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#1A4A7A' }}><Globe className="w-4 h-4 text-white" strokeWidth={1.5} /></div>;
  if (mime.includes('pdf')) return <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: '#E53E3E', color: 'white' }}>PDF</div>;
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) return <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#276749' }}><FileSpreadsheet className="w-4 h-4 text-white" strokeWidth={1.5} /></div>;
  if (mime.includes('word') || mime.includes('document')) return <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#2B6CB0' }}><FileText className="w-4 h-4 text-white" strokeWidth={1.5} /></div>;
  if (mime.includes('image')) return <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#2B7A5C' }}><Image className="w-4 h-4 text-white" strokeWidth={1.5} /></div>;
  return <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#4A4844' }}><File className="w-4 h-4" style={{ color: '#C0BDB7' }} strokeWidth={1.5} /></div>;
}

// ── Auth helpers ───────────────────────────────────────────────────────────

const PORTAL_PASSWORD = '2210';
const SESSION_KEY = 'portal_ai_authed';
const MEMBER_KEY = 'portal_member';
function isAuthed() { return sessionStorage.getItem(SESSION_KEY) === '1'; }
function getStoredMember(): LoggedInMember | null {
  try { return JSON.parse(sessionStorage.getItem(MEMBER_KEY) ?? 'null'); } catch { return null; }
}

// ── Lock Screen ────────────────────────────────────────────────────────────

function LockScreen({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);

  function triggerShake(msg: string) {
    setErr(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { triggerShake('Please enter your full name.'); return; }
    if (pw !== PORTAL_PASSWORD) { triggerShake('Incorrect password. Please try again.'); setPw(''); return; }

    setLoading(true);
    const { data } = await supabase
      .from('team_members')
      .select('full_name, avatar_url, position, org_level, departments(name)')
      .ilike('full_name', name.trim())
      .maybeSingle();
    setLoading(false);

    if (!data) {
      triggerShake('Name not found. Please use your full first and last name.');
      return;
    }

    const member: LoggedInMember = {
      full_name: data.full_name,
      avatar_url: data.avatar_url,
      position: (data.position as string) || null,
      department: (data.departments as { name: string } | null)?.name || null,
      org_level: (data.org_level as number) || null,
    };
    sessionStorage.setItem(SESSION_KEY, '1');
    sessionStorage.setItem(MEMBER_KEY, JSON.stringify(member));
    onSuccess();
  }

  const shakeStyle = shake ? { animation: 'shake 0.4s ease' } : {};

  return (
    <div className="h-screen flex items-center justify-center"
      style={{ background: '#1C1B19', fontFamily: "'Inter', sans-serif" }}>
      <div className="w-full max-w-sm px-4">
        <div className="rounded-2xl shadow-2xl overflow-hidden"
          style={{ background: '#F5F3EE', border: '1px solid #DDDBD5' }}>

          {/* Header band */}
          <div className="px-8 pt-8 pb-6 text-center" style={{ background: '#2C2A27' }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 overflow-hidden"
              style={{ background: '#3D3A36', border: '1px solid #4A4844' }}>
              <img src="/Mei-Guy_icon_(1).png" alt="MeiGuy" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-lg font-semibold mb-1" style={{ color: '#F5F3EE' }}>MeiGuy</h1>
            <p className="text-xs" style={{ color: '#6B6865' }}>Restricted access — authorized personnel only</p>
          </div>

          {/* Form */}
          <form onSubmit={submit} className="px-8 py-7 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: '#9A9690' }}>Full Name</label>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setErr(''); }}
                placeholder="First Last"
                className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none transition-all"
                style={{ background: '#ECEAE4', border: '1.5px solid #DDDBD5', color: '#2C2A27', ...shakeStyle }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: '#9A9690' }}>Password</label>
              <input
                type="password"
                value={pw}
                onChange={e => { setPw(e.target.value); setErr(''); }}
                placeholder="••••••••"
                className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none transition-all"
                style={{ background: '#ECEAE4', border: `1.5px solid ${err ? '#C05454' : '#DDDBD5'}`, color: '#2C2A27', ...shakeStyle }}
              />
              {err && (
                <p className="text-xs mt-2 font-medium" style={{ color: '#C05454' }}>{err}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-3 text-sm font-semibold transition-opacity hover:opacity-85 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: '#2C2A27', color: '#F5F3EE' }}>
              {loading
                ? <><div className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: '#4A4844', borderTopColor: '#C0BDB7' }} /> Verifying…</>
                : 'Sign In'
              }
            </button>
            <p className="text-center text-xs" style={{ color: '#C0BDB7' }}>
              Contact your IT administrator if you need access.
            </p>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}

// ── File Upload Zone ───────────────────────────────────────────────────────

function FileUploadZone({ tabId, onUploaded }: { tabId: string; onUploaded: (file: TabFile) => void }) {
  const [mode, setMode] = useState<'file' | 'url'>('file');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    setErr('');
    if (file.size > MAX_FILE_BYTES) { setErr(`File too large (max ${formatBytes(MAX_FILE_BYTES)})`); return; }
    setUploading(true);

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${tabId}/${Date.now()}_${safeName}`;

    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/tab-files/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': 'false',
      },
      body: file,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErr(`Upload failed: ${body?.message ?? res.statusText}`);
      setUploading(false);
      return;
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/tab-files/${path}`;
    const { data, error } = await supabase.from('portal_tab_files').insert({
      tab_id: tabId,
      file_name: file.name,
      file_url: publicUrl,
      file_size: file.size,
      file_type: file.type || 'application/octet-stream',
      sort_order: Math.floor(Date.now() / 1000),
    }).select().single();

    if (error || !data) setErr(`Upload failed: ${error?.message ?? 'unknown error'}`);
    else onUploaded(data as TabFile);
    setUploading(false);
  }

  async function saveUrl() {
    setErr('');
    let url = urlInput.trim();
    if (!url) { setErr('Please enter a URL.'); return; }
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    const label = labelInput.trim() || url;
    setUploading(true);

    const { data, error } = await supabase.from('portal_tab_files').insert({
      tab_id: tabId,
      file_name: label,
      file_url: url,
      file_size: 0,
      file_type: 'text/uri-list',
      sort_order: Math.floor(Date.now() / 1000),
    }).select().single();

    if (error || !data) setErr(`Could not save URL: ${error?.message ?? 'unknown error'}`);
    else { onUploaded(data as TabFile); setUrlInput(''); setLabelInput(''); }
    setUploading(false);
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    Array.from(files).forEach(uploadFile);
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #3D3A36' }}>
      {/* Tab switcher */}
      <div className="flex" style={{ background: '#2C2A27', borderBottom: '1px solid #3D3A36' }}>
        {([['file', Upload, 'File Upload'], ['url', Globe, 'Website URL']] as const).map(([m, Icon, label]) => (
          <button key={m} onClick={() => { setMode(m); setErr(''); }}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors"
            style={{
              color: mode === m ? '#F5F3EE' : '#6B6865',
              borderBottom: mode === m ? '2px solid #F5F3EE' : '2px solid transparent',
              background: 'transparent',
            }}>
            <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
            {label}
          </button>
        ))}
      </div>

      {mode === 'file' ? (
        <div
          onClick={() => !uploading && fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
          className="flex flex-col items-center justify-center gap-2 cursor-pointer transition-all"
          style={{
            padding: '1.5rem',
            background: dragging ? '#2C2A27' : '#1C1B19',
            opacity: uploading ? 0.6 : 1,
            pointerEvents: uploading ? 'none' : 'auto',
          }}>
          {uploading ? (
            <>
              <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: '#3D3A36', borderTopColor: '#9A9690' }} />
              <p className="text-xs" style={{ color: '#9A9690' }}>Uploading…</p>
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" style={{ color: '#4A4844' }} strokeWidth={1.5} />
              <p className="text-xs" style={{ color: '#6B6865' }}>
                Drop files here or <span style={{ color: '#9A9690', textDecoration: 'underline' }}>browse</span>
              </p>
              <p className="text-xs" style={{ color: '#4A4844' }}>PDF, Word, Excel, images · Max 50 MB</p>
            </>
          )}
        </div>
      ) : (
        <div className="p-4 space-y-3" style={{ background: '#1C1B19' }}>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#6B6865' }}>URL</label>
            <div className="flex items-center rounded-lg overflow-hidden" style={{ border: '1px solid #3D3A36', background: '#2C2A27' }}>
              <div className="px-3 flex-shrink-0" style={{ color: '#6B6865' }}>
                <LinkIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
              </div>
              <input
                value={urlInput}
                onChange={e => { setUrlInput(e.target.value); setErr(''); }}
                onKeyDown={e => { if (e.key === 'Enter') saveUrl(); }}
                placeholder="https://example.com"
                className="flex-1 py-2.5 pr-3 text-sm focus:outline-none bg-transparent"
                style={{ color: '#F5F3EE' }}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#6B6865' }}>Label <span style={{ color: '#4A4844' }}>(optional)</span></label>
            <input
              value={labelInput}
              onChange={e => setLabelInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveUrl(); }}
              placeholder="Display name"
              className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none"
              style={{ border: '1px solid #3D3A36', background: '#2C2A27', color: '#F5F3EE' }}
            />
          </div>
          {err && <p className="text-xs" style={{ color: '#C05454' }}>{err}</p>}
          <button
            onClick={saveUrl}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: '#2C2A27', color: '#F5F3EE', border: '1px solid #4A4844' }}>
            {uploading
              ? <><div className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: '#4A4844', borderTopColor: '#9A9690' }} /> Saving…</>
              : <><Check className="w-3.5 h-3.5" strokeWidth={2} /> Add Website</>
            }
          </button>
        </div>
      )}

      <input ref={fileRef} type="file" multiple className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv"
        onChange={e => handleFiles(e.target.files)} />
    </div>
  );
}

// ── File Card ──────────────────────────────────────────────────────────────

function FileCard({ file, authed, onDelete, onOpen }: { file: TabFile; authed: boolean; onDelete: () => void; onOpen?: () => void }) {
  const isLink = file.file_type === 'text/uri-list';
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl group transition-all"
      style={{ background: '#2C2A27', border: '1px solid #3D3A36', cursor: isLink ? 'pointer' : 'default' }}
      onClick={isLink ? onOpen : undefined}
    >
      <div className="flex-shrink-0">{fileIcon(file.file_type)}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: '#F5F3EE' }}>{file.file_name}</p>
        {isLink
          ? <p className="text-xs mt-0.5 truncate" style={{ color: '#6B6865' }}>{file.file_url}</p>
          : <p className="text-xs mt-0.5" style={{ color: '#6B6865' }}>{formatBytes(file.file_size)}</p>
        }
      </div>
      <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
        {isLink ? (
          <button
            onClick={onOpen}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:opacity-70"
            style={{ color: '#9A9690' }}
            title="Open website"
          >
            <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        ) : (
          <a
            href={file.file_url}
            target="_blank"
            rel="noopener noreferrer"
            download={file.file_name}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:opacity-70"
            style={{ color: '#9A9690' }}
            title="Download"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
          </a>
        )}
        {authed && (
          <button onClick={onDelete}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors opacity-0 group-hover:opacity-100"
            style={{ color: '#C05454' }} title="Remove">
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Tab Label Editor ───────────────────────────────────────────────────────

function TabLabelEditor({ tab, onSave, onCancel }: {
  tab: PortalTab;
  onSave: (label: string, icon: string) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(tab.label);
  const [icon, setIcon] = useState(tab.icon);
  const [showIcons, setShowIcons] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowIcons(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div className="px-1 py-1 mb-0.5" ref={ref}>
      <div className="rounded-xl p-3 space-y-2" style={{ background: '#2C2A27', border: '1px solid #3D3A36' }}>
        <div className="flex gap-2">
          <button onClick={() => setShowIcons(s => !s)}
            className="w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ background: '#3D3A36', color: '#C0BDB7' }}>
            <TabIcon name={icon} className="w-4 h-4" />
          </button>
          <input autoFocus value={label} onChange={e => setLabel(e.target.value)} placeholder="Tab name"
            className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none"
            style={{ background: '#1C1B19', border: '1px solid #4A4844', color: '#F5F3EE' }} />
        </div>
        {showIcons && (
          <div className="grid grid-cols-7 gap-1 p-1.5 rounded-lg" style={{ background: '#1C1B19' }}>
            {ICON_OPTIONS.map(ic => (
              <button key={ic} onClick={() => { setIcon(ic); setShowIcons(false); }}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                style={{ background: ic === icon ? '#F5F3EE' : 'transparent', color: ic === icon ? '#2C2A27' : '#9A9690' }}>
                <TabIcon name={ic} className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-lg py-1.5 text-xs font-medium"
            style={{ background: '#3D3A36', color: '#9A9690' }}>Cancel</button>
          <button onClick={() => onSave(label.trim() || 'Tab', icon)}
            className="flex-1 rounded-lg py-1.5 text-xs font-medium flex items-center justify-center gap-1 hover:opacity-85"
            style={{ background: '#F5F3EE', color: '#2C2A27' }}>
            <Check className="w-3 h-3" strokeWidth={2.5} /> Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Folder Label Editor ────────────────────────────────────────────────────

function FolderLabelEditor({ initialLabel, onSave, onCancel }: {
  initialLabel: string;
  onSave: (label: string) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(initialLabel);

  return (
    <div className="px-1 py-1 mb-0.5">
      <div className="rounded-xl p-3 space-y-2" style={{ background: '#2C2A27', border: '1px solid #3D3A36' }}>
        <div className="flex gap-2 items-center">
          <div className="w-7 h-7 flex items-center justify-center flex-shrink-0" style={{ color: '#9A9690' }}>
            <Folder className="w-4 h-4" strokeWidth={1.5} />
          </div>
          <input autoFocus value={label} onChange={e => setLabel(e.target.value)} placeholder="Folder name"
            onKeyDown={e => { if (e.key === 'Enter') onSave(label.trim() || 'Folder'); }}
            className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none"
            style={{ background: '#1C1B19', border: '1px solid #4A4844', color: '#F5F3EE' }} />
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-lg py-1.5 text-xs font-medium"
            style={{ background: '#3D3A36', color: '#9A9690' }}>Cancel</button>
          <button onClick={() => onSave(label.trim() || 'Folder')}
            className="flex-1 rounded-lg py-1.5 text-xs font-medium flex items-center justify-center gap-1 hover:opacity-85"
            style={{ background: '#F5F3EE', color: '#2C2A27' }}>
            <Check className="w-3 h-3" strokeWidth={2.5} /> Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Menu ───────────────────────────────────────────────────────────────

type AddTarget = 'tab' | 'folder';

function AddMenu({ onSelect, onClose }: { onSelect: (t: AddTarget) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute left-0 bottom-full mb-1 w-44 rounded-xl shadow-xl overflow-hidden z-20"
      style={{ background: '#F5F3EE', border: '1px solid #DDDBD5' }}>
      {[
        { type: 'tab' as const, icon: <FileText className="w-3.5 h-3.5" strokeWidth={1.5} />, label: 'New Tab' },
        { type: 'folder' as const, icon: <Folder className="w-3.5 h-3.5" strokeWidth={1.5} />, label: 'New Folder' },
      ].map(item => (
        <button key={item.type} onClick={() => { onSelect(item.type); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium transition-colors text-left"
          style={{ color: '#2C2A27' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#ECEAE4')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}

// ── Sidebar Tab Row ────────────────────────────────────────────────────────

function SidebarTabRow({
  tab, activeTabId, authed, indent, isDragging, isDragOver,
  onSelect, onEdit, onDelete, onDragStart, onDragOver, onDrop, onDragEnd,
}: {
  tab: PortalTab;
  activeTabId: string | null;
  authed: boolean;
  indent?: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  const isActive = activeTabId === tab.id;

  return (
    <div
      draggable={authed}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className="group relative flex items-center rounded-xl mb-0.5"
      style={{
        background: isActive ? '#E4E2DC' : 'transparent',
        border: isActive ? '1px solid #D4D2CC' : '1px solid transparent',
        opacity: isDragging ? 0.4 : 1,
        outline: isDragOver && !isDragging ? '2px solid #C0BDB7' : 'none',
        outlineOffset: '-1px',
        marginLeft: indent ? '12px' : 0,
        transition: 'opacity 0.15s',
      }}>
      {authed && (
        <div className="pl-1.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab flex-shrink-0"
          style={{ color: '#C0BDB7' }}>
          <GripVertical className="w-3 h-3" strokeWidth={1.5} />
        </div>
      )}
      <button
        onClick={onSelect}
        className="flex-1 flex items-center gap-2.5 px-3 py-2.5 text-left min-w-0"
        onMouseEnter={e => { if (!isActive) (e.currentTarget.parentElement as HTMLElement).style.background = '#ECEAE4'; }}
        onMouseLeave={e => { if (!isActive) (e.currentTarget.parentElement as HTMLElement).style.background = 'transparent'; }}
      >
        <TabIcon name={tab.icon} className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
        <span className="text-xs font-semibold truncate" style={{ color: isActive ? '#2C2A27' : '#6B6865' }}>
          {tab.label}
        </span>
      </button>
      {authed && (
        <div className="flex items-center gap-0.5 pr-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={e => { e.stopPropagation(); onEdit(); }}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-black/10 transition-colors"
            style={{ color: '#9A9690' }}>
            <Pencil className="w-3 h-3" strokeWidth={1.5} />
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-50 transition-colors"
            style={{ color: '#C08080' }}>
            <Trash2 className="w-3 h-3" strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── MeiGuy Full-Screen Chat (non-Dallas users) ─────────────────────────────

const SUPABASE_URL_CHAT = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY_CHAT = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

interface ChatMessage { role: 'user' | 'assistant'; content: string; }

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function renderChatText(text: string) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('### ')) {
      elements.push(<p key={i} className="text-xs font-semibold uppercase tracking-widest mt-3 mb-1" style={{ color: '#9A9690' }}>{line.slice(4)}</p>);
    } else if (line.startsWith('## ')) {
      elements.push(<p key={i} className="text-sm font-semibold mt-2" style={{ color: '#F5F3EE' }}>{line.slice(3)}</p>);
    } else if (line.startsWith('# ')) {
      elements.push(<p key={i} className="text-base font-bold mt-2" style={{ color: '#F5F3EE' }}>{line.slice(2)}</p>);
    } else if (line.startsWith('- ') || line.startsWith('• ')) {
      elements.push(
        <div key={i} className="flex gap-2 text-sm" style={{ color: '#C0BDB7' }}>
          <span className="flex-shrink-0 mt-1 w-1 h-1 rounded-full" style={{ background: '#6B6865', marginTop: '7px' }} />
          <span>{inlineFmt(line.slice(2))}</span>
        </div>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const m = line.match(/^(\d+)\.\s(.*)$/);
      if (m) elements.push(
        <div key={i} className="flex gap-2 text-sm" style={{ color: '#C0BDB7' }}>
          <span className="flex-shrink-0 font-medium text-xs w-4" style={{ color: '#6B6865', paddingTop: '1px' }}>{m[1]}.</span>
          <span>{inlineFmt(m[2])}</span>
        </div>
      );
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(<p key={i} className="text-sm leading-relaxed" style={{ color: '#C0BDB7' }}>{inlineFmt(line)}</p>);
    }
    i++;
  }
  return <div className="space-y-1">{elements}</div>;
}

function inlineFmt(text: string): React.ReactNode {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**'))
      return <strong key={i} style={{ color: '#F5F3EE', fontWeight: 600 }}>{p.slice(2, -2)}</strong>;
    if (p.startsWith('`') && p.endsWith('`'))
      return <code key={i} className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#2C2A27', color: '#C8A96E', fontFamily: 'monospace' }}>{p.slice(1, -1)}</code>;
    return p;
  });
}

const EXEC_NAMES = ['zach meiborg', 'james cooper', 'megan dierks', 'tony askins', 'dallas marcum'];

function getAgentEndpoint(member: LoggedInMember | null): string {
  if (!member?.full_name) return 'gemini-agent';
  const name = member.full_name.toLowerCase().trim();
  if (EXEC_NAMES.includes(name)) return 'ai-agent';
  const pos = (member.position ?? '').toLowerCase();
  const dept = (member.department ?? '').toLowerCase();
  const isAccounting = dept === 'accounting' || pos.includes('accounting') || pos.includes('billing') ||
    pos.includes('payroll') || pos.includes('controller') || pos.includes('accounts');
  return isAccounting ? 'ai-agent' : 'gemini-agent';
}

const EXEC_SUGGESTIONS: Record<string, Array<{ label: string; icon: string }>> = {
  'zach meiborg': [
    { label: 'Build a company financial summary', icon: '📊' },
    { label: 'Summarize headcount by department', icon: '👥' },
    { label: 'What are our biggest operational risks?', icon: '⚡' },
    { label: 'Model a 10% revenue growth scenario', icon: '📈' },
  ],
  'james cooper': [
    { label: 'Generate an operational performance report', icon: '📊' },
    { label: 'Analyze dispatch efficiency', icon: '🚚' },
    { label: 'What are our top cost drivers?', icon: '💰' },
    { label: 'Build a department breakdown', icon: '🏢' },
  ],
  'megan dierks': [
    { label: 'Summarize our PTO and leave policies', icon: '📋' },
    { label: 'Draft an onboarding checklist', icon: '✅' },
    { label: "What's in the benefits package?", icon: '🎁' },
    { label: 'Help with a dental card request', icon: '🦷' },
  ],
  'tony askins': [
    { label: 'Generate a Meiborg ad image prompt', icon: '🎨' },
    { label: 'Write social media posts for Meiborg', icon: '📱' },
    { label: 'Draft a marketing campaign concept', icon: '💡' },
    { label: 'Create a brand voice guide', icon: '✍️' },
  ],
  'dallas marcum': [
    { label: 'What docs are in the portal?', icon: '📁' },
    { label: 'Help me design a new AI workflow', icon: '🤖' },
    { label: 'Summarize all uploaded documents', icon: '📄' },
    { label: 'Generate a company financial report', icon: '📊' },
  ],
};

// Manager/Director/Senior tier — one level below execs
const MANAGER_SUGGESTIONS: Record<string, Array<{ label: string; icon: string }>> = {
  'melissa kiely': [
    { label: 'Summarize payroll policies for the team', icon: '💳' },
    { label: 'What are the billing and AR procedures?', icon: '📑' },
    { label: 'Help draft an accounting policy memo', icon: '📝' },
    { label: 'What are our benefits and deduction options?', icon: '🎁' },
  ],
  'heather haime': [
    { label: 'Summarize expense and reimbursement policies', icon: '💰' },
    { label: 'What are our payroll deduction options?', icon: '💳' },
    { label: 'Explain the MeiCares program', icon: '❤️' },
    { label: 'What does the employee handbook say about PTO?', icon: '📅' },
  ],
  'michael haskins': [
    { label: 'What are the team attendance policies?', icon: '📋' },
    { label: 'Summarize benefits for new hires', icon: '🎁' },
    { label: 'Help draft a customer service policy summary', icon: '📝' },
    { label: 'What is the dress code and conduct policy?', icon: '👔' },
  ],
  'austin webb': [
    { label: 'What is the travel reimbursement policy?', icon: '🚚' },
    { label: 'Summarize dispatch team benefits', icon: '🎁' },
    { label: 'What does the handbook say about overtime?', icon: '⏱️' },
    { label: 'Help me fill out a dental card', icon: '🦷' },
  ],
  'dan ramlo': [
    { label: 'How do I submit travel reimbursement?', icon: '🚚' },
    { label: 'What is our PTO and leave policy?', icon: '📅' },
    { label: 'What does the handbook say about overtime?', icon: '⏱️' },
    { label: 'Help me set up Direct Deposit', icon: '🏦' },
  ],
  'erik langholf': [
    { label: 'Summarize company policies for my division', icon: '🏢' },
    { label: 'What benefits are available to the team?', icon: '🎁' },
    { label: 'Help draft a team policy summary', icon: '📝' },
    { label: 'What does the employee handbook cover?', icon: '📖' },
  ],
  'bill jarrett': [
    { label: 'Summarize fleet operations policies', icon: '🚗' },
    { label: 'What are the team benefits?', icon: '🎁' },
    { label: 'What does the handbook say about leave?', icon: '📅' },
    { label: 'Help me fill out a dental card', icon: '🦷' },
  ],
  'michael houston': [
    { label: 'Summarize fleet policies and procedures', icon: '🚗' },
    { label: 'What benefits are available to fleet staff?', icon: '🎁' },
    { label: 'What does the handbook say about PTO?', icon: '📅' },
    { label: 'Help draft a fleet operations summary', icon: '📝' },
  ],
  'tristen wagoner': [
    { label: 'Summarize IT and remote work policies', icon: '💻' },
    { label: 'What are the team benefits?', icon: '🎁' },
    { label: 'What does the handbook say about equipment?', icon: '🖥️' },
    { label: 'Help me fill out a dental card', icon: '🦷' },
  ],
  'mark hurley': [
    { label: 'Summarize logistics team policies', icon: '📦' },
    { label: 'What are the travel reimbursement rules?', icon: '✈️' },
    { label: 'What benefits are available to the team?', icon: '🎁' },
    { label: 'What does the handbook say about leave?', icon: '📅' },
  ],
  'joshua hinz': [
    { label: 'What is in the safety and DOT section?', icon: '⚠️' },
    { label: 'Summarize compliance-related handbook policies', icon: '📋' },
    { label: 'What are the team benefits?', icon: '🎁' },
    { label: 'Help with a dental card or benefits form', icon: '🦷' },
  ],
  'chris jacobsen': [
    { label: 'Summarize Orbit Fuels team policies', icon: '⛽' },
    { label: 'What are the benefits for my department?', icon: '🎁' },
    { label: 'What does the handbook say about PTO?', icon: '📅' },
    { label: 'Help me fill out a dental card', icon: '🦷' },
  ],
};

function isManagerLevel(pos: string): boolean {
  const p = pos.toLowerCase();
  return p.includes('manager') || p.includes('director') || p.includes('supervisor') ||
    p.includes('general manager') || p.includes('controller') || p.includes('lead') ||
    p.includes('senior') || p.includes('coordinator');
}

const DEPT_SUGGESTIONS: Record<string, Array<{ label: string; icon: string }>> = {
  accounting: [
    { label: 'Explain our payroll schedule', icon: '💳' },
    { label: 'Help me set up Direct Deposit', icon: '🏦' },
    { label: 'What are my benefits?', icon: '🎁' },
    { label: 'How does PTO accrual work?', icon: '📅' },
  ],
  'accounting-mgr': [
    { label: 'Summarize payroll policies for the team', icon: '💳' },
    { label: 'What are the billing and AR procedures?', icon: '📑' },
    { label: 'Help draft an accounting policy memo', icon: '📝' },
    { label: 'What are our benefits and deduction options?', icon: '🎁' },
  ],
  dispatch: [
    { label: 'How do I submit travel reimbursement?', icon: '🚚' },
    { label: 'What is our PTO policy?', icon: '📋' },
    { label: 'Help me fill out a dental card', icon: '🦷' },
    { label: 'What is in the employee handbook?', icon: '📖' },
  ],
  'dispatch-mgr': [
    { label: 'What is the travel reimbursement policy?', icon: '🚚' },
    { label: 'Summarize dispatch team benefits', icon: '🎁' },
    { label: 'What does the handbook say about overtime?', icon: '⏱️' },
    { label: 'How does PTO work for shift-based teams?', icon: '📅' },
  ],
  csr: [
    { label: 'What benefits am I enrolled in?', icon: '🎁' },
    { label: 'How do MeiPerks work?', icon: '✨' },
    { label: 'Help me fill out a daycare waiver', icon: '👶' },
    { label: 'What is the dress code policy?', icon: '👔' },
  ],
  'csr-mgr': [
    { label: 'What are the team attendance policies?', icon: '📋' },
    { label: 'Summarize benefits for new hires', icon: '🎁' },
    { label: 'Help draft a customer service policy summary', icon: '📝' },
    { label: 'What is the dress code and conduct policy?', icon: '👔' },
  ],
  it: [
    { label: 'What is the remote work policy?', icon: '💻' },
    { label: 'Help me set up Direct Deposit', icon: '🏦' },
    { label: 'What does MeiCares cover?', icon: '❤️' },
    { label: 'Summarize the employee handbook', icon: '📖' },
  ],
  'it-mgr': [
    { label: 'Summarize IT and remote work policies', icon: '💻' },
    { label: 'What are the team benefits?', icon: '🎁' },
    { label: 'What does the handbook say about equipment use?', icon: '🖥️' },
    { label: 'How does PTO work for the IT team?', icon: '📅' },
  ],
  sales: [
    { label: 'How do I submit a travel reimbursement?', icon: '✈️' },
    { label: 'What is the expense policy?', icon: '💰' },
    { label: 'Help me fill out a dental card', icon: '🦷' },
    { label: 'What are my MeiPerks benefits?', icon: '✨' },
  ],
  fleet: [
    { label: 'What is our PTO and leave policy?', icon: '📋' },
    { label: 'Help me fill out a dental card', icon: '🦷' },
    { label: 'How does travel reimbursement work?', icon: '🚗' },
    { label: 'Explain the MeiCares program', icon: '❤️' },
  ],
  'fleet-mgr': [
    { label: 'Summarize fleet policies and procedures', icon: '🚗' },
    { label: 'What benefits are available to fleet staff?', icon: '🎁' },
    { label: 'What does the handbook say about PTO?', icon: '📅' },
    { label: 'Help draft a fleet operations summary', icon: '📝' },
  ],
  logs: [
    { label: 'What is in the safety and DOT section?', icon: '⚠️' },
    { label: 'Help me fill out a benefits form', icon: '📋' },
    { label: 'What does the Daycare Waiver cover?', icon: '👶' },
    { label: 'Explain the travel reimbursement policy', icon: '✈️' },
  ],
  'logs-mgr': [
    { label: 'Summarize logistics team policies', icon: '📦' },
    { label: 'What are the travel reimbursement rules?', icon: '✈️' },
    { label: 'What benefits are available to the team?', icon: '🎁' },
    { label: 'What does the handbook say about leave?', icon: '📅' },
  ],
  '3pl': [
    { label: 'What is in the safety and DOT section?', icon: '⚠️' },
    { label: 'Help me fill out a benefits form', icon: '📋' },
    { label: 'What does the Daycare Waiver cover?', icon: '👶' },
    { label: 'Explain the travel reimbursement policy', icon: '✈️' },
  ],
  '3pl-mgr': [
    { label: 'What is in the safety and DOT section?', icon: '⚠️' },
    { label: 'Summarize compliance-related handbook policies', icon: '📋' },
    { label: 'What are the team benefits?', icon: '🎁' },
    { label: 'How does PTO work for my team?', icon: '📅' },
  ],
};

const FALLBACK_SUGGESTIONS = [
  { label: 'What is our PTO policy?', icon: '📋' },
  { label: 'Help me fill out Direct Deposit', icon: '🏦' },
  { label: 'I need a dental card', icon: '🦷' },
  { label: 'What are my benefits?', icon: '✨' },
];

function getSuggestions(member: LoggedInMember | null) {
  if (!member) return FALLBACK_SUGGESTIONS;
  const key = member.full_name.toLowerCase().trim();

  // Exec tier — named profiles
  if (EXEC_NAMES.includes(key)) return EXEC_SUGGESTIONS[key] ?? FALLBACK_SUGGESTIONS;

  // Manager tier — named profiles first, then generic manager chips by dept
  if (MANAGER_SUGGESTIONS[key]) return MANAGER_SUGGESTIONS[key];

  const dept = (member.department ?? '').toLowerCase().trim();
  const pos = (member.position ?? '').toLowerCase();
  const isMgr = isManagerLevel(pos);

  if (dept === 'accounting' || pos.includes('accounting') || pos.includes('billing') || pos.includes('payroll') || pos.includes('accounts receivable') || pos.includes('controller'))
    return DEPT_SUGGESTIONS[isMgr ? 'accounting-mgr' : 'accounting'];
  if (dept === 'dispatch' || pos.includes('dispatch') || pos.includes('driver leader') || pos.includes('network') || pos.includes('planner'))
    return DEPT_SUGGESTIONS[isMgr ? 'dispatch-mgr' : 'dispatch'];
  if (dept === 'csr' || pos.includes('customer service') || pos.includes('receptionist'))
    return DEPT_SUGGESTIONS[isMgr ? 'csr-mgr' : 'csr'];
  if (dept === 'it' || pos.includes('engineer') || pos.includes('network specialist') || pos.includes('systems') || pos.includes('director of it'))
    return DEPT_SUGGESTIONS[isMgr ? 'it-mgr' : 'it'];
  if (dept === 'sales' || pos.includes('sales') || pos.includes('business development') || pos.includes('data analyst'))
    return DEPT_SUGGESTIONS.sales;
  if (dept === 'fleet' || pos.includes('fleet') || pos.includes('operations') || pos.includes('recruiting'))
    return DEPT_SUGGESTIONS[isMgr ? 'fleet-mgr' : 'fleet'];
  if (dept === 'logs' || pos.includes('logistics') || pos.includes('carrier'))
    return DEPT_SUGGESTIONS[isMgr ? 'logs-mgr' : 'logs'];
  if (dept === '3pl' || pos.includes('safety') || pos.includes('dot'))
    return DEPT_SUGGESTIONS[isMgr ? '3pl-mgr' : '3pl'];
  return FALLBACK_SUGGESTIONS;
}

function TypingDotsFull() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-0.5">
      {[0, 1, 2].map(i => (
        <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
          style={{ background: '#6B6865', animationDelay: `${i * 160}ms`, animationDuration: '1s' }} />
      ))}
    </div>
  );
}

// ── Exec Financial Panel ───────────────────────────────────────────────────
// Shown only for Zach Meiborg on the MeiGuy home screen.
// Fetches the latest AR, AP, and Unbilled Orders reports and displays
// key financial metrics as a compact card panel.

const TAB_IDS = {
  ar: 'b8f2c697-6db0-4146-abce-352d778304d5',
  ap: '6c2edf02-b176-444c-b8ef-8ad87bda86e0',
  unbilled: 'ba3897f3-18e0-4f3e-b4bd-82d53ca75730',
};

interface ExecMetrics {
  arTotal: number;
  arPastDue: number;
  arCustomers: number;
  apTotal: number;
  apPastDueAmount: number;
  apPastDueCount: number;
  unbilledCount: number;
  unbilledTotal: number;
  unbilledReadyCount: number;
  unbilledReadyTotal: number;
}

function fmtDollars(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });
}

function ExecFinancialPanel() {
  const [metrics, setMetrics] = useState<ExecMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [arRes, apRes, uboRes] = await Promise.all([
        supabase.from('ar_reports').select('report_data').eq('tab_id', TAB_IDS.ar)
          .order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('ap_reports').select('report_data').eq('tab_id', TAB_IDS.ap)
          .order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('unbilled_orders_reports').select('report_data').eq('tab_id', TAB_IDS.unbilled)
          .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      // AR metrics
      let arTotal = 0, arPastDue = 0, arCustomers = 0;
      if (arRes.data?.report_data) {
        const customers = arRes.data.report_data as Array<{
          totals: { balance: number; over30: number; over45: number; over60: number; over90: number };
        }>;
        arCustomers = customers.length;
        arTotal = customers.reduce((s, c) => s + (c.totals?.balance ?? 0), 0);
        arPastDue = customers.reduce((s, c) => s + (c.totals?.over30 ?? 0) + (c.totals?.over45 ?? 0) + (c.totals?.over60 ?? 0) + (c.totals?.over90 ?? 0), 0);
      }

      // AP metrics
      let apTotal = 0, apPastDueAmount = 0, apPastDueCount = 0;
      if (apRes.data?.report_data) {
        const vendors = apRes.data.report_data as Array<{
          totals: { balance: number; over30: number; over60: number; over90: number; over120: number; invoiceCount: number };
        }>;
        apTotal = vendors.reduce((s, v) => s + (v.totals?.balance ?? 0), 0);
        apPastDueAmount = vendors.reduce((s, v) => s + (v.totals?.over30 ?? 0) + (v.totals?.over60 ?? 0) + (v.totals?.over90 ?? 0) + (v.totals?.over120 ?? 0), 0);
        apPastDueCount = vendors.filter(v => ((v.totals?.over30 ?? 0) + (v.totals?.over60 ?? 0) + (v.totals?.over90 ?? 0) + (v.totals?.over120 ?? 0)) > 0).length;
      }

      // Unbilled Orders metrics
      let unbilledCount = 0, unbilledTotal = 0, unbilledReadyCount = 0, unbilledReadyTotal = 0;
      if (uboRes.data?.report_data) {
        const orders = uboRes.data.report_data as Array<{ totalCharges: number; readyToBill: boolean }>;
        unbilledCount = orders.length;
        unbilledTotal = orders.reduce((s, o) => s + (o.totalCharges ?? 0), 0);
        const ready = orders.filter(o => o.readyToBill);
        unbilledReadyCount = ready.length;
        unbilledReadyTotal = ready.reduce((s, o) => s + (o.totalCharges ?? 0), 0);
      }

      setMetrics({ arTotal, arPastDue, arCustomers, apTotal, apPastDueAmount, apPastDueCount, unbilledCount, unbilledTotal, unbilledReadyCount, unbilledReadyTotal });
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center w-72 h-48">
        <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: '#2C2A27', borderTopColor: '#C8A96E' }} />
      </div>
    );
  }

  if (!metrics) return null;

  const sections = [
    {
      title: 'Accounts Receivable',
      accent: '#60A5FA',
      items: [
        { label: 'Total AR Balance', value: fmtDollars(metrics.arTotal), color: '#F5F3EE' },
        { label: 'Past Due (30+)', value: fmtDollars(metrics.arPastDue), color: metrics.arPastDue > 0 ? '#FB923C' : '#4ADE80' },
        { label: 'Customers', value: metrics.arCustomers.toString(), color: '#9A9690' },
      ],
    },
    {
      title: 'Accounts Payable',
      accent: '#F87171',
      items: [
        { label: 'Total AP Balance', value: fmtDollars(metrics.apTotal), color: '#F5F3EE' },
        { label: 'Past Due Amount', value: fmtDollars(metrics.apPastDueAmount), color: metrics.apPastDueAmount > 0 ? '#F87171' : '#4ADE80' },
        { label: 'Vendors Past Due', value: metrics.apPastDueCount.toString(), color: metrics.apPastDueCount > 0 ? '#FCD34D' : '#4ADE80' },
      ],
    },
    {
      title: 'Unbilled Orders',
      accent: '#C8A96E',
      items: [
        { label: 'Total Orders', value: metrics.unbilledCount.toString(), color: '#9A9690' },
        { label: 'Total Value', value: fmtDollars(metrics.unbilledTotal), color: '#F5F3EE' },
        { label: `Ready to Bill (${metrics.unbilledReadyCount})`, value: fmtDollars(metrics.unbilledReadyTotal), color: '#4ADE80' },
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-3 w-72 flex-shrink-0" style={{ animation: 'fadeUp 0.6s ease both', animationDelay: '0.1s' }}>
      <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#4A4844' }}>Financial Overview</p>
      {sections.map(sec => (
        <div key={sec.title} className="rounded-2xl p-4" style={{ background: '#141210', border: `1px solid #2C2A27` }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: sec.accent }} />
            <span className="text-xs font-semibold" style={{ color: sec.accent }}>{sec.title}</span>
          </div>
          <div className="space-y-2">
            {sec.items.map(item => (
              <div key={item.label} className="flex items-center justify-between gap-3">
                <span className="text-xs" style={{ color: '#6B6865' }}>{item.label}</span>
                <span className="text-sm font-semibold tabular-nums" style={{ color: item.color }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MeiGuyFullChat({ member, onSignOut }: { member: LoggedInMember | null; onSignOut: () => void }) {
  const firstName = member?.full_name?.split(' ')[0] ?? '';
  const isExec = EXEC_NAMES.includes((member?.full_name ?? '').toLowerCase().trim());
  const isZach = (member?.full_name ?? '').toLowerCase().trim() === 'zach meiborg';
  const agentEndpoint = getAgentEndpoint(member);
  const suggestions = getSuggestions(member);
  const roleSubtitle = member?.position ? `${member.position}${member.department ? ` · ${member.department}` : ''}` : 'Meiborg Employee';
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [focused, setFocused] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasConversation = messages.length > 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loadingMsg]);

  async function send(text: string) {
    if (!text.trim() || loadingMsg) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: text.trim() }];
    setMessages(next);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setLoadingMsg(true);
    try {
      const res = await fetch(`${SUPABASE_URL_CHAT}/functions/v1/${agentEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY_CHAT}`,
          apikey: SUPABASE_ANON_KEY_CHAT,
        },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
          memberContext: {
            full_name: member?.full_name,
            position: member?.position,
            department: member?.department,
          },
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply ?? 'Sorry, something went wrong.' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I ran into an error. Please try again.' }]);
    }
    setLoadingMsg(false);
  }

  const avatarEl = member && (
    member.avatar_url
      ? <img src={member.avatar_url} alt={member.full_name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" style={{ border: '1.5px solid #3D3A36' }} />
      : <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0" style={{ background: '#2C2A27', border: '1.5px solid #3D3A36', color: '#C0BDB7' }}>
          {member.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
        </div>
  );

  return (
    <div className="h-screen flex flex-col" style={{ background: '#141412', fontFamily: "'Inter', sans-serif" }}>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid #222120', background: '#141412' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl overflow-hidden flex-shrink-0" style={{ border: '1px solid #2C2A27' }}>
            <img src="/Mei-Guy_icon_(1).png" alt="MeiGuy" className="w-full h-full object-contain" />
          </div>
          <span className="text-sm font-semibold tracking-tight" style={{ color: '#F5F3EE' }}>MeiGuy</span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: isExec ? '#2A1F0A' : '#1E1D1B', color: isExec ? '#C8A96E' : '#6B6865', border: `1px solid ${isExec ? '#4A3A1A' : '#2C2A27'}` }}>
            {isExec ? 'Full Access' : 'Meiborg'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {member && (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: '#4A4844' }}>{member.full_name}</span>
              {avatarEl}
            </div>
          )}
          <button onClick={onSignOut}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
            style={{ color: '#6B6865', background: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1E1D1B')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
            Sign out
          </button>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div ref={containerRef} className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#2C2A27 transparent' }}>

        {/* Welcome hero — shown until first message */}
        {!hasConversation && (
          <div className={`flex min-h-full px-8 pb-8 pt-16 gap-12 ${isZach ? 'items-start justify-center' : 'items-center justify-center flex-col'}`}
            style={{ animation: 'fadeUp 0.5s ease both' }}>

            {/* Center column — greeting + chips */}
            <div className="flex flex-col items-center" style={{ maxWidth: '480px', width: '100%', flexShrink: 0 }}>
              <div className="w-16 h-16 rounded-3xl overflow-hidden mb-6" style={{ border: '2px solid #2C2A27', boxShadow: '0 0 40px rgba(200,169,110,0.08)' }}>
                <img src="/Mei-Guy_icon_(1).png" alt="MeiGuy" className="w-full h-full object-contain" />
              </div>
              <h1 className="text-4xl font-semibold mb-2 text-center tracking-tight"
                style={{ color: '#F5F3EE', fontFamily: "'Georgia', serif" }}>
                {getGreeting()}{firstName ? `, ${firstName}` : ''}
              </h1>
              <p className="text-sm mb-1 text-center font-medium" style={{ color: '#6B6865' }}>
                {roleSubtitle}
              </p>
              <p className="text-sm mb-10 text-center" style={{ color: '#4A4844' }}>
                {isExec ? 'Full access — ask me anything about Meiborg.' : 'Your personal HR and company assistant.'}
              </p>

              {/* Suggestion chips */}
              <div className="grid grid-cols-2 gap-2.5 w-full">
                {suggestions.map(s => (
                  <button key={s.label} onClick={() => send(s.label)}
                    className="text-left px-4 py-3 rounded-2xl text-sm transition-all"
                    style={{ background: '#1A1917', border: '1px solid #262422', color: '#9A9690' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#3D3A36'; (e.currentTarget as HTMLElement).style.color = '#F5F3EE'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#262422'; (e.currentTarget as HTMLElement).style.color = '#9A9690'; }}>
                    <span className="block text-base mb-1">{s.icon}</span>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Financial panel — Zach only */}
            {isZach && (
              <div className="pt-2" style={{ marginTop: '88px' }}>
                <ExecFinancialPanel />
              </div>
            )}
          </div>
        )}

        {/* Message thread */}
        {hasConversation && (
          <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
            {messages.map((m, i) => (
              <div key={i}
                className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                style={{ animation: 'fadeUp 0.25s ease both' }}>
                {m.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-xl overflow-hidden flex-shrink-0 mt-0.5" style={{ border: '1px solid #2C2A27' }}>
                    <img src="/Mei-Guy_icon_(1).png" alt="MeiGuy" className="w-full h-full object-contain" />
                  </div>
                )}
                <div className={`rounded-2xl px-4 py-3 ${m.role === 'user' ? 'max-w-md' : 'max-w-xl flex-1'}`}
                  style={{
                    background: m.role === 'user' ? '#1E1D1B' : 'transparent',
                    border: m.role === 'user' ? '1px solid #2C2A27' : 'none',
                  }}>
                  {m.role === 'user'
                    ? <p className="text-sm leading-relaxed" style={{ color: '#E8E5DF' }}>{m.content}</p>
                    : renderChatText(m.content)
                  }
                </div>
                {m.role === 'user' && avatarEl}
              </div>
            ))}

            {loadingMsg && (
              <div className="flex gap-3 justify-start" style={{ animation: 'fadeUp 0.25s ease both' }}>
                <div className="w-7 h-7 rounded-xl overflow-hidden flex-shrink-0 mt-0.5" style={{ border: '1px solid #2C2A27' }}>
                  <img src="/Mei-Guy_icon_(1).png" alt="MeiGuy" className="w-full h-full object-contain" />
                </div>
                <div className="rounded-2xl px-4 py-3" style={{ background: '#1A1917', border: '1px solid #222120' }}>
                  <TypingDotsFull />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Input bar ── */}
      <div className="flex-shrink-0 px-4 pb-6 pt-3" style={{ background: '#141412' }}>
        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl transition-all duration-200"
            style={{
              background: '#1A1917',
              border: `1px solid ${focused ? '#3D3A36' : '#262422'}`,
              boxShadow: focused ? '0 0 0 3px rgba(61,58,54,0.25)' : 'none',
            }}>
            <div className="px-4 pt-3 pb-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                placeholder={hasConversation ? 'Continue the conversation…' : 'Ask anything about Meiborg…'}
                rows={1}
                className="w-full bg-transparent text-sm resize-none focus:outline-none leading-relaxed"
                style={{ color: '#F5F3EE', maxHeight: '160px', scrollbarWidth: 'none' }}
                onInput={e => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
                }}
              />
            </div>
            <div className="flex items-center justify-between px-3 pb-2.5">
              <span className="text-xs" style={{ color: '#4A4844' }}>Shift+Enter for new line</span>
              <button
                onClick={() => send(input)}
                disabled={!input.trim() || loadingMsg}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                style={{
                  background: input.trim() && !loadingMsg ? '#F5F3EE' : '#222120',
                  color: input.trim() && !loadingMsg ? '#141412' : '#4A4844',
                  cursor: input.trim() && !loadingMsg ? 'pointer' : 'default',
                }}>
                {loadingMsg
                  ? <><Loader2 className="w-3 h-3 animate-spin" strokeWidth={2} />Thinking…</>
                  : <><Send className="w-3 h-3" strokeWidth={2} />Send</>
                }
              </button>
            </div>
          </div>
          <p className="text-center text-xs mt-2" style={{ color: '#3D3A36' }}>
            MeiGuy can make mistakes. Verify important information with HR.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ── Main PortalPage ────────────────────────────────────────────────────────

function PortalInner({
  member,
  onOpenAdmin,
  onOpenOrgChart,
  onActiveTabChange,
  onSignOut,
}: {
  member: LoggedInMember | null;
  onOpenAdmin?: () => void;
  onOpenOrgChart?: () => void;
  onActiveTabChange?: (label: string | undefined) => void;
  onSignOut: () => void;
}) {
  const authed = true;

  const [folders, setFolders] = useState<PortalFolder[]>([]);
  const [tabs, setTabs] = useState<PortalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [files, setFiles] = useState<TabFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);

  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [addingWhat, setAddingWhat] = useState<AddTarget | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const [deletingTabId, setDeletingTabId] = useState<string | null>(null);
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);

  const [dragTabId, setDragTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [iframeLabel, setIframeLabel] = useState<string>('');

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [{ data: foldersData }, { data: tabsData }] = await Promise.all([
      supabase.from('portal_folders').select('*').order('sort_order'),
      supabase.from('portal_tabs').select('*').order('sort_order'),
    ]);
    const f = (foldersData ?? []) as PortalFolder[];
    const t = (tabsData ?? []) as PortalTab[];
    setFolders(f);
    setTabs(t);
    const open: Record<string, boolean> = {};
    f.forEach(folder => { open[folder.id] = folder.is_open; });
    setOpenFolders(open);
    if (t.length > 0) setActiveTabId(prev => prev ?? t[0].id);
    setLoading(false);
  }

  useEffect(() => {
    if (!activeTabId) { setFiles([]); return; }
    setIframeUrl(null);
    setIframeLabel('');
    loadContent(activeTabId);
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab) {
      const folder = tab.folder_id ? folders.find(f => f.id === tab.folder_id) : null;
      const label = folder ? `${folder.label} > ${tab.label}` : tab.label;
      onActiveTabChange?.(label);
    }
  }, [activeTabId, tabs, folders]);

  async function loadContent(tabId: string) {
    setContentLoading(true);
    const { data: fi } = await supabase.from('portal_tab_files').select('*').eq('tab_id', tabId).order('sort_order');
    setFiles((fi ?? []) as TabFile[]);
    setContentLoading(false);
  }

  // ── Build sidebar ──────────────────────────────────────────────────────────

  function buildSidebar(): SidebarItem[] {
    const topTabs = tabs.filter(t => !t.folder_id);
    const allTopLevel: Array<{ sort_order: number; item: SidebarItem }> = [
      ...topTabs.map(tab => ({ sort_order: tab.sort_order, item: { kind: 'tab' as const, tab } })),
      ...folders.map(folder => ({
        sort_order: folder.sort_order,
        item: { kind: 'folder' as const, folder, tabs: tabs.filter(t => t.folder_id === folder.id) },
      })),
    ];
    allTopLevel.sort((a, b) => a.sort_order - b.sort_order);
    return allTopLevel.map(x => x.item);
  }

  // ── Tab ops ────────────────────────────────────────────────────────────────

  async function createTab(label: string, icon: string) {
    const maxOrder = tabs.length > 0 ? Math.max(...tabs.map(t => t.sort_order)) + 1 : 0;
    const { data } = await supabase.from('portal_tabs').insert({ label, icon, sort_order: maxOrder }).select().single();
    if (data) { setTabs(prev => [...prev, data as PortalTab]); setActiveTabId((data as PortalTab).id); }
    setAddingWhat(null);
  }

  async function updateTab(id: string, label: string, icon: string) {
    await supabase.from('portal_tabs').update({ label, icon }).eq('id', id);
    setTabs(ts => ts.map(t => t.id === id ? { ...t, label, icon } : t));
    setEditingTabId(null);
  }

  async function deleteTab(id: string) {
    await supabase.from('portal_tabs').delete().eq('id', id);
    const remaining = tabs.filter(t => t.id !== id);
    setTabs(remaining);
    if (activeTabId === id) setActiveTabId(remaining[0]?.id ?? null);
    setDeletingTabId(null);
  }

  async function moveTabToFolder(tabId: string, folderId: string | null) {
    await supabase.from('portal_tabs').update({ folder_id: folderId }).eq('id', tabId);
    setTabs(ts => ts.map(t => t.id === tabId ? { ...t, folder_id: folderId } : t));
  }

  // ── Folder ops ─────────────────────────────────────────────────────────────

  async function createFolder(label: string) {
    const maxOrder = folders.length > 0 ? Math.max(...folders.map(f => f.sort_order)) + 1 : 0;
    const { data } = await supabase.from('portal_folders').insert({ label, sort_order: maxOrder, is_open: true }).select().single();
    if (data) {
      setFolders(prev => [...prev, data as PortalFolder]);
      setOpenFolders(prev => ({ ...prev, [(data as PortalFolder).id]: true }));
    }
    setAddingWhat(null);
  }

  async function updateFolder(id: string, label: string) {
    await supabase.from('portal_folders').update({ label }).eq('id', id);
    setFolders(fs => fs.map(f => f.id === id ? { ...f, label } : f));
    setEditingFolderId(null);
  }

  async function deleteFolder(id: string) {
    const tabsInFolder = tabs.filter(t => t.folder_id === id);
    if (tabsInFolder.length > 0) {
      await supabase.from('portal_tabs').update({ folder_id: null }).eq('folder_id', id);
      setTabs(ts => ts.map(t => t.folder_id === id ? { ...t, folder_id: null } : t));
    }
    await supabase.from('portal_folders').delete().eq('id', id);
    setFolders(fs => fs.filter(f => f.id !== id));
    setDeletingFolderId(null);
  }

  function toggleFolder(id: string) {
    setOpenFolders(prev => ({ ...prev, [id]: !prev[id] }));
  }

  // ── File ops ───────────────────────────────────────────────────────────────

  async function deleteFile(file: TabFile) {
    const pathMatch = file.file_url.match(/\/object\/public\/tab-files\/(.+)$/);
    if (pathMatch?.[1]) {
      await fetch(`${SUPABASE_URL}/storage/v1/object/tab-files/${pathMatch[1]}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY },
      });
    }
    await supabase.from('portal_tab_files').delete().eq('id', file.id);
    setFiles(fs => fs.filter(f => f.id !== file.id));
  }

  // ── Sidebar drag ───────────────────────────────────────────────────────────

  function onTabDragStart(tabId: string) { setDragTabId(tabId); }

  function onTabDragOverTab(e: React.DragEvent, tabId: string) {
    e.preventDefault();
    setDragOverTabId(tabId);
    setDragOverFolderId(null);
  }

  function onTabDragOverFolder(e: React.DragEvent, folderId: string) {
    e.preventDefault();
    setDragOverFolderId(folderId);
    setDragOverTabId(null);
  }

  function onTabDropOnFolder(folderId: string) {
    if (dragTabId) moveTabToFolder(dragTabId, folderId);
    clearTabDrag();
  }

  function onTabDropOnTab(targetTabId: string) {
    if (dragTabId && dragTabId !== targetTabId) {
      const target = tabs.find(t => t.id === targetTabId);
      if (target) moveTabToFolder(dragTabId, target.folder_id ?? null);
    }
    clearTabDrag();
  }

  function clearTabDrag() {
    setDragTabId(null);
    setDragOverTabId(null);
    setDragOverFolderId(null);
  }

  const activeTab = tabs.find(t => t.id === activeTabId) ?? null;
  const activeFolder = activeTab?.folder_id ? folders.find(f => f.id === activeTab.folder_id) : null;
  const sidebarItems = buildSidebar();

  return (
    <div className="h-screen flex" style={{ background: '#ECEAE4', fontFamily: "'Inter', sans-serif" }}>

      {/* ── Sidebar ── */}
      <aside className="w-56 flex-shrink-0 flex flex-col py-4 z-10"
        style={{ background: '#F5F3EE', borderRight: '1px solid #DDDBD5' }}>

        <div className="flex items-center gap-2.5 px-4 mb-5 flex-shrink-0">
          <span className="font-display italic text-xl tracking-wide" style={{ color: '#2C2A27' }}>MeiPortal</span>
        </div>

        <div className="mx-4 mb-2" style={{ height: '1px', background: '#DDDBD5' }} />

        <div className="flex-1 overflow-y-auto px-2 py-1">
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: '#DDDBD5', borderTopColor: '#9A9690' }} />
            </div>
          ) : (
            <>
              {sidebarItems.map(item => {
                if (item.kind === 'tab') {
                  const tab = item.tab;
                  return editingTabId === tab.id ? (
                    <TabLabelEditor key={tab.id} tab={tab}
                      onSave={(l, ic) => updateTab(tab.id, l, ic)}
                      onCancel={() => setEditingTabId(null)} />
                  ) : (
                    <SidebarTabRow
                      key={tab.id} tab={tab} activeTabId={activeTabId} authed={authed} indent={false}
                      isDragging={dragTabId === tab.id} isDragOver={dragOverTabId === tab.id && dragTabId !== tab.id}
                      onSelect={() => setActiveTabId(tab.id)}
                      onEdit={() => { setEditingTabId(tab.id); setAddingWhat(null); }}
                      onDelete={() => setDeletingTabId(tab.id)}
                      onDragStart={() => onTabDragStart(tab.id)}
                      onDragOver={e => onTabDragOverTab(e, tab.id)}
                      onDrop={() => onTabDropOnTab(tab.id)}
                      onDragEnd={clearTabDrag}
                    />
                  );
                }

                const { folder, tabs: folderTabs } = item;
                const isOpen = openFolders[folder.id] ?? true;
                const isFolderDragOver = dragOverFolderId === folder.id;

                return (
                  <div key={folder.id}
                    onDragOver={e => onTabDragOverFolder(e, folder.id)}
                    onDrop={() => onTabDropOnFolder(folder.id)}
                    onDragLeave={() => setDragOverFolderId(null)}>

                    {editingFolderId === folder.id ? (
                      <FolderLabelEditor initialLabel={folder.label}
                        onSave={label => updateFolder(folder.id, label)}
                        onCancel={() => setEditingFolderId(null)} />
                    ) : (
                      <div
                        className="group relative flex items-center rounded-xl mb-0.5 cursor-pointer"
                        style={{
                          border: isFolderDragOver ? '1px dashed #9A9690' : '1px solid transparent',
                          background: isFolderDragOver ? '#ECEAE4' : 'transparent',
                          transition: 'background 0.1s',
                        }}
                        onClick={() => toggleFolder(folder.id)}
                        onMouseEnter={e => { if (!isFolderDragOver) (e.currentTarget as HTMLElement).style.background = '#ECEAE4'; }}
                        onMouseLeave={e => { if (!isFolderDragOver) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                        <div className="flex-1 flex items-center gap-2 px-3 py-2.5 min-w-0">
                          <div className="flex-shrink-0" style={{ color: '#9A9690' }}>
                            {isOpen ? <FolderOpen className="w-3.5 h-3.5" strokeWidth={1.5} /> : <Folder className="w-3.5 h-3.5" strokeWidth={1.5} />}
                          </div>
                          <span className="text-xs font-semibold truncate flex-1" style={{ color: '#6B6865' }}>{folder.label}</span>
                          <div className="flex-shrink-0" style={{ color: '#C0BDB7' }}>
                            {isOpen ? <ChevronDownIcon className="w-3 h-3" strokeWidth={2} /> : <ChevronRight className="w-3 h-3" strokeWidth={2} />}
                          </div>
                        </div>
                        {authed && (
                          <div className="flex items-center gap-0.5 pr-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                            onClick={e => e.stopPropagation()}>
                            <button onClick={() => setEditingFolderId(folder.id)}
                              className="w-5 h-5 flex items-center justify-center rounded hover:bg-black/10 transition-colors"
                              style={{ color: '#9A9690' }}>
                              <Pencil className="w-3 h-3" strokeWidth={1.5} />
                            </button>
                            <button onClick={() => setDeletingFolderId(folder.id)}
                              className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-50 transition-colors"
                              style={{ color: '#C08080' }}>
                              <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {isOpen && (
                      <div className="pl-2 mb-0.5">
                        {folderTabs.map(tab => (
                          editingTabId === tab.id ? (
                            <TabLabelEditor key={tab.id} tab={tab}
                              onSave={(l, ic) => updateTab(tab.id, l, ic)}
                              onCancel={() => setEditingTabId(null)} />
                          ) : (
                            <SidebarTabRow
                              key={tab.id} tab={tab} activeTabId={activeTabId} authed={authed} indent
                              isDragging={dragTabId === tab.id} isDragOver={dragOverTabId === tab.id && dragTabId !== tab.id}
                              onSelect={() => setActiveTabId(tab.id)}
                              onEdit={() => { setEditingTabId(tab.id); setAddingWhat(null); }}
                              onDelete={() => setDeletingTabId(tab.id)}
                              onDragStart={() => onTabDragStart(tab.id)}
                              onDragOver={e => onTabDragOverTab(e, tab.id)}
                              onDrop={() => onTabDropOnTab(tab.id)}
                              onDragEnd={clearTabDrag}
                            />
                          )
                        ))}
                        {folderTabs.length === 0 && (
                          <p className="text-xs px-3 py-1.5 italic" style={{ color: '#C0BDB7' }}>Drag tabs here</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {authed && (
                <div className="relative mt-1">
                  {addingWhat === 'tab' ? (
                    <TabLabelEditor tab={{ id: '', label: '', icon: 'FileText', sort_order: 0, folder_id: null }}
                      onSave={createTab} onCancel={() => setAddingWhat(null)} />
                  ) : addingWhat === 'folder' ? (
                    <FolderLabelEditor initialLabel="" onSave={createFolder} onCancel={() => setAddingWhat(null)} />
                  ) : (
                    <>
                      {showAddMenu && (
                        <AddMenu
                          onSelect={t => { setAddingWhat(t); setShowAddMenu(false); }}
                          onClose={() => setShowAddMenu(false)}
                        />
                      )}
                      <button onClick={() => setShowAddMenu(s => !s)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors"
                        style={{ color: '#B0ADA7', border: '1px dashed #DDDBD5' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#ECEAE4'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                        <Plus className="w-3.5 h-3.5" strokeWidth={2} /> Add
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="mx-4 mt-2 mb-2" style={{ height: '1px', background: '#DDDBD5' }} />

        <div className="px-2 space-y-0.5 flex-shrink-0">
          {onOpenOrgChart && (
            <button onClick={onOpenOrgChart}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all text-left"
              style={{ color: '#9A9690' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#E4E2DC')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <Network className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
              Org Chart
            </button>
          )}
          {onOpenAdmin && (
            <button onClick={onOpenAdmin}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all text-left"
              style={{ color: '#9A9690' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#E4E2DC')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <Shield className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
              Admin
            </button>
          )}
          {authed ? (
            <button onClick={onSignOut}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all text-left"
              style={{ color: '#9A9690' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#E4E2DC')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <LogOut className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
              Sign Out
            </button>
          ) : null}
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">

        <header className="flex items-center justify-between px-6 py-3 flex-shrink-0"
          style={{ background: '#2C2A27', borderBottom: '1px solid #1a1917' }}>
          <div className="flex items-center gap-2 min-w-0">
            {iframeUrl ? (
              <>
                <button
                  onClick={() => { setIframeUrl(null); setIframeLabel(''); }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-opacity hover:opacity-70 flex-shrink-0 mr-2"
                  style={{ background: '#3D3A36', color: '#C0BDB7' }}>
                  <X className="w-3 h-3" strokeWidth={2} />
                  Back
                </button>
                <Globe className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#6B6865' }} strokeWidth={1.5} />
                <span className="font-semibold text-sm truncate" style={{ color: '#F5F3EE' }}>{iframeLabel}</span>
                <a href={iframeUrl} target="_blank" rel="noopener noreferrer"
                  className="flex-shrink-0 ml-1 hover:opacity-70 transition-opacity"
                  style={{ color: '#6B6865' }} title="Open in new tab">
                  <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
                </a>
              </>
            ) : (
              <>
                {activeFolder && (
                  <>
                    <Folder className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#6B6865' }} strokeWidth={1.5} />
                    <span className="text-sm flex-shrink-0" style={{ color: '#6B6865' }}>{activeFolder.label}</span>
                    <span style={{ color: '#4A4844' }} className="flex-shrink-0">/</span>
                  </>
                )}
                {activeTab && (
                  <>
                    <TabIcon name={activeTab.icon} className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
                    <span className="font-semibold text-sm truncate" style={{ color: '#F5F3EE' }}>{activeTab.label}</span>
                  </>
                )}
              </>
            )}
          </div>
          {authed && !iframeUrl && (
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                style={{ background: '#3D3A36', color: '#C0BDB7' }}>
                <Pencil className="w-3 h-3" strokeWidth={1.5} />
                Edit Mode
              </div>
              {member && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium" style={{ color: '#9A9690' }}>{member.full_name}</span>
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt={member.full_name}
                      className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                      style={{ border: '1.5px solid #4A4844' }} />
                  ) : (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold"
                      style={{ background: '#3D3A36', border: '1.5px solid #4A4844', color: '#C0BDB7' }}>
                      {member.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </header>

        {iframeUrl ? (
          <div className="flex-1 relative" style={{ background: '#000' }}>
            <iframe
              src={iframeUrl}
              title={iframeLabel}
              className="absolute inset-0 w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
            />
          </div>
        ) : (
          <div className="flex-1 overflow-auto px-8 py-8" style={{ background: '#1C1B19' }}>

            {tabs.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: '#2C2A27', border: '1px solid #3D3A36' }}>
                  <FileText className="w-7 h-7" style={{ color: '#4A4844' }} strokeWidth={1.5} />
                </div>
                <p className="font-semibold text-base" style={{ color: '#4A4844' }}>No pages yet</p>
                {authed && <p className="text-sm" style={{ color: '#3D3A36' }}>Add a tab in the sidebar to get started.</p>}
              </div>
            )}

            {activeTabId && (
              <div className="max-w-2xl mx-auto">
                {contentLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: '#3D3A36', borderTopColor: '#9A9690' }} />
                  </div>
                ) : (
                  <>
                    {/* Files section */}
                    {(files.length > 0 || authed) && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Paperclip className="w-3.5 h-3.5" style={{ color: '#6B6865' }} strokeWidth={1.5} />
                          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#6B6865' }}>
                            Files {files.length > 0 && `· ${files.length}`}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {files.map(f => (
                            <FileCard key={f.id} file={f} authed={authed} onDelete={() => deleteFile(f)}
                              onOpen={f.file_type === 'text/uri-list' ? () => { setIframeUrl(f.file_url); setIframeLabel(f.file_name); } : undefined} />
                          ))}
                          {authed && (
                            <FileUploadZone tabId={activeTabId} onUploaded={f => setFiles(prev => [...prev, f])} />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Empty state (not authed, no files) */}
                    {files.length === 0 && !authed && (
                      <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                          style={{ background: '#2C2A27', border: '1px solid #3D3A36' }}>
                          <FileText className="w-5 h-5" style={{ color: '#4A4844' }} strokeWidth={1.5} />
                        </div>
                        <p className="text-sm font-medium" style={{ color: '#4A4844' }}>Nothing here yet</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {deletingTabId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(28,27,25,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-xs rounded-2xl p-6 shadow-2xl"
            style={{ background: '#F5F3EE', border: '1px solid #DDDBD5' }}>
            <h3 className="font-semibold text-base mb-2" style={{ color: '#2C2A27' }}>Delete Tab</h3>
            <p className="text-sm mb-5" style={{ color: '#9A9690' }}>
              Delete <span className="font-medium" style={{ color: '#2C2A27' }}>{tabs.find(t => t.id === deletingTabId)?.label}</span> and all its files? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingTabId(null)} className="flex-1 rounded-xl py-2.5 text-sm font-medium"
                style={{ background: '#E4E2DC', color: '#6B6865' }}>Cancel</button>
              <button onClick={() => deleteTab(deletingTabId)} className="flex-1 rounded-xl py-2.5 text-sm font-medium"
                style={{ background: '#C05454', color: 'white' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {deletingFolderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(28,27,25,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-xs rounded-2xl p-6 shadow-2xl"
            style={{ background: '#F5F3EE', border: '1px solid #DDDBD5' }}>
            <h3 className="font-semibold text-base mb-2" style={{ color: '#2C2A27' }}>Delete Folder</h3>
            <p className="text-sm mb-5" style={{ color: '#9A9690' }}>
              Delete <span className="font-medium" style={{ color: '#2C2A27' }}>{folders.find(f => f.id === deletingFolderId)?.label}</span>? Tabs inside will be moved out of the folder.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingFolderId(null)} className="flex-1 rounded-xl py-2.5 text-sm font-medium"
                style={{ background: '#E4E2DC', color: '#6B6865' }}>Cancel</button>
              <button onClick={() => deleteFolder(deletingFolderId)} className="flex-1 rounded-xl py-2.5 text-sm font-medium"
                style={{ background: '#C05454', color: 'white' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── DeptPortalView ─────────────────────────────────────────────────────────
// Shown for department users who have dept-specific folders.
// Left: collapsible sidebar with Company Docs + dept folders + file viewer.
// Right: MeiGuy chat panel.

interface DeptTabFile {
  id: string;
  tab_id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  file_type: string;
  sort_order: number;
}

function DeptPortalView({ member, onSignOut }: { member: LoggedInMember | null; onSignOut: () => void }) {
  const dept = member?.department ?? '';
  const canUseMeiGuy = true;
  const agentEndpoint = getAgentEndpoint(member);
  const suggestions = getSuggestions(member);
  const firstName = member?.full_name?.split(' ')[0] ?? '';
  const roleSubtitle = member?.position ? `${member.position}${dept ? ` · ${dept}` : ''}` : 'Meiborg Employee';

  const [deptFolders, setDeptFolders] = useState<PortalFolder[]>([]);
  const [tabs, setTabs] = useState<PortalTab[]>([]);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [files, setFiles] = useState<DeptTabFile[]>([]);
  const [loadingTabs, setLoadingTabs] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [iframeLabel, setIframeLabel] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [focused, setFocused] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasConversation = messages.length > 0;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loadingMsg]);

  useEffect(() => { loadPortalData(); }, [dept]);

  async function loadPortalData() {
    setLoadingTabs(true);
    const [{ data: foldersData }, { data: tabsData }] = await Promise.all([
      supabase.from('portal_folders').select('*').order('sort_order'),
      supabase.from('portal_tabs').select('*').order('sort_order'),
    ]);

    // Only show folders tagged to this user's department
    const depFolders = ((foldersData ?? []) as PortalFolder[]).filter(f => f.department_access === dept);
    const depFolderIds = new Set(depFolders.map(f => f.id));
    const depTabs = ((tabsData ?? []) as PortalTab[]).filter(t => t.folder_id && depFolderIds.has(t.folder_id));

    setDeptFolders(depFolders);
    setTabs(depTabs);

    const open: Record<string, boolean> = {};
    depFolders.forEach(f => { open[f.id] = true; });
    setOpenFolders(open);

    if (depTabs.length > 0) setActiveTabId(depTabs[0].id);
    setLoadingTabs(false);
  }

  useEffect(() => { if (activeTabId) loadFiles(activeTabId); }, [activeTabId]);

  async function loadFiles(tabId: string) {
    setLoadingFiles(true);
    setIframeUrl(null);
    const { data } = await supabase.from('portal_tab_files').select('*').eq('tab_id', tabId).order('sort_order');
    setFiles((data ?? []) as DeptTabFile[]);
    setLoadingFiles(false);
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loadingMsg) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: text.trim() }];
    setMessages(next);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setLoadingMsg(true);
    try {
      const activeTab = tabs.find(t => t.id === activeTabId);
      const activeFolder = activeTab?.folder_id ? deptFolders.find(f => f.id === activeTab.folder_id) : null;
      const formContext = activeFolder ? `${activeFolder.label} > ${activeTab?.label ?? ''}` : activeTab?.label;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/${agentEndpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
          formContext,
          memberContext: { full_name: member?.full_name, position: member?.position, department: member?.department },
          accountingAccess: (member?.department ?? '').toLowerCase() === 'accounting',
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setLoadingMsg(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }

  const activeTab = tabs.find(t => t.id === activeTabId) ?? null;
  const activeFolder = activeTab?.folder_id ? deptFolders.find(f => f.id === activeTab.folder_id) ?? null : null;
  const isARTab = activeTab?.label?.toLowerCase().includes('accounts receivable') ?? false;
  const isAPTab = activeTab?.label?.toLowerCase().includes('accounts payable') ?? false;
  const isDebtTab = activeTab?.label?.toLowerCase() === 'debts';
  const isCalendarTab = activeTab?.label?.toLowerCase().includes('payment calendar') ?? false;
  const isCollectionsTab = activeTab?.label?.toLowerCase() === 'collections';
  const isUnbilledOrdersTab = activeTab?.label?.toLowerCase() === 'unbilled orders';
  // Any dept folder tab → full screen mode
  const isDeptTab = activeTabId != null && activeFolder != null;

  // Avatar: member photo or initials fallback
  const avatarUrl = member?.avatar_url;
  const initials = (member?.full_name ?? '').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: '#0F0E0C' }}>

      {/* ── Left sidebar ── hidden in dept-tab full-screen mode ── */}
      <aside
        className="flex-shrink-0 flex flex-col transition-all duration-300 overflow-hidden"
        style={{
          width: (sidebarOpen && !isDeptTab) ? '220px' : '0px',
          background: '#F5F3EE',
          borderRight: '1px solid #DDDBD5',
        }}>
        <div className="flex items-center justify-between px-4 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #DDDBD5' }}>
          <span className="font-semibold text-sm tracking-tight" style={{ color: '#2C2A27' }}>{dept}</span>
          <button onClick={() => setSidebarOpen(false)} className="w-5 h-5 flex items-center justify-center rounded"
            style={{ color: '#9A9690' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#2C2A27')}
            onMouseLeave={e => (e.currentTarget.style.color = '#9A9690')}>
            <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2" style={{ scrollbarWidth: 'thin' }}>
          {loadingTabs ? (
            <div className="flex justify-center py-6">
              <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: '#DDDBD5', borderTopColor: '#9A9690' }} />
            </div>
          ) : deptFolders.map(folder => {
            const isOpen = openFolders[folder.id] ?? true;
            const folderTabs = tabs.filter(t => t.folder_id === folder.id);
            return (
              <div key={folder.id} className="mb-0.5">
                <button
                  onClick={() => setOpenFolders(prev => ({ ...prev, [folder.id]: !prev[folder.id] }))}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all"
                  style={{ background: 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#ECEAE4')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div className="flex-shrink-0" style={{ color: '#C8A96E' }}>
                    {isOpen ? <FolderOpen className="w-3.5 h-3.5" strokeWidth={1.5} /> : <Folder className="w-3.5 h-3.5" strokeWidth={1.5} />}
                  </div>
                  <span className="text-xs font-semibold truncate flex-1 text-left" style={{ color: '#2C2A27' }}>
                    {folder.label}
                  </span>
                  <div className="flex-shrink-0" style={{ color: '#C0BDB7' }}>
                    {isOpen ? <ChevronDownIcon className="w-3 h-3" strokeWidth={2} /> : <ChevronRight className="w-3 h-3" strokeWidth={2} />}
                  </div>
                </button>
                {isOpen && (
                  <div className="pl-3 mb-1">
                    {folderTabs.map(tab => {
                      const isActive = tab.id === activeTabId;
                      return (
                        <button key={tab.id} onClick={() => setActiveTabId(tab.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl mb-0.5 text-left transition-all"
                          style={{ background: isActive ? '#2C2A27' : 'transparent', color: isActive ? '#F5F3EE' : '#6B6865' }}
                          onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = '#ECEAE4'; }}
                          onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                          <TabIcon name={tab.icon} className="w-3 h-3 flex-shrink-0" />
                          <span className="text-xs truncate">{tab.label}</span>
                        </button>
                      );
                    })}
                    {folderTabs.length === 0 && (
                      <p className="text-xs px-3 py-1.5 italic" style={{ color: '#C0BDB7' }}>No tabs yet</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* ── Right: content area ── */}
      <div className="flex-1 flex flex-col overflow-hidden relative">

        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid #222120', background: '#141412' }}>
          <div className="flex items-center gap-3">
            {/* Sidebar toggle: show when sidebar is closed OR when in dept-tab mode */}
            {(!sidebarOpen || isDeptTab) && (
              <button
                onClick={() => {
                  if (isDeptTab) {
                    // Go back: deselect active tab so sidebar shows
                    setActiveTabId(tabs.filter(t => !activeFolder || t.folder_id !== activeFolder?.id)[0]?.id ?? null);
                  } else {
                    setSidebarOpen(true);
                  }
                }}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                style={{ color: '#6B6865' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#F5F3EE')}
                onMouseLeave={e => (e.currentTarget.style.color = '#6B6865')}>
                <Folder className="w-4 h-4" strokeWidth={1.5} />
              </button>
            )}
            {/* Breadcrumb */}
            {activeTab && (
              <div className="flex items-center gap-2">
                {activeFolder && (
                  <>
                    <button
                      className="flex items-center gap-1.5 transition-all"
                      onClick={() => setActiveTabId(null)}
                      style={{ color: '#C8A96E' }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                      <Folder className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                      <span className="text-sm flex-shrink-0">{activeFolder.label}</span>
                    </button>
                    <span style={{ color: '#4A4844' }} className="flex-shrink-0">/</span>
                  </>
                )}
                <TabIcon name={activeTab.icon} className="w-4 h-4 flex-shrink-0" style={{ color: '#9A9690' } as React.CSSProperties} />
                <span className="font-semibold text-sm truncate" style={{ color: '#F5F3EE' }}>{activeTab.label}</span>
              </div>
            )}
            {!activeTab && (
              <span className="font-semibold text-sm" style={{ color: '#F5F3EE' }}>{dept}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: '#4A4844' }}>{member?.full_name}</span>
            <button onClick={onSignOut}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
              style={{ color: '#6B6865' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1E1D1B')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
              Sign out
            </button>
          </div>
        </div>

        {/* ── DEPT TAB: full-screen content + floating MeiGuy ── */}
        {isDeptTab ? (
          <>
            {/* Full-screen tab content */}
            <div className="flex-1 overflow-hidden" style={{ background: '#0F0E0C' }}>
              {isARTab && activeTabId ? (
                <ARReport tabId={activeTabId} uploaderName={member?.full_name ?? ''} />
              ) : isAPTab && activeTabId ? (
                <APReport tabId={activeTabId} uploaderName={member?.full_name ?? ''} />
              ) : isDebtTab && activeTabId ? (
                <DebtReport tabId={activeTabId} uploaderName={member?.full_name ?? ''} />
              ) : isCalendarTab && activeTabId ? (
                <DebtCalendar tabId={activeTabId} />
              ) : isCollectionsTab && activeTabId ? (
                <CollectionsReport tabId={activeTabId} uploaderName={member?.full_name ?? ''} />
              ) : isUnbilledOrdersTab && activeTabId ? (
                <UnbilledOrdersReport tabId={activeTabId} uploaderName={member?.full_name ?? ''} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: '#1A1917', border: '1px solid #262422' }}>
                    <TabIcon name={activeTab?.icon ?? 'FileText'} className="w-6 h-6" style={{ color: '#C8A96E' } as React.CSSProperties} />
                  </div>
                  <p className="text-sm font-medium" style={{ color: '#F5F3EE' }}>{activeTab?.label}</p>
                  <p className="text-xs" style={{ color: '#4A4844' }}>Coming soon</p>
                </div>
              )}
            </div>

            {/* Floating MeiGuy button */}
            {canUseMeiGuy && (
            <button
              onClick={() => setChatOpen(o => !o)}
              className="absolute bottom-6 right-6 w-12 h-12 rounded-2xl overflow-hidden shadow-2xl transition-transform z-40"
              style={{ border: '2px solid #2C2A27', transform: chatOpen ? 'scale(0.92)' : 'scale(1)' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.06)')}
              onMouseLeave={e => (e.currentTarget.style.transform = chatOpen ? 'scale(0.92)' : 'scale(1)')}>
              <img src="/Mei-Guy_icon_(1).png" alt="MeiGuy" className="w-full h-full object-contain" style={{ background: '#1A1917' }} />
            </button>
            )}

            {/* Floating chat panel */}
            {canUseMeiGuy && chatOpen && (
              <div
                className="absolute bottom-24 right-6 w-96 flex flex-col rounded-2xl overflow-hidden shadow-2xl z-40"
                style={{ height: '480px', background: '#141412', border: '1px solid #2C2A27' }}>
                {/* Chat header */}
                <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid #1E1D1B' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid #2C2A27' }}>
                      <img src="/Mei-Guy_icon_(1).png" alt="MeiGuy" className="w-full h-full object-contain" />
                    </div>
                    <span className="text-sm font-semibold" style={{ color: '#F5F3EE' }}>MeiGuy</span>
                    <span className="text-xs" style={{ color: '#4A4844' }}>· {activeTab?.label}</span>
                  </div>
                  <button onClick={() => setChatOpen(false)} style={{ color: '#6B6865' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#F5F3EE')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#6B6865')}>
                    <X className="w-4 h-4" strokeWidth={2} />
                  </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
                  style={{ scrollbarWidth: 'thin', scrollbarColor: '#2C2A27 transparent' }}>
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 pb-4">
                      <p className="text-xs text-center" style={{ color: '#4A4844' }}>Ask MeiGuy about {activeTab?.label}</p>
                      <div className="w-full space-y-1.5">
                        {suggestions.slice(0, 3).map(s => (
                          <button key={s.label} onClick={() => sendMessage(s.label)}
                            className="w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all"
                            style={{ background: '#1A1917', border: '1px solid #262422', color: '#9A9690' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#3D3A36'; (e.currentTarget as HTMLElement).style.color = '#F5F3EE'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#262422'; (e.currentTarget as HTMLElement).style.color = '#9A9690'; }}>
                            <span className="mr-1.5">{s.icon}</span>{s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {messages.map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          {m.role === 'assistant' && (
                            <div className="w-5 h-5 rounded-md overflow-hidden flex-shrink-0 mr-2 mt-0.5" style={{ border: '1px solid #2C2A27' }}>
                              <img src="/Mei-Guy_icon_(1).png" alt="MeiGuy" className="w-full h-full object-contain" />
                            </div>
                          )}
                          <div className="max-w-[80%] px-3 py-2 rounded-xl text-xs leading-relaxed"
                            style={m.role === 'user'
                              ? { background: '#2C2A27', color: '#F5F3EE' }
                              : { background: '#1A1917', color: '#C0BDB7', border: '1px solid #262422' }}>
                            {m.role === 'assistant' ? renderChatText(m.content) : m.content}
                          </div>
                        </div>
                      ))}
                      {loadingMsg && (
                        <div className="flex justify-start">
                          <div className="w-5 h-5 rounded-md overflow-hidden flex-shrink-0 mr-2 mt-0.5" style={{ border: '1px solid #2C2A27' }}>
                            <img src="/Mei-Guy_icon_(1).png" alt="MeiGuy" className="w-full h-full object-contain" />
                          </div>
                          <div className="px-3 py-2 rounded-xl" style={{ background: '#1A1917', border: '1px solid #262422' }}>
                            <TypingDotsFull />
                          </div>
                        </div>
                      )}
                      <div ref={bottomRef} />
                    </>
                  )}
                </div>

                {/* Input */}
                <div className="flex-shrink-0 p-3" style={{ borderTop: '1px solid #1E1D1B' }}>
                  <div className="rounded-xl overflow-hidden transition-all"
                    style={{ background: '#1A1917', border: `1px solid ${focused ? '#3D3A36' : '#262422'}` }}>
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`; }}
                      onKeyDown={handleKey}
                      onFocus={() => setFocused(true)}
                      onBlur={() => setFocused(false)}
                      placeholder="Ask MeiGuy anything..."
                      rows={1}
                      className="w-full bg-transparent px-3 pt-2.5 pb-1 text-xs resize-none outline-none"
                      style={{ color: '#F5F3EE', maxHeight: '100px', scrollbarWidth: 'none' }}
                    />
                    <div className="flex items-center justify-end px-3 pb-2">
                      <button onClick={() => sendMessage(input)} disabled={!input.trim() || loadingMsg}
                        className="w-6 h-6 flex items-center justify-center rounded-lg transition-all disabled:opacity-30"
                        style={{ background: input.trim() && !loadingMsg ? '#C8A96E' : '#2C2A27' }}>
                        {loadingMsg
                          ? <Loader2 className="w-3 h-3 animate-spin" style={{ color: '#6B6865' }} strokeWidth={2} />
                          : <Send className="w-3 h-3" style={{ color: input.trim() ? '#1A1410' : '#6B6865' }} strokeWidth={2} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* ── DEFAULT: MeiGuy chat full-width ── */}
            {/* Chat area */}
            <div className="flex-1 overflow-y-auto px-6 py-6"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#2C2A27 transparent', background: '#0F0E0C' }}>

              {!hasConversation ? (
                <div className="flex flex-col items-center justify-center h-full pb-4 max-w-lg mx-auto" style={{ animation: 'fadeUp 0.4s ease both' }}>
                  {/* Member avatar */}
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={member?.full_name ?? ''} className="w-16 h-16 rounded-2xl object-cover mb-4" style={{ border: '2px solid #2C2A27' }} />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 text-base font-semibold" style={{ background: '#2C2A27', color: '#C8A96E', border: '2px solid #3D3A36' }}>
                      {initials}
                    </div>
                  )}
                  <h2 className="text-xl font-semibold mb-1 text-center" style={{ color: '#F5F3EE', fontFamily: "'Georgia', serif" }}>
                    Hi, {firstName}
                  </h2>
                  <p className="text-xs mb-1 text-center" style={{ color: '#6B6865' }}>{roleSubtitle}</p>
                  <p className="text-xs mb-8 text-center" style={{ color: '#4A4844' }}>How can I help you today?</p>
                  <div className="w-full grid grid-cols-2 gap-2">
                    {suggestions.map(s => (
                      <button key={s.label} onClick={() => sendMessage(s.label)}
                        className="text-left px-3 py-3 rounded-xl text-xs transition-all"
                        style={{ background: '#1A1917', border: '1px solid #262422', color: '#9A9690' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#3D3A36'; (e.currentTarget as HTMLElement).style.color = '#F5F3EE'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#262422'; (e.currentTarget as HTMLElement).style.color = '#9A9690'; }}>
                        <span className="mr-1.5">{s.icon}</span>{s.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4 max-w-2xl mx-auto">
                  {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {m.role === 'assistant' && (
                        <div className="w-6 h-6 rounded-lg overflow-hidden flex-shrink-0 mr-2 mt-0.5" style={{ border: '1px solid #2C2A27' }}>
                          <img src="/Mei-Guy_icon_(1).png" alt="MeiGuy" className="w-full h-full object-contain" />
                        </div>
                      )}
                      <div className="max-w-[80%] px-4 py-3 rounded-xl text-sm leading-relaxed"
                        style={m.role === 'user'
                          ? { background: '#2C2A27', color: '#F5F3EE' }
                          : { background: '#1A1917', color: '#C0BDB7', border: '1px solid #262422' }}>
                        {m.role === 'assistant' ? renderChatText(m.content) : m.content}
                      </div>
                    </div>
                  ))}
                  {loadingMsg && (
                    <div className="flex justify-start">
                      <div className="w-6 h-6 rounded-lg overflow-hidden flex-shrink-0 mr-2 mt-0.5" style={{ border: '1px solid #2C2A27' }}>
                        <img src="/Mei-Guy_icon_(1).png" alt="MeiGuy" className="w-full h-full object-contain" />
                      </div>
                      <div className="px-4 py-3 rounded-xl" style={{ background: '#1A1917', border: '1px solid #262422' }}>
                        <TypingDotsFull />
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <div className="flex-shrink-0 p-4" style={{ borderTop: '1px solid #1E1D1B', background: '#141412' }}>
              <div className="max-w-2xl mx-auto rounded-xl overflow-hidden transition-all"
                style={{ background: '#1A1917', border: `1px solid ${focused ? '#3D3A36' : '#262422'}` }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`; }}
                  onKeyDown={handleKey}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder="Ask MeiGuy anything..."
                  rows={1}
                  className="w-full bg-transparent px-4 pt-3 pb-1 text-sm resize-none outline-none"
                  style={{ color: '#F5F3EE', maxHeight: '120px', scrollbarWidth: 'none' }}
                />
                <div className="flex items-center justify-end px-3 pb-2.5">
                  <button onClick={() => sendMessage(input)} disabled={!input.trim() || loadingMsg}
                    className="w-7 h-7 flex items-center justify-center rounded-lg transition-all disabled:opacity-30"
                    style={{ background: input.trim() && !loadingMsg ? '#C8A96E' : '#2C2A27' }}>
                    {loadingMsg
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: '#6B6865' }} strokeWidth={2} />
                      : <Send className="w-3.5 h-3.5" style={{ color: input.trim() ? '#1A1410' : '#6B6865' }} strokeWidth={2} />}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function PortalPage({
  onOpenAdmin,
  onOpenOrgChart,
  onActiveTabChange,
  onAuthChange,
}: {
  onOpenAdmin?: () => void;
  onOpenOrgChart?: () => void;
  onActiveTabChange?: (label: string | undefined) => void;
  onAuthChange?: (authed: boolean, member: LoggedInMember | null) => void;
}) {
  const [authed, setAuthed] = useState(isAuthed);
  const [member, setMember] = useState<LoggedInMember | null>(getStoredMember);

  function handleSuccess() {
    const m = getStoredMember();
    setMember(m);
    setAuthed(true);
    onAuthChange?.(true, m);
  }

  function handleSignOut() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(MEMBER_KEY);
    setMember(null);
    setAuthed(false);
    onAuthChange?.(false, null);
  }

  if (!authed) {
    return <LockScreen onSuccess={handleSuccess} />;
  }

  const isDallas = member?.full_name?.split(' ')[0]?.toLowerCase() === 'dallas';
  const isExecUser = EXEC_NAMES.includes((member?.full_name ?? '').toLowerCase().trim());

  // Execs and Dallas get the full portal
  if (isDallas || isExecUser) {
    if (isDallas) {
      return (
        <PortalInner
          member={member}
          onOpenAdmin={onOpenAdmin}
          onOpenOrgChart={onOpenOrgChart}
          onActiveTabChange={onActiveTabChange}
          onSignOut={handleSignOut}
        />
      );
    }
    return <MeiGuyFullChat member={member} onSignOut={handleSignOut} />;
  }

  // Department users with dept-specific folders get the split portal view
  const deptWithPortal = ['Accounting'];
  if (member?.department && deptWithPortal.includes(member.department)) {
    return <DeptPortalView member={member} onSignOut={handleSignOut} />;
  }

  return <MeiGuyFullChat member={member} onSignOut={handleSignOut} />;
}
