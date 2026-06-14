'use client';

import { useState, useRef, useEffect } from 'react';
import { LogOut, Bookmark, User, ChevronDown, MessageSquare, Star, Users, Rss, MonitorPlay } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { useFollowingStore } from '@/store/followingStore';

interface UserMenuProps {
  onLoginClick: () => void;
}

export function UserMenu({ onLoginClick }: UserMenuProps) {
  const { user, logout } = useAuthStore();
  const { toggleChat } = useChatStore();
  const { following } = useFollowingStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!user) {
    return (
      <button
        onClick={onLoginClick}
        className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-white text-sm font-semibold transition-colors"
      >
        Sign In
      </button>
    );
  }

  const close = () => setOpen(false);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 p-1 rounded-xl hover:bg-[var(--bg-hover)] transition-colors"
        aria-label="User menu"
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' }}
        >
          {user.initials}
        </div>
        <ChevronDown
          size={14}
          className={`text-[var(--text-muted)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 glass rounded-xl border border-[var(--border)] shadow-[0_16px_48px_rgba(0,0,0,0.6)] overflow-hidden z-50">

          {/* User info */}
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{user.name}</p>
            <p className="text-xs text-[var(--text-muted)] truncate">{user.email}</p>
          </div>

          {/* Stars · Following · Feed */}
          <div className="px-3 py-2.5 border-b border-[var(--border)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2 px-1">Discover</p>
            <div className="flex gap-1.5">
              <Link
                href="/stars"
                onClick={close}
                className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--accent-primary)]/15 hover:border-[var(--accent-primary)]/30 border border-transparent transition-all group"
              >
                <Star size={15} className="text-amber-400 group-hover:text-amber-300 transition-colors" />
                <span className="text-[10px] font-semibold text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors">Stars</span>
              </Link>
              <Link
                href="/following"
                onClick={close}
                className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--accent-primary)]/15 hover:border-[var(--accent-primary)]/30 border border-transparent transition-all group relative"
              >
                <Users size={15} className="text-violet-400 group-hover:text-violet-300 transition-colors" />
                <span className="text-[10px] font-semibold text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors">Following</span>
                {following.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--accent-primary)] text-[9px] font-black text-white flex items-center justify-center">
                    {following.length > 9 ? '9+' : following.length}
                  </span>
                )}
              </Link>
              <Link
                href="/feed"
                onClick={close}
                className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--accent-primary)]/15 hover:border-[var(--accent-primary)]/30 border border-transparent transition-all group"
              >
                <Rss size={15} className="text-green-400 group-hover:text-green-300 transition-colors" />
                <span className="text-[10px] font-semibold text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors">Feed</span>
              </Link>
            </div>
          </div>

          {/* Standard nav */}
          <div className="py-1">
            <Link
              href="/watchlist"
              onClick={close}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <Bookmark size={15} />
              My Watchlist
            </Link>
            <Link
              href="/profile"
              onClick={close}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <User size={15} />
              Profile
            </Link>
            <Link
              href="/shorts"
              onClick={close}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-red-500/10 hover:text-red-400 transition-colors group"
            >
              <MonitorPlay size={15} className="text-red-500 group-hover:text-red-400" />
              Movie Shorts
            </Link>
          </div>

          {/* Chat */}
          <div className="border-t border-[var(--border)] py-1">
            <button
              onClick={() => { toggleChat(); close(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:text-white hover:bg-[var(--accent-primary)]/20 transition-colors text-left group"
            >
              <MessageSquare size={15} className="text-violet-400 group-hover:text-violet-300 transition-colors" />
              Open Chat
            </button>
          </div>

          {/* Sign out */}
          <div className="border-t border-[var(--border)] py-1">
            <button
              onClick={async () => { await logout(); close(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-left"
            >
              <LogOut size={15} />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
