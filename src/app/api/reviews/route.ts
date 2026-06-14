import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongoose';
import { Review } from '@/lib/db/models';
import { getSession } from '@/lib/db/auth';

export async function GET(req: NextRequest) {
  const movieId = req.nextUrl.searchParams.get('movieId');
  if (!movieId) return NextResponse.json({ reviews: [] });

  await connectDB();
  const reviews = await Review.find({ movieId: Number(movieId) })
    .sort({ createdAt: -1 })
    .limit(50);

  return NextResponse.json({ reviews });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { movieId, movieTitle, moviePoster, rating, content, spoiler } = await req.json();
  if (!movieId || !rating || !content?.trim()) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
  }

  await connectDB();
  const review = await Review.create({
    movieId, movieTitle, moviePoster,
    userId: session.userId,
    userName: session.name,
    userInitials: session.initials,
    rating, content: content.trim(), spoiler: !!spoiler,
  });

  return NextResponse.json({ review }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  await connectDB();
  const review = await Review.findById(id);
  if (!review) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (review.userId.toString() !== session.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await review.deleteOne();
  return NextResponse.json({ ok: true });
}
