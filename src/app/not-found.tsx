import type { Metadata } from 'next';
import { Compass, Home } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'Page not found',
};

export default function NotFound() {
  return (
    <section className="grid min-h-[70vh] place-items-center px-gutter py-16">
      <div className="max-w-lg text-center">
        <p className="text-micro font-medium uppercase tracking-[0.12em] text-accent">Error 404</p>
        <h1 className="mt-3 text-h1 text-fg text-balance">This reel is missing.</h1>
        <p className="mt-4 text-body-lg text-fg-secondary text-pretty">
          The page you are looking for was moved, removed, or never made it out of the edit.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button href="/" leadingIcon={<Home />}>
            Back to home
          </Button>
          <Button href="/discover" variant="secondary" leadingIcon={<Compass />}>
            Discover something
          </Button>
        </div>
      </div>
    </section>
  );
}
