import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { supabase } from '../lib/supabase';
import { Channel, Message, Profile, Department } from '../types';
import {
  MessageSquare, Bell, Hash, Send, KeyRound,
  UserCircle, Settings, X, AlertCircle, Check, Shield, Network,
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

function getChannelIcon(channel: Channel) {
  if (channel.channel_type === 'general') return MessageSquare;
  if (channel.channel_type === 'announcements') return Bell;
  return Hash;
}

function getDeptColor(channel: Channel): string {
  if (channel.department) return (channel.department as Department).color;
  return '#6b7280';
}

function timeLabel(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function dateDivider(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

const LS_UNLOCKED = 'tc_unlocked_v1';
const LS_NAME = 'tc_display_name';

function getUnlocked(): string[] {
  try { return JSON.parse(localStorage.getItem(LS_UNLOCKED) || '[]'); } catch { return []; }
}
function addUnlocked(id: string) {
  const arr = getUnlocked();
  if (!arr.includes(id)) { arr.push(id); localStorage.setItem(LS_UNLOCKED, JSON.stringify(arr)); }
}
function getDisplayName(): string { return localStorage.getItem(LS_NAME) || ''; }
function setDisplayName(n: string) { localStorage.setItem(LS_NAME, n); }

export default function ChatPage({ onOpenAdmin, onOpenOrgChart }: { onOpenAdmin?: () => void; onOpenOrgChart?: () => void }) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [unlocked, setUnlocked] = useState<string[]>(getUnlocked);
  const [displayName, setDisplayNameState] = useState(getDisplayName);

  // Code entry modal
  const [pendingChannel, setPendingChannel] = useState<Channel | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);

  // Name setup modal
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameInput, setNameInput] = useState('');

  // Edit name dropdown
  const [showNameMenu, setShowNameMenu] = useState(false);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadChannels(); }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!activeChannel) return;
    loadMessages(activeChannel.id);

    const sub = supabase
      .channel(`msgs:${activeChannel.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `channel_id=eq.${activeChannel.id}`,
      }, async (payload) => {
        const msg = payload.new as Message;
        if (msg.user_id && !profiles[msg.user_id]) {
          const { data } = await supabase.from('profiles').select('*').eq('id', msg.user_id).maybeSingle();
          if (data) setProfiles(p => ({ ...p, [data.id]: data as Profile }));
        }
        setMessages(prev => [...prev, msg]);
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [activeChannel?.id]);

  async function loadChannels() {
    const { data } = await supabase
      .from('channels')
      .select('*, department:departments(*)')
      .order('channel_type').order('name');
    if (data) setChannels(data as Channel[]);
  }

  async function loadMessages(channelId: string) {
    const { data } = await supabase
      .from('messages').select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true }).limit(150);
    if (data) {
      setMessages(data as Message[]);
      const ids = [...new Set((data as Message[]).map(m => m.user_id).filter(Boolean) as string[])];
      const missing = ids.filter(id => !profiles[id]);
      if (missing.length) {
        const { data: pData } = await supabase.from('profiles').select('*').in('id', missing);
        if (pData) {
          const map: Record<string, Profile> = {};
          pData.forEach(p => { map[p.id] = p as Profile; });
          setProfiles(prev => ({ ...prev, ...map }));
        }
      }
    }
  }

  function handleChannelClick(ch: Channel) {
    if (unlocked.includes(ch.id)) {
      setActiveChannel(ch);
    } else {
      setPendingChannel(ch);
      setCodeInput('');
      setCodeError('');
      setTimeout(() => codeInputRef.current?.focus(), 100);
    }
  }

  async function handleVerifyCode() {
    if (!pendingChannel || !codeInput.trim()) return;
    setCodeLoading(true);
    setCodeError('');
    const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-channel-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ channel_id: pendingChannel.id, code: codeInput.trim() }),
    });
    const { valid } = await res.json();
    setCodeLoading(false);
    if (valid) {
      addUnlocked(pendingChannel.id);
      const next = [...unlocked, pendingChannel.id];
      setUnlocked(next);
      setActiveChannel(pendingChannel);
      setPendingChannel(null);
      if (!displayName) {
        setShowNameModal(true);
        setNameInput('');
      }
    } else {
      setCodeError('Incorrect access code. Please try again.');
      codeInputRef.current?.focus();
    }
  }

  function confirmName() {
    const n = nameInput.trim();
    if (!n) return;
    setDisplayName(n);
    setDisplayNameState(n);
    setShowNameModal(false);
  }

  async function sendMessage() {
    if (!input.trim() || !activeChannel) return;
    if (!displayName) { setShowNameModal(true); setNameInput(''); return; }
    setSending(true);
    const content = input.trim();
    setInput('');
    await supabase.from('messages').insert({
      channel_id: activeChannel.id,
      content,
      sender_name: displayName,
    });
    setSending(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  // Group messages by date
  type DateGroup = { date: string; msgs: Message[] };
  const grouped: DateGroup[] = [];
  messages.forEach(msg => {
    const d = dateDivider(msg.created_at);
    const last = grouped[grouped.length - 1];
    if (last?.date === d) last.msgs.push(msg);
    else grouped.push({ date: d, msgs: [msg] });
  });

  function isContinuation(msgs: Message[], i: number) {
    if (i === 0) return false;
    const prev = msgs[i - 1], curr = msgs[i];
    const name1 = prev.user_id ? (profiles[prev.user_id]?.full_name ?? prev.sender_name) : prev.sender_name;
    const name2 = curr.user_id ? (profiles[curr.user_id]?.full_name ?? curr.sender_name) : curr.sender_name;
    const dt = new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime();
    return name1 === name2 && dt < 5 * 60 * 1000;
  }

  function getSenderName(msg: Message): string {
    if (msg.user_id && profiles[msg.user_id]) return profiles[msg.user_id].full_name;
    return (msg as any).sender_name || 'Unknown';
  }

  function getSenderAvatar(msg: Message): string | null {
    if (msg.user_id && profiles[msg.user_id]) return profiles[msg.user_id].avatar_url ?? null;
    return (msg as any).sender_avatar ?? null;
  }

  const generalChannels = channels.filter(c => c.channel_type === 'general' || c.channel_type === 'announcements');
  const deptChannels = channels.filter(c => c.channel_type === 'department');

  return (
    <div className="h-screen flex" style={{ background: '#ECEAE4', fontFamily: "'Inter', sans-serif" }}>

      {/* ── Sidebar with department names ── */}
      <aside
        className="w-56 flex-shrink-0 flex flex-col py-4 z-10 relative"
        style={{ background: '#F5F3EE', borderRight: '1px solid #DDDBD5' }}
      >
        {/* Logo + App Name */}
        <div className="flex items-center gap-2.5 px-4 mb-5 flex-shrink-0">
          <span className="font-display italic text-xl tracking-wide" style={{ color: '#2C2A27' }}>MeiPortal</span>
        </div>

        <div className="mx-4 mb-3" style={{ height: '1px', background: '#DDDBD5' }} />

        {/* General Channels */}
        <nav className="flex flex-col gap-0.5 px-2 flex-shrink-0">
          {generalChannels.map(ch => {
            const Icon = getChannelIcon(ch);
            const isActive = activeChannel?.id === ch.id;
            const isUnlocked = unlocked.includes(ch.id);
            return (
              <button
                key={ch.id}
                onClick={() => handleChannelClick(ch)}
                className="relative flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm transition-all duration-150 text-left"
                style={{
                  background: isActive ? '#2C2A27' : 'transparent',
                  color: isActive ? '#F5F3EE' : '#6B6865',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = '#E4E2DC'; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                {isActive && (
                  <span className="absolute top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                    style={{ background: '#8B9D28', left: 0 }} />
                )}
                <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
                <span className="flex-1 font-medium">{ch.name}</span>
                {!isUnlocked && (
                  <KeyRound className="w-3 h-3 flex-shrink-0" style={{ color: isActive ? '#F5F3EE88' : '#C0B89A' }} strokeWidth={1.5} />
                )}
              </button>
            );
          })}
        </nav>

        <div className="mx-4 my-3" style={{ height: '1px', background: '#DDDBD5' }} />

        {/* Label */}
        <p className="px-5 mb-1.5 text-xs font-semibold uppercase tracking-widest flex-shrink-0" style={{ color: '#B0ADA7' }}>
          Departments
        </p>

        {/* Department Channels */}
        <nav className="flex flex-col gap-0.5 px-2 overflow-y-auto no-scrollbar flex-1">
          {deptChannels.map(ch => {
            const isActive = activeChannel?.id === ch.id;
            const isUnlocked = unlocked.includes(ch.id);
            const color = getDeptColor(ch);
            return (
              <button
                key={ch.id}
                onClick={() => handleChannelClick(ch)}
                className="relative flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm transition-all duration-150 text-left"
                style={{
                  background: isActive ? color + '18' : 'transparent',
                  color: isActive ? color : '#6B6865',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = '#E4E2DC'; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                {isActive && (
                  <span className="absolute top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                    style={{ background: color, left: 0 }} />
                )}
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: isActive ? color : '#C8C5BF' }} />
                <span className="flex-1 font-medium">{ch.name}</span>
                {!isUnlocked && (
                  <KeyRound className="w-3 h-3 flex-shrink-0" style={{ color: isActive ? color + '88' : '#C0B89A' }} strokeWidth={1.5} />
                )}
              </button>
            );
          })}
        </nav>

        <div className="mx-4 mt-3 mb-3" style={{ height: '1px', background: '#DDDBD5' }} />

        {/* Admin + name section */}
        <div className="px-2 space-y-0.5 flex-shrink-0">
          {onOpenAdmin && (
            <button
              onClick={onOpenAdmin}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all text-left"
              style={{ color: '#9A9690' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#E4E2DC')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Shield className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
              Admin
            </button>
          )}

          {/* Display name button */}
          <button
            onClick={() => setShowNameMenu(m => !m)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors text-left"
            style={{ color: '#6B6865' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#E4E2DC')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold overflow-hidden flex-shrink-0"
              style={{ background: displayName ? '#8B9D28' : '#C0B89A', color: 'white' }}>
              {displayName ? displayName[0].toUpperCase() : '?'}
            </div>
            <span className="flex-1 truncate font-medium">{displayName || 'Set your name'}</span>
          </button>
        </div>

        {/* Name menu */}
        {showNameMenu && (
          <div
            className="absolute bottom-14 right-3 z-50 shadow-xl rounded-xl overflow-hidden border w-52"
            style={{ background: '#F5F3EE', borderColor: '#DDDBD5' }}
          >
            <div className="px-4 py-3 border-b" style={{ borderColor: '#DDDBD5' }}>
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: '#9A9690' }}>Your Name</p>
              <p className="text-sm font-medium mt-0.5 truncate" style={{ color: '#2C2A27' }}>
                {displayName || 'Not set'}
              </p>
            </div>
            <button
              onClick={() => { setShowNameMenu(false); setShowNameModal(true); setNameInput(displayName); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-left hover:bg-[#E4E2DC]"
              style={{ color: '#2C2A27' }}
            >
              <UserCircle className="w-4 h-4" strokeWidth={1.5} />
              Change display name
            </button>
            <button
              onClick={() => setShowNameMenu(false)}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-left hover:bg-[#E4E2DC]"
              style={{ color: '#9A9690' }}
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
              Close
            </button>
          </div>
        )}
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="flex items-center justify-between px-8 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #DDDBD5', background: '#ECEAE4' }}>
          <div>
            {onOpenOrgChart && (
              <button
                onClick={onOpenOrgChart}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                style={{ background: '#2C2A27', color: '#F5F3EE' }}
                title="Org Chart"
              >
                <Network className="w-4 h-4" strokeWidth={1.5} />
                <span>Org Chart</span>
              </button>
            )}
          </div>
          <h1 className="font-display italic text-2xl tracking-wide" style={{ color: '#2C2A27', fontSize: '1.75rem' }}>
            MeiPortal
          </h1>
          <div className="flex items-center gap-2">
            {activeChannel && (
              <div className="flex items-center gap-2 text-sm" style={{ color: '#9A9690' }}>
                {(() => { const Icon = getChannelIcon(activeChannel); return <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />; })()}
                <span>{activeChannel.name}</span>
              </div>
            )}
          </div>
        </header>

        {/* Chat area or welcome */}
        {!activeChannel ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="font-display italic text-lg" style={{ color: '#B0ADA7' }}>
              Select a department from the sidebar to get started.
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-8 py-6 scrollbar-thin">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="w-12 h-12 rounded-2xl mb-4 flex items-center justify-center"
                    style={{ background: '#E4E2DC' }}>
                    {(() => { const Icon = getChannelIcon(activeChannel); return <Icon className="w-5 h-5" style={{ color: getDeptColor(activeChannel) }} strokeWidth={1.5} />; })()}
                  </div>
                  <p className="font-display italic text-xl mb-1" style={{ color: '#2C2A27' }}>
                    {activeChannel.name}
                  </p>
                  <p className="text-sm" style={{ color: '#B0ADA7' }}>
                    {activeChannel.description || 'No messages yet — be the first to say something.'}
                  </p>
                </div>
              )}

              {grouped.map(({ date, msgs }) => (
                <div key={date}>
                  {/* Date divider */}
                  <div className="flex items-center gap-4 my-6">
                    <div className="flex-1 h-px" style={{ background: '#DDDBD5' }} />
                    <span className="text-xs font-medium px-1" style={{ color: '#B0ADA7' }}>{date}</span>
                    <div className="flex-1 h-px" style={{ background: '#DDDBD5' }} />
                  </div>

                  <div className="space-y-0">
                    {msgs.map((msg, idx) => {
                      const cont = isContinuation(msgs, idx);
                      const name = getSenderName(msg);
                      const avatar = getSenderAvatar(msg);
                      return (
                        <div
                          key={msg.id}
                          className={`flex items-start gap-3 px-3 py-1 rounded-xl group transition-colors ${cont ? '' : 'mt-4'}`}
                          onMouseEnter={e => (e.currentTarget.style.background = '#E8E6E0')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <div className="w-8 flex-shrink-0 flex items-start justify-center pt-0.5">
                            {!cont ? (
                              <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden text-xs font-semibold flex-shrink-0"
                                style={{ background: '#DDD9D0', color: '#6B6865' }}>
                                {avatar
                                  ? <img src={avatar} alt={name} className="w-full h-full object-cover" />
                                  : name[0]?.toUpperCase() ?? '?'
                                }
                              </div>
                            ) : (
                              <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ color: '#B0ADA7' }}>
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            {!cont && (
                              <div className="flex items-baseline gap-2 mb-0.5">
                                <span className="text-sm font-semibold" style={{ color: '#2C2A27' }}>{name}</span>
                                <span className="text-xs" style={{ color: '#B0ADA7' }}>{timeLabel(msg.created_at)}</span>
                              </div>
                            )}
                            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words" style={{ color: '#3D3B38' }}>
                              {msg.content}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input area */}
            <div className="px-8 pb-6 flex-shrink-0">
              <div
                className="flex items-end gap-3 rounded-2xl px-4 py-3 transition-shadow"
                style={{ background: '#F5F3EE', border: '1px solid #DDDBD5', boxShadow: '0 1px 3px rgba(44,42,39,0.06)' }}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message ${activeChannel.name}${displayName ? '' : ' — set your name first'}`}
                  rows={1}
                  className="flex-1 bg-transparent text-sm resize-none focus:outline-none leading-relaxed"
                  style={{ color: '#2C2A27', maxHeight: '160px' }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  className="p-2 rounded-xl transition-all duration-150 flex-shrink-0"
                  style={{
                    background: input.trim() ? '#2C2A27' : '#E4E2DC',
                    color: input.trim() ? '#F5F3EE' : '#B0ADA7',
                  }}
                >
                  <Send className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              </div>
              <p className="text-xs mt-1.5 ml-1" style={{ color: '#C0BDB7' }}>
                Enter to send · Shift+Enter for new line
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Code Entry Modal ── */}
      {pendingChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(44,42,39,0.45)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" style={{ background: '#F5F3EE', border: '1px solid #DDDBD5' }}>
            <div className="px-7 pt-7 pb-5">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: getDeptColor(pendingChannel) + '22' }}>
                  {(() => { const Icon = getChannelIcon(pendingChannel); return <Icon className="w-5 h-5" style={{ color: getDeptColor(pendingChannel) }} strokeWidth={1.5} />; })()}
                </div>
                <div>
                  <h2 className="font-semibold text-base" style={{ color: '#2C2A27' }}>{pendingChannel.name}</h2>
                  <p className="text-xs" style={{ color: '#9A9690' }}>Enter the access code to join</p>
                </div>
              </div>

              <label className="block text-xs font-medium uppercase tracking-wider mb-2" style={{ color: '#9A9690' }}>
                Access Code
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#B0ADA7' }} strokeWidth={1.5} />
                <input
                  ref={codeInputRef}
                  type="text"
                  value={codeInput}
                  onChange={e => { setCodeInput(e.target.value); setCodeError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleVerifyCode(); }}
                  placeholder="Enter code..."
                  className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none"
                  style={{
                    background: '#ECEAE4', border: `1px solid ${codeError ? '#DC6B6B' : '#DDDBD5'}`,
                    color: '#2C2A27',
                  }}
                />
              </div>

              {codeError && (
                <div className="flex items-center gap-2 mt-2.5 text-sm" style={{ color: '#C05454' }}>
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                  {codeError}
                </div>
              )}
            </div>

            <div className="flex gap-2 px-7 pb-7">
              <button
                onClick={() => setPendingChannel(null)}
                className="flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors"
                style={{ background: '#E4E2DC', color: '#6B6865' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#DDDBD5')}
                onMouseLeave={e => (e.currentTarget.style.background = '#E4E2DC')}
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyCode}
                disabled={!codeInput.trim() || codeLoading}
                className="flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                style={{ background: '#2C2A27', color: '#F5F3EE', opacity: (!codeInput.trim() || codeLoading) ? 0.5 : 1 }}
              >
                {codeLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <><Check className="w-3.5 h-3.5" strokeWidth={2} /> Unlock</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Name Setup Modal ── */}
      {showNameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(44,42,39,0.45)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" style={{ background: '#F5F3EE', border: '1px solid #DDDBD5' }}>
            <div className="px-7 pt-7 pb-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: '#E4E2DC' }}>
                <UserCircle className="w-5 h-5" style={{ color: '#6B6865' }} strokeWidth={1.5} />
              </div>
              <h2 className="font-semibold text-base mb-1" style={{ color: '#2C2A27' }}>What should we call you?</h2>
              <p className="text-sm mb-5" style={{ color: '#9A9690' }}>
                Your name will appear on your messages in this chat.
              </p>
              <label className="block text-xs font-medium uppercase tracking-wider mb-2" style={{ color: '#9A9690' }}>
                Display Name
              </label>
              <input
                autoFocus
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') confirmName(); }}
                placeholder="Your name..."
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                style={{ background: '#ECEAE4', border: '1px solid #DDDBD5', color: '#2C2A27' }}
              />
            </div>
            <div className="flex gap-2 px-7 pb-7">
              <button
                onClick={() => setShowNameModal(false)}
                className="flex-1 rounded-xl py-2.5 text-sm font-medium"
                style={{ background: '#E4E2DC', color: '#6B6865' }}
              >
                Skip
              </button>
              <button
                onClick={confirmName}
                disabled={!nameInput.trim()}
                className="flex-1 rounded-xl py-2.5 text-sm font-medium"
                style={{ background: '#2C2A27', color: '#F5F3EE', opacity: nameInput.trim() ? 1 : 0.5 }}
              >
                Save Name
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside name menu */}
      {showNameMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowNameMenu(false)} />
      )}
    </div>
  );
}
