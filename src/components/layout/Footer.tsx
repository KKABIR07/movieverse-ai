import Link from 'next/link';
import { Logo } from './Logo';

const LINKS = [
  { href: '/about', label: 'About' },
  { href: '/blog', label: 'Blog' },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="flex flex-col gap-6 px-gutter py-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-md space-y-3">
          <Logo />
          <p className="text-caption text-fg-muted">
            Movie data and images from{' '}
            <a
              href="https://www.themoviedb.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-fg-secondary underline underline-offset-2 hover:text-fg"
            >
              TMDB
            </a>
            . This product uses the TMDB API but is not endorsed or certified by TMDB.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="inline-flex h-11 items-center text-caption text-fg-secondary hover:text-fg">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-line px-gutter py-5">
        <p className="text-micro text-fg-muted">© {new Date().getUTCFullYear()} mkmovies</p>
      </div>
    </footer>
  );
}
