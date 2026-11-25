import Link from 'next/link';
import type { Genre } from '@/types/tmdb';
import { cn } from '@/components/ui/cn';

/** Genre swatch classes (bars/dots only, per the design rules). Literal strings so Tailwind sees them. */
const SWATCH = {
  action: 'bg-genre-action',
  drama: 'bg-genre-drama',
  comedy: 'bg-genre-comedy',
  horror: 'bg-genre-horror',
  scifi: 'bg-genre-scifi',
  romance: 'bg-genre-romance',
  animation: 'bg-genre-animation',
  thriller: 'bg-genre-thriller',
} as const;

const BY_ID: Record<number, keyof typeof SWATCH> = {
  28: 'action', 12: 'action', 10752: 'action', 37: 'action', 10759: 'action', 10768: 'action',
  18: 'drama', 99: 'drama', 36: 'drama', 10770: 'drama', 10763: 'drama',
  35: 'comedy', 10402: 'comedy', 10764: 'comedy', 10767: 'comedy',
  27: 'horror',
  878: 'scifi', 14: 'scifi', 10765: 'scifi',
  10749: 'romance', 10766: 'romance',
  16: 'animation', 10751: 'animation', 10762: 'animation',
  53: 'thriller', 80: 'thriller', 9648: 'thriller',
};

export function genreSwatch(id: number): string {
  return SWATCH[BY_ID[id] ?? 'drama'];
}

export interface GenreTilesProps {
  genres: readonly Genre[];
  /** Link builder; default /genre/:id (movies) or /genre/:id?type=tv. */
  hrefFor?: (g: Genre) => string;
  type?: 'movie' | 'tv';
  /** Limit the number of tiles. */
  limit?: number;
  className?: string;
}

/**
 * "Browse by genre" tiles: surface cards with a small colour bar. Server-component safe.
 * @example <GenreTiles genres={await getGenres('movie')} />
 */
export function GenreTiles({ genres, hrefFor, type = 'movie', limit, className }: GenreTilesProps) {
  const list = limit ? genres.slice(0, limit) : genres;
  const href = hrefFor ?? ((g: Genre) => (type === 'tv' ? `/genre/${g.id}?type=tv` : `/genre/${g.id}`));
  return (
    <ul className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6', className)}>
      {list.map((g) => (
        <li key={g.id}>
          <Link
            href={href(g)}
            className="group flex h-full min-h-[72px] flex-col justify-between gap-3 rounded-card border border-line bg-surface-1 p-4 transition-colors duration-120 hover:border-line-strong hover:bg-surface-2"
          >
            <span aria-hidden className={cn('block h-1 w-8 rounded-full transition-[width] duration-200 group-hover:w-12', genreSwatch(g.id))} />
            <span className="text-body font-semibold text-fg group-hover:text-accent transition-colors">{g.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
