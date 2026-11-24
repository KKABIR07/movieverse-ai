'use client';

import { useId, useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { LogoMark } from '@/components/layout/Logo';

type Tab = 'login' | 'signup';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: Tab;
}

const inputClass =
  'h-11 w-full rounded-control border border-line bg-surface-2 px-3.5 text-body text-fg placeholder:text-fg-muted ' +
  'transition-colors hover:border-line-strong focus:border-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-accent';

/**
 * Sign-in / create-account form. Mounted only while the dialog is open, so all
 * fields reset naturally each time (no state-syncing effects).
 */
function AuthForm({ defaultTab, onDone }: { defaultTab: Tab; onDone: () => void }) {
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const login = useAuthStore((s) => s.login);
  const signup = useAuthStore((s) => s.signup);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const ids = useId();
  const errorId = `${ids}-error`;

  const switchTab = (t: Tab) => {
    clearError();
    setTab(t);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (tab === 'signup') await signup(name, email, password);
    else await login(email, password);
    if (useAuthStore.getState().user) onDone();
  };

  return (
    <div>
      <Tabs<Tab>
        label="Account"
        appearance="pill"
        panels={false}
        value={tab}
        onValueChange={switchTab}
        items={[
          { id: 'login', label: 'Sign in' },
          { id: 'signup', label: 'Create account' },
        ]}
        className="mb-5"
      />

      <form onSubmit={onSubmit} className="space-y-4" aria-describedby={error ? errorId : undefined}>
        {tab === 'signup' && (
          <div>
            <label htmlFor={`${ids}-name`} className="mb-1.5 block text-caption font-medium text-fg-secondary">
              Name
            </label>
            <input
              id={`${ids}-name`}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              className={inputClass}
            />
          </div>
        )}
        <div>
          <label htmlFor={`${ids}-email`} className="mb-1.5 block text-caption font-medium text-fg-secondary">
            Email
          </label>
          <input
            id={`${ids}-email`}
            data-autofocus
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`${ids}-password`} className="mb-1.5 block text-caption font-medium text-fg-secondary">
            Password
          </label>
          <div className="relative">
            <input
              id={`${ids}-password`}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={tab === 'signup' ? 6 : undefined}
              aria-describedby={tab === 'signup' ? `${ids}-pw-hint` : undefined}
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              className={`${inputClass} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-chip text-fg-muted hover:text-fg"
            >
              {showPassword ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
            </button>
          </div>
          {tab === 'signup' && (
            <p id={`${ids}-pw-hint`} className="mt-1.5 text-micro text-fg-muted">
              At least 6 characters.
            </p>
          )}
        </div>

        {error && (
          <p id={errorId} role="alert" className="rounded-control border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-caption text-danger">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" block loading={isLoading}>
          {tab === 'login' ? 'Sign in' : 'Create account'}
        </Button>
      </form>

      <p className="mt-5 text-center text-caption text-fg-muted">
        {tab === 'login' ? 'New to mkmovies? ' : 'Already have an account? '}
        <button
          type="button"
          onClick={() => switchTab(tab === 'login' ? 'signup' : 'login')}
          className="font-medium text-accent underline-offset-2 hover:underline"
        >
          {tab === 'login' ? 'Create an account' : 'Sign in'}
        </button>
      </p>
    </div>
  );
}

/** Sign-in dialog. Opened globally via `openAuth()` from '@/store'. */
export function AuthModal({ open, onClose, defaultTab = 'login' }: AuthModalProps) {
  const clearError = useAuthStore((s) => s.clearError);
  const handleClose = () => {
    clearError();
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={handleClose}
      size="sm"
      placement="sheet"
      title={
        <span className="flex items-center gap-2.5">
          <LogoMark className="size-7" />
          Welcome to mkmovies
        </span>
      }
      description="Sign in to keep a watchlist, follow people and join the chat."
    >
      <AuthForm defaultTab={defaultTab} onDone={handleClose} />
    </Dialog>
  );
}
