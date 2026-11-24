import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db/mongoose';
import { User, type IUser } from '@/lib/db/models';
import { signToken, setAuthCookie, toUserDTO } from '@/lib/db/auth';
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

  // DB failures propagate as DatabaseUnavailableError → 503 (not 401/500).
  await connectDB();
  const user = await User.findOne({ email })
    .select('+passwordHash name email initials avatar tokenVersion createdAt')
    .lean<IUser>();

  const ok = await bcrypt.compare(password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !ok) throw INVALID();

  const token = signToken({
    userId: user._id.toString(),
    name: user.name,
    email: user.email,
    initials: user.initials,
    tokenVersion: user.tokenVersion ?? 0,
  });
  return setAuthCookie(json({ user: toUserDTO(user) }), token);
});
