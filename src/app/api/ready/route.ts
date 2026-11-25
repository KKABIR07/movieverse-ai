import { pingDB } from '@/lib/db/client';
import { isTmdbConfigured } from '@/lib/server/env';

/** GET /api/ready — readiness: Postgres `select 1` with a 2 s timeout. 200 { ok, db:'up' } | 503 { ok:false, db:'down' } */
export async function GET() {
  const dbUp = await pingDB(2000);
  return Response.json(
    { ok: dbUp, db: dbUp ? 'up' : 'down', tmdb: isTmdbConfigured() ? 'configured' : 'missing' },
    { status: dbUp ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
