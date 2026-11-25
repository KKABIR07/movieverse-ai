import { json, readQuery, withHandler } from '@/lib/server/http';
import { youtubeShortsQuery } from '@/lib/server/validation';
import { searchShorts } from '@/lib/server/youtube';

/**
 * GET /api/youtube/shorts?q=<title ≤100>&n=<1..10, default 3>&type=shorts|videos
 * 200 { items: YTShortItem[] } · 400 invalid params · 503 { code: 'NO_KEY' | 'YOUTUBE_QUOTA' } · 502 upstream
 */
export const GET = withHandler('youtube.shorts', async (req) => {
  const { q, n, type } = readQuery(req, youtubeShortsQuery);
  const { items, cache } = await searchShorts(q, n, type);
  return json(
    { items },
    { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600', 'X-Cache': cache } },
  );
});
