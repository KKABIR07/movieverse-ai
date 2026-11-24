import type { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db/mongoose';
import { User, type IUser } from '@/lib/db/models';
import { clearAuthCookie, hasAuthCookie, verifyToken, AUTH_COOKIE, toUserDTO, type UserDTO } from '@/lib/db/auth';
import { json, getRequestId } from '@/lib/server/http';
import { logger } from '@/lib/server/logger';

/**
 * GET /api/auth/me — NEVER throws, always 200 with `{ user }`:
 *  - no cookie / invalid / expired / revoked token → { user: null } (and the stale cookie is cleared)
 *  - valid token                                  → { user: UserDTO }
 *  - valid token but DB or config unavailable     → { user: <from JWT claims, joinedAt: null>, degraded: true }
 *    (keeps the UI signed in during a DB blip; every protected endpoint still enforces auth itself)
 */
export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  const headers = { 'x-request-id': requestId };
  const anonymous = (clear: boolean) => {
    const res = json<{ user: null }>({ user: null }, { headers });
    return clear ? clearAuthCookie(res) : res;
  };

  if (!hasAuthCookie(req)) return anonymous(false);

  let session;
  try {
    session = verifyToken(req.cookies.get(AUTH_COOKIE)?.value ?? '');
  } catch (err) {
    logger.error('auth.me: cannot verify token', { requestId, err });
    return anonymous(false); // JWT_SECRET not configured — treat as signed out, keep cookie
  }
  if (!session) return anonymous(true);

  try {
    await connectDB();
    const user = await User.findById(session.userId)
      .select('name email initials avatar tokenVersion createdAt')
      .lean<IUser>();
    if (!user || (user.tokenVersion ?? 0) !== session.tokenVersion) return anonymous(true);
    return json<{ user: UserDTO }>({ user: toUserDTO(user) }, { headers });
  } catch (err) {
    logger.warn('auth.me: degraded (db unavailable)', { requestId, err });
    const user: UserDTO = {
      id: session.userId,
      name: session.name,
      email: session.email,
      initials: session.initials,
      avatar: null,
      joinedAt: null,
    };
    return json({ user, degraded: true }, { headers });
  }
}
