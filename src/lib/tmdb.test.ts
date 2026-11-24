import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tmdb, TmdbClientError, tmdbRetry, TMDB_KEY_MISSING } from './tmdb';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubGlobal('window', {}); // the browser client refuses to run on the server
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ page: 1, results: [] }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

const calledUrl = () => String(fetchMock.mock.calls.at(-1)![0]);

describe('browser tmdb client', () => {
  it('calls the same-origin proxy (relative URL, no credentials, no secrets)', async () => {
    await tmdb.movie.trending('week');
    expect(calledUrl()).toBe('/api/tmdb/trending/movie/week?page=1');
    const init = fetchMock.mock.calls.at(-1)![1] as RequestInit;
    expect(init.credentials).toBe('omit');
    expect(JSON.stringify(init)).not.toMatch(/bearer|api_key/i);
  });

  it('keeps existing call signatures', async () => {
    await tmdb.movie.popular(3);
    expect(calledUrl()).toBe('/api/tmdb/movie/popular?page=3');
    await tmdb.movie.detail(550);
    expect(calledUrl()).toMatch(/^\/api\/tmdb\/movie\/550\?append_to_response=videos%2Ccredits/);
    await tmdb.movie.discover({ with_genres: '28', page: 2 });
    expect(calledUrl()).toBe('/api/tmdb/discover/movie?sort_by=popularity.desc&with_genres=28&page=2');
    await tmdb.tv.videos(1399);
    expect(calledUrl()).toBe('/api/tmdb/tv/1399/videos');
    await tmdb.search.multi('dune', 2);
    expect(calledUrl()).toBe('/api/tmdb/search/multi?query=dune&page=2');
    await tmdb.person.trending('day', 2);
    expect(calledUrl()).toBe('/api/tmdb/trending/person/day?page=2');
    await tmdb.genre.tvList();
    expect(calledUrl()).toBe('/api/tmdb/genre/tv/list');
  });

  it('drops empty params', async () => {
    await tmdb.movie.discover({ with_genres: '', sort_by: 'vote_average.desc' });
    expect(calledUrl()).toBe('/api/tmdb/discover/movie?sort_by=vote_average.desc');
  });

  it('throws TmdbClientError with status/code; retry helper only retries transient errors', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Not found.', code: 'NOT_FOUND' }), { status: 404 }));
    const e404 = await tmdb.movie.detail(1).catch((e) => e);
    expect(e404).toBeInstanceOf(TmdbClientError);
    expect(e404).toMatchObject({ status: 404, code: 'NOT_FOUND', message: 'Not found.' });
    expect(tmdbRetry(0, e404)).toBe(false);

    fetchMock.mockResolvedValueOnce(new Response('bad gateway', { status: 502 }));
    const e502 = await tmdb.movie.popular().catch((e) => e);
    expect(e502.retryable).toBe(true);
    expect(tmdbRetry(0, e502)).toBe(true);
    expect(tmdbRetry(2, e502)).toBe(false);

    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    const eNet = await tmdb.movie.popular().catch((e) => e);
    expect(eNet.status).toBe(0);
  });

  it('refuses to run on the server', async () => {
    vi.unstubAllGlobals();
    await expect(tmdb.movie.popular()).rejects.toBeInstanceOf(TmdbClientError);
  });

  it('TMDB_KEY_MISSING is a constant false (keys are server-side)', () => {
    expect(TMDB_KEY_MISSING).toBe(false);
  });
});
