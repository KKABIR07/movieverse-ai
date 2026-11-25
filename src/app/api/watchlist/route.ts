import type { NextRequest } from 'next/server';
import { and, count, desc, eq } from 'drizzle-orm';
import { getDb, type Db } from '@/lib/db/client';
import { users, watchlistItems } from '@/lib/db/schema';
import { requireSession } from '@/lib/db/auth';
import { HttpError, unauthorized } from '@/lib/server/errors';
import { json, readJson, withHandler } from '@/lib/server/http';
import { toWatchlistDTO, type WatchlistItemDTO } from '@/lib/server/dto';
import {
  WATCHLIST_MAX_ITEMS,
  watchlistItemSchema,
  watchlistRemoveSchema,
  type WatchlistItemInput,
} from '@/lib/server/validation';

const itemColumns = {
  tmdbId: watchlistItems.tmdbId,
  mediaType: watchlistItems.mediaType,
  title: watchlistItems.title,
  name: watchlistItems.name,
  posterPath: watchlistItems.posterPath,
  backdropPath: watchlistItems.backdropPath,
  voteAverage: watchlistItems.voteAverage,
  releaseDate: watchlistItems.releaseDate,
  firstAirDate: watchlistItems.firstAirDate,
  addedAt: watchlistItems.addedAt,
};

async function loadItems(db: Pick<Db, 'select'>, userId: string): Promise<WatchlistItemDTO[]> {
  const rows = await db
    .select(itemColumns)
    .from(watchlistItems)
    .where(eq(watchlistItems.userId, userId))
    .orderBy(desc(watchlistItems.addedAt), desc(watchlistItems.tmdbId))
    .limit(WATCHLIST_MAX_ITEMS);
  return rows.map(toWatchlistDTO);
}

/** Whitelisted, normalised row (unknown client fields were already dropped by zod). */
function toRow(userId: string, input: WatchlistItemInput): typeof watchlistItems.$inferInsert {
  return {
    userId,
    tmdbId: input.id,
    mediaType: input.media_type,
    title: input.title || null,
    name: input.name || null,
    posterPath: input.poster_path,
    backdropPath: input.backdrop_path,
    voteAverage: input.vote_average,
    releaseDate: input.release_date ?? null,
    firstAirDate: input.first_air_date ?? null,
    addedAt: input.addedAt ? new Date(input.addedAt) : new Date(),
  };
}

/** GET /api/watchlist → { items } (newest first) */
export const GET = withHandler('watchlist.GET', async (req) => {
  const s = await requireSession(req);
  return json({ items: await loadItems(getDb(), s.userId) });
});

/**
 * POST /api/watchlist  body: WatchlistItem  → { items }
 * Idempotent: an item already present (same id + media_type) is not duplicated (200).
 * 409 WATCHLIST_FULL when the list already holds 1000 items.
 * The cap check + insert run in one transaction serialised per user (row lock on users).
 */
export const POST = withHandler('watchlist.POST', async (req) => {
  const s = await requireSession(req);
  const row = toRow(s.userId, await readJson(req, watchlistItemSchema));

  const result = await getDb().transaction(async (tx) => {
    const [owner] = await tx.select({ id: users.id }).from(users).where(eq(users.id, s.userId)).for('update');
    if (!owner) throw unauthorized();

    const [present] = await tx
      .select({ tmdbId: watchlistItems.tmdbId })
      .from(watchlistItems)
      .where(
        and(
          eq(watchlistItems.userId, s.userId),
          eq(watchlistItems.mediaType, row.mediaType),
          eq(watchlistItems.tmdbId, row.tmdbId),
        ),
      )
      .limit(1);
    if (present) return { status: 200, items: await loadItems(tx, s.userId) };

    const [{ n }] = await tx.select({ n: count() }).from(watchlistItems).where(eq(watchlistItems.userId, s.userId));
    if (n >= WATCHLIST_MAX_ITEMS) {
      throw new HttpError(409, `Watchlist is full (max ${WATCHLIST_MAX_ITEMS} items).`, { code: 'WATCHLIST_FULL' });
    }
    // The composite PK makes this a no-op if a concurrent request (impossible under the lock) won.
    await tx.insert(watchlistItems).values(row).onConflictDoNothing();
    return { status: 201, items: await loadItems(tx, s.userId) };
  });
  return json({ items: result.items }, { status: result.status });
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
  const db = getDb();
  await db
    .delete(watchlistItems)
    .where(and(eq(watchlistItems.userId, s.userId), eq(watchlistItems.mediaType, media_type), eq(watchlistItems.tmdbId, id)));
  return json({ items: await loadItems(db, s.userId) });
});
