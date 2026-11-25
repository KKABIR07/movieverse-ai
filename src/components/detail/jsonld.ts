/**
 * schema.org JSON-LD builders (pure, unit-tested). Data comes from TMDB; every object
 * carries TMDB attribution via `sourceOrganization`-style `isBasedOn`.
 */
import type { Movie, Person, TVShow } from '../../types/tmdb';
import { absoluteUrl, clampDescription, SITE_NAME, SITE_URL } from './seo';

const IMG = 'https://image.tmdb.org/t/p';
const TMDB = { '@type': 'Organization', name: 'The Movie Database (TMDB)', url: 'https://www.themoviedb.org' } as const;

type Json = Record<string, unknown>;

/** Drop undefined / null / empty arrays so the output stays clean. */
function compact<T extends Json>(o: T): T {
  const out: Json = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out as T;
}

const img = (path: string | null | undefined, size = 'w780') => (path ? `${IMG}/${size}${path}` : undefined);
const isoDate = (d: string | null | undefined) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : undefined);
const isoDuration = (min: number | null | undefined) => (min && min > 0 ? `PT${Math.floor(min / 60)}H${min % 60}M` : undefined);

function aggregateRating(avg: number | undefined, count: number | undefined): Json | undefined {
  if (!avg || !count || count < 1) return undefined;
  return {
    '@type': 'AggregateRating',
    ratingValue: Math.round(avg * 10) / 10,
    bestRating: 10,
    worstRating: 0,
    ratingCount: count,
    author: TMDB,
  };
}

const tmdbSource = (path: string) => ({ isBasedOn: `https://www.themoviedb.org/${path}`, sourceOrganization: TMDB });

export function movieJsonLd(m: Movie): Json {
  const directors = (m.credits?.crew ?? []).filter((c) => c.job === 'Director').slice(0, 3);
  const trailer = (m.videos?.results ?? []).find((v) => v.site === 'YouTube' && v.type === 'Trailer');
  return compact({
    '@context': 'https://schema.org',
    '@type': 'Movie',
    '@id': absoluteUrl(`/movie/${m.id}`),
    url: absoluteUrl(`/movie/${m.id}`),
    name: m.title,
    alternateName: m.original_title && m.original_title !== m.title ? m.original_title : undefined,
    description: clampDescription(m.overview, 300) || undefined,
    image: img(m.poster_path),
    datePublished: isoDate(m.release_date),
    duration: isoDuration(m.runtime),
    genre: (m.genres ?? []).map((g) => g.name),
    inLanguage: m.original_language,
    director: directors.map((d) => ({ '@type': 'Person', name: d.name, url: absoluteUrl(`/person/${d.id}`) })),
    actor: (m.credits?.cast ?? []).slice(0, 10).map((c) => ({ '@type': 'Person', name: c.name, url: absoluteUrl(`/person/${c.id}`) })),
    aggregateRating: aggregateRating(m.vote_average, m.vote_count),
    trailer: trailer
      ? {
          '@type': 'VideoObject',
          name: trailer.name,
          embedUrl: `https://www.youtube-nocookie.com/embed/${trailer.key}`,
          thumbnailUrl: `https://i.ytimg.com/vi/${trailer.key}/hqdefault.jpg`,
          uploadDate: isoDate(trailer.published_at),
        }
      : undefined,
    sameAs: m.imdb_id ? [`https://www.imdb.com/title/${m.imdb_id}/`] : undefined,
    ...tmdbSource(`movie/${m.id}`),
  });
}

export function tvJsonLd(t: TVShow): Json {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'TVSeries',
    '@id': absoluteUrl(`/tv/${t.id}`),
    url: absoluteUrl(`/tv/${t.id}`),
    name: t.name,
    alternateName: t.original_name && t.original_name !== t.name ? t.original_name : undefined,
    description: clampDescription(t.overview, 300) || undefined,
    image: img(t.poster_path),
    startDate: isoDate(t.first_air_date),
    endDate: t.in_production === false ? isoDate(t.last_air_date) : undefined,
    numberOfSeasons: t.number_of_seasons,
    numberOfEpisodes: t.number_of_episodes,
    genre: (t.genres ?? []).map((g) => g.name),
    creator: (t.created_by ?? []).map((c) => ({ '@type': 'Person', name: c.name, url: absoluteUrl(`/person/${c.id}`) })),
    actor: (t.credits?.cast ?? []).slice(0, 10).map((c) => ({ '@type': 'Person', name: c.name, url: absoluteUrl(`/person/${c.id}`) })),
    aggregateRating: aggregateRating(t.vote_average, t.vote_count),
    ...tmdbSource(`tv/${t.id}`),
  });
}

export function personJsonLd(p: Person): Json {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': absoluteUrl(`/person/${p.id}`),
    url: absoluteUrl(`/person/${p.id}`),
    name: p.name,
    description: clampDescription(p.biography, 300) || undefined,
    image: img(p.profile_path, 'h632'),
    birthDate: isoDate(p.birthday),
    deathDate: isoDate(p.deathday),
    birthPlace: p.place_of_birth ? { '@type': 'Place', name: p.place_of_birth } : undefined,
    jobTitle: p.known_for_department,
    alternateName: (p.also_known_as ?? []).slice(0, 5),
    sameAs: p.imdb_id ? [`https://www.imdb.com/name/${p.imdb_id}/`] : undefined,
    ...tmdbSource(`person/${p.id}`),
  });
}

export interface ArticleInput {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  image?: string | null;
  tags?: string[];
}

export function articleJsonLd(a: ArticleInput): Json {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': absoluteUrl(`/blog/${a.slug}`),
    mainEntityOfPage: absoluteUrl(`/blog/${a.slug}`),
    headline: a.title.slice(0, 110),
    description: clampDescription(a.description),
    datePublished: isoDate(a.date),
    dateModified: isoDate(a.date),
    author: { '@type': 'Person', name: a.author },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    image: a.image ?? undefined,
    keywords: a.tags?.length ? a.tags.join(', ') : undefined,
  });
}

/** Safe for `<script type="application/ld+json">`: escapes `<` so "</script>" can't break out. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
