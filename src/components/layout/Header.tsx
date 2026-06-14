'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Search, Bookmark, X, Menu, Film, Tv, TrendingUp,
  Star, Home, SlidersHorizontal, Compass, Users, Shuffle,
} from 'lucide-react';
import { useUIStore, useWatchlistStore } from '@/store';
import { useFilterStore } from '@/store/filterStore';
import { useAuthStore } from '@/store/authStore';
import { UserMenu } from '@/components/auth/UserMenu';
import { AuthModal } from '@/components/auth/AuthModal';
import { DiceRollModal } from '@/components/movie/DiceRollModal';

const NAV_LINKS = [
  { href: '/',           label: 'Home',      icon: Home },
  { href: '/trending',   label: 'Trending',  icon: TrendingUp },
  { href: '/discover',   label: 'Discover',  icon: Compass },
  { href: '/movies',     label: 'Movies',    icon: Film },
  { href: '/tv',         label: 'TV Shows',  icon: Tv },
  { href: '/top-rated',  label: 'Top Rated', icon: Star },
  { href: '/following',  label: 'Following', icon: Users },
];

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [query, setQuery] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const [diceOpen, setDiceOpen] = useState(false);
  const [diceSpinning, setDiceSpinning] = useState(false);
  const { searchOpen, setSearchOpen, mobileMenuOpen, setMobileMenuOpen } = useUIStore();
  const watchlistItems = useWatchlistStore((s) => s.getActiveItems());
  const { toggleSidebar } = useFilterStore();
  const { user } = useAuthStore();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Global auth event from any page
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      openAuth(detail?.tab ?? 'login');
    };
    window.addEventListener('movieverse:openAuth', handler);
    return () => window.removeEventListener('movieverse:openAuth', handler);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setSearchOpen(false);
  }, [pathname, setMobileMenuOpen, setSearchOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setSearchOpen(false);
      setQuery('');
    }
  };

  const openAuth = (tab: 'login' | 'signup' = 'login') => {
    setAuthTab(tab);
    setAuthOpen(true);
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'glass border-b border-[var(--border)]' : 'bg-gradient-to-b from-black/60 to-transparent'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-4 md:px-6 gap-3">
          {/* Sidebar toggle + Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              aria-label="Toggle sidebar"
            >
              <SlidersHorizontal size={18} />
            </button>
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--accent-primary)]">
                <Film size={16} className="text-white" />
              </div>
              <span className="font-bold text-base gradient-text hidden sm:block">MovieVerse</span>
            </Link>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  pathname === href
                    ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Dice Roll */}
            <button
              onClick={() => {
                setDiceSpinning(true);
                setTimeout(() => setDiceSpinning(false), 600);
                setDiceOpen(true);
              }}
              title="Random pick"
              aria-label="Random movie or show"
              className="relative p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 transition-colors group"
            >
              <Shuffle
                size={19}
                style={{ transition: 'transform 0.1s', transform: diceSpinning ? 'rotate(20deg) scale(1.2)' : 'none' }}
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--accent-primary)] opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            {searchOpen ? (
              <form onSubmit={handleSearch} className="flex items-center">
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search movies, TV, people..."
                  className="w-48 sm:w-64 bg-[var(--bg-card)] border border-[var(--border-active)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                />
                <button type="button" onClick={() => setSearchOpen(false)} className="ml-1.5 p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  <X size={16} />
                </button>
              </form>
            ) : (
              <button onClick={() => setSearchOpen(true)} className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors" aria-label="Search">
                <Search size={19} />
              </button>
            )}

            {/* Watchlist — require login */}
            {user ? (
              <Link href="/watchlist" className="relative p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors" aria-label="Watchlist">
                <Bookmark size={19} />
                {watchlistItems.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[var(--accent-primary)] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {watchlistItems.length > 9 ? '9+' : watchlistItems.length}
                  </span>
                )}
              </Link>
            ) : (
              <button onClick={() => openAuth('login')} className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors" aria-label="Sign in to use watchlist">
                <Bookmark size={19} />
              </button>
            )}

            <UserMenu onLoginClick={() => openAuth('login')} />

            {/* Mobile menu */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden glass border-t border-[var(--border)] px-4 py-3 space-y-1">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${pathname === href ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                <Icon size={17} /> {label}
              </Link>
            ))}
            <form onSubmit={handleSearch} className="pt-2">
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search..." className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]" />
            </form>
          </div>
        )}
      </header>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} defaultTab={authTab} />
      <DiceRollModal open={diceOpen} onClose={() => setDiceOpen(false)} />
    </>
  );
}
