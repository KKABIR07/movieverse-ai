import type { NextRequest } from 'next/server';
import { HttpError, notFound } from '@/lib/server/errors';
import { withHandler } from '@/lib/server/http';
import { cacheControlFor, matchTmdbPath, sanitizeTmdbParams, TmdbParamError } from '@/lib/tmdb/allowlist';
import { TmdbError, tmdbFetch } from '@/lib/tmdb/server';

type Ctx = { params: Promise<{ path: string[] }> };

/**
 * GET /api/tmdb/<allowlisted TMDB v3 path>?<allowlisted params>
 * Public read-only TMDB proxy for client components. The server adds credentials; client headers and
 * cookies are never forwarded. Responses are the raw TMDB JSON with CDN-friendly Cache-Control.
 *   404 path not allowlisted / TMDB 404 · 400 invalid param value · 502/503 upstream problems
 */
export const GET = withHandler<Ctx>('tmdb.proxy', async (req: NextRequest, ctx) => {
  const { path } = await ctx.params;
  const matched = matchTmdbPath(path ?? []);
  if (!matched) throw notFound('Unknown TMDB endpoint.');

  let params: Record<string, string>;
  try {
    params = sanitizeTmdbParams(req.nextUrl.searchParams, matched);
  } catch (err) {
    if (err instanceof TmdbParamError) throw new HttpError(400, err.message, { code: 'BAD_PARAM' });
    throw err;
  }

  let data: unknown;
  try {
    data = await tmdbFetch<unknown>(matched.path, params, { revalidate: matched.revalidate });
  } catch (err) {
    if (!(err instanceof TmdbError)) throw err;
    if (err.status === 404) throw notFound('Not found on TMDB.');
    if (err.status === 429) {
      throw new HttpError(503, 'Movie data is busy, please retry.', { code: 'TMDB_RATE_LIMITED', headers: { 'Retry-After': '5' } });
    }
    throw new HttpError(502, 'Movie data is temporarily unavailable.', { code: 'TMDB_UPSTREAM', cause: err });
  }

  return Response.json(data, { headers: { 'Cache-Control': cacheControlFor(matched.cls) } });
});
