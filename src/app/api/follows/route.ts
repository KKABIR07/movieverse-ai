import { connectDB } from '@/lib/db/mongoose';
import { Follow, type IFollow } from '@/lib/db/models';
import { requireSession } from '@/lib/db/auth';
import { json, readJson, withHandler } from '@/lib/server/http';
import { followCreateSchema, followDeleteSchema } from '@/lib/server/validation';
import { toFollowDTO } from '@/lib/server/dto';

const MAX_FOLLOWS_RETURNED = 1000;

/** GET /api/follows (auth) → { following: FollowDTO[] } newest first */
export const GET = withHandler('follows.GET', async (req) => {
  const s = await requireSession(req);
  await connectDB();
  const docs = await Follow.find({ userId: s.userId })
    .sort({ followedAt: -1 })
    .limit(MAX_FOLLOWS_RETURNED)
    .lean<IFollow[]>();
  return json({ following: docs.map(toFollowDTO) });
});

/** POST /api/follows (auth) body { personId, personName, personImage?, department? } → { success, followerCount } (idempotent) */
export const POST = withHandler('follows.POST', async (req) => {
  const s = await requireSession(req);
  const { personId, personName, personImage, department } = await readJson(req, followCreateSchema);
  await connectDB();
  try {
    await Follow.updateOne(
      { userId: s.userId, personId },
      {
        $set: { personName, personImage, department },
        $setOnInsert: { userId: s.userId, personId, followedAt: new Date() },
      },
      { upsert: true },
    );
  } catch (err) {
    // A concurrent upsert won the race — the follow exists, which is what the caller wanted.
    if ((err as { code?: number }).code !== 11000) throw err;
  }
  const followerCount = await Follow.countDocuments({ personId });
  return json({ success: true, followerCount });
});

/** DELETE /api/follows (auth) body { personId } → { success, followerCount } (idempotent) */
export const DELETE = withHandler('follows.DELETE', async (req) => {
  const s = await requireSession(req);
  const { personId } = await readJson(req, followDeleteSchema);
  await connectDB();
  await Follow.deleteOne({ userId: s.userId, personId });
  const followerCount = await Follow.countDocuments({ personId });
  return json({ success: true, followerCount });
});
