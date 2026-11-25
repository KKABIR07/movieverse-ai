import { clearAuthCookie } from '@/lib/db/auth';
import { json, withHandler } from '@/lib/server/http';

/** Clears this browser's session cookie. Always 200 (idempotent, no auth required). */
export const POST = withHandler('auth.logout', async () => clearAuthCookie(json({ ok: true })));
