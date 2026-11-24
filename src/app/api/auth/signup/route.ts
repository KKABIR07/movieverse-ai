import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db/mongoose';
import { User } from '@/lib/db/models';
import { signToken, setAuthCookie, initialsFor, toUserDTO } from '@/lib/db/auth';
import { getJwtSecret } from '@/lib/server/env';
import { HttpError } from '@/lib/server/errors';
import { json, readJson, withHandler } from '@/lib/server/http';
import { signupSchema } from '@/lib/server/validation';

const BCRYPT_COST = 11;

export const POST = withHandler('auth.signup', async (req) => {
  const { name, email, password } = await readJson(req, signupSchema);
  getJwtSecret(); // fail fast (503) before creating an account we could not log into

  await connectDB();
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  let user;
  try {
    user = await User.create({ name, email, passwordHash, initials: initialsFor(name) });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      throw new HttpError(409, 'An account with this email already exists.', { code: 'EMAIL_TAKEN' });
    }
    throw err;
  }

  const token = signToken({
    userId: user._id.toString(),
    name: user.name,
    email: user.email,
    initials: user.initials,
    tokenVersion: user.tokenVersion ?? 0,
  });
  return setAuthCookie(json({ user: toUserDTO(user) }, { status: 201 }), token);
});
