import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db/mongoose';
import { User } from '@/lib/db/models';
import { signToken, setAuthCookie } from '@/lib/db/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    await connectDB();
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const token = signToken({ userId: user._id.toString(), name: user.name, email: user.email, initials: user.initials });
    const res = NextResponse.json({
      user: { id: user._id.toString(), name: user.name, email: user.email, initials: user.initials, avatar: user.avatar, joinedAt: user.createdAt },
    });

    return setAuthCookie(res, token);
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
