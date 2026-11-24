'use client';

import { useEffect } from 'react';
import { Home, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('[mkmovies] route error', error);
  }, [error]);

  return (
    <section role="alert" className="grid min-h-[70vh] place-items-center px-gutter py-16">
      <div className="max-w-lg text-center">
        <p className="text-micro font-medium uppercase tracking-[0.12em] text-danger">Something broke</p>
        <h1 className="mt-3 text-h1 text-fg text-balance">The projector jammed.</h1>
        <p className="mt-4 text-body-lg text-fg-secondary text-pretty">
          This page hit an unexpected error. Try again, and if it keeps happening, come back in a minute.
        </p>
        {error.digest && <p className="mt-3 text-micro text-fg-muted tabular">Reference: {error.digest}</p>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={() => unstable_retry()} leadingIcon={<RotateCcw />}>
            Try again
          </Button>
          <Button href="/" variant="secondary" leadingIcon={<Home />}>
            Back to home
          </Button>
        </div>
      </div>
    </section>
  );
}
