import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongoose';
import { Follow } from '@/lib/db/models';
import { getSession } from '@/lib/db/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const docs = await Follow.find({ userId: session.userId }).sort({ followedAt: -1 });
  return NextResponse.json({ following: docs });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { personId, personName, personImage, department } = await req.json();
  if (!personId || !personName) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  await connectDB();
  await Follow.findOneAndUpdate(
    { userId: session.userId, personId },
    { personName, personImage: personImage ?? null, department: department ?? 'Acting', followedAt: new Date() },
    { upsert: true }
  );

  const count = await Follow.countDocuments({ personId });
  return NextResponse.json({ success: true, followerCount: count });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { personId } = await req.json();
  if (!personId) return NextResponse.json({ error: 'Missing personId' }, { status: 400 });

  await connectDB();
  await Follow.deleteOne({ userId: session.userId, personId });

  const count = await Follow.countDocuments({ personId });
  return NextResponse.json({ success: true, followerCount: count });
}
