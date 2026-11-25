import Image from 'next/image';
import { ExternalLink, Tv } from 'lucide-react';
import type { WatchProvider } from '@/types/tmdb';
import { tmdbUrl } from '@/components/media/tmdbImage';
import { regionName } from './region';

export interface RegionProviders {
  link?: string;
  flatrate?: WatchProvider[];
  rent?: WatchProvider[];
  buy?: WatchProvider[];
  free?: WatchProvider[];
  ads?: WatchProvider[];
}

const GROUPS: { key: keyof RegionProviders; label: string }[] = [
  { key: 'flatrate', label: 'Stream' },
  { key: 'free', label: 'Free' },
  { key: 'ads', label: 'With ads' },
  { key: 'rent', label: 'Rent' },
  { key: 'buy', label: 'Buy' },
];

/**
 * Region-aware providers from TMDB (data by JustWatch, attribution required).
 * Links go to TMDB's provider page for the title, which deep-links to each service.
 */
export function WhereToWatch({ providers, region, title }: { providers: RegionProviders | null; region: string; title: string }) {
  const name = regionName(region);
  const groups = GROUPS.map((g) => ({ ...g, list: ((providers?.[g.key] as WatchProvider[] | undefined) ?? []).slice(0, 8) })).filter(
    (g) => g.list.length,
  );
  return (
    <section aria-labelledby="where-to-watch" className="rounded-panel border border-line bg-surface-1 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="where-to-watch" className="text-h3 text-fg">
          Where to watch
        </h2>
        <span className="text-micro text-fg-muted">{name}</span>
      </div>

      {groups.length === 0 ? (
        <div className="mt-4 flex items-start gap-3 text-caption text-fg-muted">
          <Tv className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            No streaming, rental or purchase options for {title} in {name} right now.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {groups.map((g) => (
            <div key={g.key}>
              <h3 className="text-micro font-medium uppercase tracking-[0.08em] text-fg-muted">{g.label}</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {g.list.map((p) => {
                  const logo = tmdbUrl(p.logo_path, 'w92');
                  const content = (
                    <>
                      {logo && <Image src={logo} alt="" width={36} height={36} unoptimized className="size-9 rounded-control object-cover ring-1 ring-line" />}
                      <span className="sr-only">{p.provider_name}</span>
                    </>
                  );
                  return (
                    <li key={p.provider_id} title={p.provider_name}>
                      {providers?.link ? (
                        <a
                          href={providers.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block rounded-control outline-offset-2"
                          aria-label={`${g.label} ${title} on ${p.provider_name} (opens TMDB)`}
                        >
                          {content}
                        </a>
                      ) : (
                        content
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {providers?.link && (
            <a
              href={providers.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-caption text-accent hover:underline underline-offset-2"
            >
              All options on TMDB <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
        </div>
      )}
      <p className="mt-4 border-t border-line pt-3 text-micro text-fg-muted">
        Availability data provided by{' '}
        <a href="https://www.justwatch.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-fg">
          JustWatch
        </a>{' '}
        via TMDB.
      </p>
    </section>
  );
}
