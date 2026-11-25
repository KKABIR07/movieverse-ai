import Image from 'next/image';
import { Tv } from 'lucide-react';
import type { TVSeasonSummary } from '@/types/tmdb';
import { posterSrc } from '@/components/media/tmdbImage';
import { formatRating, formatYear } from '@/lib/format';

/** Seasons, regular seasons first, specials last. */
export function SeasonsList({ seasons, showTitle }: { seasons: TVSeasonSummary[]; showTitle: string }) {
  const list = [...seasons].sort((a, b) => (a.season_number === 0 ? 1 : b.season_number === 0 ? -1 : a.season_number - b.season_number));
  if (!list.length) return <p className="text-fg-muted">No season information yet.</p>;
  return (
    <ol className="space-y-3" aria-label={`${showTitle} seasons`}>
      {list.map((s) => {
        const poster = posterSrc(s.poster_path);
        const score = formatRating(s.vote_average, s.vote_average ? 1 : 0);
        const year = formatYear(s.air_date, '');
        return (
          <li key={s.id} className="flex gap-4 rounded-panel border border-line bg-surface-1 p-3 md:p-4">
            <div className="relative aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-control bg-surface-2 md:w-20">
              {poster ? (
                <Image src={poster} alt="" fill sizes="80px" className="object-cover" />
              ) : (
                <Tv className="absolute inset-0 m-auto size-6 text-fg-muted" aria-hidden />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-h3 text-fg">{s.name}</h3>
              <p className="mt-0.5 text-caption tabular text-fg-muted">
                {[year, s.episode_count ? `${s.episode_count} ${s.episode_count === 1 ? 'episode' : 'episodes'}` : null, score ? `TMDB ${score}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {s.overview && <p className="mt-2 line-clamp-3 text-body text-fg-secondary">{s.overview}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
