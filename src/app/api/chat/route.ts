import { and, desc, eq, gt, type SQL } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { chatMessages } from '@/lib/db/schema';
import { maybeSweep } from '@/lib/db/maintenance';
import { getOptionalSession, requireSession } from '@/lib/db/auth';
import { json, readJson, readQuery, withHandler } from '@/lib/server/http';
import { chatListQuery, chatPostSchema } from '@/lib/server/validation';
import { toChatDTO } from '@/lib/server/dto';

const USER_COLORS = ['#7c3aed', '#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#db2777', '#9333ea'];
function userColor(userId: string): string {
  let hash = 0;
  for (const c of userId) hash = (hash << 5) - hash + c.charCodeAt(0);
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

const PAGE = 50;

/**
 * GET /api/chat?roomId=<room>&after=<ISO datetime>  (PUBLIC, read-only for signed-out users)
 * → { messages: ChatMessageDTO[] } — the latest ≤50 messages (newer than `after` if given), oldest → newest.
 * `isMine` is computed for signed-in callers; user ids are never returned. Poll-friendly (no-store).
 */
export const GET = withHandler('chat.GET', async (req) => {
  const { roomId, after } = readQuery(req, chatListQuery);
  const session = await getOptionalSession(req);
  const where: SQL[] = [eq(chatMessages.roomId, roomId)];
  if (after) where.push(gt(chatMessages.createdAt, new Date(after)));
  const rows = await getDb()
    .select()
    .from(chatMessages)
    .where(and(...where))
    .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
    .limit(PAGE);
  return json({ messages: rows.reverse().map((m) => toChatDTO(m, session?.userId)) });
});

/**
 * POST /api/chat  (auth) body { roomId?, text 1..500 } → 201 { message: ChatMessageDTO }
 * ~1% of posts also trigger the 30-day retention sweep (fire-and-forget).
 */
export const POST = withHandler('chat.POST', async (req) => {
  const s = await requireSession(req);
  const { roomId, text } = await readJson(req, chatPostSchema);
  const db = getDb();
  const [msg] = await db
    .insert(chatMessages)
    .values({
      roomId,
      userId: s.userId,
      userName: s.name,
      userInitials: s.initials,
      color: userColor(s.userId),
      text,
    })
    .returning();
  maybeSweep('chat', db);
  return json({ message: toChatDTO(msg, s.userId) }, { status: 201 });
});
