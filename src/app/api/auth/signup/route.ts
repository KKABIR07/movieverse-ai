import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { signToken, setAuthCookie, initialsFor, toUserDTO, userPublicColumns } from '@/lib/db/auth';
import { getJwtSecret } from '@/lib/server/env';
import { HttpError, PG, pgSqlState } from '@/lib/server/errors';
import { json, readJson, withHandler } from '@/lib/server/http';
import { signupSchema } from '@/lib/server/validation';

const BCRYPT_COST = 11;

export const POST = withHandler('auth.signup', async (req) => {
  const { name, email, password } = await readJson(req, signupSchema);
  getJwtSecret(); // fail fast (503) before creating an account we could not log into

  const db = getDb(); // ConfigError (503) before hashing when DATABASE_URL is missing
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  let user;
  try {
    [user] = await db
      .insert(users)
      .values({ name, email, passwordHash, initials: initialsFor(name) })
      .returning(userPublicColumns);
  } catch (err) {
    if (pgSqlState(err) === PG.UNIQUE_VIOLATION) {
      throw new HttpError(409, 'An account with this email already exists.', { code: 'EMAIL_TAKEN' });
    }
    throw err;
  }

  const token = signToken({
    userId: user.id,
    name: user.name,
    email: user.email,
    initials: user.initials,
    tokenVersion: user.tokenVersion,
  });
  return setAuthCookie(json({ user: toUserDTO(user) }, { status: 201 }), token);
});
