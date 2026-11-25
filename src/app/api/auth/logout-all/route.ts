import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { clearAuthCookie, invalidateTokenVersionCache, requireSession } from '@/lib/db/auth';
import { json, withHandler } from '@/lib/server/http';

/** Revokes every session of the current user (bumps tokenVersion) and clears this cookie. */
export const POST = withHandler('auth.logoutAll', async (req) => {
  const session = await requireSession(req);
  await getDb()
    .update(users)
    .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
    .where(eq(users.id, session.userId));
  invalidateTokenVersionCache(session.userId);
  return clearAuthCookie(json({ ok: true }));
});
