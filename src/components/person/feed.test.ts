import { describe, expect, it } from 'vitest';
import { buildFeed, formatPeople } from './feed';
import type { PersonCredit } from './credits';

const c = (id: number, date: string, over: Partial<PersonCredit> = {}): PersonCredit => ({
  id,
  mediaType: 'movie',
  title: `T${id}`,
  posterPath: '/p.jpg',
  backdropPath: null,
  date,
  roles: [],
  voteAverage: 0,
  voteCount: 0,
  popularity: 0,
  genreIds: [],
  ...over,
});

const today = '2026-06-01';

describe('buildFeed', () => {
  it('splits upcoming (soonest first) from recent (newest first) and drops old / undated titles', () => {
    const feed = buildFeed(
      [{ id: 1, name: 'A', credits: [c(1, '2026-09-01'), c(2, '2026-07-01'), c(3, '2026-05-01'), c(4, '2025-12-01'), c(5, '2010-01-01'), c(6, '')] }],
      { today },
    );
    expect(feed.upcoming.map((e) => e.credit.id)).toEqual([2, 1]);
    expect(feed.recent.map((e) => e.credit.id)).toEqual([3, 4]);
  });

  it('merges a title shared by two followed people and attributes both', () => {
    const feed = buildFeed(
      [
        { id: 1, name: 'A', credits: [c(9, '2026-05-01', { posterPath: null })] },
        { id: 2, name: 'B', credits: [c(9, '2026-05-01')] },
      ],
      { today },
    );
    expect(feed.recent).toHaveLength(1);
    expect(feed.recent[0].people.map((p) => p.name)).toEqual(['A', 'B']);
    expect(feed.recent[0].credit.posterPath).toBe('/p.jpg');
  });

  it('keeps a movie and a show with the same id apart, and filters by type and query', () => {
    const people = [{ id: 1, name: 'A', credits: [c(9, '2026-05-01', { title: 'Dune' }), c(9, '2026-05-02', { mediaType: 'tv', title: 'Show' })] }];
    expect(buildFeed(people, { today }).recent).toHaveLength(2);
    expect(buildFeed(people, { today, mediaType: 'tv' }).recent.map((e) => e.credit.title)).toEqual(['Show']);
    expect(buildFeed(people, { today, query: 'du' }).recent.map((e) => e.credit.title)).toEqual(['Dune']);
  });

  it('caps each section', () => {
    const credits = Array.from({ length: 10 }, (_, i) => c(i + 1, `2026-05-${String(i + 1).padStart(2, '0')}`));
    expect(buildFeed([{ id: 1, name: 'A', credits }], { today, limit: 3 }).recent).toHaveLength(3);
  });
});

describe('formatPeople', () => {
  it('reads naturally', () => {
    expect(formatPeople([])).toBe('');
    expect(formatPeople([{ name: 'A' }])).toBe('with A');
    expect(formatPeople([{ name: 'A' }, { name: 'B' }])).toBe('with A and B');
    expect(formatPeople([{ name: 'A' }, { name: 'B' }, { name: 'C' }])).toBe('with A, B and 1 other');
    expect(formatPeople([{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }])).toBe('with A, B and 2 others');
  });
});
