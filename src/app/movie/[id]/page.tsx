import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { cache } from 'react';
import { Clapperboard } from 'lucide-react';
import { getMovie, MOVIE_APPEND } from '@/lib/tmdb/server';
import { formatCount, formatDate, formatRuntime, formatYear } from '@/lib/format';
import type { Movie } from '@/types/tmdb';
import { MediaGrid } from '@/components/media/MediaGrid';
import { toMediaSummary } from '@/components/media/types';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tabs } from '@/components/ui/Tabs';
import { ReviewSection } from '@/components/movie/ReviewSection';
import { YouTubeSection } from '@/components/movie/YouTubeSection';
import { CertBadge, DetailHero } from '@/components/detail/DetailHero';
import { JsonLd } from '@/components/detail/JsonLdScript';
import { movieJsonLd } from '@/components/detail/jsonld';
import { regionFromHeaders } from '@/components/detail/region';
import { ScorePanel } from '@/components/detail/ScorePanel';
import { CastRail, DetailSection, FactsCard, PeopleGrid, Prose } from '@/components/detail/Sections';
import { VideoGrid } from '@/components/detail/Videos';
import { pickTrailer, pickVideos } from '@/components/detail/videoUtils';
import { WhereToWatch } from '@/components/detail/WhereToWatch';
import { backdropSrc } from '@/components/media/tmdbImage';
import { clampDescription, metadataBase, parseId } from '@/components/detail/seo';

type ReleaseDates = { results?: { iso_3166_1: string; release_dates: { certification: string; type: number }[] }[] };
type MovieDetail = Movie & { release_dates?: ReleaseDates };

type Props = { params: Promise<{ id: string }> };

/** One TMDB request per render (generateMetadata + page share it). */
const loadMovie = cache(async (id: number) => (await getMovie(id, `${MOVIE_APPEND},release_dates`)) as MovieDetail | null);

function certification(m: MovieDetail, region: string): { value: string; region: string } | null {
  const results = m.release_dates?.results ?? [];
  for (const r of [region, 'US']) {
    const entry = results.find((x) => x.iso_3166_1 === r);
    const dates = (entry?.release_dates ?? []).filter((d) => d.certification?.trim());
    const best = dates.find((d) => d.type === 3) ?? dates[0];
    if (best) return { value: best.certification.trim(), region: r };
  }
  return null;
}

const money = (n: number | undefined) => (n && n > 0 ? `$${formatCount(n)}` : null);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection();
  const id = parseId((await params).id);
  const movie = id ? await loadMovie(id) : null;
  if (!movie) return { title: 'Movie not found', robots: { index: false } };
  const year = formatYear(movie.release_date, '');
  const title = year ? `${movie.title} (${year})` : movie.title;
  const description = clampDescription(movie.overview) || `${movie.title}: cast, trailers, reviews and where to watch.`;
  const image = backdropSrc(movie.backdrop_path);
  return {
    metadataBase,
    title,
    description,
    alternates: { canonical: `/movie/${movie.id}` },
    openGraph: {
      type: 'video.movie',
      title,
      description,
      url: `/movie/${movie.id}`,
      images: image ? [{ url: image, width: 1280, height: 720, alt: movie.title }] : undefined,
    },
    twitter: { card: 'summary_large_image', title, description, images: image ? [image] : undefined },
  };
}

