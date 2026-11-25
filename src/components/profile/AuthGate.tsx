'use client';

import type { ReactNode } from 'react';
import { LogIn } from 'lucide-react';
import { openAuth } from '@/store';
import { useAuthStatus } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

export interface AuthGateProps {
  /** Shown to signed-out visitors. */
  icon: ReactNode;
  title: string;
  description: string;
  /** Rendered while /api/auth/me has not answered yet. */
  loading?: ReactNode;
  children: ReactNode;
}

/**
 * Renders `children` only for a confirmed signed-in user. While the session is still unknown it
 * shows `loading` (no flash of the signed-out state); signed out, a sign-in prompt.
 */
export function AuthGate({ icon, title, description, loading, children }: AuthGateProps) {
  const status = useAuthStatus();
  if (status === 'unknown') {
    return (
      <div aria-busy="true">
        <span className="sr-only" role="status">
          Checking your session…
        </span>
        {loading ?? <div className="skeleton mx-gutter h-64 rounded-panel" />}
      </div>
    );
  }
  if (status !== 'authenticated') {
    return (
      <div className="px-gutter py-16">
        <EmptyState
          icon={icon}
          title={title}
          description={description}
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button leadingIcon={<LogIn />} onClick={() => openAuth('login')}>
                Sign in
              </Button>
              <Button variant="secondary" onClick={() => openAuth('signup')}>
                Create a free account
              </Button>
            </div>
          }
        />
      </div>
    );
  }
  return <>{children}</>;
}
