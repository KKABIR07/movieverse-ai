import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongoose';
import { Watchlist } from '@/lib/db/models';
import { getSession } from '@/lib/db/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectDB();
  const doc = await Watchlist.findOne({ userId: session.userId });
  return NextResponse.json({ items: doc?.items ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const item = await req.json();
  if (!item?.id || !item?.mediaType) {
    return NextResponse.json({ error: 'Invalid item' }, { status: 400 });
  }

  await connectDB();
  const doc = await Watchlist.findOneAndUpdate(
    { userId: session.userId },
    { $addToSet: { items: item } },
    { upsert: true, new: true }
  );

  return NextResponse.json({ items: doc.items });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, mediaType } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  await connectDB();
  const doc = await Watchlist.findOneAndUpdate(
    { userId: session.userId },
    { $pull: { items: { id, mediaType } } },
    { new: true }
  );

  return NextResponse.json({ items: doc?.items ?? [] });
}
