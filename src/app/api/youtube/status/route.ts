import { getYoutubeApiKey } from '@/lib/server/env';
import { json, withHandler } from '@/lib/server/http';

/** GET /api/youtube/status → { configured } — never calls YouTube (no quota cost). */
export const GET = withHandler('youtube.status', async () =>
  json({ configured: getYoutubeApiKey() !== null }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } }),
);
