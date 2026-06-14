'use client';

import { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Film, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: 'login' | 'signup';
}

export function AuthModal({ open, onClose, defaultTab = 'login' }: AuthModalProps) {
  const [tab, setTab] = useState<'login' | 'signup'>(defaultTab);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, signup, isLoading, error, clearError, user } = useAuthStore();

  useEffect(() => { if (user) onClose(); }, [user, onClose]);
  useEffect(() => { if (open) { clearError(); setName(''); setEmail(''); setPassword(''); setTab(defaultTab); } }, [open, defaultTab, clearError]);
  useEffect(() => { const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', fn); return () => window.removeEventListener('keydown', fn); }, [onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === 'signup') {
      await signup(name, email, password);
    } else {
      await login(email, password);
    }
  };

  const switchTab = (t: 'login' | 'signup') => { clearError(); setTab(t); };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md glass rounded-2xl border border-[var(--border)] shadow-[0_32px_64px_rgba(0,0,0,0.8)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent-primary)] flex items-center justify-center">
              <Film size={14} className="text-white" />
            </div>
            <span className="font-bold gradient-text">mkmovies</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-6">
          {/* Tabs */}
          <div className="flex rounded-xl border border-[var(--border)] overflow-hidden mb-6">
            {(['login', 'signup'] as const).map((t) => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className={`flex-1 py-2.5 text-sm font-semibold capitalize transition-colors ${tab === t ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
              >
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'signup' && (
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  required
                  autoComplete="name"
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] focus:border-[var(--accent-primary)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none transition-colors"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] focus:border-[var(--accent-primary)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={tab === 'signup' ? 'At least 6 characters' : '••••••••'}
                  required
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] focus:border-[var(--accent-primary)] rounded-xl px-4 py-2.5 pr-11 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 mt-2"
            >
              {isLoading && <Loader2 size={16} className="animate-spin" />}
              {isLoading ? 'Please wait...' : tab === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-xs text-[var(--text-muted)] mt-5">
            {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={() => switchTab(tab === 'login' ? 'signup' : 'login')} className="text-[var(--accent-primary)] hover:underline font-medium">
              {tab === 'login' ? 'Sign up free' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
