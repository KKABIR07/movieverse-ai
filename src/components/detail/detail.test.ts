import { describe, expect, it } from 'vitest';
import type { Movie, Person, TVShow } from '../../types/tmdb';
import { articleJsonLd, movieJsonLd, personJsonLd, serializeJsonLd, tvJsonLd } from './jsonld';
import { regionFromHeaders } from './region';
import { clampDescription, parseId, SITE_URL } from './seo';

const movie = {
  id: 550,
  title: 'Fight Club',
  original_title: 'Fight Club',
  overview: 'A ticking-time-bomb insomniac and a slippery soap salesman channel primal male aggression.',
  poster_path: '/p.jpg',
  backdrop_path: '/b.jpg',
  release_date: '1999-10-15',
  runtime: 139,
  vote_average: 8.438,
  vote_count: 30000,
  genres: [{ id: 18, name: 'Drama' }],
  original_language: 'en',
  imdb_id: 'tt0137523',
  credits: {
    cast: [{ id: 819, name: 'Edward Norton', character: 'Narrator', profile_path: null, order: 0, known_for_department: 'Acting' }],
    crew: [{ id: 7467, name: 'David Fincher', job: 'Director', department: 'Directing', profile_path: null }],
  },
  videos: { results: [{ id: 'v', key: 'abc123', name: 'Trailer', site: 'YouTube', type: 'Trailer', official: true, published_at: '2014-01-01T00:00:00Z' }] },
} as unknown as Movie;

describe('JSON-LD builders', () => {
  it('builds a Movie with TMDB attribution, rating and nocookie trailer', () => {
    const ld = movieJsonLd(movie);
    expect(ld).toMatchObject({
      '@type': 'Movie',
      name: 'Fight Club',
      url: `${SITE_URL}/movie/550`,
      datePublished: '1999-10-15',
      duration: 'PT2H19M',
      genre: ['Drama'],
      director: [{ name: 'David Fincher' }],
      aggregateRating: { ratingValue: 8.4, bestRating: 10, ratingCount: 30000 },
      isBasedOn: 'https://www.themoviedb.org/movie/550',
      sourceOrganization: { name: 'The Movie Database (TMDB)' },
    });
    expect((ld.trailer as { embedUrl: string }).embedUrl).toBe('https://www.youtube-nocookie.com/embed/abc123');
    expect(ld).not.toHaveProperty('alternateName');
  });

  it('omits the rating for unrated titles (no fake scores)', () => {
    expect(movieJsonLd({ ...movie, vote_average: 0, vote_count: 0 })).not.toHaveProperty('aggregateRating');
  });

  it('builds TVSeries and Person', () => {
    const tv = tvJsonLd({ id: 1399, name: 'Game of Thrones', original_name: 'Game of Thrones', overview: 'x', poster_path: null, first_air_date: '2011-04-17', number_of_seasons: 8, vote_average: 8.4, vote_count: 20 } as unknown as TVShow);
    expect(tv).toMatchObject({ '@type': 'TVSeries', startDate: '2011-04-17', numberOfSeasons: 8 });
    expect(tv).not.toHaveProperty('image');
    const p = personJsonLd({ id: 287, name: 'Brad Pitt', biography: '', birthday: '1963-12-18', deathday: null, place_of_birth: 'Shawnee, Oklahoma, USA', profile_path: '/x.jpg', known_for_department: 'Acting', popularity: 1 } as Person);
    expect(p).toMatchObject({ '@type': 'Person', birthDate: '1963-12-18', birthPlace: { name: 'Shawnee, Oklahoma, USA' } });
    expect(p).not.toHaveProperty('deathDate');
  });

  it('builds an Article', () => {
    expect(articleJsonLd({ slug: 's', title: 'T', description: 'D', date: '2025-03-01', author: 'A' })).toMatchObject({
      '@type': 'Article',
      headline: 'T',
      datePublished: '2025-03-01',
      author: { name: 'A' },
    });
  });

  it('serializes safely inside a script tag', () => {
    expect(serializeJsonLd({ name: '</script><script>alert(1)</script>' })).not.toContain('</script>');
  });
});

describe('seo helpers', () => {
  it('parses only positive integer ids', () => {
    expect(parseId('550')).toBe(550);
    for (const bad of ['0', '-1', '1.5', '12abc', '', undefined, '99999999999', '０1']) expect(parseId(bad)).toBeNull();
  });
  it('clamps descriptions at a word boundary', () => {
    const d = clampDescription('word '.repeat(60));
    expect(d.length).toBeLessThanOrEqual(155);
    expect(d.endsWith('…')).toBe(true);
    expect(clampDescription('  short   text ')).toBe('short text');
  });
});

describe('regionFromHeaders', () => {
  const h = (o: Record<string, string>) => (n: string) => o[n] ?? null;
  it('prefers CDN geo headers', () => {
    expect(regionFromHeaders(h({ 'cf-ipcountry': 'de', 'accept-language': 'en-GB' }))).toBe('DE');
  });
  it('falls back to Accept-Language region subtags', () => {
    expect(regionFromHeaders(h({ 'accept-language': 'pt-BR,pt;q=0.9' }))).toBe('BR');
    expect(regionFromHeaders(h({ 'accept-language': 'zh-Hant-TW' }))).toBe('TW');
    expect(regionFromHeaders(h({ 'cf-ipcountry': 'XX', 'accept-language': 'fr, en-CA;q=0.5' }))).toBe('CA');
  });
  it('defaults to US', () => {
    expect(regionFromHeaders(h({ 'accept-language': 'en' }))).toBe('US');
    expect(regionFromHeaders(h({}))).toBe('US');
  });
});
