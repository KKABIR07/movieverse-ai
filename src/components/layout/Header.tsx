'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Bookmark, MessageSquare, Search, Shuffle } from 'lucide-react';
import { useUIStore, useWatchlistCount, type AuthTab } from '@/store';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { useStoresHydrated } from '@/store/hydration';
import { useHotkey } from '@/lib/hooks/useHotkey';
import { IconButton } from '@/components/ui/IconButton';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { UserMenu } from '@/components/auth/UserMenu';
import { AuthModal } from '@/components/auth/AuthModal';
import { DiceRollModal } from '@/components/movie/DiceRollModal';
import { CommandPalette } from './CommandPalette';
import { Logo } from './Logo';
import { PRIMARY_NAV, isNavActive } from './nav';

const SCROLL_THRESHOLD = 24;

function subscribeScroll(cb: () => void) {
  window.addEventListener('scroll', cb, { passive: true });
  return () => window.removeEventListener('scroll', cb);
}
function useScrolled() {
  return useSyncExternalStore(
    subscribeScroll,
    () => window.scrollY > SCROLL_THRESHOLD,
    () => false,
  );
}

const noop = () => () => {};
/** "⌘K" on Apple platforms, "Ctrl K" elsewhere (server renders "Ctrl K"). */
function useShortcutLabel() {
  return useSyncExternalStore(
    noop,
    () => (/Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent) ? '⌘K' : 'Ctrl K'),
    () => 'Ctrl K',
  );
}

export function Header() {
  const pathname = usePathname();
  const scrolled = useScrolled();
  const shortcut = useShortcutLabel();
  const [diceOpen, setDiceOpen] = useState(false);

  const searchOpen = useUIStore((s) => s.searchOpen);
  const setSearchOpen = useUIStore((s) => s.setSearchOpen);
  const authOpen = useUIStore((s) => s.authOpen);
  const authTab = useUIStore((s) => s.authTab);
  const openAuth = useUIStore((s) => s.openAuth);
  const closeAuth = useUIStore((s) => s.closeAuth);

  const signedIn = useAuthStore((s) => !!s.user);
  const hydrated = useStoresHydrated();
  const watchCount = useWatchlistCount();
  const shownCount = hydrated && signedIn ? watchCount : 0;

  const toggleChat = useChatStore((s) => s.toggleChat);
  const chatOpen = useChatStore((s) => s.chatOpen);
  const unread = useChatStore((s) => s.unreadCount);

  useHotkey('mod+k', () => setSearchOpen(!useUIStore.getState().searchOpen), { allowInInputs: true });
  useHotkey('/', () => setSearchOpen(true), { enabled: !searchOpen });

  // Legacy: pages dispatch `mkmovies:openAuth` to request the sign-in dialog.
  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent<{ tab?: AuthTab }>).detail?.tab ?? 'login';
      openAuth(tab);
    };
    window.addEventListener('mkmovies:openAuth', handler);
    return () => window.removeEventListener('mkmovies:openAuth', handler);
  }, [openAuth]);

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 h-[var(--header-h)] transition-[background-color,border-color,backdrop-filter] duration-200',
          scrolled
            ? 'border-b border-line bg-ground/85 backdrop-blur-xl backdrop-saturate-150'
            : 'border-b border-transparent bg-gradient-to-b from-ground/80 to-transparent',
        )}
      >
        <div className="flex h-full items-center gap-2 px-gutter">
          <Logo className="shrink-0 lg:mr-2" wordmarkClassName="md:max-lg:sr-only" />

          <nav aria-label="Primary" className="hidden md:flex flex-1 justify-center min-w-0">
            <ul className="flex items-center gap-0.5 rounded-full border border-line/80 bg-surface-1/70 p-1 backdrop-blur-md">
              {PRIMARY_NAV.map((item) => {
                const active = isNavActive(item, pathname);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'inline-flex h-9 items-center rounded-full px-3 lg:px-3.5 text-caption font-medium whitespace-nowrap transition-colors duration-120',
                        active ? 'bg-surface-3 text-fg' : 'text-fg-secondary hover:text-fg hover:bg-surface-2',
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">
            {/* Search trigger: wide on xl, icon below. Mobile uses the tab bar. */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search movies, TV shows and people"
              aria-keyshortcuts="Control+K Meta+K /"
              aria-haspopup="dialog"
              className="hidden xl:inline-flex h-11 w-56 items-center gap-2 rounded-control border border-line bg-surface-1/80 px-3 text-caption text-fg-muted hover:border-line-strong hover:text-fg-secondary transition-colors"
            >
              <Search aria-hidden className="size-4" />
              <span className="flex-1 text-left">Search</span>
              <kbd className="rounded-[6px] border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-micro text-fg-muted">
                {shortcut}
              </kbd>
            </button>
            <IconButton
              label={`Search (${shortcut})`}
              icon={<Search />}
              onClick={() => setSearchOpen(true)}
              aria-haspopup="dialog"
              className="hidden md:inline-flex xl:hidden"
            />

            <IconButton
              label="Random pick"
              icon={<Shuffle />}
              onClick={() => setDiceOpen(true)}
              className="hidden lg:inline-flex"
            />

            <IconButton
              label={unread > 0 ? `Community chat, ${unread} unread` : 'Community chat'}
              icon={<MessageSquare />}
              badge={chatOpen ? 0 : unread}
              pressed={chatOpen}
              onClick={toggleChat}
              aria-controls="chat-panel"
            />

            {signedIn ? (
              <IconButton
                href="/watchlist"
                label={shownCount ? `Watchlist, ${shownCount} items` : 'Watchlist'}
                icon={<Bookmark />}
                badge={shownCount}
                className="hidden md:inline-flex"
              />
            ) : (
              <IconButton
                label="Watchlist (sign in required)"
                icon={<Bookmark />}
                onClick={() => openAuth('login')}
                className="hidden md:inline-flex"
              />
            )}

            {signedIn ? (
              <UserMenu onLoginClick={() => openAuth('login')} />
            ) : (
              <Button size="sm" onClick={() => openAuth('login')} className="ml-1 h-10">
                Sign in
              </Button>
            )}
          </div>
        </div>
      </header>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <AuthModal open={authOpen} onClose={closeAuth} defaultTab={authTab} />
      <DiceRollModal open={diceOpen} onClose={() => setDiceOpen(false)} />
    </>
  );
}
