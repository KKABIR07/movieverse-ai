import { count, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { follows } from '@/lib/db/schema';
import { json, readQuery, withHandler } from '@/lib/server/http';
import { followCountsQuery } from '@/lib/server/validation';

const CACHE = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' };

/**
 * GET /api/follows/counts?ids=1,2,3 (public; ≤100 positive ints)
 * → { counts: Record<personId, number> } (ids with zero followers are omitted). Missing ids → { counts: {} }.
 */
export const GET = withHandler('follows.counts', async (req) => {
  if (!req.nextUrl.searchParams.get('ids')) return json({ counts: {} }, { headers: CACHE });
  const { ids } = readQuery(req, followCountsQuery);
  const rows = await getDb()
    .select({ personId: follows.personId, n: count() })
    .from(follows)
    .where(inArray(follows.personId, ids))
    .groupBy(follows.personId);
  const counts: Record<number, number> = {};
  for (const r of rows) counts[r.personId] = r.n;
  return json({ counts }, { headers: CACHE });
});
