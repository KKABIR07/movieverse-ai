'use client';

import { useEffect } from 'react';
import './globals.css';

/**
 * Replaces the root layout when it crashes, so it cannot rely on the shell,
 * fonts or providers. Keep it dependency-free.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('[mkmovies] global error', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="grid min-h-dvh place-items-center bg-ground px-4 text-fg font-sans">
        <title>Something went wrong | mkmovies</title>
        <main role="alert" className="max-w-md text-center">
          <p className="text-micro font-medium uppercase tracking-[0.12em] text-danger">Something broke</p>
          <h1 className="mt-3 text-h1 text-balance">mkmovies hit a snag.</h1>
          <p className="mt-4 text-body-lg text-fg-secondary">Please try again. If it keeps happening, reload the page.</p>
          {error.digest && <p className="mt-3 text-micro text-fg-muted">Reference: {error.digest}</p>}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => unstable_retry()}
              className="inline-flex h-11 items-center rounded-control bg-accent px-5 font-medium text-on-accent hover:bg-accent-hover"
            >
              Try again
            </button>
            {/* Full reload on purpose: the app shell itself failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="inline-flex h-11 items-center rounded-control border border-line bg-surface-2 px-5 font-medium text-fg hover:bg-surface-3"
            >
              Back to home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
