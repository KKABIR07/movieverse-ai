import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Film } from 'lucide-react';
import { Backdrop } from '@/components/media/Backdrop';
import { POSTER_SIZES, posterSrc } from '@/components/media/tmdbImage';
import { chipClass } from '@/components/ui/Chip';
import { cn } from '@/components/ui/cn';

export interface HeroGenre {
  id: number;
  name: string;
  href?: string;
}

export interface DetailHeroProps {
  title: string;
  backdropPath: string | null;
  posterPath: string | null;
  /** Poster alt text, e.g. "Fight Club poster". */
  posterAlt: string;
  eyebrow?: ReactNode;
  genres?: HeroGenre[];
  tagline?: string | null;
  /** Meta row items (year, runtime, badge, director …); falsy entries are skipped. */
  meta?: ReactNode[];
  /** Score panel / actions under the meta row. */
  children?: ReactNode;
  /** Round poster (people). */
  roundPoster?: boolean;
}

/**
 * Detail page header: full-bleed backdrop with a bottom scrim, poster (2:3, radius 18)
 * overlapping it on the left, genre chips, title (the page's only h1), tagline, meta row.
 * Server component; interactive bits are passed in as `children`.
 */
export function DetailHero({ title, backdropPath, posterPath, posterAlt, eyebrow, genres, tagline, meta, children, roundPoster }: DetailHeroProps) {
  const poster = posterSrc(posterPath);
  const metaItems = (meta ?? []).filter(Boolean);
  return (
    <header className="relative isolate -mt-[var(--header-h)]">
      <div className="relative h-[42vh] min-h-[260px] md:h-[58vh] md:min-h-[420px]">
        <Backdrop path={backdropPath} preload scrim="bottom" position="center 25%" />
        <div aria-hidden className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-ground/70 to-transparent" />
      </div>

      <div className="relative -mt-28 flex flex-col gap-6 px-gutter sm:-mt-36 md:-mt-52 md:flex-row md:items-end md:gap-10">
        <div
          className={cn(
            'relative w-36 shrink-0 overflow-hidden bg-surface-2 shadow-pop ring-1 ring-line sm:w-44 md:w-[260px]',
            roundPoster ? 'aspect-square rounded-full' : 'aspect-[2/3] rounded-[18px]',
          )}
        >
          {poster ? (
            <Image src={poster} alt={posterAlt} fill loading="eager" fetchPriority="high" sizes={POSTER_SIZES.detail} className="object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-fg-muted">
              <Film className="size-10" aria-hidden />
              <span className="sr-only">No image available</span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 md:pb-2">
          {eyebrow && <p className="mb-2 text-micro font-medium uppercase tracking-[0.08em] text-accent">{eyebrow}</p>}
          {!!genres?.length && (
            <ul className="mb-3 flex flex-wrap gap-2" aria-label="Genres">
              {genres.slice(0, 4).map((g) => (
                <li key={g.id}>
                  {g.href ? (
                    <Link href={g.href} className={chipClass(false, 'sm', 'bg-surface-1/70 backdrop-blur')}>
                      {g.name}
                    </Link>
                  ) : (
                    <span className={chipClass(false, 'sm', 'bg-surface-1/70 backdrop-blur pointer-events-none')}>{g.name}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <h1 className="text-h1 text-balance text-fg md:text-[64px] md:leading-[1.02]">{title}</h1>
          {tagline && <p className="mt-3 max-w-2xl text-body-lg italic text-fg-secondary text-pretty">{tagline}</p>}
          {metaItems.length > 0 && (
            <ul className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-caption text-fg-secondary" aria-label="Details">
              {metaItems.map((m, i) => (
                <li key={i} className="flex items-center gap-3">
                  {i > 0 && (
                    <span aria-hidden className="text-fg-muted">
                      ·
                    </span>
                  )}
                  {m}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {children && <div className="relative mt-6 px-gutter">{children}</div>}
    </header>
  );
}

/** Small outlined badge for certifications ("R", "TV-MA"). */
export function CertBadge({ value, region }: { value: string; region: string }) {
  return (
    <span className="inline-flex h-6 items-center rounded-chip border border-line-strong px-2 text-micro font-semibold tabular text-fg">
      <span className="sr-only">Rated </span>
      {value}
      <span className="sr-only"> in {region}</span>
    </span>
  );
}
