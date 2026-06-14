import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongoose';
import { Follow } from '@/lib/db/models';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get('ids');
  if (!idsParam) return NextResponse.json({ counts: {} });

  const ids = idsParam.split(',').map(Number).filter(Boolean);
  if (!ids.length) return NextResponse.json({ counts: {} });

  await connectDB();
  const results = await Follow.aggregate([
    { $match: { personId: { $in: ids } } },
    { $group: { _id: '$personId', count: { $sum: 1 } } },
  ]);

  const counts: Record<number, number> = {};
  results.forEach((r) => { counts[r._id] = r.count; });

  return NextResponse.json({ counts });
}
