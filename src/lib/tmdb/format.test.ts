import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatDate,
  formatRating,
  formatRuntime,
  formatYear,
  getRatingColor,
  getTrailerKey,
  tmdbBackdrop,
  tmdbImage,
  tmdbProfile,
} from './format';
import { buildDiscoverParams } from './discover';

describe('image helpers', () => {
  it('poster default w500, placeholder for null/invalid', () => {
    expect(tmdbImage('/a.jpg')).toBe('https://image.tmdb.org/t/p/w500/a.jpg');
    expect(tmdbImage('/a.jpg', 'w185')).toBe('https://image.tmdb.org/t/p/w185/a.jpg');
    expect(tmdbImage(null)).toBe('/placeholder-poster.svg');
    expect(tmdbImage('https://evil.example/x.jpg')).toBe('/placeholder-poster.svg');
  });
  it('backdrop defaults to w1280 (not original)', () => {
    expect(tmdbBackdrop('/b.jpg')).toBe('https://image.tmdb.org/t/p/w1280/b.jpg');
    expect(tmdbBackdrop('/b.jpg', 'original')).toBe('https://image.tmdb.org/t/p/original/b.jpg');
    expect(tmdbBackdrop(undefined)).toBe('/placeholder-backdrop.svg');
  });
  it('profile', () => expect(tmdbProfile('/p.jpg')).toBe('https://image.tmdb.org/t/p/w185/p.jpg'));
});

describe('formatters', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('formatYear is string-based (timezone-proof)', () => {
    expect(formatYear('2019-01-01')).toBe('2019');
    expect(formatYear('')).toBe('N/A');
    expect(formatYear(undefined)).toBe('N/A');
    expect(formatYear('garbage')).toBe('N/A');
  });

  it('formatYear does not shift on negative UTC offsets', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles');
    expect(formatYear('2020-01-01')).toBe('2020');
  });

  it('formatDate renders in UTC', () => {
    expect(formatDate('2020-01-01')).toBe('Jan 1, 2020');
    expect(formatDate(null)).toBe('N/A');
    expect(formatDate('2020-13-45')).toBe('N/A');
  });

  it('formatRating is null-safe', () => {
    expect(formatRating(7.456)).toBe('7.5');
    expect(formatRating(null)).toBe('N/A');
    expect(formatRating(undefined)).toBe('N/A');
    expect(formatRating(Number.NaN)).toBe('N/A');
    expect(formatRating(0)).toBe('N/A');
  });

  it('formatRuntime', () => {
    expect(formatRuntime(139)).toBe('2h 19m');
    expect(formatRuntime(45)).toBe('45m');
    expect(formatRuntime(0)).toBe('N/A');
    expect(formatRuntime(undefined)).toBe('N/A');
  });

  it('getRatingColor is null-safe', () => {
    expect(getRatingColor(8)).toBe('#22c55e');
    expect(getRatingColor(6.5)).toBe('#f59e0b');
    expect(getRatingColor(null)).toBe('#ef4444');
  });

  it('getTrailerKey prefers official YouTube trailers', () => {
    const v = (key: string, type: string, official = false, site = 'YouTube') => ({ key, type, official, site });
    expect(getTrailerKey({ results: [v('a', 'Clip'), v('b', 'Trailer'), v('c', 'Trailer', true)] })).toBe('c');
    expect(getTrailerKey({ results: [v('a', 'Trailer', true, 'Vimeo'), v('b', 'Teaser')] })).toBe('b');
    expect(getTrailerKey({ results: [] })).toBeNull();
    expect(getTrailerKey(undefined)).toBeNull();
  });
});

describe('buildDiscoverParams', () => {
  it('defaults', () => {
    expect(buildDiscoverParams('movie')).toEqual({ include_adult: 'false', sort_by: 'popularity.desc' });
  });

  it('maps year range to the right date field per media type', () => {
    expect(buildDiscoverParams('movie', { yearFrom: 1990, yearTo: '1999' })).toMatchObject({
      'primary_release_date.gte': '1990-01-01',
      'primary_release_date.lte': '1999-12-31',
    });
    expect(buildDiscoverParams('tv', { yearFrom: 2010 })).toMatchObject({ 'first_air_date.gte': '2010-01-01' });
  });

  it('swaps inverted year ranges and ignores invalid years', () => {
    expect(buildDiscoverParams('movie', { yearFrom: 2000, yearTo: 1990 })).toMatchObject({
      'primary_release_date.gte': '1990-01-01',
      'primary_release_date.lte': '2000-12-31',
    });
    expect(buildDiscoverParams('movie', { yearFrom: 'abc' })['primary_release_date.gte']).toBeUndefined();
  });

  it('genres, language, rating (+vote floor), sort translation', () => {
    const p = buildDiscoverParams('tv', { genres: [18, 18, 80], language: 'ko', minRating: '7.5', sortBy: 'primary_release_date.desc' });
    expect(p).toMatchObject({
      with_genres: '18,80',
      with_original_language: 'ko',
      'vote_average.gte': '7.5',
      'vote_count.gte': '50',
      sort_by: 'first_air_date.desc',
    });
  });

  it('rejects unsafe sort and clamps page', () => {
    const p = buildDiscoverParams('movie', { sortBy: 'x;drop', page: 9999 });
    expect(p.sort_by).toBe('popularity.desc');
    expect(p.page).toBe('500');
  });
});
