'use client';

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  BookmarkCheck, Users, Star, Rss,
  LogIn, Share2, Check, Copy, ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useFollowingStore } from '@/store/followingStore';
import { useWatchlistStore } from '@/store';

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  icon, value, label, href,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  href?: string;
}) {
  const inner = (
    <div className="glass rounded-2xl px-5 py-4 flex items-center gap-3 border border-[var(--border)] hover:border-[var(--accent-primary)]/40 transition-all group">
      <span className="text-[var(--accent-primary)] group-hover:scale-110 transition-transform">{icon}</span>
      <div>
        <p className="text-2xl font-black text-[var(--text-primary)] leading-none">{value}</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5 font-medium">{label}</p>
      </div>
      {href && <ChevronRight size={14} className="ml-auto text-[var(--text-muted)] group-hover:text-[var(--accent-primary)] transition-colors" />}
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : <div>{inner}</div>;
}

// ── Share profile button ───────────────────────────────────────────────────────
function ShareProfile() {
  const { user } = useAuthStore();
  const { following } = useFollowingStore();
  const { lists } = useWatchlistStore();
  const [copied, setCopied] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [cardStyle, setCardStyle] = useState({ top: 80, right: 16 });
  const btnRef = useRef<HTMLButtonElement>(null);

  if (!user) return null;

  const totalItems = lists.reduce((s, l) => s + l.items.length, 0);
  const topList    = lists[0];

  const shareText = [
    `🎬 ${user.name}'s MovieVerse Profile`,
    `📚 ${lists.length} watchlist${lists.length !== 1 ? 's' : ''} · ${totalItems} saved title${totalItems !== 1 ? 's' : ''}`,
    `👥 Following ${following.length} star${following.length !== 1 ? 's' : ''}`,
    topList?.items[0] ? `❤️ Currently watching: ${topList.items[0].title}` : '',
    `\n${window?.location?.origin ?? ''}/watchlist`,
  ].filter(Boolean).join('\n');

  const copy = async () => {
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleToggle = () => {
    if (!showCard && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setCardStyle({
        top: Math.round(rect.bottom + 8),
        right: Math.round(window.innerWidth - rect.right),
      });
    }
    setShowCard((v) => !v);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-hover)] hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/8 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
      >
        <Share2 size={15} />
        Share Profile
      </button>

      {showCard && typeof document !== 'undefined' && createPortal(
        <>
          {/* Click-outside backdrop */}
          <div className="fixed inset-0 z-[199]" onClick={() => setShowCard(false)} />

          {/* Floating card */}
          <div
            className="fixed z-[200] w-72 glass rounded-2xl border border-[var(--border)] shadow-[0_24px_64px_rgba(0,0,0,0.7)] p-4 space-y-3"
            style={{ top: cardStyle.top, right: cardStyle.right }}
          >
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Your Profile Card</p>

            {/* Preview card */}
            <div className="rounded-xl bg-[var(--bg-secondary)] p-3 space-y-1.5 border border-[var(--border)]">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' }}
                >
                  {user.initials}
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{user.name}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">MovieVerse Member</p>
                </div>
              </div>
              <div className="flex gap-3 pt-1 text-xs text-[var(--text-muted)]">
                <span>📚 {totalItems} titles</span>
                <span>👥 {following.length} following</span>
                <span>🗂 {lists.length} lists</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={copy}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[var(--accent-primary)] text-white text-xs font-semibold hover:bg-[var(--accent-secondary)] transition-colors"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Copied!' : 'Copy Card'}
              </button>
              <button
                onClick={() => setShowCard(false)}
                className="px-3 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user } = useAuthStore();
  const { following } = useFollowingStore();
  const { lists } = useWatchlistStore();

  const openAuth = () =>
    window.dispatchEvent(new CustomEvent('movieverse:openAuth', { detail: { tab: 'login' } }));

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 pt-20">
        <div className="w-16 h-16 rounded-2xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 flex items-center justify-center mb-5">
          <Star size={30} className="text-[var(--accent-primary)]" />
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Sign in to view your profile</h1>
        <p className="text-[var(--text-muted)] max-w-sm mb-6">
          Track your watchlists, follow your favourite stars, and see their latest work.
        </p>
        <button
          onClick={openAuth}
          className="flex items-center gap-2 px-6 py-3 bg-[var(--accent-primary)] text-white font-semibold rounded-xl hover:bg-[var(--accent-secondary)] transition-colors"
        >
          <LogIn size={18} /> Sign In Free
        </button>
      </div>
    );
  }

  const totalItems = lists.reduce((s, l) => s + l.items.length, 0);

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="container mx-auto px-4 md:px-8 max-w-2xl">
        <div className="mt-6 space-y-6">

          {/* ── Profile card ── */}
          <div className="glass rounded-3xl p-6 md:p-8">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black text-white flex-shrink-0 shadow-[0_8px_24px_rgba(124,58,237,0.4)]"
                  style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' }}
                >
                  {user.initials}
                </div>
                <div>
                  <h1 className="text-xl font-black text-[var(--text-primary)]">{user.name}</h1>
                  <p className="text-sm text-[var(--text-muted)]">{user.email}</p>
                  {user.joinedAt && (
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Member since {new Date(user.joinedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </p>
                  )}
                </div>
              </div>
              <ShareProfile />
            </div>
          </div>

          {/* ── Stats ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard icon={<BookmarkCheck size={18} />} value={totalItems}      label="Saved Titles"  href="/watchlist" />
            <StatCard icon={<Users size={18} />}         value={following.length} label="Following"     href="/following" />
            <StatCard icon={<Star size={18} />}          value={lists.length}     label="Watchlists"    href="/watchlist" />
          </div>

          {/* ── Quick nav ── */}
          <div className="glass rounded-2xl divide-y divide-[var(--border)] overflow-hidden">
            {[
              { href: '/stars',     icon: <Star size={16} className="text-amber-400" />,   label: 'Trending Stars',  desc: 'Discover actors & directors' },
              { href: '/following', icon: <Users size={16} className="text-violet-400" />, label: 'Following',       desc: `${following.length} people` },
              { href: '/feed',      icon: <Rss size={16} className="text-green-400" />,    label: 'My Feed',         desc: 'Latest from who you follow' },
              { href: '/watchlist', icon: <BookmarkCheck size={16} className="text-[var(--accent-primary)]" />, label: 'My Watchlists', desc: `${lists.length} lists · ${totalItems} titles` },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-[var(--bg-hover)] transition-colors group"
              >
                <span className="flex-shrink-0">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">{item.label}</p>
                  <p className="text-xs text-[var(--text-muted)]">{item.desc}</p>
                </div>
                <ChevronRight size={14} className="text-[var(--text-muted)] group-hover:text-[var(--accent-primary)] transition-colors flex-shrink-0" />
              </Link>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
