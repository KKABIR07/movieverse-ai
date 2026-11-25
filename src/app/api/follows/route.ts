import { and, count, desc, eq, sql } from 'drizzle-orm';
import { getDb, type Db } from '@/lib/db/client';
import { follows } from '@/lib/db/schema';
import { requireSession } from '@/lib/db/auth';
import { json, readJson, withHandler } from '@/lib/server/http';
import { followCreateSchema, followDeleteSchema } from '@/lib/server/validation';
import { toFollowDTO } from '@/lib/server/dto';

const MAX_FOLLOWS_RETURNED = 1000;

async function followerCount(db: Db, personId: number): Promise<number> {
  const [{ n }] = await db.select({ n: count() }).from(follows).where(eq(follows.personId, personId));
  return n;
}

/** GET /api/follows (auth) → { following: FollowDTO[] } newest first */
export const GET = withHandler('follows.GET', async (req) => {
  const s = await requireSession(req);
  const rows = await getDb()
    .select({
      personId: follows.personId,
      personName: follows.personName,
      personImage: follows.personImage,
      department: follows.department,
      createdAt: follows.createdAt,
    })
    .from(follows)
    .where(eq(follows.userId, s.userId))
    .orderBy(desc(follows.createdAt), desc(follows.personId))
    .limit(MAX_FOLLOWS_RETURNED);
  return json({ following: rows.map(toFollowDTO) });
});

/** POST /api/follows (auth) body { personId, personName, personImage?, department? } → { success, followerCount } (idempotent) */
export const POST = withHandler('follows.POST', async (req) => {
  const s = await requireSession(req);
  const { personId, personName, personImage, department } = await readJson(req, followCreateSchema);
  const db = getDb();
  // Re-following refreshes the display fields but keeps the original follow time.
  await db
    .insert(follows)
    .values({ userId: s.userId, personId, personName, personImage, department })
    .onConflictDoUpdate({
      target: [follows.userId, follows.personId],
      set: {
        personName: sql`excluded.person_name`,
        personImage: sql`excluded.person_image`,
        department: sql`excluded.department`,
      },
    });
  return json({ success: true, followerCount: await followerCount(db, personId) });
});

/** DELETE /api/follows (auth) body { personId } → { success, followerCount } (idempotent) */
export const DELETE = withHandler('follows.DELETE', async (req) => {
  const s = await requireSession(req);
  const { personId } = await readJson(req, followDeleteSchema);
  const db = getDb();
  await db.delete(follows).where(and(eq(follows.userId, s.userId), eq(follows.personId, personId)));
  return json({ success: true, followerCount: await followerCount(db, personId) });
});
