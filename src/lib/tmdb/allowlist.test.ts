import { describe, expect, it } from 'vitest';
import { matchTmdbPath, sanitizeTmdbParams, TmdbParamError, REVALIDATE, cacheControlFor } from './allowlist';

describe('matchTmdbPath', () => {
  it.each([
    ['trending/movie/week', 'list'],
    ['trending/all/day', 'list'],
    ['trending/person/week', 'list'],
    ['movie/popular', 'list'],
    ['movie/now_playing', 'list'],
    ['tv/airing_today', 'list'],
    ['tv/on_the_air', 'list'],
    ['person/popular', 'list'],
    ['search/multi', 'list'],
    ['discover/tv', 'list'],
    ['movie/550', 'detail'],
    ['movie/550/videos', 'detail'],
    ['movie/550/credits', 'detail'],
    ['movie/550/similar', 'detail'],
    ['movie/550/recommendations', 'detail'],
    ['movie/550/watch/providers', 'detail'],
    ['tv/1399', 'detail'],
    ['tv/1399/season/1', 'detail'],
    ['person/287', 'detail'],
    ['person/287/combined_credits', 'detail'],
    ['genre/movie/list', 'static'],
    ['watch/providers/movie', 'static'],
  ])('allows %s (%s)', (path, cls) => {
    const m = matchTmdbPath(path);
    expect(m).not.toBeNull();
    expect(m!.cls).toBe(cls);
    expect(m!.revalidate).toBe(REVALIDATE[cls as keyof typeof REVALIDATE]);
  });

  it('accepts catch-all segment arrays', () => {
    expect(matchTmdbPath(['movie', '550', 'watch', 'providers'])?.path).toBe('movie/550/watch/providers');
  });

  it.each([
    '',
    'account/123',
    'authentication/token/new',
    'movie/550/rating', // write endpoint
    'movie/550/account_states',
    'list/1',
    'movie/0',
    'movie/abc',
    'movie/550/../../account',
    'movie/550%2F..',
    'movie/550?api_key=x',
    'MOVIE/550',
    'trending/movie/month',
    'search/company',
    'tv/1/season/1/episode/1/rating',
    'movie/' + '9'.repeat(200),
  ])('rejects %s', (path) => {
    expect(matchTmdbPath(path)).toBeNull();
  });

  it('revalidate classes: lists 1h, details 24h, static 7d', () => {
    expect(REVALIDATE).toEqual({ list: 3600, detail: 86400, static: 604800 });
    expect(cacheControlFor('detail')).toContain('s-maxage=86400');
    expect(cacheControlFor('list')).toContain('stale-while-revalidate=3600');
  });
});

describe('sanitizeTmdbParams', () => {
  const sp = (o: Record<string, string>) => new URLSearchParams(o);
  const list = matchTmdbPath('movie/popular')!;
  const detail = matchTmdbPath('movie/550')!;
  const discover = matchTmdbPath('discover/movie')!;
  const search = matchTmdbPath('search/multi')!;

  it('drops unknown params (api_key, session_id, …)', () => {
    expect(sanitizeTmdbParams(sp({ page: '2', api_key: 'x', session_id: 'y', foo: 'z' }), list)).toEqual({ page: '2' });
  });

  it('clamps page to 1..500', () => {
    expect(sanitizeTmdbParams(sp({ page: '0' }), list).page).toBe('1');
    expect(sanitizeTmdbParams(sp({ page: '99999' }), list).page).toBe('500');
  });

  it('rejects invalid values with TmdbParamError', () => {
    expect(() => sanitizeTmdbParams(sp({ page: '-1' }), list)).toThrow(TmdbParamError);
    expect(() => sanitizeTmdbParams(sp({ sort_by: 'popularity.desc;drop' }), discover)).toThrow(TmdbParamError);
    expect(() => sanitizeTmdbParams(sp({ 'primary_release_date.gte': '1990' }), discover)).toThrow(TmdbParamError);
    expect(() => sanitizeTmdbParams(sp({ 'vote_average.gte': '11' }), discover)).toThrow(TmdbParamError);
    expect(() => sanitizeTmdbParams(sp({ with_genres: '28,abc' }), discover)).toThrow(TmdbParamError);
    expect(() => sanitizeTmdbParams(sp({ query: 'x'.repeat(101) }), search)).toThrow(TmdbParamError);
  });

  it('requires query for search', () => {
    expect(() => sanitizeTmdbParams(sp({}), search)).toThrow(TmdbParamError);
  });

  it('forces include_adult=false on search/discover', () => {
    expect(sanitizeTmdbParams(sp({ query: 'x', include_adult: 'true' }), search).include_adult).toBe('false');
    expect(sanitizeTmdbParams(sp({}), discover).include_adult).toBe('false');
    expect(sanitizeTmdbParams(sp({ include_adult: 'true' }), list).include_adult).toBeUndefined();
  });

  it('passes sidebar discover filters', () => {
    const out = sanitizeTmdbParams(
      sp({
        sort_by: 'vote_average.desc',
        with_genres: '28,12',
        with_original_language: 'ko',
        'vote_average.gte': '7.5',
        'primary_release_date.gte': '1990-01-01',
        'primary_release_date.lte': '1999-12-31',
      }),
      discover,
    );
    expect(out).toMatchObject({ with_genres: '28,12', with_original_language: 'ko', 'vote_average.gte': '7.5' });
  });

  it('filters append_to_response to the endpoint allowlist; ignores it on lists', () => {
    expect(sanitizeTmdbParams(sp({ append_to_response: 'videos,credits,account_states' }), detail).append_to_response).toBe(
      'videos,credits',
    );
    expect(sanitizeTmdbParams(sp({ append_to_response: 'videos' }), list).append_to_response).toBeUndefined();
  });

  it('produces sorted keys (stable cache key)', () => {
    expect(Object.keys(sanitizeTmdbParams(sp({ with_genres: '1', page: '2', sort_by: 'popularity.desc' }), discover))).toEqual([
      'include_adult',
      'page',
      'sort_by',
      'with_genres',
    ]);
  });
});
