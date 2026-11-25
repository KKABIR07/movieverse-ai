/**
 * Trailer lookup + background-embed helpers shared by the home hero and the hover previews on cards.
 * Keys come from TMDB through our /api/tmdb proxy (no secrets in the browser) and are cached per
 * title for the life of the tab, so a second hover or a carousel loop never refetches.
 */
import { tmdb, getTrailerKey } from '@/lib/tmdb';
import { YT_EMBED_ORIGIN } from '@/components/shorts/keys';
import type { MediaType } from '@/components/media/types';

export { YT_EMBED_ORIGIN, playerCommand } from '@/components/shorts/keys';

const VIDEO_ID = /^[A-Za-z0-9_-]{6,20}$/;
const cache = new Map<string, Promise<string | null>>();

/** YouTube key of the best trailer for a title, or null (no trailer / TMDB unavailable). Never throws. */
export function loadTrailerKey(id: number, type: MediaType): Promise<string | null> {
  const k = `${type}:${id}`;
  let p = cache.get(k);
  if (!p) {
    p = (type === 'tv' ? tmdb.tv.videos(id) : tmdb.movie.videos(id))
      .then((v) => {
        const key = getTrailerKey(v);
        return key && VIDEO_ID.test(key) ? key : null;
      })
      .catch(() => {
        cache.delete(k); // transient failure: allow a later retry
        return null;
      });
    cache.set(k, p);
  }
  return p;
}

/** Test hook. */
export function clearTrailerCache(): void {
  cache.clear();
}

/**
 * Muted, chrome-less, looping embed for use as moving artwork behind content.
 * `enablejsapi` lets the hero unmute without reloading (see playerCommand).
 */
export function backgroundEmbedUrl(videoId: string, origin?: string): string | null {
  if (!VIDEO_ID.test(videoId)) return null;
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    controls: '0',
    disablekb: '1',
    fs: '0',
    iv_load_policy: '3',
    cc_load_policy: '0',
    modestbranding: '1',
    rel: '0',
    playsinline: '1',
    loop: '1',
    playlist: videoId,
    enablejsapi: '1',
  });
  if (origin && /^https?:\/\/[^/]+$/.test(origin)) params.set('origin', origin);
  return `${YT_EMBED_ORIGIN}/embed/${videoId}?${params}`;
}

/** True when the browser asked us to save data (Network Information API; absent = false). */
export function prefersSaveData(): boolean {
  if (typeof navigator === 'undefined') return false;
  const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return c?.saveData === true;
}
