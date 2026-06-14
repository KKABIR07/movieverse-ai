'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import {
  Play, Star, Clock, Calendar, BookmarkPlus, BookmarkCheck,
  Globe, ChevronRight, ExternalLink
} from 'lucide-react';
import { tmdb, tmdbImage, tmdbBackdrop, formatRuntime, formatYear, getTrailerKey, getRatingColor } from '@/lib/tmdb';
import { useWatchlistStore, useRatingsStore } from '@/store';
import { ReviewSection } from '@/components/movie/ReviewSection';
import { HorizontalScroll } from '@/components/movie/HorizontalScroll';
import { YouTubeSection } from '@/components/movie/YouTubeSection';
import { MovieDetailSkeleton } from '@/components/ui/Skeleton';
import { RatingBadge } from '@/components/ui/StarRating';

export default function MoviePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const movieId = parseInt(id, 10);

  const { data: movie, isLoading, error } = useQuery({
    queryKey: ['movie', movieId],
    queryFn: () => tmdb.movie.detail(movieId),
    enabled: !isNaN(movieId),
  });

  const { add, remove, has } = useWatchlistStore();
  const { getRating } = useRatingsStore();
  const inWatchlist = has(movieId);
  const userRating = getRating(movieId);

  if (isLoading) return <MovieDetailSkeleton />;
  if (error || !movie) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--text-muted)]">
        <div className="text-center">
          <p className="text-5xl mb-4">🎬</p>
          <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">Movie not found</h1>
          <Link href="/" className="text-[var(--accent-primary)] hover:underline">Go home</Link>
        </div>
      </div>
    );
  }

  const trailerKey = getTrailerKey(movie.videos);
  const director = movie.credits?.crew?.find((c) => c.job === 'Director');
  const cast = movie.credits?.cast?.slice(0, 12) ?? [];
  const watchProviders = (movie as unknown as Record<string, unknown>)['watch/providers'] as { results?: { US?: { link: string; flatrate?: { provider_id: number; provider_name: string; logo_path: string }[]; rent?: { provider_id: number; provider_name: string; logo_path: string }[]; buy?: { provider_id: number; provider_name: string; logo_path: string }[] } } } | undefined;
  const usProviders = watchProviders?.results?.US;

  const handleWatchlist = () => {
    if (inWatchlist) {
      remove(movie.id);
    } else {
      add({ id: movie.id, title: movie.title, poster_path: movie.poster_path, release_date: movie.release_date, vote_average: movie.vote_average, media_type: 'movie' });
    }
  };

  return (
    <div className="min-h-screen">
      {/* Backdrop hero */}
      <div className="relative h-[55vh] min-h-[400px] overflow-hidden">
        {movie.backdrop_path && (
          <Image
            src={tmdbBackdrop(movie.backdrop_path)}
            alt={movie.title}
            fill
            priority
            className="object-cover opacity-35"
            sizes="100vw"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)]/40 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-primary)] via-transparent to-transparent" />
      </div>

      {/* Main content */}
      <div className="container mx-auto px-4 md:px-8 -mt-64 relative z-10">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Poster */}
          <div className="flex-shrink-0 mx-auto md:mx-0 w-48 md:w-64">
            <div className="relative aspect-[2/3] rounded-2xl overflow-hidden shadow-[0_24px_48px_rgba(0,0,0,0.8)] ring-1 ring-white/10">
              <Image
                src={tmdbImage(movie.poster_path, 'w500')}
                alt={movie.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 192px, 256px"
              />
            </div>

            {/* User rating */}
            {userRating && (
              <div className="mt-3 text-center">
                <p className="text-xs text-[var(--text-muted)] mb-1">Your Rating</p>
                <span className="text-2xl font-black" style={{ color: getRatingColor(userRating) }}>
                  {userRating}/10
                </span>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 space-y-5">
            {/* Title + meta */}
            <div>
              {(movie.genres?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {movie.genres!.map((g) => (
                    <Link
                      key={g.id}
                      href={`/genre/${g.id}?name=${encodeURIComponent(g.name)}`}
                      className="text-xs px-2.5 py-1 rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition-colors"
                    >
                      {g.name}
                    </Link>
                  ))}
                </div>
              )}

              <h1 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] leading-tight">
                {movie.title}
              </h1>

              {movie.tagline && (
                <p className="text-[var(--text-muted)] italic mt-1.5">"{movie.tagline}"</p>
              )}

              <div className="flex items-center gap-5 mt-4 flex-wrap">
                <RatingBadge rating={movie.vote_average} size="lg" />
                <span className="text-xs text-[var(--text-muted)]">{movie.vote_count.toLocaleString()} votes</span>
                <span className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                  <Calendar size={14} />
                  {formatYear(movie.release_date)}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                  <Clock size={14} />
                  {formatRuntime(movie.runtime)}
                </span>
                {movie.spoken_languages?.[0] && (
                  <span className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                    <Globe size={14} />
                    {movie.spoken_languages[0].english_name}
                  </span>
                )}
              </div>
            </div>

            {/* Overview */}
            <p className="text-[var(--text-secondary)] leading-relaxed text-base max-w-2xl">
              {movie.overview}
            </p>

            {/* Director */}
            {director && (
              <p className="text-sm text-[var(--text-secondary)]">
                <span className="text-[var(--text-muted)]">Director:</span>{' '}
                <Link href={`/person/${director.id}`} className="text-[var(--text-primary)] font-medium hover:text-[var(--accent-primary)] transition-colors">
                  {director.name}
                </Link>
              </p>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              {trailerKey && (
                <a
                  href={`https://www.youtube.com/watch?v=${trailerKey}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-white font-semibold rounded-xl transition-all hover:shadow-[0_0_20px_rgba(124,58,237,0.4)] text-sm"
                >
                  <Play size={16} className="fill-current" />
                  Watch Trailer
                </a>
              )}
              <button
                onClick={handleWatchlist}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border font-medium text-sm transition-all ${
                  inWatchlist
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                    : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {inWatchlist ? <BookmarkCheck size={16} /> : <BookmarkPlus size={16} />}
                {inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
              </button>
            </div>

            {/* Streaming providers */}
            {usProviders && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Available on</p>
                <div className="flex flex-wrap gap-3">
                  {[...(usProviders.flatrate ?? []), ...(usProviders.rent ?? []), ...(usProviders.buy ?? [])].slice(0, 6).map((p) => (
                    <div key={p.provider_id} title={p.provider_name} className="relative w-9 h-9 rounded-lg overflow-hidden ring-1 ring-white/10">
                      <Image
                        src={`https://image.tmdb.org/t/p/original${p.logo_path}`}
                        alt={p.provider_name}
                        fill
                        className="object-cover"
                        sizes="36px"
                      />
                    </div>
                  ))}
                  {usProviders.link && (
                    <a href={usProviders.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-[var(--accent-primary)] hover:underline">
                      <ExternalLink size={12} />
                      More
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Trailer embed */}
        {trailerKey && (
          <div className="mt-12">
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">Trailer</h2>
            <div className="relative w-full max-w-3xl aspect-video rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-[0_16px_48px_rgba(0,0,0,0.6)]">
              <iframe
                src={`https://www.youtube.com/embed/${trailerKey}?rel=0&modestbranding=1`}
                title={`${movie.title} Trailer`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
              />
            </div>
          </div>
        )}

        {/* YouTube Videos & Shorts */}
        <YouTubeSection
          query={movie.title}
          videoSuffix="official clip scene"
          sectionTitle="Videos & Shorts"
        />

        {/* Cast */}
        {cast.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Cast</h2>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
              {cast.map((member) => (
                <Link key={member.id} href={`/person/${member.id}`} className="flex-shrink-0 w-28 group">
                  <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-[var(--bg-card)] ring-1 ring-white/5 group-hover:ring-[var(--accent-primary)]/30 transition-all">
                    {member.profile_path ? (
                      <Image
                        src={tmdbImage(member.profile_path, 'w185')}
                        alt={member.name}
                        fill
                        className="object-cover"
                        sizes="112px"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-3xl text-[var(--text-muted)]">👤</div>
                    )}
                  </div>
                  <p className="text-xs font-medium text-[var(--text-primary)] mt-2 line-clamp-1 group-hover:text-[var(--accent-primary)] transition-colors">{member.name}</p>
                  <p className="text-xs text-[var(--text-muted)] line-clamp-1">{member.character}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Reviews */}
        <div className="mt-12">
          <ReviewSection movie={movie} />
        </div>

        {/* Recommendations */}
        {(movie.recommendations?.results?.length ?? 0) > 0 && (
          <div className="mt-4">
            <HorizontalScroll
              title="You Might Also Like"
              items={movie.recommendations!.results}
              mediaType="movie"
            />
          </div>
        )}

        {/* Similar */}
        {(movie.similar?.results?.length ?? 0) > 0 && (
          <div className="mt-4 mb-12">
            <HorizontalScroll
              title="Similar Movies"
              items={movie.similar!.results}
              mediaType="movie"
            />
          </div>
        )}
      </div>
    </div>
  );
}
