import { describe, expect, it } from 'vitest';
import {
  ageInYears,
  buildFilmography,
  groupCrewByDepartment,
  isSelfAppearance,
  knownFor,
  mergeCredits,
  sortCreditsByDate,
  type PersonCredit,
} from './credits';

const credit = (over: Partial<PersonCredit>): PersonCredit => ({
  id: 1,
  mediaType: 'movie',
  title: 'T',
  posterPath: '/p.jpg',
  backdropPath: null,
  date: '2020-01-01',
  roles: [],
  voteAverage: 7,
  voteCount: 10,
  popularity: 1,
  genreIds: [],
  ...over,
});

describe('mergeCredits', () => {
  it('merges multiple roles for the same title and keeps movie/tv with the same id apart', () => {
    const out = mergeCredits(
      [
        { id: 5, media_type: 'tv', name: 'Show', character: 'A', episode_count: 3 },
        { id: 5, media_type: 'tv', name: 'Show', character: 'B', episode_count: 7 },
        { id: 5, media_type: 'tv', name: 'Show', character: 'A' },
        { id: 5, media_type: 'movie', title: 'Film', character: 'C' },
      ],
      'cast',
    );
    expect(out).toHaveLength(2);
    const show = out.find((c) => c.mediaType === 'tv')!;
    expect(show.roles).toEqual(['A', 'B']);
    expect(show.episodeCount).toBe(7);
    expect(out.find((c) => c.mediaType === 'movie')!.title).toBe('Film');
  });

  it('drops rows with bad ids or media types and uses jobs for crew', () => {
    const out = mergeCredits(
      [
        { id: 0, media_type: 'movie' },
        { id: 'x', media_type: 'movie' },
        { id: 3, media_type: 'person' },
        { id: 4, media_type: 'movie', title: 'Dir', job: 'Director', department: 'Directing' },
        { id: 4, media_type: 'movie', title: 'Dir', job: 'Writer', department: 'Writing' },
      ],
      'crew',
    );
    expect(out).toHaveLength(1);
    expect(out[0].roles).toEqual(['Director', 'Writer']);
    expect(out[0].department).toBe('Directing');
  });

  it('handles undefined input', () => {
    expect(mergeCredits(undefined, 'cast')).toEqual([]);
  });
});

describe('sortCreditsByDate', () => {
  it('puts undated first, then newest first, ties by popularity then title', () => {
    const sorted = sortCreditsByDate([
      credit({ id: 1, title: 'Old', date: '1999-05-01' }),
      credit({ id: 2, title: 'New', date: '2024-02-01' }),
      credit({ id: 3, title: 'Undated', date: '' }),
      credit({ id: 4, title: 'B', date: '2010-01-01', popularity: 1 }),
      credit({ id: 5, title: 'A', date: '2010-01-01', popularity: 1 }),
      credit({ id: 6, title: 'Z', date: '2010-01-01', popularity: 9 }),
    ]);
    expect(sorted.map((c) => c.title)).toEqual(['Undated', 'New', 'Z', 'A', 'B', 'Old']);
  });

  it('does not mutate its input', () => {
    const input = [credit({ id: 1, date: '2000-01-01' }), credit({ id: 2, date: '2001-01-01' })];
    sortCreditsByDate(input);
    expect(input[0].id).toBe(1);
  });
});

describe('knownFor / isSelfAppearance', () => {
  it('ranks by vote count and skips talk shows, Self roles and poster-less titles', () => {
    const list = knownFor(
      [
        credit({ id: 1, voteCount: 100 }),
        credit({ id: 2, voteCount: 5000, mediaType: 'tv', genreIds: [10767] }),
        credit({ id: 3, voteCount: 4000, roles: ['Himself'] }),
        credit({ id: 4, voteCount: 3000, posterPath: null }),
        credit({ id: 5, voteCount: 2000 }),
        credit({ id: 5, voteCount: 2000 }),
      ],
      5,
    );
    expect(list.map((c) => c.id)).toEqual([5, 1]);
  });

  it('a mixed Self + character role is not a self appearance', () => {
    expect(isSelfAppearance(credit({ roles: ['Self', 'Narrator'] }))).toBe(false);
    expect(isSelfAppearance(credit({ roles: ['Self - Guest'] }))).toBe(true);
  });
});

describe('groupCrewByDepartment', () => {
  it('orders departments by size and sorts each by date', () => {
    const groups = groupCrewByDepartment([
      credit({ id: 1, department: 'Writing', date: '2001-01-01' }),
      credit({ id: 2, department: 'Directing', date: '2001-01-01' }),
      credit({ id: 3, department: 'Directing', date: '2005-01-01' }),
    ]);
    expect(groups.map((g) => g.department)).toEqual(['Directing', 'Writing']);
    expect(groups[0].credits.map((c) => c.id)).toEqual([3, 2]);
  });
});

describe('buildFilmography', () => {
  it('splits cast into movies and tv and counts unique titles across cast + crew', () => {
    const f = buildFilmography({
      combined_credits: {
        cast: [
          { id: 1, media_type: 'movie', title: 'M', character: 'x', poster_path: '/a.jpg', vote_count: 9 },
          { id: 2, media_type: 'tv', name: 'S', character: 'y', poster_path: '/b.jpg', vote_count: 3 },
        ],
        crew: [{ id: 1, media_type: 'movie', title: 'M', job: 'Director', department: 'Directing' }],
      },
    } as never);
    expect(f.movies).toHaveLength(1);
    expect(f.tv).toHaveLength(1);
    expect(f.crew).toHaveLength(1);
    expect(f.totalTitles).toBe(2);
    expect(f.knownFor.map((c) => c.id)).toEqual([1, 2]);
  });

  it('copes with a person without credits', () => {
    expect(buildFilmography({}).totalTitles).toBe(0);
  });
});

describe('ageInYears', () => {
  it('counts whole years and handles the birthday boundary', () => {
    expect(ageInYears('1970-06-15', '2020-06-14')).toBe(49);
    expect(ageInYears('1970-06-15', '2020-06-15')).toBe(50);
  });
  it('returns null for unknown or malformed dates', () => {
    expect(ageInYears(null)).toBeNull();
    expect(ageInYears('1970')).toBeNull();
    expect(ageInYears('2030-01-01', '2020-01-01')).toBeNull();
  });
});
