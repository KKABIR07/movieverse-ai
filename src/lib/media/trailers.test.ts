import { beforeEach, describe, expect, it, vi } from 'vitest';

const movieVideos = vi.fn();
const tvVideos = vi.fn();
vi.mock('@/lib/tmdb', () => ({
  tmdb: { movie: { videos: (id: number) => movieVideos(id) }, tv: { videos: (id: number) => tvVideos(id) } },
  getTrailerKey: (v: { results: { key: string }[] }) => v.results[0]?.key ?? null,
}));

const { backgroundEmbedUrl, clearTrailerCache, loadTrailerKey, prefersSaveData } = await import('./trailers');

const result = (key: string) => ({ results: [{ key }] });

describe('loadTrailerKey', () => {
  beforeEach(() => {
    clearTrailerCache();
    movieVideos.mockReset();
    tvVideos.mockReset();
  });

  it('looks up movie and tv trailers on their own endpoints', async () => {
    movieVideos.mockResolvedValue(result('movieKey123'));
    tvVideos.mockResolvedValue(result('tvKey45678'));
    expect(await loadTrailerKey(550, 'movie')).toBe('movieKey123');
    expect(await loadTrailerKey(1399, 'tv')).toBe('tvKey45678');
    expect(movieVideos).toHaveBeenCalledWith(550);
    expect(tvVideos).toHaveBeenCalledWith(1399);
  });

  it('caches per title, including concurrent callers (one request)', async () => {
    movieVideos.mockResolvedValue(result('abcdefghijk'));
    const [a, b] = await Promise.all([loadTrailerKey(1, 'movie'), loadTrailerKey(1, 'movie')]);
    await loadTrailerKey(1, 'movie');
    expect([a, b]).toEqual(['abcdefghijk', 'abcdefghijk']);
    expect(movieVideos).toHaveBeenCalledTimes(1);
  });

  it('caches "no trailer" but retries after a network failure', async () => {
    movieVideos.mockResolvedValueOnce({ results: [] });
    expect(await loadTrailerKey(2, 'movie')).toBeNull();
    expect(await loadTrailerKey(2, 'movie')).toBeNull();
    expect(movieVideos).toHaveBeenCalledTimes(1);

    movieVideos.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(result('later12345'));
    expect(await loadTrailerKey(3, 'movie')).toBeNull();
    expect(await loadTrailerKey(3, 'movie')).toBe('later12345');
  });

  it('rejects keys that are not YouTube ids', async () => {
    movieVideos.mockResolvedValue(result('"><script>'));
    expect(await loadTrailerKey(4, 'movie')).toBeNull();
  });
});

describe('backgroundEmbedUrl', () => {
  it('is muted, chrome-less, looping, inline, JS-API enabled, on youtube-nocookie', () => {
    const u = new URL(backgroundEmbedUrl('dQw4w9WgXcQ', 'https://www.mkmovies.site')!);
    expect(u.origin).toBe('https://www.youtube-nocookie.com');
    expect(u.pathname).toBe('/embed/dQw4w9WgXcQ');
    const p = Object.fromEntries(u.searchParams);
    expect(p).toMatchObject({ autoplay: '1', mute: '1', controls: '0', loop: '1', playlist: 'dQw4w9WgXcQ', playsinline: '1', enablejsapi: '1' });
    expect(p.origin).toBe('https://www.mkmovies.site');
  });

  it('refuses bad ids and ignores a malformed origin', () => {
    expect(backgroundEmbedUrl('bad id!')).toBeNull();
    expect(new URL(backgroundEmbedUrl('dQw4w9WgXcQ', 'javascript:alert(1)')!).searchParams.has('origin')).toBe(false);
  });
});

describe('prefersSaveData', () => {
  it('reads navigator.connection.saveData, false when absent', () => {
    vi.stubGlobal('navigator', { connection: { saveData: true } });
    expect(prefersSaveData()).toBe(true);
    vi.stubGlobal('navigator', {});
    expect(prefersSaveData()).toBe(false);
    vi.unstubAllGlobals();
  });
});
