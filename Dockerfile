# MovieVerse AI (mkmovies) — production image (Next.js standalone).
# Multi-arch: builds natively on the arm64 OCI box (mkb-007). No runtime secrets are needed to build:
# DATABASE_URL is unset during `next build`, so the app skips migrations at build time.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are inlined at build time, so pass them as build args.
ARG NEXT_PUBLIC_SITE_URL=https://www.mkmovies.site
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN npm run build
# The SQL migrations are applied by the app at startup (src/instrumentation.ts). Ensure the folder exists
# even before the first migration is committed, so the COPY below never fails.
RUN mkdir -p drizzle/migrations

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 \
    MIGRATIONS_DIR=/app/drizzle/migrations
# Fixed uid/gid (1001) so docker-compose can mount the tmpfs cache owned by this user.
RUN addgroup -S -g 1001 app && adduser -S -u 1001 -G app app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
# Read-only at runtime (root fs is read_only); owned by root so the app cannot rewrite its own migrations.
COPY --from=build /app/drizzle/migrations ./drizzle/migrations
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "server.js"]
