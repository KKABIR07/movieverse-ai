'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Bookmark, LogOut, MessageSquare, Rss, Star, User, Users } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { useFollowingStore } from '@/store/followingStore';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';

interface UserMenuProps {
  /** Called by the signed-out state's "Sign in" button. */
  onLoginClick: () => void;
}

const itemBase =
  'flex w-full min-h-11 items-center gap-3 rounded-chip px-3 text-left text-caption outline-none hover:bg-surface-3 focus-visible:bg-surface-3';
const itemClass = `${itemBase} text-fg-secondary hover:text-fg focus-visible:text-fg`;

/**
 * Avatar button + account menu (ARIA menu button pattern: Enter/Space/↓ open,
 * ↑ ↓ Home End move, Esc closes and returns focus). Renders a "Sign in" button
 * when signed out.
 */
export function UserMenu({ onLoginClick }: UserMenuProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setChatOpen = useChatStore((s) => s.setChatOpen);
  const followingCount = useFollowingStore((s) => s.following.length);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    const raf = requestAnimationFrame(() => menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
    return () => {
      document.removeEventListener('mousedown', onDown);
      cancelAnimationFrame(raf);
    };
  }, [open]);

  if (!user) {
    return (
      <Button onClick={onLoginClick}>
        Sign in
      </Button>
    );
  }

  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const idx = items.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (e.key === 'ArrowDown') next = (idx + 1) % items.length;
    else if (e.key === 'ArrowUp') next = (idx - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    else if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    } else if (e.key === 'Tab') {
      setOpen(false);
      return;
    }
    if (next >= 0) {
      e.preventDefault();
      items[next]?.focus();
    }
  };

  return (
    <div ref={wrapRef} className="relative ml-1">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Account menu for ${user.name}`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="grid size-11 place-items-center rounded-full"
      >
        <span className="grid size-9 place-items-center rounded-full bg-surface-3 text-caption font-semibold text-fg ring-1 ring-line-strong">
          {user.initials}
        </span>
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKey}
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-card border border-line bg-surface-2 p-1.5 shadow-pop animate-rise-in"
        >
          <div className="px-3 py-2.5" role="none">
            <p className="truncate text-caption font-semibold text-fg">{user.name}</p>
            <p className="truncate text-micro text-fg-muted">{user.email}</p>
          </div>
          <div className="my-1 h-px bg-line" role="separator" />
          <Link role="menuitem" tabIndex={-1} href="/watchlist" onClick={() => close(false)} className={itemClass}>
            <Bookmark aria-hidden className="size-4" /> Watchlist
          </Link>
          <Link role="menuitem" tabIndex={-1} href="/profile" onClick={() => close(false)} className={itemClass}>
            <User aria-hidden className="size-4" /> Profile
          </Link>
          <Link role="menuitem" tabIndex={-1} href="/following" onClick={() => close(false)} className={itemClass}>
            <Users aria-hidden className="size-4" />
            <span className="flex-1">Following</span>
            {followingCount > 0 && <span className="tabular text-micro text-fg-muted">{followingCount}</span>}
          </Link>
          <Link role="menuitem" tabIndex={-1} href="/feed" onClick={() => close(false)} className={itemClass}>
            <Rss aria-hidden className="size-4" /> Feed
          </Link>
          <Link role="menuitem" tabIndex={-1} href="/stars" onClick={() => close(false)} className={itemClass}>
            <Star aria-hidden className="size-4" /> People
          </Link>
          <button
            role="menuitem"
            tabIndex={-1}
            type="button"
            onClick={() => {
              setChatOpen(true);
              close(false);
            }}
            className={itemClass}
          >
            <MessageSquare aria-hidden className="size-4" /> Community chat
          </button>
          <div className="my-1 h-px bg-line" role="separator" />
          <button
            role="menuitem"
            tabIndex={-1}
            type="button"
            onClick={async () => {
              close(false);
              await logout();
            }}
            className={cn(itemBase, 'text-danger')}
          >
            <LogOut aria-hidden className="size-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
