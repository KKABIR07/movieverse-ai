import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { MobileTabBar } from '@/components/layout/MobileTabBar';
import { Providers } from '@/components/layout/Providers';
import { ChatWidget } from '@/components/chat/ChatWidget';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'], display: 'swap' });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'], display: 'swap' });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.mkmovies.site';
const DESCRIPTION =
  'Discover what to watch: trending movies and TV shows, top 10 lists, new releases, genres and cast, with ratings from TMDB. Track it all in your watchlist.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'mkmovies: discover movies & TV shows', template: '%s · mkmovies' },
  description: DESCRIPTION,
  applicationName: 'mkmovies',
  keywords: ['movies', 'TV shows', 'trending', 'what to watch', 'ratings', 'watchlist', 'streaming'],
  openGraph: {
    type: 'website',
    siteName: 'mkmovies',
    title: 'mkmovies: discover movies & TV shows',
    description: DESCRIPTION,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'mkmovies: discover movies & TV shows',
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: '#0b0b0f',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} font-sans`}>
      <body className="flex min-h-dvh flex-col bg-ground text-fg antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[300] focus:rounded-control focus:bg-accent focus:px-4 focus:py-3 focus:text-caption focus:font-semibold focus:text-on-accent"
        >
          Skip to content
        </a>
        <Providers>
          <Header />
          <div className="flex flex-1 flex-col pb-tabbar md:pb-0">
            <main id="main" tabIndex={-1} className="flex-1 min-w-0 pt-[var(--header-h)] outline-none">
              {children}
            </main>
            <Footer />
          </div>
          <MobileTabBar />
          <ChatWidget />
        </Providers>
      </body>
    </html>
  );
}
