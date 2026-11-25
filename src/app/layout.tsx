import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { MobileTabBar } from '@/components/layout/MobileTabBar';
import { Providers } from '@/components/layout/Providers';
import { SetupBanner } from '@/components/ui/SetupBanner';
import { ChatWidget } from '@/components/chat/ChatWidget';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'], display: 'swap' });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'mkmovies', template: '%s | mkmovies' },
  description: 'Discover, review and track movies & TV shows with AI-powered recommendations.',
  keywords: ['movies', 'TV shows', 'reviews', 'ratings', 'recommendations', 'streaming'],
  openGraph: {
    title: 'mkmovies',
    description: 'Your cinematic universe. Discover, review, and track movies & TV shows.',
    type: 'website',
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
          <SetupBanner />
        </Providers>
      </body>
    </html>
  );
}
