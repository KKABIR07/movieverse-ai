import { NextResponse } from 'next/server';
import { getSession } from '@/lib/db/auth';
import { connectDB } from '@/lib/db/mongoose';
import { User } from '@/lib/db/models';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null });

  await connectDB();
  const user = await User.findById(session.userId).select('-passwordHash');
  if (!user) return NextResponse.json({ user: null });

  return NextResponse.json({
    user: { id: user._id.toString(), name: user.name, email: user.email, initials: user.initials, avatar: user.avatar, joinedAt: user.createdAt },
  });
}
