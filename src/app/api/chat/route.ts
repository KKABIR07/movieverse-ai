import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongoose';
import { ChatMessage } from '@/lib/db/models';
import { getSession } from '@/lib/db/auth';

const USER_COLORS = [
  '#7c3aed', '#4f46e5', '#0891b2', '#059669',
  '#d97706', '#dc2626', '#db2777', '#7c3aed',
];
function userColor(userId: string): string {
  let hash = 0;
  for (const c of userId) hash = ((hash << 5) - hash) + c.charCodeAt(0);
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get('roomId') ?? 'general';
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const messages = await ChatMessage.find({ roomId })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return NextResponse.json({ messages: messages.reverse() });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { roomId = 'general', text } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 });

  await connectDB();
  const msg = await ChatMessage.create({
    roomId,
    userId: session.userId,
    userName: session.name,
    userInitials: session.initials,
    color: userColor(session.userId),
    text: text.trim(),
  });

  return NextResponse.json({ message: msg }, { status: 201 });
}
