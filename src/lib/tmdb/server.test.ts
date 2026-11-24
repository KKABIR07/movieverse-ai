import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { tmdbFetch, getMovie, getPerson, discover, getTopIds, getWatchProviders, searchMulti, TmdbError } from './server';

const okJson = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
const status = (s: number) => new Response('{}', { status: s });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv('TMDB_BEARER', 'test-bearer-token-0123456789abcdef');
  vi.stubEnv('TMDB_API_KEY', '');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const lastUrl = () => new URL(String(fetchMock.mock.calls.at(-1)![0]));
const lastInit = () => fetchMock.mock.calls.at(-1)![1] as RequestInit & { next?: { revalidate?: number } };

describe('tmdbFetch', () => {
  it('sends bearer auth, default language, revalidate and a timeout signal', async () => {
    fetchMock.mockResolvedValue(okJson({ id: 1 }));
    await tmdbFetch('movie/popular', { page: 2 }, { cls: 'list' });
    const url = lastUrl();
    expect(url.origin + url.pathname).toBe('https://api.themoviedb.org/3/movie/popular');
    expect(url.searchParams.get('language')).toBe('en-US');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.has('api_key')).toBe(false);
    const init = lastInit();
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-bearer-token-0123456789abcdef');
    expect(init.next?.revalidate).toBe(3600);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('falls back to api_key when no bearer', async () => {
    vi.stubEnv('TMDB_BEARER', '');
    vi.stubEnv('TMDB_API_KEY', 'abcdef0123456789');
    fetchMock.mockResolvedValue(okJson({}));
    await tmdbFetch('genre/movie/list', {}, { cls: 'static' });
    expect(lastUrl().searchParams.get('api_key')).toBe('abcdef0123456789');
    expect((lastInit().headers as Record<string, string>).Authorization).toBeUndefined();
    expect(lastInit().next?.revalidate).toBe(604800);
  });

  it('throws ConfigError (503) when no credentials, without calling fetch', async () => {
    vi.stubEnv('TMDB_BEARER', '');
    await expect(tmdbFetch('movie/popular')).rejects.toMatchObject({ status: 503, code: 'NOT_CONFIGURED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retries once on 5xx then succeeds', async () => {
    fetchMock.mockResolvedValueOnce(status(502)).mockResolvedValueOnce(okJson({ ok: true }));
    await expect(tmdbFetch('movie/popular')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries once on network error, then throws TmdbError(0)', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const err = await tmdbFetch('movie/popular').catch((e) => e);
    expect(err).toBeInstanceOf(TmdbError);
    expect(err.status).toBe(0);
    expect(err.retryable).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry 4xx', async () => {
    fetchMock.mockResolvedValue(status(401));
    await expect(tmdbFetch('movie/popular')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('typed helpers', () => {
  it('getMovie returns null on 404 and for invalid ids', async () => {
    fetchMock.mockResolvedValue(status(404));
    await expect(getMovie(999999999)).resolves.toBeNull();
    await expect(getMovie(-1)).resolves.toBeNull();
    await expect(getPerson(1.5)).resolves.toBeNull();
  });

  it('getMovie appends sub-resources and uses the 24h class', async () => {
    fetchMock.mockResolvedValue(okJson({ id: 550, title: 'Fight Club' }));
    await expect(getMovie(550)).resolves.toMatchObject({ id: 550 });
    expect(lastUrl().searchParams.get('append_to_response')).toContain('videos');
    expect(lastInit().next?.revalidate).toBe(86400);
  });

  it('getMovie rethrows non-404 errors', async () => {
    fetchMock.mockResolvedValue(status(500));
    await expect(getMovie(550)).rejects.toBeInstanceOf(TmdbError);
  });

  it('discover maps filters', async () => {
    fetchMock.mockResolvedValue(okJson({ page: 1, results: [], total_pages: 1, total_results: 0 }));
    await discover('tv', { genres: [18], yearFrom: 2010, yearTo: 2012, page: 3 });
    const sp = lastUrl().searchParams;
    expect(lastUrl().pathname).toBe('/3/discover/tv');
    expect(sp.get('with_genres')).toBe('18');
    expect(sp.get('first_air_date.gte')).toBe('2010-01-01');
    expect(sp.get('page')).toBe('3');
  });

  it('searchMulti trims/caps the query and disables adult', async () => {
    fetchMock.mockResolvedValue(okJson({ page: 1, results: [] }));
    await searchMulti(`  ${'x'.repeat(150)}  `);
    expect(lastUrl().searchParams.get('query')).toHaveLength(100);
    expect(lastUrl().searchParams.get('include_adult')).toBe('false');
  });

  it('getWatchProviders picks a region', async () => {
    fetchMock.mockImplementation(async () => okJson({ results: { US: { link: 'x', flatrate: [] }, GB: { link: 'y' } } }));
    await expect(getWatchProviders('movie', 550, 'gb')).resolves.toEqual({ link: 'y' });
    await expect(getWatchProviders('movie', 550, 'FR')).resolves.toBeNull();
  });

  it('getTopIds collects, de-dupes and stops at n', async () => {
    let call = 0;
    fetchMock.mockImplementation(async () => {
      call++;
      const base = (call - 1) * 20;
      return okJson({ page: call, total_pages: 50, results: Array.from({ length: 20 }, (_, i) => ({ id: (base + i) % 30 + 1 })) });
    });
    const ids = await getTopIds('movie', 25);
    expect(ids).toHaveLength(25);
    expect(new Set(ids).size).toBe(25);
  });

  it('getTopIds returns partial results if a page fails', async () => {
    fetchMock
      .mockResolvedValueOnce(okJson({ page: 1, total_pages: 5, results: [{ id: 1 }, { id: 2 }] }))
      .mockResolvedValue(status(404));
    await expect(getTopIds('person', 10)).resolves.toEqual([1, 2]);
  });
});
