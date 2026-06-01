import { useState, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Mail, AlertCircle, X, Settings } from 'lucide-react';

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function LoginPage({ onSuccess, onCancel }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      setError(error);
      setLoading(false);
    } else {
      onSuccess();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(44,42,39,0.45)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: '#F5F3EE', border: '1px solid #DDDBD5', fontFamily: "'Inter', sans-serif" }}>

        <div className="flex items-center justify-between px-7 pt-7 pb-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#2C2A27' }}>
              <Settings className="w-4.5 h-4.5 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="font-semibold text-base" style={{ color: '#2C2A27' }}>Admin Access</h2>
              <p className="text-xs" style={{ color: '#9A9690' }}>Sign in to manage the platform</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg" style={{ color: '#9A9690' }}>
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-7 pt-6 pb-7 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9A9690' }}>Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#B0ADA7' }} strokeWidth={1.5} />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@company.com" required
                className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none"
                style={{ background: '#ECEAE4', border: '1px solid #DDDBD5', color: '#2C2A27' }} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9A9690' }}>Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#B0ADA7' }} strokeWidth={1.5} />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
                className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none"
                style={{ background: '#ECEAE4', border: '1px solid #DDDBD5', color: '#2C2A27' }} />
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl text-sm" style={{ background: '#FAEAEA', color: '#C05454' }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} /> {error}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onCancel} className="flex-1 rounded-xl py-2.5 text-sm font-medium" style={{ background: '#E4E2DC', color: '#6B6865' }}>Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 rounded-xl py-2.5 text-sm font-medium transition-opacity" style={{ background: '#2C2A27', color: '#F5F3EE', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
