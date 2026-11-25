import { describe, expect, it } from 'vitest';
import { buildDiscoverParams } from '@/lib/tmdb/discover';
import {
  DEFAULT_STATE,
  activeFilterCount,
  describeDiscover,
  discoverHref,
  parseDiscover,
  toDiscoverFilters,
  withFilters,
} from './state';

describe('parseDiscover', () => {
  it('defaults', () => {
    expect(parseDiscover({})).toEqual(DEFAULT_STATE);
  });

  it('parses canonical params', () => {
    const s = parseDiscover({ type: 'tv', genres: '18,35', year_from: '2015', year_to: '2020', rating: '7', lang: 'KO', sort: 'rating', page: '3' });
    expect(s).toEqual({ type: 'tv', genres: [18, 35], yearFrom: 2015, yearTo: 2020, rating: 7, lang: 'ko', sort: 'rating', page: 3 });
  });

  it('swaps an inverted year range and rejects junk', () => {
    const s = parseDiscover({ year_from: '2020', year_to: '1999', lang: 'english', type: 'person', sort: 'nope' });
    expect(s.yearFrom).toBe(1999);
    expect(s.yearTo).toBe(2020);
    expect(s.lang).toBeUndefined();
    expect(s.type).toBe('movie');
    expect(s.sort).toBe('popular');
  });

  it('understands the old sidebar params', () => {
    const s = parseDiscover({ with_genres: '28', with_original_language: 'hi', 'vote_average.gte': '7.5', sort_by: 'release_date.desc' });
    expect(s).toMatchObject({ genres: [28], lang: 'hi', rating: 7.5, sort: 'newest' });
  });

  it('box-office sort is movie-only', () => {
    expect(parseDiscover({ type: 'tv', sort: 'revenue' }).sort).toBe('popular');
  });
});

describe('discoverHref / withFilters', () => {
  it('round-trips through the URL', () => {
    const s = { ...DEFAULT_STATE, type: 'tv' as const, genres: [18], yearFrom: 2015, page: 2 };
    const href = discoverHref(s);
    expect(href).toBe('/discover?type=tv&genres=18&year_from=2015&page=2');
    const params = Object.fromEntries(new URL(href, 'http://x').searchParams);
    expect(parseDiscover(params)).toEqual(s);
  });

  it('omits defaults', () => {
    expect(discoverHref(DEFAULT_STATE)).toBe('/discover');
  });

  it('resets the page on every filter change', () => {
    const s = { ...DEFAULT_STATE, page: 7 };
    expect(withFilters(s, { genres: [35] }).page).toBe(1);
    expect(withFilters({ ...s, sort: 'revenue' }, { type: 'tv' }).sort).toBe('popular');
  });
});

describe('toDiscoverFilters → TMDB params', () => {
  it('applies every filter for TV (first_air_date, not primary_release_date)', () => {
    const s = parseDiscover({ type: 'tv', genres: '18', year_from: '2015', rating: '7', lang: 'ko', sort: 'newest' });
    const p = buildDiscoverParams('tv', toDiscoverFilters(s));
    expect(p).toMatchObject({
      with_genres: '18',
      'first_air_date.gte': '2015-01-01',
      'vote_average.gte': '7',
      with_original_language: 'ko',
      sort_by: 'first_air_date.desc',
    });
    expect(p['primary_release_date.gte']).toBeUndefined();
  });

  it('uses primary_release_date for movies', () => {
    const p = buildDiscoverParams('movie', toDiscoverFilters(parseDiscover({ year_from: '1990', year_to: '1999' })));
    expect(p).toMatchObject({ 'primary_release_date.gte': '1990-01-01', 'primary_release_date.lte': '1999-12-31' });
  });
});

describe('activeFilterCount / describeDiscover', () => {
  it('counts filters and describes them', () => {
    const s = parseDiscover({ type: 'tv', genres: '18,35', year_from: '2015', rating: '7', lang: 'ko' });
    expect(activeFilterCount(s)).toBe(5);
    const names = new Map([
      [18, 'Drama'],
      [35, 'Comedy'],
    ]);
    expect(describeDiscover(s, names)).toBe('Drama, Comedy · TV shows · 2015 onwards · rated 7+ · in Korean');
  });
});
