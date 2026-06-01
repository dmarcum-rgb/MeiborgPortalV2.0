import { useState, useRef, useEffect } from 'react';
import { Send, X, Loader2, CheckCircle, Minus } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const EXECUTIVE_NAMES = ['james cooper', 'zach meiborg', 'megan dierks', 'tony askins', 'dallas marcum'];

function getMemberContext() {
  try {
    const m = JSON.parse(sessionStorage.getItem('portal_member') ?? 'null');
    if (!m) return null;
    return { full_name: m.full_name, position: m.position ?? null, department: m.department ?? null };
  } catch { return null; }
}

function getAgentEndpoint(member: { full_name?: string; position?: string | null; department?: string | null } | null): string {
  if (!member?.full_name) return 'gemini-agent';
  const name = member.full_name.toLowerCase().trim();
  if (EXECUTIVE_NAMES.includes(name)) return 'ai-agent';
  const pos = (member.position ?? '').toLowerCase();
  const dept = (member.department ?? '').toLowerCase();
  const isAccounting = dept === 'accounting' || pos.includes('accounting') || pos.includes('billing') ||
    pos.includes('payroll') || pos.includes('controller') || pos.includes('accounts');
  return isAccounting ? 'ai-agent' : 'gemini-agent';
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const FORM_TABS = ['Dental Cards', 'Daycare Waiver', 'Direct Deposit', 'MeiCares'];

const SUGGESTIONS = [
  { label: 'Handbook', prompts: ['What is our PTO policy?', 'How do I request FMLA?', 'What is the dress code?'] },
  { label: 'Forms', prompts: ['Help me fill out Direct Deposit', 'I need a dental card', 'Help with Daycare Waiver', 'Set up MeiCares'] },
];

// ── Markdown-lite renderer ─────────────────────────────────────────────────

function renderText(text: string) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-xs font-semibold mt-2 mb-0.5" style={{ color: '#F5F3EE' }}>{line.slice(4)}</h3>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-sm font-semibold mt-2 mb-0.5" style={{ color: '#F5F3EE' }}>{line.slice(3)}</h2>);
    } else if (line.startsWith('- ') || line.startsWith('• ')) {
      elements.push(
        <div key={i} className="flex gap-1.5 text-xs" style={{ color: '#C0BDB7' }}>
          <span className="flex-shrink-0 mt-0.5" style={{ color: '#6B6865' }}>•</span>
          <span>{inlineFormat(line.slice(2))}</span>
        </div>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+)\.\s(.*)$/);
      if (match) {
        elements.push(
          <div key={i} className="flex gap-1.5 text-xs" style={{ color: '#C0BDB7' }}>
            <span className="flex-shrink-0 font-medium" style={{ color: '#9A9690', minWidth: '1rem' }}>{match[1]}.</span>
            <span>{inlineFormat(match[2])}</span>
          </div>
        );
      }
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-1" />);
    } else {
      elements.push(
        <p key={i} className="text-xs leading-relaxed" style={{ color: '#C0BDB7' }}>
          {inlineFormat(line)}
        </p>
      );
    }
    i++;
  }
  return <div className="space-y-0.5">{elements}</div>;
}

function inlineFormat(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: '#F5F3EE', fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map(i => (
        <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#6B6865', animationDelay: `${i * 150}ms` }} />
      ))}
    </div>
  );
}

// ── Chat Panel ─────────────────────────────────────────────────────────────

