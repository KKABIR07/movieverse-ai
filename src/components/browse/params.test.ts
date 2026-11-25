import { describe, expect, it } from 'vitest';
import { buildHref, first, parseIds, parsePage, parseRating, parseYear, pick, yearOptions } from './params';
import { toPeople, toSummaries } from './trim';

describe('first', () => {
  it('takes the first value and trims', () => {
    expect(first(['  a ', 'b'])).toBe('a');
    expect(first('  ')).toBeUndefined();
    expect(first(undefined)).toBeUndefined();
  });
});

describe('parsePage', () => {
  it.each([
    [undefined, 1],
    ['', 1],
    ['abc', 1],
    ['0', 1],
    ['-4', 1],
    ['3', 3],
    ['3.9', 3],
    ['500', 500],
    ['501', 500],
    ['99999', 500],
    [['7', '8'], 7],
  ])('%j -> %i', (input, expected) => {
    expect(parsePage(input as string | string[] | undefined)).toBe(expected);
  });
});

describe('pick', () => {
  it('accepts allowed values and falls back otherwise', () => {
    expect(pick('tv', ['movie', 'tv'] as const, 'movie')).toBe('tv');
    expect(pick('person', ['movie', 'tv'] as const, 'movie')).toBe('movie');
    expect(pick(undefined, ['movie', 'tv'] as const, 'movie')).toBe('movie');
  });
});

describe('parseIds', () => {
  it('parses, dedupes and caps', () => {
    expect(parseIds('18, 35,18,x,-1,0')).toEqual([18, 35]);
    expect(parseIds(undefined)).toEqual([]);
    expect(parseIds(Array.from({ length: 20 }, (_, i) => i + 1).join(','))).toHaveLength(10);
  });
});

describe('parseYear / parseRating', () => {
  it('validates years', () => {
    expect(parseYear('2015')).toBe(2015);
    expect(parseYear('15')).toBeUndefined();
    expect(parseYear('1700')).toBeUndefined();
    expect(parseYear('2015-01-01')).toBeUndefined();
  });
  it('validates ratings', () => {
    expect(parseRating('7.5')).toBe(7.5);
    expect(parseRating('12')).toBe(10);
    expect(parseRating('0')).toBeUndefined();
    expect(parseRating('abc')).toBeUndefined();
  });
});

describe('buildHref', () => {
  it('drops empty values, defaults and page 1', () => {
    expect(buildHref('/trending', { type: 'all', window: 'week', page: 1 }, { type: 'all', window: 'week' })).toBe('/trending');
    expect(buildHref('/trending', { type: 'tv', window: 'day', page: 2 }, { type: 'all', window: 'week' })).toBe(
      '/trending?type=tv&window=day&page=2',
    );
    expect(buildHref('/search', { q: 'batman & robin', x: '', y: undefined })).toBe('/search?q=batman+%26+robin');
  });
});

describe('yearOptions', () => {
  it('runs from next year down to the oldest year', () => {
    const ys = yearOptions(2026, 2020);
    expect(ys).toEqual([2027, 2026, 2025, 2024, 2023, 2022, 2021, 2020]);
  });
});

describe('toSummaries / toPeople', () => {
  it('keeps movies and shows, drops people, blanks overviews', () => {
    const out = toSummaries([
      { id: 1, title: 'A', media_type: 'movie', overview: 'long', poster_path: '/a.jpg' },
      { id: 2, name: 'B', media_type: 'tv', first_air_date: '2020-01-01' },
      { id: 3, name: 'C', media_type: 'person' },
      { title: 'no id' },
    ]);
    expect(out.map((m) => [m.id, m.mediaType])).toEqual([
      [1, 'movie'],
      [2, 'tv'],
    ]);
    expect(out[0].overview).toBe('');
  });
  it('forces the media type when given', () => {
    expect(toSummaries([{ id: 9, name: 'X' }], 'tv')[0].mediaType).toBe('tv');
  });
  it('keeps only person fields', () => {
    expect(toPeople([{ id: 1, name: 'P', profile_path: null, known_for_department: 'Acting', media_type: 'person' }])).toEqual([
      { id: 1, name: 'P', profile_path: null, known_for_department: 'Acting' },
    ]);
  });
});
