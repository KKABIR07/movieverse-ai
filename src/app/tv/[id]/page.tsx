'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { Play, Star, Calendar, BookmarkPlus, BookmarkCheck, Tv } from 'lucide-react';
import { tmdb, tmdbImage, tmdbBackdrop, formatYear, getTrailerKey } from '@/lib/tmdb';
import { useWatchlistStore } from '@/store';
import { HorizontalScroll } from '@/components/movie/HorizontalScroll';
import { YouTubeSection } from '@/components/movie/YouTubeSection';
import { MovieDetailSkeleton } from '@/components/ui/Skeleton';
import { RatingBadge } from '@/components/ui/StarRating';

export default function TVDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const showId = parseInt(id, 10);

  const { data: show, isLoading } = useQuery({
    queryKey: ['tv', showId],
    queryFn: () => tmdb.tv.detail(showId),
  });

  const { add, remove, has } = useWatchlistStore();
  const inWatchlist = has(showId);

  if (isLoading) return <MovieDetailSkeleton />;
  if (!show) return (
    <div className="min-h-screen flex items-center justify-center text-[var(--text-muted)]">
      <div className="text-center"><p className="text-5xl mb-4">📺</p><p>Show not found</p></div>
    </div>
  );

  const trailerKey = getTrailerKey(show.videos);
  const cast = show.credits?.cast?.slice(0, 12) ?? [];

  return (
    <div className="min-h-screen">
      <div className="relative h-[50vh] min-h-[380px] overflow-hidden">
        {show.backdrop_path && (
          <Image src={tmdbBackdrop(show.backdrop_path)} alt={show.name} fill priority className="object-cover opacity-35" sizes="100vw" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)]/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-primary)] via-transparent to-transparent" />
      </div>

      <div className="container mx-auto px-4 md:px-8 -mt-48 relative z-10">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-shrink-0 mx-auto md:mx-0 w-44 md:w-56">
            <div className="relative aspect-[2/3] rounded-2xl overflow-hidden shadow-[0_24px_48px_rgba(0,0,0,0.8)] ring-1 ring-white/10">
              <Image src={tmdbImage(show.poster_path, 'w500')} alt={show.name} fill className="object-cover" sizes="224px" />
            </div>
          </div>

          <div className="flex-1 space-y-5">
            <div>
              {(show.genres?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {show.genres!.map((g) => (
                    <span key={g.id} className="text-xs px-2.5 py-1 rounded-full border border-[var(--border)] text-[var(--text-muted)]">{g.name}</span>
                  ))}
                </div>
              )}
              <h1 className="text-3xl md:text-4xl font-black text-[var(--text-primary)]">{show.name}</h1>
              {show.tagline && <p className="text-[var(--text-muted)] italic mt-1">"{show.tagline}"</p>}
              <div className="flex items-center gap-5 mt-4 flex-wrap">
                <RatingBadge rating={show.vote_average} size="lg" />
                <span className="text-xs text-[var(--text-muted)]">{show.vote_count.toLocaleString()} votes</span>
                <span className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]"><Calendar size={14} />{formatYear(show.first_air_date)}</span>
                {show.number_of_seasons && <span className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]"><Tv size={14} />{show.number_of_seasons} seasons</span>}
                {show.status && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">{show.status}</span>}
              </div>
            </div>

            <p className="text-[var(--text-secondary)] leading-relaxed text-base max-w-2xl">{show.overview}</p>

            <div className="flex flex-wrap gap-3">
              {trailerKey && (
                <a href={`https://www.youtube.com/watch?v=${trailerKey}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-white font-semibold rounded-xl transition-all text-sm">
                  <Play size={16} className="fill-current" /> Watch Trailer
                </a>
              )}
              <button
                onClick={() => inWatchlist ? remove(show.id) : add({ id: show.id, title: show.name, poster_path: show.poster_path, release_date: show.first_air_date ?? '', vote_average: show.vote_average, media_type: 'tv' })}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border font-medium text-sm transition-all ${inWatchlist ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]' : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]'}`}
              >
                {inWatchlist ? <BookmarkCheck size={16} /> : <BookmarkPlus size={16} />}
                {inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
              </button>
            </div>
          </div>
        </div>

        {trailerKey && (
          <div className="mt-12">
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">Trailer</h2>
            <div className="relative w-full max-w-3xl aspect-video rounded-2xl overflow-hidden ring-1 ring-white/10">
              <iframe src={`https://www.youtube.com/embed/${trailerKey}?rel=0&modestbranding=1`} title={`${show.name} Trailer`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="absolute inset-0 w-full h-full" />
            </div>
          </div>
        )}

        {/* YouTube Videos & Shorts */}
        <YouTubeSection
          query={show.name}
          videoSuffix="official clip scene"
          sectionTitle="Videos & Shorts"
        />

        {cast.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-5">Cast</h2>
            <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
              {cast.map((member) => (
                <Link key={member.id} href={`/person/${member.id}`} className="flex-shrink-0 w-28 group">
                  <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-[var(--bg-card)] group-hover:ring-1 ring-[var(--accent-primary)]/30 transition-all">
                    {member.profile_path ? (
                      <Image src={tmdbImage(member.profile_path, 'w185')} alt={member.name} fill className="object-cover" sizes="112px" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-3xl">👤</div>
                    )}
                  </div>
                  <p className="text-xs font-medium text-[var(--text-primary)] mt-2 line-clamp-1">{member.name}</p>
                  <p className="text-xs text-[var(--text-muted)] line-clamp-1">{member.character}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {(show.recommendations?.results?.length ?? 0) > 0 && (
          <div className="mt-8 mb-12">
            <HorizontalScroll title="You Might Also Like" items={show.recommendations!.results} mediaType="tv" />
          </div>
        )}
      </div>
    </div>
  );
}
