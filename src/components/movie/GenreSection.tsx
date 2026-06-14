'use client';

import Link from 'next/link';
import { GENRES } from '@/types/tmdb';

const GENRE_COLORS: Record<number, string> = {
  28: '#ef4444',   // Action
  12: '#f97316',   // Adventure
  16: '#8b5cf6',   // Animation
  35: '#eab308',   // Comedy
  80: '#6366f1',   // Crime
  99: '#06b6d4',   // Documentary
  18: '#3b82f6',   // Drama
  10751: '#22c55e', // Family
  14: '#a855f7',   // Fantasy
  36: '#d97706',   // History
  27: '#dc2626',   // Horror
  10402: '#ec4899', // Music
  9648: '#7c3aed', // Mystery
  10749: '#f43f5e', // Romance
  878: '#0ea5e9',  // Sci-Fi
  53: '#64748b',   // Thriller
  10752: '#78716c', // War
  37: '#92400e',   // Western
};

const GENRE_EMOJIS: Record<number, string> = {
  28: '💥', 12: '🗺️', 16: '🎨', 35: '😂', 80: '🔫', 99: '🎥',
  18: '🎭', 10751: '👨‍👩‍👧', 14: '🧙', 36: '📜', 27: '👻', 10402: '🎵',
  9648: '🔍', 10749: '💕', 878: '🚀', 53: '😰', 10752: '⚔️', 37: '🤠',
};

export function GenreSection() {
  const displayGenres = GENRES.filter((g) => g.id !== 10770);

  return (
    <section className="py-10 px-4 md:px-8">
      <h2 className="text-xl font-bold text-[var(--text-primary)] mb-5">Browse by Genre</h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-3">
        {displayGenres.map((genre) => {
          const color = GENRE_COLORS[genre.id] ?? '#7c3aed';
          return (
            <Link
              key={genre.id}
              href={`/genre/${genre.id}?name=${encodeURIComponent(genre.name)}`}
              className="group flex flex-col items-center gap-2 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] hover:border-opacity-60 transition-all hover:scale-105 active:scale-100"
              style={{ '--hover-color': color } as React.CSSProperties}
            >
              <span className="text-2xl">{GENRE_EMOJIS[genre.id] ?? '🎬'}</span>
              <span
                className="text-xs font-medium text-center leading-tight"
                style={{ color }}
              >
                {genre.name}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
