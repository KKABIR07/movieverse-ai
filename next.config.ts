import type { NextConfig } from 'next';

// Content-Security-Policy. Next's App Router injects inline bootstrap scripts and styles, so
// 'unsafe-inline' is required until nonce plumbing (proxy-generated nonce + dynamic rendering)
// is implemented. The browser never talks to TMDB directly (all TMDB calls go through /api),
// hence connect-src 'self'.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://image.tmdb.org https://i.ytimg.com https://img.youtube.com",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self'",
  'frame-src https://www.youtube.com https://www.youtube-nocookie.com',
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  // No `preload` yet — only add it once the whole domain is confirmed HTTPS-only for good.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Content-Security-Policy', value: csp },
];

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (see Dockerfile).
  output: 'standalone',
  poweredByHeader: false,

  images: {
    // Custom loader → the browser fetches pre-sized renditions straight from the TMDB CDN.
    // Next's built-in optimizer (sharp + .next/cache/images) is never used, which keeps the
    // 1 GB / 5 GB production box free of image CPU, RAM and disk churn.
    loader: 'custom',
    loaderFile: './src/lib/image-loader.ts',
    remotePatterns: [
      { protocol: 'https', hostname: 'image.tmdb.org', pathname: '/t/p/**' },
      { protocol: 'https', hostname: 'img.youtube.com', pathname: '/**' },
      { protocol: 'https', hostname: 'i.ytimg.com', pathname: '/**' },
    ],
  },

  // TLS termination and the apex → www redirect are handled by Caddy on the host
  // (deploy/Caddyfile.mkmovies). Do not add proto/host redirects here: behind the proxy they loop.

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
