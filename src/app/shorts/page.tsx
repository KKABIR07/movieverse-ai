import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getTrending } from '@/lib/tmdb/server';
import { load } from '@/components/browse/BrowseStates';
import { pageMeta } from '@/components/browse/meta';
import { ShortsPlayer, type ShortTitle } from '@/components/shorts/ShortsPlayer';

export const metadata: Metadata = pageMeta({
  title: 'Shorts',
  description: "Short clips from YouTube for this week's trending movies and TV shows.",
  path: '/shorts',
});

const PER_KIND = 5;

function pick(items: { id: number; title?: string; name?: string; poster_path: string | null; vote_average: number; release_date?: string; first_air_date?: string }[] | undefined, mediaType: 'movie' | 'tv'): ShortTitle[] {
  return (items ?? [])
    .filter((m) => typeof m.id === 'number' && (m.title ?? m.name))
    .slice(0, PER_KIND)
    .map((m) => ({
      id: m.id,
      mediaType,
      title: (mediaType === 'tv' ? (m.name ?? m.title) : (m.title ?? m.name)) as string,
      posterPath: m.poster_path ?? null,
      rating: typeof m.vote_average === 'number' ? m.vote_average : 0,
      date: (mediaType === 'tv' ? m.first_air_date : m.release_date) || null,
    }));
}

export default async function ShortsPage() {
  await connection();
  const [movies, tv] = await Promise.all([
    load('trending/movie', getTrending('movie', 'week')),
    load('trending/tv', getTrending('tv', 'week')),
  ]);
  const titles = [...pick(movies.ok ? movies.data.results : [], 'movie'), ...pick(tv.ok ? tv.data.results : [], 'tv')];

  return (
    <>
      <h1 className="sr-only">Shorts for trending movies and TV</h1>
      <ShortsPlayer titles={titles} />
      <p className="sr-only">Use the arrow keys or J and K to move between shorts, and M to mute or unmute.</p>
    </>
  );
}
