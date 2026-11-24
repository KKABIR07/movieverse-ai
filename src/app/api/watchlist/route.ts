import type { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db/mongoose';
import { Watchlist, type IWatchlistItem } from '@/lib/db/models';
import { requireSession } from '@/lib/db/auth';
import { HttpError } from '@/lib/server/errors';
import { json, readJson, withHandler } from '@/lib/server/http';
import {
  WATCHLIST_MAX_ITEMS,
  watchlistItemSchema,
  watchlistRemoveSchema,
  type WatchlistItemInput,
} from '@/lib/server/validation';

/** Whitelisted, normalised item (unknown client fields are dropped by zod). */
function toItem(input: WatchlistItemInput): IWatchlistItem {
  const item: IWatchlistItem = {
    id: input.id,
    media_type: input.media_type,
    poster_path: input.poster_path,
    backdrop_path: input.backdrop_path,
    vote_average: input.vote_average,
    addedAt: input.addedAt ?? new Date().toISOString(),
  };
  if (input.title) item.title = input.title;
  if (input.name) item.name = input.name;
  if (input.release_date !== undefined) item.release_date = input.release_date;
  if (input.first_air_date !== undefined) item.first_air_date = input.first_air_date;
  return item;
}

async function loadItems(userId: string): Promise<IWatchlistItem[]> {
  const doc = await Watchlist.findOne({ userId }).select('items').lean<{ items?: IWatchlistItem[] }>();
  return doc?.items ?? [];
}

/** GET /api/watchlist → { items } (newest first) */
export const GET = withHandler('watchlist.GET', async (req) => {
  const s = await requireSession(req);
  await connectDB();
  return json({ items: await loadItems(s.userId) });
});

/**
 * POST /api/watchlist  body: WatchlistItem  → { items }
 * Idempotent: an item already present (same id + media_type) is not duplicated (200).
 * 409 WATCHLIST_FULL when the list already holds 1000 items.
 */
export const POST = withHandler('watchlist.POST', async (req) => {
  const s = await requireSession(req);
  const item = toItem(await readJson(req, watchlistItemSchema));
  await connectDB();

  await Watchlist.updateOne({ userId: s.userId }, { $setOnInsert: { items: [] } }, { upsert: true }).catch((err) => {
    if ((err as { code?: number }).code !== 11000) throw err; // concurrent first insert — doc exists now
  });
  const updated = await Watchlist.findOneAndUpdate(
    {
      userId: s.userId,
      [`items.${WATCHLIST_MAX_ITEMS - 1}`]: { $exists: false },
      items: { $not: { $elemMatch: { id: item.id, media_type: item.media_type } } },
    },
    { $push: { items: { $each: [item], $position: 0 } } },
    { returnDocument: 'after', projection: { items: 1 } },
  ).lean<{ items: IWatchlistItem[] }>();

  if (updated) return json({ items: updated.items }, { status: 201 });

  const items = await loadItems(s.userId);
  if (items.some((i) => i.id === item.id && i.media_type === item.media_type)) return json({ items });
  throw new HttpError(409, `Watchlist is full (max ${WATCHLIST_MAX_ITEMS} items).`, { code: 'WATCHLIST_FULL' });
});

function removeInput(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  const media = req.nextUrl.searchParams.get('media_type');
  return id !== null ? { id: Number(id), media_type: media } : null;
}

/** DELETE /api/watchlist  body { id, media_type }  (or ?id=&media_type=)  → { items } */
export const DELETE = withHandler('watchlist.DELETE', async (req) => {
  const s = await requireSession(req);
  const fromQuery = removeInput(req);
  const { id, media_type } = fromQuery ? watchlistRemoveSchema.parse(fromQuery) : await readJson(req, watchlistRemoveSchema);
  await connectDB();
  const doc = await Watchlist.findOneAndUpdate(
    { userId: s.userId },
    { $pull: { items: { id, media_type } } },
    { returnDocument: 'after', projection: { items: 1 } },
  ).lean<{ items: IWatchlistItem[] }>();
  return json({ items: doc?.items ?? [] });
});
