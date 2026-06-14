import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Sidebar } from '@/components/layout/Sidebar';
import { Providers } from '@/components/layout/Providers';
import { SetupBanner } from '@/components/ui/SetupBanner';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { SidebarShift } from '@/components/layout/SidebarShift';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
        <Providers>
          <Header />
          <div className="flex flex-1 pt-16">
            <Sidebar />
            <SidebarShift>
              <main className="flex-1 min-w-0">
                {children}
              </main>
              <Footer />
            </SidebarShift>
          </div>
          <ChatWidget />
          <SetupBanner />
        </Providers>
      </body>
    </html>
  );
}
