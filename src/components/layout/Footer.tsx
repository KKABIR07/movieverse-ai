import Link from 'next/link';
import { Film, Globe, ExternalLink } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg-secondary)] mt-16">
      <div className="container mx-auto px-4 md:px-8 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-[var(--accent-primary)] flex items-center justify-center">
                <Film size={15} className="text-white" />
              </div>
              <span className="font-bold gradient-text">mkmovies</span>
            </div>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              Discover, review, and track movies & TV shows. Powered by TMDB.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Discover</h4>
            <ul className="space-y-2 text-sm text-[var(--text-muted)]">
              <li><Link href="/trending" className="hover:text-[var(--text-primary)] transition-colors">Trending</Link></li>
              <li><Link href="/movies" className="hover:text-[var(--text-primary)] transition-colors">Movies</Link></li>
              <li><Link href="/tv" className="hover:text-[var(--text-primary)] transition-colors">TV Shows</Link></li>
              <li><Link href="/top-rated" className="hover:text-[var(--text-primary)] transition-colors">Top Rated</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">My Space</h4>
            <ul className="space-y-2 text-sm text-[var(--text-muted)]">
              <li><Link href="/watchlist" className="hover:text-[var(--text-primary)] transition-colors">Watchlist</Link></li>
              <li><Link href="/search" className="hover:text-[var(--text-primary)] transition-colors">Search</Link></li>
              <li><Link href="/shorts" className="hover:text-[var(--text-primary)] transition-colors">Shorts</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Company</h4>
            <ul className="space-y-2 text-sm text-[var(--text-muted)]">
              <li><Link href="/about" className="hover:text-[var(--text-primary)] transition-colors">About</Link></li>
              <li><Link href="/blog" className="hover:text-[var(--text-primary)] transition-colors">Blog</Link></li>
              <li>
                <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--text-primary)] transition-colors">
                  Data: TMDB
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-[var(--border)] gap-4">
          <p className="text-xs text-[var(--text-muted)]">
            © 2026 mkmovies. Movie data provided by{' '}
            <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-primary)] hover:underline">
              TMDB
            </a>
            . Not affiliated with TMDB.
          </p>
          <div className="flex items-center gap-4">
            <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <Globe size={18} />
            </a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <ExternalLink size={18} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
