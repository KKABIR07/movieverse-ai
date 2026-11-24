'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Bookmark, Compass, Home, MonitorPlay, Search } from 'lucide-react';
import { useUIStore, useWatchlistCount } from '@/store';
import { useAuthStore } from '@/store/authStore';
import { useStoresHydrated } from '@/store/hydration';
import { cn } from '@/components/ui/cn';
import { isNavActive } from './nav';

const item =
  'relative flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-control text-micro font-medium transition-colors duration-120';

function TabLink({ href, label, icon, active, badge }: { href: string; label: string; icon: ReactNode; active: boolean; badge?: number }) {
  return (
    <li className="flex flex-1">
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(item, active ? 'text-fg' : 'text-fg-muted hover:text-fg-secondary')}
      >
        <span className={cn('relative [&_svg]:size-[22px]', active && '[&_svg]:text-accent')} aria-hidden>
          {icon}
          {!!badge && (
            <span className="tabular absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-accent px-1 text-center text-micro font-semibold leading-4 text-on-accent">
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </span>
        <span>{label}</span>
        {badge ? <span className="sr-only">, {badge} items</span> : null}
      </Link>
    </li>
  );
}

/**
 * Fixed bottom navigation for < 768px. Respects the iOS home indicator via
 * env(safe-area-inset-bottom). <main> gets matching bottom padding in the layout.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const setSearchOpen = useUIStore((s) => s.setSearchOpen);
  const searchOpen = useUIStore((s) => s.searchOpen);
  const openAuth = useUIStore((s) => s.openAuth);
  const signedIn = useAuthStore((s) => !!s.user);
  const hydrated = useStoresHydrated();
  const count = useWatchlistCount();
  const watchBadge = hydrated && signedIn ? count : 0;

  return (
    <nav
      aria-label="Mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ground/90 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <ul className="flex h-[var(--tabbar-h)] items-stretch px-1 py-1">
        <TabLink href="/" label="Home" icon={<Home />} active={isNavActive({ href: '/' }, pathname)} />
        <TabLink
          href="/discover"
          label="Discover"
          icon={<Compass />}
          active={isNavActive({ href: '/discover', match: ['/movies', '/tv', '/genre/', '/trending', '/top-rated'] }, pathname)}
        />
        <li className="flex flex-1">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={searchOpen}
            className={cn(item, searchOpen || pathname === '/search' ? 'text-fg' : 'text-fg-muted')}
          >
            <Search aria-hidden className={cn('size-[22px]', (searchOpen || pathname === '/search') && 'text-accent')} />
            <span>Search</span>
          </button>
        </li>
        <TabLink href="/shorts" label="Shorts" icon={<MonitorPlay />} active={isNavActive({ href: '/shorts' }, pathname)} />
        {signedIn ? (
          <TabLink
            href="/watchlist"
            label="Watchlist"
            icon={<Bookmark />}
            badge={watchBadge}
            active={isNavActive({ href: '/watchlist' }, pathname)}
          />
        ) : (
          <li className="flex flex-1">
            <button type="button" onClick={() => openAuth('login')} className={cn(item, 'text-fg-muted')}>
              <Bookmark aria-hidden className="size-[22px]" />
              <span>Watchlist</span>
              <span className="sr-only"> (sign in required)</span>
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
}
