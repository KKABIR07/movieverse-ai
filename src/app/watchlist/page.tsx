'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  BookmarkX, Star, Calendar, ArrowRight, Share2, Check, Lock, LogIn,
  Plus, Pencil, Trash2, MoreHorizontal, X, List, Film,
} from 'lucide-react';
import { useWatchlistStore } from '@/store';
import type { WatchlistList } from '@/store';
import { useAuthStore } from '@/store/authStore';
import { tmdbImage, formatYear } from '@/lib/tmdb';
import type { WatchlistItem } from '@/types/tmdb';

// ── Share button ───────────────────────────────────────────────────────────────
function ShareButton({ list }: { list: WatchlistList }) {
  const { user } = useAuthStore();
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  const copyLink = async () => {
    const payload = { owner: user.name, items: list.items, listName: list.name };
    const encoded = encodeURIComponent(btoa(JSON.stringify(payload)));
    const link = `${window.location.origin}/watchlist/share?data=${encoded}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <button
      onClick={copyLink}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition-colors"
    >
      {copied ? <Check size={13} className="text-green-400" /> : <Share2 size={13} />}
      {copied ? 'Copied!' : 'Share'}
    </button>
  );
}

// ── Inline rename input ────────────────────────────────────────────────────────
function RenameInput({ value, onSave, onCancel }: { value: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);

  const commit = () => { if (draft.trim()) onSave(draft.trim()); else onCancel(); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') onCancel();
  };

  return (
    <input
      ref={ref}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKey}
      className="bg-transparent border-b border-[var(--accent-primary)] text-[var(--text-primary)] font-semibold text-sm outline-none px-0 min-w-0 w-full"
      maxLength={40}
    />
  );
}

// ── New list dialog ────────────────────────────────────────────────────────────
function NewListDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) onCreate(name.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">New Watchlist</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <input
            ref={ref}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Horror Favourites, Date Night…"
            maxLength={40}
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--accent-primary)] text-white font-semibold text-sm hover:bg-[var(--accent-secondary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── List card in the sidebar ───────────────────────────────────────────────────
function ListCard({
  list,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  list: WatchlistList;
  active: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing]   = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const preview = list.items.slice(0, 3);

  return (
    <div
      onClick={() => { if (!editing) onSelect(); }}
      className={`relative group cursor-pointer rounded-2xl p-4 border transition-all ${
        active
          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/8 shadow-[0_0_0_1px_var(--accent-primary)]'
          : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent-primary)]/40 hover:bg-[var(--bg-hover)]'
      }`}
    >
      {/* Poster strip preview */}
      {preview.length > 0 && (
        <div className="flex gap-1.5 mb-3">
          {preview.map((item) => (
            <div key={item.id} className="relative flex-1 aspect-[2/3] rounded-lg overflow-hidden bg-[var(--bg-secondary)] max-w-[56px]">
              <Image src={tmdbImage(item.poster_path, 'w92')} alt={item.title} fill className="object-cover" sizes="56px" />
            </div>
          ))}
          {list.items.length > 3 && (
            <div className="relative flex-1 aspect-[2/3] rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center max-w-[56px]">
              <span className="text-xs font-bold text-[var(--text-muted)]">+{list.items.length - 3}</span>
            </div>
          )}
          {preview.length < 3 && Array.from({ length: 3 - preview.length }).map((_, i) => (
            <div key={i} className="relative flex-1 aspect-[2/3] rounded-lg bg-[var(--bg-secondary)] max-w-[56px]" />
          ))}
        </div>
      )}

      {preview.length === 0 && (
        <div className="flex items-center justify-center h-20 mb-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] border-dashed">
          <Film size={22} className="text-[var(--text-muted)]" />
        </div>
      )}

      <div className="flex items-center gap-2 min-w-0">
        {editing ? (
          <RenameInput
            value={list.name}
            onSave={(v) => { onRename(v); setEditing(false); }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <span className="font-semibold text-sm text-[var(--text-primary)] truncate flex-1">{list.name}</span>
        )}

        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
            className={`p-1 rounded-md transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] ${
              menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            <MoreHorizontal size={15} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 w-40 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden">
              <button
                onClick={(e) => { e.stopPropagation(); setEditing(true); setMenuOpen(false); }}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Pencil size={14} /> Rename
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(); }}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-red-400 hover:bg-red-400/10 transition-colors"
              >
                <Trash2 size={14} /> Delete List
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-[var(--text-muted)] mt-1">
        {list.items.length} {list.items.length === 1 ? 'title' : 'titles'}
      </p>

      {active && (
        <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[var(--accent-primary)]" />
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function WatchlistPage() {
  const {
    lists, activeListId,
    createList, renameList, deleteList, setActiveList, removeFromList,
  } = useWatchlistStore();
  const { user } = useAuthStore();

  const [showNew, setShowNew]       = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const openAuth = () =>
    window.dispatchEvent(new CustomEvent('mkmovies:openAuth', { detail: { tab: 'login' } }));

  if (!user) {
    return (
      <div className="container mx-auto px-4 md:px-8 py-24 min-h-screen flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 flex items-center justify-center mx-auto mb-5">
          <Lock size={30} className="text-[var(--accent-primary)]" />
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Sign in to use Watchlists</h1>
        <p className="text-[var(--text-muted)] max-w-sm mb-6">
          Create a free account to build multiple watchlists, name them, and share them with friends.
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

  const activeList = lists.find((l) => l.id === activeListId) ?? lists[0];

  const handleCreate = (name: string) => {
    createList(name);
    setShowNew(false);
  };

  const handleDelete = (listId: string) => {
    if (lists.length === 1) {
      // Just clear it instead of deleting the only list
      deleteList(listId);
    } else {
      deleteList(listId);
    }
    setDeleteConfirm(null);
  };

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="container mx-auto px-4 md:px-8">

        {/* Page header */}
        <div className="flex items-center justify-between mb-8 mt-4">
          <div>
            <h1 className="text-3xl font-black text-[var(--text-primary)] flex items-center gap-3">
              <List size={28} className="text-[var(--accent-primary)]" />
              My Watchlists
            </h1>
            <p className="text-[var(--text-muted)] mt-1 text-sm">
              {lists.length} {lists.length === 1 ? 'list' : 'lists'} ·{' '}
              {lists.reduce((sum, l) => sum + l.items.length, 0)} total titles
            </p>
          </div>

          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent-primary)] text-white font-semibold text-sm hover:bg-[var(--accent-secondary)] transition-all hover:shadow-[0_0_16px_rgba(124,58,237,0.4)] active:scale-95"
          >
            <Plus size={16} /> New List
          </button>
        </div>

        {/* Two-panel layout */}
        <div className="flex gap-6 items-start">

          {/* ── Left: list cards ── */}
          <div className="w-72 flex-shrink-0 space-y-3">
            {lists.map((list) => (
              <ListCard
                key={list.id}
                list={list}
                active={list.id === activeListId}
                onSelect={() => setActiveList(list.id)}
                onRename={(name) => renameList(list.id, name)}
                onDelete={() => setDeleteConfirm(list.id)}
              />
            ))}

            <button
              onClick={() => setShowNew(true)}
              className="w-full rounded-2xl border border-[var(--border)] border-dashed py-5 flex flex-col items-center gap-2 text-[var(--text-muted)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition-colors group"
            >
              <Plus size={20} className="group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium">New Watchlist</span>
            </button>
          </div>

          {/* ── Right: active list items ── */}
          <div className="flex-1 min-w-0">
            {activeList ? (
              <>
                {/* Active list header */}
                <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <h2 className="text-xl font-bold text-[var(--text-primary)] truncate">{activeList.name}</h2>
                    <span className="text-sm text-[var(--text-muted)] flex-shrink-0">
                      {activeList.items.length} {activeList.items.length === 1 ? 'title' : 'titles'}
                    </span>
                  </div>
                  <ShareButton list={activeList} />
                </div>

                {activeList.items.length === 0 ? (
                  <div className="glass rounded-2xl py-20 flex flex-col items-center justify-center text-center">
                    <div className="text-5xl mb-4">🎬</div>
                    <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">This list is empty</h3>
                    <p className="text-[var(--text-muted)] text-sm max-w-xs mb-6">
                      Browse movies and TV shows and bookmark them — they'll appear here.
                    </p>
                    <Link
                      href="/"
                      className="flex items-center gap-2 px-5 py-2.5 bg-[var(--accent-primary)] text-white font-semibold rounded-xl hover:bg-[var(--accent-secondary)] transition-colors text-sm"
                    >
                      Discover Movies <ArrowRight size={16} />
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeList.items.map((item, index) => (
                      <WatchlistRow
                        key={item.id}
                        item={item}
                        index={index}
                        listId={activeList.id}
                        onRemove={() => removeFromList(activeList.id, item.id)}
                        lists={lists}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="glass rounded-2xl py-20 flex flex-col items-center justify-center text-center">
                <p className="text-[var(--text-muted)]">Select a list to see its contents</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Dialogs ── */}
      {showNew && <NewListDialog onClose={() => setShowNew(false)} onCreate={handleCreate} />}

      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteConfirm(null); }}
        >
          <div className="glass rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">Delete List?</h3>
            <p className="text-sm text-[var(--text-muted)] mb-5">
              {lists.length === 1
                ? 'This will clear all items in your last list.'
                : `"${lists.find((l) => l.id === deleteConfirm)?.name}" and all its items will be permanently removed.`}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition-colors"
              >
                {lists.length === 1 ? 'Clear List' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Watchlist item row ─────────────────────────────────────────────────────────
function WatchlistRow({
  item,
  index,
  onRemove,
  lists,
  listId,
}: {
  item: WatchlistItem;
  index: number;
  listId: string;
  onRemove: () => void;
  lists: WatchlistList[];
}) {
  const { addToList, hasInAny, removeFromList } = useWatchlistStore();
  const [copyMenu, setCopyMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!copyMenu) return;
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setCopyMenu(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [copyMenu]);

  const otherLists = lists.filter((l) => l.id !== listId);

  return (
    <div className="glass rounded-2xl p-4 flex items-center gap-4 group hover:border-[var(--accent-primary)]/20 transition-all border border-transparent">
      <span className="hidden sm:flex w-7 items-center justify-center text-sm font-bold text-[var(--text-muted)] flex-shrink-0">
        {index + 1}
      </span>

      <Link href={`/${item.media_type}/${item.id}`} className="flex-shrink-0">
        <div className="relative w-11 h-[66px] rounded-lg overflow-hidden ring-1 ring-white/10 hover:ring-[var(--accent-primary)]/50 transition-all">
          <Image src={tmdbImage(item.poster_path, 'w92')} alt={item.title} fill className="object-cover" sizes="44px" />
        </div>
      </Link>

      <div className="flex-1 min-w-0">
        <Link href={`/${item.media_type}/${item.id}`}>
          <h3 className="font-semibold text-[var(--text-primary)] line-clamp-1 hover:text-[var(--accent-primary)] transition-colors text-sm">
            {item.title}
          </h3>
        </Link>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className="flex items-center gap-1 text-xs text-[var(--accent-gold)] font-medium">
            <Star size={10} className="fill-current" />{item.vote_average.toFixed(1)}
          </span>
          <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
            <Calendar size={10} />{formatYear(item.release_date)}
          </span>
          <span className="text-xs text-[var(--text-muted)] capitalize px-1.5 py-0.5 rounded-full bg-[var(--bg-hover)] border border-[var(--border)]">
            {item.media_type}
          </span>
        </div>
      </div>

      <div className="hidden md:block text-xs text-[var(--text-muted)] flex-shrink-0">
        {new Date(item.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </div>

      {/* Copy to another list */}
      {otherLists.length > 0 && (
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            onClick={() => setCopyMenu((o) => !o)}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg transition-all opacity-0 group-hover:opacity-100"
            title="Copy to another list"
          >
            <Plus size={15} />
          </button>
          {copyMenu && (
            <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden">
              <p className="px-3 py-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold border-b border-[var(--border)]">
                Copy to list
              </p>
              {otherLists.map((l) => {
                const already = l.items.some((i) => i.id === item.id);
                return (
                  <button
                    key={l.id}
                    onClick={() => { if (!already) addToList(l.id, item); setCopyMenu(false); }}
                    disabled={already}
                    className="flex items-center justify-between gap-2 w-full px-3 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className="truncate">{l.name}</span>
                    {already ? <Check size={13} className="text-green-400 flex-shrink-0" /> : <Plus size={13} className="flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <button
        onClick={onRemove}
        className="p-2 text-[var(--text-muted)] hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all flex-shrink-0"
        aria-label="Remove"
      >
        <BookmarkX size={16} />
      </button>
    </div>
  );
}
