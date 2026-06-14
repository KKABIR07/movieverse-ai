'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { X, Shuffle, Star, Bookmark, ExternalLink, Loader2 } from 'lucide-react';
import { tmdb, tmdbImage, formatYear } from '@/lib/tmdb';
import { useWatchlistStore } from '@/store';
import { useAuthStore } from '@/store/authStore';

type RollType = 'movie' | 'tv';

interface RollResult {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  vote_average: number;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  _type: RollType;
}

const ROLL_TYPES: RollType[] = ['movie', 'movie', 'movie', 'tv', 'tv', 'movie', 'tv', 'movie'];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function DiceRollModal({ open, onClose }: Props) {
  const [result, setResult] = useState<RollResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const { add, has } = useWatchlistStore();
  const { user } = useAuthStore();
  const [saved, setSaved] = useState(false);

  const roll = useCallback(async () => {
    setLoading(true);
    setSpinning(true);
    setResult(null);
    setSaved(false);

    const type = ROLL_TYPES[Math.floor(Math.random() * ROLL_TYPES.length)];
    const page = Math.floor(Math.random() * 8) + 1;

    try {
      if (type === 'movie') {
        const data = await tmdb.movie.popular(page);
        const items = data.results.filter((m) => m.poster_path && m.vote_average > 5);
        if (items.length > 0) {
          const picked = items[Math.floor(Math.random() * items.length)];
          setResult({ ...picked, _type: 'movie' });
        }
      } else {
        const data = await tmdb.tv.popular(page);
        const items = data.results.filter((t) => t.poster_path && t.vote_average > 5);
        if (items.length > 0) {
          const picked = items[Math.floor(Math.random() * items.length)];
          setResult({
            id: picked.id,
            title: picked.name,
            poster_path: picked.poster_path,
            backdrop_path: picked.backdrop_path,
            vote_average: picked.vote_average,
            overview: picked.overview,
            first_air_date: picked.first_air_date,
            _type: 'tv',
          });
        }
      }
    } catch {
      // silently fail — user can roll again
    }

    setLoading(false);
    setTimeout(() => setSpinning(false), 400);
  }, []);

  useEffect(() => {
    if (open) roll();
  }, [open]); // eslint-disable-line

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const year = result?.release_date
    ? formatYear(result.release_date)
    : result?.first_air_date
    ? formatYear(result.first_air_date)
    : null;

  const detailHref = result ? `/${result._type}/${result.id}` : '#';

  const handleSave = () => {
    if (!result || !user) {
      window.dispatchEvent(new CustomEvent('movieverse:openAuth', { detail: { tab: 'login' } }));
      return;
    }
    add({
      id: result.id,
      title: result.title,
      poster_path: result.poster_path,
      vote_average: result.vote_average,
      release_date: result.release_date ?? result.first_air_date ?? '',
      media_type: result._type,
    });
    setSaved(true);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <style>{`
        @keyframes mv-dice-spin {
          0%   { transform: rotate(0deg) scale(1); }
          25%  { transform: rotate(180deg) scale(1.3); }
          50%  { transform: rotate(360deg) scale(1); }
          75%  { transform: rotate(540deg) scale(0.8); }
          100% { transform: rotate(720deg) scale(1); }
        }
        @keyframes mv-dice-result {
          from { opacity: 0; transform: translateY(12px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-sm glass rounded-3xl border border-[var(--border)] shadow-[0_32px_80px_rgba(0,0,0,0.8)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl bg-[var(--accent-primary)]/20 border border-[var(--accent-primary)]/30 flex items-center justify-center"
              style={{ animation: spinning ? 'mv-dice-spin 0.6s ease-out' : 'none' }}
            >
              <Shuffle size={16} className="text-[var(--accent-primary)]" />
            </div>
            <div>
              <p className="text-sm font-black text-[var(--text-primary)]">Random Pick</p>
              <p className="text-[10px] text-[var(--text-muted)]">What should I watch next?</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 pb-5 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div
                style={{ animation: 'mv-dice-spin 0.8s ease-out infinite' }}
                className="w-10 h-10 rounded-xl bg-[var(--accent-primary)]/20 flex items-center justify-center"
              >
                <Shuffle size={20} className="text-[var(--accent-primary)]" />
              </div>
              <p className="text-sm text-[var(--text-muted)]">Rolling the dice…</p>
            </div>
          ) : result ? (
            <div style={{ animation: 'mv-dice-result 0.3s ease-out' }}>
              {/* Poster + info row */}
              <div className="flex gap-4">
                <div className="flex-shrink-0 relative rounded-xl overflow-hidden shadow-lg" style={{ width: 90, height: 134 }}>
                  {result.poster_path ? (
                    <Image
                      src={tmdbImage(result.poster_path, 'w185')}
                      alt={result.title}
                      fill
                      className="object-cover"
                      sizes="90px"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[var(--bg-card)] flex items-center justify-center text-2xl">🎬</div>
                  )}
                  {/* Type badge */}
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase bg-black/70 backdrop-blur-sm text-white">
                    {result._type === 'tv' ? 'TV' : 'Movie'}
                  </div>
                </div>

                <div className="flex-1 min-w-0 pt-1 space-y-1.5">
                  <h3 className="text-base font-black text-[var(--text-primary)] leading-tight line-clamp-2">
                    {result.title}
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <Star size={11} className="text-amber-400 fill-current" />
                      <span className="text-xs font-bold text-amber-300">{result.vote_average.toFixed(1)}</span>
                    </div>
                    {year && <span className="text-xs text-[var(--text-muted)]">{year}</span>}
                  </div>
                  {result.overview && (
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-4">
                      {result.overview}
                    </p>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={roll}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-hover)] text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)]/50 transition-all"
                >
                  <Shuffle size={14} />
                  Roll Again
                </button>
                <button
                  onClick={handleSave}
                  disabled={saved || has(result.id)}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                    saved || has(result.id)
                      ? 'border-green-500/40 bg-green-500/10 text-green-400'
                      : 'border-[var(--border)] bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)]/50'
                  }`}
                >
                  <Bookmark size={14} className={saved || has(result.id) ? 'fill-current' : ''} />
                  {saved || has(result.id) ? 'Saved' : 'Save'}
                </button>
                <Link
                  href={detailHref}
                  onClick={onClose}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[var(--accent-primary)] text-white text-sm font-semibold hover:bg-[var(--accent-secondary)] transition-colors"
                >
                  <ExternalLink size={14} />
                  View
                </Link>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-[var(--text-muted)] text-sm">
              Could not load a suggestion. Try rolling again.
              <button onClick={roll} className="block mx-auto mt-3 text-[var(--accent-primary)] hover:underline">
                Roll Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
