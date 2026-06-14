'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { Calendar, MapPin, Users } from 'lucide-react';
import { tmdb, tmdbImage, formatYear } from '@/lib/tmdb';
import { MovieCardSkeleton } from '@/components/ui/Skeleton';
import { FollowButton } from '@/components/people/FollowButton';
import { useFollowingStore } from '@/store/followingStore';
import { useEffect } from 'react';

export default function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const personId = parseInt(id, 10);
  const { counts, setCounts } = useFollowingStore();

  const { data: person, isLoading } = useQuery({
    queryKey: ['person', personId],
    queryFn: () => tmdb.person.detail(personId),
  });

  // Fetch follower count for this person
  useEffect(() => {
    fetch(`/api/follows/counts?ids=${personId}`)
      .then((r) => r.json())
      .then(({ counts: c }) => { if (c) setCounts(c); })
      .catch(() => {});
  }, [personId, setCounts]);

  const followerCount = counts[personId] ?? 0;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 md:px-8 py-24">
        <div className="flex gap-8 mb-12">
          <div className="w-48 h-72 skeleton rounded-2xl flex-shrink-0" />
          <div className="flex-1 space-y-4">
            <div className="h-10 skeleton rounded-xl w-1/2" />
            <div className="h-4 skeleton rounded w-1/3" />
            <div className="h-32 skeleton rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--text-muted)]">
        Person not found
      </div>
    );
  }

  const movies = person.combined_credits?.cast
    ?.filter((c) => c.poster_path && c.media_type === 'movie')
    ?.sort((a, b) => b.popularity - a.popularity)
    ?.slice(0, 20) ?? [];

  const tvShows = person.combined_credits?.cast
    ?.filter((c) => c.poster_path && c.media_type === 'tv')
    ?.sort((a, b) => b.popularity - a.popularity)
    ?.slice(0, 10) ?? [];

  const directing = (person.combined_credits?.crew ?? [])
    .filter((c) => c.job === 'Director' && (c as { poster_path?: string | null }).poster_path)
    .slice(0, 10) as unknown as typeof movies;

  return (
    <div className="container mx-auto px-4 md:px-8 py-24 min-h-screen">
      <div className="flex flex-col md:flex-row gap-8 mb-12">
        {/* Photo */}
        <div className="flex-shrink-0 mx-auto md:mx-0 w-48">
          <div className="relative aspect-[2/3] rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-[0_16px_48px_rgba(0,0,0,0.7)]">
            {person.profile_path ? (
              <Image src={tmdbImage(person.profile_path, 'w342')} alt={person.name} fill className="object-cover" sizes="192px" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-6xl text-[var(--text-muted)]">👤</div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 space-y-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-[var(--text-primary)]">{person.name}</h1>
            <p className="text-[var(--text-muted)] mt-1">{person.known_for_department}</p>
          </div>

          {/* Follow + follower count */}
          <div className="flex items-center gap-4 flex-wrap">
            <FollowButton
              person={{
                id: person.id,
                name: person.name,
                profile_path: person.profile_path,
                known_for_department: person.known_for_department,
              }}
            />
            {followerCount > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
                <Users size={14} className="text-violet-400" />
                <span className="font-semibold text-violet-400">
                  {followerCount >= 1000 ? `${(followerCount / 1000).toFixed(1)}K` : followerCount}
                </span>
                <span>followers</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-[var(--text-secondary)]">
            {person.birthday && (
              <span className="flex items-center gap-1.5">
                <Calendar size={14} />
                Born {new Date(person.birthday).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            )}
            {person.place_of_birth && (
              <span className="flex items-center gap-1.5">
                <MapPin size={14} />
                {person.place_of_birth}
              </span>
            )}
            {person.deathday && (
              <span className="text-red-400">
                Died {new Date(person.deathday).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            )}
          </div>

          {person.biography && (
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)] mb-2">Biography</h2>
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed line-clamp-6">{person.biography}</p>
            </div>
          )}
        </div>
      </div>

      {/* Movies */}
      {movies.length > 0 && (
        <FilmographySection title="🎬 Movies" items={movies} type="movie" />
      )}

      {/* TV Shows */}
      {tvShows.length > 0 && (
        <FilmographySection title="📺 TV Shows" items={tvShows} type="tv" />
      )}

      {/* Directed */}
      {directing.length > 0 && (
        <FilmographySection title="🎥 Directed" items={directing as typeof movies} type="movie" />
      )}
    </div>
  );
}

function FilmographySection({
  title,
  items,
  type,
}: {
  title: string;
  items: { id: number; poster_path?: string | null; title?: string; name?: string; release_date?: string; first_air_date?: string; character?: string }[];
  type: 'movie' | 'tv';
}) {
  return (
    <div className="mb-10">
      <h2 className="text-xl font-bold text-[var(--text-primary)] mb-5">{title}</h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-4">
        {items.map((film) => (
          <Link key={`${film.id}-${film.character ?? ''}`} href={`/${type}/${film.id}`} className="group">
            <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-[var(--bg-card)] ring-1 ring-white/5 group-hover:ring-[var(--accent-primary)]/40 transition-all group-hover:-translate-y-1">
              <Image
                src={film.poster_path ? `https://image.tmdb.org/t/p/w185${film.poster_path}` : '/placeholder-poster.svg'}
                alt={film.title ?? film.name ?? ''}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 14vw"
              />
            </div>
            <p className="text-xs font-medium text-[var(--text-primary)] mt-2 line-clamp-1 group-hover:text-[var(--accent-primary)] transition-colors">
              {film.title ?? film.name}
            </p>
            {(film.release_date ?? film.first_air_date) && (
              <p className="text-xs text-[var(--text-muted)]">{formatYear(film.release_date ?? film.first_air_date)}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
