import Image from 'next/image';
import Link from 'next/link';
import { Film } from 'lucide-react';
import { formatYear } from '@/lib/format';
import { tmdbUrl } from '@/components/media/tmdbImage';
import type { PersonCredit } from './credits';

const href = (c: Pick<PersonCredit, 'id' | 'mediaType'>) => (c.mediaType === 'tv' ? `/tv/${c.id}` : `/movie/${c.id}`);

/**
 * Filmography as a year-ordered list (server component). Rows are links with a small poster,
 * title, year and the person's roles; long lists are cut at `limit` with an honest count.
 */
export function CreditList({ credits, label, limit = 80 }: { credits: PersonCredit[]; label: string; limit?: number }) {
  if (!credits.length) return <p className="text-body text-fg-muted">No credits listed on TMDB yet.</p>;
  const shown = credits.slice(0, limit);
  return (
    <div>
      <ol aria-label={label} className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface-1">
        {shown.map((c) => {
          const year = formatYear(c.date, '');
          const thumb = tmdbUrl(c.posterPath, 'w92');
          const roles = c.roles.join(', ');
          return (
            <li key={`${c.mediaType}:${c.id}`}>
              <Link
                href={href(c)}
                className="group flex items-center gap-3 px-3 py-2.5 transition-colors duration-120 hover:bg-surface-2 focus-visible:bg-surface-2 sm:gap-4 sm:px-4"
              >
                <span className="w-11 shrink-0 text-caption tabular text-fg-muted">{year || 'TBA'}</span>
                <span className="relative h-[60px] w-10 shrink-0 overflow-hidden rounded-chip bg-surface-2">
                  {thumb ? (
                    <Image src={thumb} alt="" fill sizes="40px" className="object-cover" />
                  ) : (
                    <Film aria-hidden className="absolute inset-0 m-auto size-4 text-fg-muted" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-medium text-fg group-hover:text-accent">{c.title}</span>
                  {(roles || c.episodeCount) && (
                    <span className="mt-0.5 block truncate text-caption text-fg-secondary">
                      {roles && (c.department ? roles : <>as {roles}</>)}
                      {c.episodeCount ? (
                        <span className="tabular text-fg-muted">
                          {roles ? ' · ' : ''}
                          {c.episodeCount} {c.episodeCount === 1 ? 'episode' : 'episodes'}
                        </span>
                      ) : null}
                    </span>
                  )}
                </span>
                <span className="hidden shrink-0 rounded-chip bg-surface-2 px-2 py-0.5 text-micro text-fg-secondary sm:inline">
                  {c.mediaType === 'tv' ? 'TV' : 'Film'}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      {credits.length > shown.length && (
        <p className="mt-3 text-caption text-fg-muted tabular">
          Showing the {shown.length} most recent of {credits.length} credits.
        </p>
      )}
    </div>
  );
}
