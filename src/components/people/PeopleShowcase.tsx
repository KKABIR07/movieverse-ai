'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Users, Clapperboard } from 'lucide-react';
import { tmdbImage } from '@/lib/tmdb';
import { useFollowingStore } from '@/store/followingStore';
import { FollowButton } from './FollowButton';
import type { Person } from '@/types/tmdb';

const SLIDE_DURATION = 5500;

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

// Stable particle data — generated once at module level
const PARTICLES = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  left: (i * 2.5) % 100,
  size: 1 + ((i * 7) % 4),
  delay: (i * 0.37) % 10,
  duration: 10 + ((i * 3) % 16),
  opacity: 0.3 + ((i * 11) % 7) * 0.1,
}));

type SlideDir = 'next' | 'prev';

interface Props {
  people: Person[];
}

export function PeopleShowcase({ people }: Props) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused]   = useState(false);
  const [dir, setDir]         = useState<SlideDir>('next');
  const [animKey, setAnimKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { counts, setCounts } = useFollowingStore();

  // Fetch follower counts for all people
  useEffect(() => {
    if (!people.length) return;
    const ids = people.map((p) => p.id).join(',');
    fetch(`/api/follows/counts?ids=${ids}`)
      .then((r) => r.json())
      .then(({ counts: c }) => { if (c) setCounts(c); })
      .catch(() => {});
  }, [people, setCounts]);

  const advance = useCallback(() => {
    setDir('next');
    setAnimKey((k) => k + 1);
    setCurrent((c) => (c + 1) % people.length);
  }, [people.length]);

  useEffect(() => {
    if (paused || !people.length) return;
    timerRef.current = setTimeout(advance, SLIDE_DURATION);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [current, paused, advance, people.length]);

  if (!people.length) return null;

  const person        = people[current];
  const knownFor      = person.known_for?.slice(0, 3) ?? [];
  const followerCount = counts[person.id] ?? Math.floor(person.popularity * 1000);
  const sidebarPeople = people.slice(0, 8);
  const dotPeople     = people.slice(0, 20);

  const go = (to: number, direction: SlideDir) => {
    setPaused(true);
    setDir(direction);
    setAnimKey((k) => k + 1);
    setCurrent(to);
  };

  const prev = () => go((current - 1 + people.length) % people.length, 'prev');
  const next = () => go((current + 1) % people.length, 'next');

  // Animation: portrait comes from opposite side, info comes from same side
  const portraitAnim = dir === 'next' ? 'mv-slide-from-right' : 'mv-slide-from-left';
  const infoAnim     = dir === 'next' ? 'mv-slide-from-right' : 'mv-slide-from-left';

  return (
    <section className="relative overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
      <style>{`
        @keyframes mv-people-prog {
          from { width: 0 }
          to   { width: 100% }
        }
        @keyframes mv-slide-from-right {
          from { opacity: 0; transform: translateX(48px) scale(0.97); }
          to   { opacity: 1; transform: translateX(0)   scale(1); }
        }
        @keyframes mv-slide-from-left {
          from { opacity: 0; transform: translateX(-48px) scale(0.97); }
          to   { opacity: 1; transform: translateX(0)    scale(1); }
        }
        @keyframes mv-star-float {
          0%   { transform: translateY(0) scale(1);   opacity: 0; }
          10%  { opacity: 1; }
          85%  { opacity: 0.5; }
          100% { transform: translateY(-110vh) scale(0.5); opacity: 0; }
        }
        @keyframes mv-star-twinkle {
          0%, 100% { opacity: 0.15; transform: scale(0.8); }
          50%      { opacity: 0.9;  transform: scale(1.3); }
        }
        @keyframes mv-nebula {
          0%   { transform: translate(-50%, -50%) scale(1)    rotate(0deg);   }
          50%  { transform: translate(-50%, -50%) scale(1.15) rotate(180deg); }
          100% { transform: translate(-50%, -50%) scale(1)    rotate(360deg); }
        }
      `}</style>

      {/* ── Particle background ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute rounded-full"
          style={{
            width: 700, height: 700,
            left: '15%', top: '50%',
            background: 'radial-gradient(circle, rgba(124,58,237,0.09) 0%, transparent 70%)',
            animation: 'mv-nebula 30s linear infinite',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 450, height: 450,
            left: '70%', top: '25%',
            background: 'radial-gradient(circle, rgba(168,85,247,0.07) 0%, transparent 70%)',
            animation: 'mv-nebula 22s linear infinite reverse',
          }}
        />
        {PARTICLES.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full bg-white"
            style={{
              left: `${p.left}%`, bottom: '-4px',
              width: p.size, height: p.size,
              opacity: p.opacity,
              animation: `mv-star-float ${p.duration}s ${p.delay}s ease-in infinite`,
            }}
          />
        ))}
        {PARTICLES.slice(0, 25).map((p) => (
          <div
            key={`tw-${p.id}`}
            className="absolute rounded-full bg-white"
            style={{
              left:   `${(p.left * 1.4) % 100}%`,
              top:    `${(p.id * 4.7) % 100}%`,
              width:  p.size * 0.6,
              height: p.size * 0.6,
              animation: `mv-star-twinkle ${3 + (p.id % 4)}s ${p.delay}s ease-in-out infinite`,
            }}
          />
        ))}
      </div>

      {/* Background blur from profile */}
      {person.profile_path && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <Image
            key={`bg-${person.id}`}
            src={tmdbImage(person.profile_path, 'w780')}
            alt=""
            fill
            className="object-cover object-top transition-opacity duration-700"
            style={{ filter: 'blur(60px) saturate(0.6)', opacity: 0.2, transform: 'scale(1.1)' }}
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-secondary)] via-[var(--bg-secondary)]/60 to-[var(--bg-secondary)]/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-secondary)]/60 to-transparent" />
        </div>
      )}

      <div className="relative z-10 container mx-auto px-4 md:px-8 py-14">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent-primary)]/20 border border-[var(--accent-primary)]/30 flex items-center justify-center">
              <Clapperboard size={17} className="text-[var(--accent-primary)]" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-[var(--text-primary)]">Trending Stars</h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{people.length} trending this week</p>
            </div>
          </div>
          <Link href="/stars" className="text-sm text-[var(--accent-primary)] hover:underline font-semibold">
            View All Stars →
          </Link>
        </div>

        {/* ── Main slide layout ── */}
        <div className="flex gap-8 lg:gap-16 items-center">

          {/* Portrait — bigger, with slide animation */}
          <div
            key={`portrait-${animKey}`}
            className="flex-shrink-0"
            style={{ animation: `${portraitAnim} 0.45s ease-out` }}
          >
            <div
              className="relative rounded-3xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.75)] ring-2 ring-[var(--accent-primary)]/30 hover:ring-[var(--accent-primary)]/60 transition-all duration-300"
              style={{ width: 'clamp(160px, 18vw, 280px)', height: 'clamp(240px, 27vw, 420px)' }}
            >
              {person.profile_path ? (
                <Image
                  src={tmdbImage(person.profile_path, 'w342')}
                  alt={person.name}
                  fill
                  className="object-cover object-top"
                  sizes="280px"
                  priority
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-7xl bg-[var(--bg-card)]">👤</div>
              )}

              {/* Bottom gradient + rank badge */}
              <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/90 to-transparent" />

              {/* Rank badge */}
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-black bg-[var(--accent-primary)] text-white shadow-lg">
                #{current + 1}
              </div>

              {/* Followers */}
              <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center">
                <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
                  <Users size={12} className="text-violet-400" />
                  <span className="text-sm font-bold text-white">{formatFollowers(followerCount)}</span>
                  <span className="text-[10px] text-white/50">followers</span>
                </div>
              </div>
            </div>
          </div>

          {/* Info — with slide animation (slight delay for parallax feel) */}
          <div
            key={`info-${animKey}`}
            className="flex-1 min-w-0 space-y-6"
            style={{ animation: `${infoAnim} 0.45s ease-out 0.06s both` }}
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--accent-primary)] mb-2">
                {person.known_for_department === 'Directing' ? '🎬 Director' : '🎭 Actor / Actress'}
              </p>
              <h3 className="text-4xl md:text-5xl font-black text-white leading-none tracking-tight">
                {person.name}
              </h3>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="text-sm text-[var(--text-muted)]">Popularity Score</span>
                <span className="text-sm font-bold text-[var(--accent-primary)]">{Math.round(person.popularity)}</span>
                <span className="w-1 h-1 rounded-full bg-[var(--text-muted)]" />
                <span className="text-sm text-[var(--text-muted)] capitalize">
                  {person.known_for_department ?? 'Acting'}
                </span>
              </div>
            </div>

            {/* Known for — bigger posters */}
            {knownFor.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Known For</p>
                <div className="flex gap-4">
                  {knownFor.map((item) => (
                    <Link key={item.id} href={`/${item.media_type}/${item.id}`} className="group flex-shrink-0">
                      <div
                        className="relative rounded-xl overflow-hidden ring-1 ring-white/10 group-hover:ring-[var(--accent-primary)]/60 transition-all group-hover:scale-105 duration-200 shadow-md"
                        style={{ width: 90, height: 135 }}
                      >
                        {item.poster_path ? (
                          <Image
                            src={tmdbImage(item.poster_path, 'w185')}
                            alt={item.title ?? item.name ?? ''}
                            fill
                            className="object-cover"
                            sizes="90px"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-[var(--bg-card)] flex items-center justify-center text-sm text-[var(--text-muted)]">?</div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)] mt-2 line-clamp-1 group-hover:text-[var(--text-secondary)] transition-colors" style={{ width: 90 }}>
                        {item.title ?? item.name}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 flex-wrap">
              <FollowButton person={person} size="md" />
              <Link
                href={`/person/${person.id}`}
                className="px-5 py-2.5 rounded-full border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)] transition-all bg-white/5 backdrop-blur-sm"
              >
                View Profile
              </Link>
            </div>
          </div>

          {/* Thumbnail strip — sidebar quick nav */}
          <div className="hidden xl:flex flex-col gap-1.5 flex-shrink-0">
            {sidebarPeople.map((p, i) => (
              <button
                key={p.id}
                onClick={() => go(i, i > current ? 'next' : 'prev')}
                className={`flex items-center gap-3 group rounded-xl px-3 py-2 transition-all ${
                  i === current
                    ? 'bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/40'
                    : 'hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="relative w-9 h-9 rounded-full overflow-hidden ring-1 ring-white/10 flex-shrink-0">
                  {p.profile_path
                    ? <Image src={tmdbImage(p.profile_path, 'w92')} alt={p.name} fill className="object-cover" sizes="36px" />
                    : <div className="absolute inset-0 bg-[var(--bg-card)] flex items-center justify-center text-xs">?</div>}
                </div>
                <span className={`text-sm font-medium line-clamp-1 max-w-[120px] transition-colors ${
                  i === current ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]'
                }`}>
                  {p.name}
                </span>
              </button>
            ))}
            {people.length > 8 && (
              <p className="text-xs text-[var(--text-muted)] px-3 mt-1">+{people.length - 8} more</p>
            )}
          </div>
        </div>

        {/* ── Progress bar + nav ── */}
        <div className="mt-10 flex items-center gap-4">
          <button
            onClick={prev}
            className="p-2.5 rounded-full bg-white/5 border border-[var(--border)] hover:border-[var(--accent-primary)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-all"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex-1 flex items-center gap-1.5 overflow-hidden">
            {dotPeople.map((_, i) => (
              <button
                key={i}
                onClick={() => go(i, i > current ? 'next' : 'prev')}
                className={`h-1.5 rounded-full transition-all duration-300 flex-shrink-0 relative overflow-hidden ${
                  i === current
                    ? 'w-10 bg-[var(--accent-primary)]/30'
                    : 'w-4 bg-white/15 hover:bg-white/30'
                }`}
              >
                {i === current && !paused && (
                  <div
                    key={`prog-${current}`}
                    className="absolute left-0 top-0 h-full rounded-full bg-[var(--accent-primary)]"
                    style={{ animation: `mv-people-prog ${SLIDE_DURATION}ms linear forwards` }}
                  />
                )}
                {i === current && paused && (
                  <div className="absolute left-0 top-0 h-full w-full rounded-full bg-[var(--accent-primary)]" />
                )}
              </button>
            ))}
            {people.length > 20 && (
              <span className="text-xs text-[var(--text-muted)] flex-shrink-0 ml-2">+{people.length - 20}</span>
            )}
          </div>

          <button
            onClick={next}
            className="p-2.5 rounded-full bg-white/5 border border-[var(--border)] hover:border-[var(--accent-primary)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-all"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}
