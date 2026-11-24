import { connectDB } from '@/lib/db/mongoose';
import { Follow } from '@/lib/db/models';
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
  await connectDB();
  const rows = await Follow.aggregate<{ _id: number; count: number }>([
    { $match: { personId: { $in: ids } } },
    { $group: { _id: '$personId', count: { $sum: 1 } } },
  ]);
  const counts: Record<number, number> = {};
  for (const r of rows) counts[r._id] = r.count;
  return json({ counts }, { headers: CACHE });
});
