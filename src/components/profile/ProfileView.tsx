'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Bookmark, ChevronRight, LogOut, MonitorSmartphone, Rss, Star, UserRound, Users } from 'lucide-react';
import { useRatingsStore, useWatchlistCount } from '@/store';
import { useUser, useAuthStore } from '@/store/authStore';
import { useFollowingStore } from '@/store/followingStore';
import { useStoresHydrated } from '@/store/hydration';
import { toast } from '@/store/toastStore';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { AuthGate } from './AuthGate';

function Stat({ value, label, href, hydrated }: { value: number; label: string; href?: string; hydrated: boolean }) {
  const body = (
    <span>
      <span className="block text-h2 tabular text-fg">{hydrated ? value.toLocaleString('en-US') : '–'}</span>
      <span className="block text-caption text-fg-secondary">{label}</span>
    </span>
  );
  const box = 'group flex items-center justify-between gap-3 rounded-panel border border-line bg-surface-1 px-5 py-4';
  if (!href) return <div className={box}>{body}</div>;
  return (
    <Link href={href} className={`${box} transition-colors duration-120 hover:border-line-strong hover:bg-surface-2`}>
      {body}
      <ChevronRight aria-hidden className="size-4 text-fg-muted group-hover:text-accent" />
    </Link>
  );
}

const LINKS = [
  { href: '/watchlist', icon: Bookmark, label: 'Watchlist', desc: 'Titles you saved' },
  { href: '/following', icon: Users, label: 'Following', desc: 'People you follow' },
  { href: '/feed', icon: Rss, label: 'Your feed', desc: 'New and upcoming from people you follow' },
  { href: '/stars', icon: Star, label: 'Find people', desc: 'Popular actors and directors' },
] as const;

function ProfileBody() {
  const user = useUser();
  const hydrated = useStoresHydrated();
  const watchlist = useWatchlistCount();
  const following = useFollowingStore((s) => s.following.length);
  const ratings = useRatingsStore((s) => Object.keys(s.ratings).length);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<null | 'one' | 'all'>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  if (!user) return null;

  const finish = (message: string) => {
    queryClient.clear(); // drop cached per-user responses too
    toast({ title: message, tone: 'success' });
    router.push('/');
  };

  const signOut = async () => {
    setBusy('one');
    try {
      await useAuthStore.getState().logout();
      finish('Signed out');
    } finally {
      setBusy(null);
    }
  };

  const signOutAll = async () => {
    setBusy('all');
    try {
      await useAuthStore.getState().logoutAll();
      setConfirmAll(false);
      finish('Signed out on every device');
    } catch (err) {
      toast({ title: 'Could not sign out everywhere', description: (err as Error).message, tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <section
        aria-labelledby="account-title"
        className="flex flex-col gap-5 rounded-panel border border-line bg-surface-1 p-5 sm:flex-row sm:items-center sm:p-6"
      >
        <span aria-hidden className="grid size-16 shrink-0 place-items-center rounded-full bg-accent text-h3 font-semibold text-on-accent">
          {user.initials || <UserRound />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="account-title" className="truncate text-h2 text-fg">
            {user.name}
          </h2>
          <p className="truncate text-body text-fg-secondary">{user.email}</p>
          {user.joinedAt && (
            <p className="mt-1 text-caption text-fg-muted">
              Member since <time dateTime={user.joinedAt}>{formatDate(user.joinedAt, { year: 'numeric', month: 'long' })}</time>
            </p>
          )}
        </div>
      </section>

      <section aria-label="Your activity" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat value={watchlist} label={watchlist === 1 ? 'Saved title' : 'Saved titles'} href="/watchlist" hydrated={hydrated} />
        <Stat value={following} label={following === 1 ? 'Person followed' : 'People followed'} href="/following" hydrated={hydrated} />
        <Stat
          value={ratings}
          label={ratings === 1 ? 'Private rating (this device)' : 'Private ratings (this device)'}
          hydrated={hydrated}
        />
      </section>

      <nav aria-label="Your pages" className="overflow-hidden rounded-panel border border-line bg-surface-1">
        <ul className="divide-y divide-line">
          {LINKS.map(({ href, icon: Icon, label, desc }) => (
            <li key={href}>
              <Link href={href} className="group flex items-center gap-4 px-5 py-4 transition-colors duration-120 hover:bg-surface-2">
                <Icon aria-hidden className="size-5 shrink-0 text-fg-muted group-hover:text-accent" />
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-medium text-fg">{label}</span>
                  <span className="block text-caption text-fg-secondary">{desc}</span>
                </span>
                <ChevronRight aria-hidden className="size-4 shrink-0 text-fg-muted" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section aria-labelledby="session-title" className="rounded-panel border border-line bg-surface-1 p-5 sm:p-6">
        <h2 id="session-title" className="text-h3 text-fg">
          Sessions
        </h2>
        <p className="mt-1 text-caption text-fg-secondary">
          Signing out removes your watchlist, follows and ratings from this browser. They stay in your account.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="secondary" leadingIcon={<LogOut />} onClick={signOut} loading={busy === 'one'} disabled={busy !== null}>
            Sign out
          </Button>
          <Button variant="ghost" leadingIcon={<MonitorSmartphone />} onClick={() => setConfirmAll(true)} disabled={busy !== null}>
            Sign out of all devices
          </Button>
        </div>
      </section>

      <Dialog
        open={confirmAll}
        onClose={() => setConfirmAll(false)}
        title="Sign out of all devices?"
        description="Every browser and phone signed in to this account will need to sign in again."
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmAll(false)} disabled={busy === 'all'}>
              Cancel
            </Button>
            <Button variant="danger" onClick={signOutAll} loading={busy === 'all'}>
              Sign out everywhere
            </Button>
          </div>
        }
      >
        <p className="text-body text-fg-secondary">Your saved titles and follows are not affected.</p>
      </Dialog>
    </div>
  );
}

export function ProfileView() {
  return (
    <>
      <PageHeader eyebrow="Account" title="Your profile" />
      <div className="px-gutter pb-16">
        <AuthGate
          icon={<UserRound />}
          title="Sign in to see your profile"
          description="Keep a watchlist, follow people and get a feed of their new releases."
        >
          <ProfileBody />
        </AuthGate>
      </div>
    </>
  );
}