function ChatPanel({ formContext, userName, onClose }: { formContext?: string; userName?: string; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isFormContext = formContext && FORM_TABS.includes(formContext);
  const memberContext = getMemberContext();
  const agentEndpoint = getAgentEndpoint(memberContext);

  useEffect(() => {
    const greeting = isFormContext
      ? `Hi${userName ? ` ${userName.split(' ')[0]}` : ''}! I'm MeiGuy, your Meiborg HR assistant. I can help you fill out the **${formContext}** form — I'll ask a few questions then send it to HR once you confirm.\n\nShall we get started?`
      : `Hi${userName ? ` ${userName.split(' ')[0]}` : ''}! I'm **MeiGuy**, your Meiborg HR assistant.\n\nI can answer **Handbook** questions and help fill out HR forms like Direct Deposit, Dental Cards, Daycare Waiver, and MeiCares.\n\nWhat can I help you with?`;
    setMessages([{ role: 'assistant', content: greeting }]);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const next = [...messages, { role: 'user' as const, content: text.trim() }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/${agentEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
          formContext,
          memberContext: memberContext,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      if (data.emailSent) setEmailSent(true);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        width: '360px',
        height: '520px',
        background: '#1C1B19',
        border: '1px solid #3D3A36',
        borderRadius: '20px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-2.5 px-4 py-3 border-b" style={{ borderColor: '#2C2A27' }}>
        <img src="/Mei-Guy_icon_(1).png" alt="MeiGuy" className="w-8 h-8 rounded-xl object-contain flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold" style={{ color: '#F5F3EE' }}>MeiGuy</span>
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#4A9D6F' }} />
          </div>
          <p className="text-xs truncate" style={{ color: '#6B6865' }}>
            {isFormContext ? `${formContext} · HR Form Assistant` : 'Meiborg HR Assistant'}
          </p>
        </div>
        {emailSent && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium flex-shrink-0" style={{ background: '#1A3828', color: '#4A9D6F' }}>
            <CheckCircle className="w-3 h-3" strokeWidth={1.5} />
            Sent
          </div>
        )}
        <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0 transition-opacity hover:opacity-60" style={{ color: '#4A4844' }}>
          <X className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ scrollbarWidth: 'thin', scrollbarColor: '#2C2A27 transparent' }}>
        {messages.length === 1 && !isFormContext && (
          <div className="pb-1">
            {SUGGESTIONS.map(group => (
              <div key={group.label} className="mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider mb-1.5 px-0.5" style={{ color: '#4A4844' }}>{group.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.prompts.map(p => (
                    <button key={p} onClick={() => sendMessage(p)}
                      className="px-2.5 py-1 rounded-full text-xs transition-all hover:opacity-80"
                      style={{ background: '#2C2A27', color: '#9A9690', border: '1px solid #3D3A36' }}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
            {msg.role === 'assistant' && (
              <img src="/Mei-Guy_icon_(1).png" alt="MeiGuy" className="w-6 h-6 rounded-lg object-contain flex-shrink-0 mt-0.5" />
            )}
            <div
              className="max-w-[82%] rounded-2xl px-3 py-2"
              style={msg.role === 'user'
                ? { background: '#2C2A27', borderBottomRightRadius: '4px', border: '1px solid #3D3A36' }
                : { background: 'transparent', borderBottomLeftRadius: '4px' }
              }
            >
              {msg.role === 'user'
                ? <p className="text-xs" style={{ color: '#F5F3EE' }}>{msg.content}</p>
                : renderText(msg.content)
              }
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start gap-2">
            <img src="/Mei-Guy_icon_(1).png" alt="MeiGuy" className="w-6 h-6 rounded-lg object-contain flex-shrink-0" />
            <div className="px-3 py-2 rounded-2xl" style={{ background: '#2C2A27', border: '1px solid #3D3A36', borderBottomLeftRadius: '4px' }}>
              <TypingDots />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-3 pb-3 pt-2 border-t" style={{ borderColor: '#2C2A27' }}>
        <div className="flex items-end gap-2 rounded-xl px-3 py-2" style={{ background: '#2C2A27', border: '1px solid #3D3A36' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            placeholder="Ask anything…"
            rows={1}
            className="flex-1 bg-transparent text-xs resize-none focus:outline-none leading-relaxed"
            style={{ color: '#F5F3EE', maxHeight: '80px', scrollbarWidth: 'none' }}
            onInput={e => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, 80)}px`;
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all"
            style={{ background: input.trim() && !loading ? '#F5F3EE' : '#3D3A36', color: input.trim() && !loading ? '#2C2A27' : '#4A4844' }}
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2} /> : <Send className="w-3 h-3" strokeWidth={2} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Floating Widget ────────────────────────────────────────────────────────

export default function MeiGuyWidget({ formContext, userName }: { formContext?: string; userName?: string }) {
  const [open, setOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [pulse, setPulse] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setPulse(false), 3000);
    return () => clearTimeout(t);
  }, []);

  function handleOpen() {
    setOpen(true);
    setHasUnread(false);
    setPulse(false);
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Chat panel */}
      <div
        style={{
          transformOrigin: 'bottom right',
          transform: open ? 'scale(1) translateY(0)' : 'scale(0.85) translateY(12px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'transform 0.22s cubic-bezier(0.34,1.56,0.64,1), opacity 0.18s ease',
        }}
      >
        <ChatPanel formContext={formContext} userName={userName} onClose={() => setOpen(false)} />
      </div>

      {/* FAB button */}
      <button
        onClick={open ? () => setOpen(false) : handleOpen}
        className="relative flex items-center justify-center transition-transform active:scale-95"
        style={{
          width: '60px',
          height: '60px',
          borderRadius: '18px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          transform: open ? 'rotate(0deg)' : 'rotate(0deg)',
          transition: 'box-shadow 0.2s ease, transform 0.2s ease',
          overflow: 'hidden',
          border: '2px solid #3D3A36',
        }}
        onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.55)')}
        onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)')}
        title="Ask MeiGuy"
      >
        {open ? (
          <div className="w-full h-full flex items-center justify-center" style={{ background: '#2C2A27' }}>
            <Minus className="w-5 h-5" style={{ color: '#C0BDB7' }} strokeWidth={2} />
          </div>
        ) : (
          <img src="/Mei-Guy_icon_(1).png" alt="MeiGuy" className="w-full h-full object-contain" />
        )}

        {/* Pulse ring */}
        {pulse && !open && (
          <span className="absolute inset-0 rounded-[16px] animate-ping" style={{ background: 'rgba(255,255,255,0.15)' }} />
        )}

        {/* Unread dot */}
        {hasUnread && !open && (
          <div className="absolute top-0 right-0 w-3 h-3 rounded-full border-2" style={{ background: '#E05252', borderColor: '#1C1B19', transform: 'translate(25%, -25%)' }} />
        )}
      </button>
    </div>
  );
}