export default async function MoviePage({ params }: Props) {
  const id = parseId((await params).id);
  if (!id) notFound();
  const [movie, h] = await Promise.all([loadMovie(id), headers()]);
  if (!movie) notFound();

  const region = regionFromHeaders((n) => h.get(n));
  const media = toMediaSummary(movie, 'movie');
  const cert = certification(movie, region);
  const directors = (movie.credits?.crew ?? []).filter((c) => c.job === 'Director');
  const cast = [...(movie.credits?.cast ?? [])].sort((a, b) => a.order - b.order);
  const keyCrew = (movie.credits?.crew ?? [])
    .filter((c) => ['Director', 'Screenplay', 'Writer', 'Novel', 'Producer', 'Original Music Composer', 'Director of Photography'].includes(c.job))
    .slice(0, 18);
  const videos = pickVideos(movie.videos?.results, 24);
  const trailer = pickTrailer(movie.videos?.results);
  const recs = (movie.recommendations?.results?.length ? movie.recommendations.results : movie.similar?.results) ?? [];
  const providers = movie['watch/providers']?.results?.[region] ?? null;
  const year = formatYear(movie.release_date, '');

  const overview = (
    <div className="space-y-10">
      <DetailSection title="Overview" id="overview-title" srOnlyTitle>
        <Prose text={movie.overview} empty="No overview is available for this title yet." />
      </DetailSection>
      <CastRail people={cast.slice(0, 15)} />
      {videos.length > 0 && (
        <DetailSection title="Trailers & clips" id="clips-title">
          <VideoGrid videos={videos.slice(0, 3)} />
        </DetailSection>
      )}
    </div>
  );

  const tabs = [
    { id: 'overview', label: 'Overview', panel: overview },
    {
      id: 'cast',
      label: 'Cast',
      count: cast.length || undefined,
      panel: (
        <div className="space-y-10">
          <DetailSection title="Cast" id="cast-title">
            {cast.length ? <PeopleGrid people={cast.slice(0, 48)} label="Cast" /> : <p className="text-fg-muted">No cast information yet.</p>}
          </DetailSection>
          {keyCrew.length > 0 && (
            <DetailSection title="Crew" id="crew-title">
              <PeopleGrid people={keyCrew} label="Crew" />
            </DetailSection>
          )}
        </div>
      ),
    },
    {
      id: 'videos',
      label: 'Videos',
      count: videos.length || undefined,
      panel: (
        <div className="space-y-10">
          {videos.length ? (
            <DetailSection title="Videos" id="videos-title" srOnlyTitle>
              <VideoGrid videos={videos} />
            </DetailSection>
          ) : (
            <EmptyState compact icon={<Clapperboard />} title="No videos yet" />
          )}
          <YouTubeSection query={`${movie.title} ${year}`.trim()} title={movie.title} />
        </div>
      ),
    },
    {
      id: 'reviews',
      label: 'Reviews',
      panel: <ReviewSection movieId={movie.id} movieTitle={movie.title} moviePoster={movie.poster_path} />,
    },
    {
      id: 'similar',
      label: 'Similar',
      panel: (
        <DetailSection title={movie.recommendations?.results?.length ? 'Recommended' : 'Similar titles'} id="similar-title">
          <MediaGrid items={recs.slice(0, 18)} mediaType="movie" label={`Titles similar to ${movie.title}`} empty={<p className="text-fg-muted">Nothing similar found yet.</p>} />
        </DetailSection>
      ),
    },
  ];

  return (
    <article className="pb-16">
      <JsonLd data={movieJsonLd(movie)} />
      <DetailHero
        title={movie.title}
        backdropPath={movie.backdrop_path}
        posterPath={movie.poster_path}
        posterAlt={`${movie.title} poster`}
        genres={(movie.genres ?? []).map((g) => ({ ...g, href: `/genre/${g.id}?name=${encodeURIComponent(g.name)}` }))}
        tagline={movie.tagline}
        meta={[
          year && <time dateTime={movie.release_date}>{year}</time>,
          movie.runtime ? <span className="tabular">{formatRuntime(movie.runtime)}</span> : null,
          cert && <CertBadge value={cert.value} region={cert.region} />,
          directors.length > 0 && (
            <span>
              Directed by{' '}
              {directors.slice(0, 2).map((d, i) => (
                <span key={d.id}>
                  {i > 0 && ' & '}
                  <Link href={`/person/${d.id}`} className="font-medium text-fg hover:text-accent">
                    {d.name}
                  </Link>
                </span>
              ))}
            </span>
          ),
        ]}
      >
        <ScorePanel media={media} trailer={trailer} sharePath={`/movie/${movie.id}`} />
      </DetailHero>

      <div className="mt-10 grid gap-10 px-gutter lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <Tabs label={`${movie.title} sections`} items={tabs} />
        </div>
        <aside className="space-y-6" aria-label="Watch options and details">
          <WhereToWatch providers={providers} region={region} title={movie.title} />
          <FactsCard
            facts={[
              { label: 'Release date', value: movie.release_date ? formatDate(movie.release_date, { year: 'numeric', month: 'long', day: 'numeric' }) : null },
              { label: 'Status', value: movie.status },
              { label: 'Original title', value: movie.original_title !== movie.title ? movie.original_title : null },
              {
                label: 'Language',
                value: movie.spoken_languages?.find((l) => l.iso_639_1 === movie.original_language)?.english_name ?? movie.original_language?.toUpperCase(),
              },
              { label: 'Budget', value: money(movie.budget) },
              { label: 'Box office', value: money(movie.revenue) },
              { label: 'Studios', value: (movie.production_companies ?? []).slice(0, 3).map((c) => c.name).join(', ') },
              {
                label: 'Collection',
                value: movie.belongs_to_collection?.name,
              },
            ]}
          />
          {!!movie.keywords?.keywords?.length && (
            <section aria-labelledby="kw-title" className="rounded-panel border border-line bg-surface-1 p-5">
              <h2 id="kw-title" className="text-h3 text-fg">
                Keywords
              </h2>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {movie.keywords.keywords.slice(0, 16).map((k) => (
                  <li key={k.id} className="rounded-chip bg-surface-2 px-2 py-1 text-micro text-fg-secondary">
                    {k.name}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </article>
  );
}
