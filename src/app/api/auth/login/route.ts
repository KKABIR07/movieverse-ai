import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { signToken, setAuthCookie, toUserDTO, userPublicColumns } from '@/lib/db/auth';
import { getJwtSecret } from '@/lib/server/env';
import { HttpError } from '@/lib/server/errors';
import { json, readJson, withHandler } from '@/lib/server/http';
import { loginSchema } from '@/lib/server/validation';

// Compared against when the email is unknown so both paths cost one bcrypt verification
// (no user-enumeration via response timing). Cost matches signup (11).
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= bcrypt.hash('mkmovies-timing-equaliser', 11));

const INVALID = () => new HttpError(401, 'Invalid email or password.', { code: 'INVALID_CREDENTIALS' });

export const POST = withHandler('auth.login', async (req) => {
  const { email, password } = await readJson(req, loginSchema);
  getJwtSecret(); // config problems → 503, never a misleading 401

  // DB failures propagate and are mapped to 503 DB_UNAVAILABLE (not 401/500).
  const [user] = await getDb()
    .select({ ...userPublicColumns, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const ok = await bcrypt.compare(password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !ok) throw INVALID();

  const token = signToken({
    userId: user.id,
    name: user.name,
    email: user.email,
    initials: user.initials,
    tokenVersion: user.tokenVersion,
  });
  return setAuthCookie(json({ user: toUserDTO(user) }), token);
});
