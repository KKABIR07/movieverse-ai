import { connectDB } from '@/lib/db/mongoose';
import { User } from '@/lib/db/models';
import { clearAuthCookie, invalidateTokenVersionCache, requireSession } from '@/lib/db/auth';
import { json, withHandler } from '@/lib/server/http';

/** Revokes every session of the current user (bumps tokenVersion) and clears this cookie. */
export const POST = withHandler('auth.logoutAll', async (req) => {
  const session = await requireSession(req);
  await connectDB();
  await User.updateOne({ _id: session.userId }, { $inc: { tokenVersion: 1 } });
  invalidateTokenVersionCache(session.userId);
  return clearAuthCookie(json({ ok: true }));
});
