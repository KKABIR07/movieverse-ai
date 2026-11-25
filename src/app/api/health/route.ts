import pkg from '../../../../package.json';

/** GET /api/health — liveness only (no DB, no upstreams). Used by the container healthcheck. */
export function GET() {
  return Response.json(
    { ok: true, version: process.env.APP_VERSION || pkg.version },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
