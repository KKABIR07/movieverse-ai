import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { cache } from 'react';
import { Clapperboard } from 'lucide-react';
import { getTv, TV_APPEND } from '@/lib/tmdb/server';
import { formatDate, formatRuntime, formatYear } from '@/lib/format';
import type { TVShow } from '@/types/tmdb';
import { MediaGrid } from '@/components/media/MediaGrid';
import { toMediaSummary } from '@/components/media/types';
import { backdropSrc } from '@/components/media/tmdbImage';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tabs } from '@/components/ui/Tabs';
import { YouTubeSection } from '@/components/movie/YouTubeSection';
import { CertBadge, DetailHero } from '@/components/detail/DetailHero';
import { JsonLd } from '@/components/detail/JsonLdScript';
import { tvJsonLd } from '@/components/detail/jsonld';
import { regionFromHeaders } from '@/components/detail/region';
import { ScorePanel } from '@/components/detail/ScorePanel';
import { SeasonsList } from '@/components/detail/SeasonsList';
import { CastRail, DetailSection, FactsCard, PeopleGrid, Prose } from '@/components/detail/Sections';
import { VideoGrid } from '@/components/detail/Videos';
import { pickTrailer, pickVideos } from '@/components/detail/videoUtils';
import { WhereToWatch } from '@/components/detail/WhereToWatch';
import { clampDescription, metadataBase, parseId } from '@/components/detail/seo';

type ContentRatings = { results?: { iso_3166_1: string; rating: string }[] };
type TvDetail = TVShow & { content_ratings?: ContentRatings };
type Props = { params: Promise<{ id: string }> };

const loadTv = cache(async (id: number) => (await getTv(id, `${TV_APPEND},content_ratings`)) as TvDetail | null);

function rating(t: TvDetail, region: string): { value: string; region: string } | null {
  for (const r of [region, 'US']) {
    const hit = t.content_ratings?.results?.find((x) => x.iso_3166_1 === r && x.rating?.trim());
    if (hit) return { value: hit.rating.trim(), region: r };
  }
  return null;
}

/** "2011–2019", "2011–" (running) or "2011". */
function yearRange(t: TVShow): string {
  const start = formatYear(t.first_air_date, '');
  if (!start) return '';
  if (t.in_production || t.status === 'Returning Series') return `${start}–`;
  const end = formatYear(t.last_air_date, '');
  return end && end !== start ? `${start}–${end}` : start;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection();
  const id = parseId((await params).id);
  const show = id ? await loadTv(id) : null;
  if (!show) return { title: 'Show not found', robots: { index: false } };
  const year = formatYear(show.first_air_date, '');
  const title = year ? `${show.name} (${year})` : show.name;
  const description = clampDescription(show.overview) || `${show.name}: seasons, cast, trailers and where to watch.`;
  const image = backdropSrc(show.backdrop_path);
  return {
    metadataBase,
    title,
    description,
    alternates: { canonical: `/tv/${show.id}` },
    openGraph: {
      type: 'video.tv_show',
      title,
      description,
      url: `/tv/${show.id}`,
      images: image ? [{ url: image, width: 1280, height: 720, alt: show.name }] : undefined,
    },
    twitter: { card: 'summary_large_image', title, description, images: image ? [image] : undefined },
  };
}

export default async function TvPage({ params }: Props) {
  const id = parseId((await params).id);
  if (!id) notFound();
  const [show, h] = await Promise.all([loadTv(id), headers()]);
  if (!show) notFound();

  const region = regionFromHeaders((n) => h.get(n));
  const media = toMediaSummary(show, 'tv');
  const cert = rating(show, region);
  const cast = [...(show.credits?.cast ?? [])].sort((a, b) => a.order - b.order);
  const videos = pickVideos(show.videos?.results, 24);
  const trailer = pickTrailer(show.videos?.results);
  const recs = (show.recommendations?.results?.length ? show.recommendations.results : show.similar?.results) ?? [];
  const providers = show['watch/providers']?.results?.[region] ?? null;
  const runtime = show.episode_run_time?.find((m) => m > 0);
  const range = yearRange(show);
  const seasons = show.seasons ?? [];
  const regularSeasons = seasons.filter((s) => s.season_number > 0).length;

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      panel: (
        <div className="space-y-10">
          <DetailSection title="Overview" id="overview-title" srOnlyTitle>
            <Prose text={show.overview} empty="No overview is available for this show yet." />
          </DetailSection>
          <CastRail people={cast.slice(0, 15)} title="Series cast" />
          {videos.length > 0 && (
            <DetailSection title="Trailers & clips" id="clips-title">
              <VideoGrid videos={videos.slice(0, 3)} />
            </DetailSection>
          )}
        </div>
      ),
    },
    {
      id: 'seasons',
      label: 'Seasons',
      count: regularSeasons || undefined,
      panel: (
        <DetailSection title="Seasons" id="seasons-title" srOnlyTitle>
          <SeasonsList seasons={seasons} showTitle={show.name} />
        </DetailSection>
      ),
    },
    {
      id: 'cast',
      label: 'Cast',
      count: cast.length || undefined,
      panel: (
        <DetailSection title="Cast" id="cast-title" srOnlyTitle>
          {cast.length ? <PeopleGrid people={cast.slice(0, 48)} label="Cast" /> : <p className="text-fg-muted">No cast information yet.</p>}
        </DetailSection>
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
          <YouTubeSection query={`${show.name} series`} title={show.name} />
        </div>
      ),
    },
    {
      id: 'similar',
      label: 'Similar',
      panel: (
        <DetailSection title={show.recommendations?.results?.length ? 'Recommended' : 'Similar shows'} id="similar-title">
          <MediaGrid items={recs.slice(0, 18)} mediaType="tv" label={`Shows similar to ${show.name}`} empty={<p className="text-fg-muted">Nothing similar found yet.</p>} />
        </DetailSection>
      ),
    },
  ];

  return (
    <article className="pb-16">
      <JsonLd data={tvJsonLd(show)} />
      <DetailHero
        title={show.name}
        eyebrow="TV series"
        backdropPath={show.backdrop_path}
        posterPath={show.poster_path}
        posterAlt={`${show.name} poster`}
        genres={(show.genres ?? []).map((g) => ({ id: g.id, name: g.name }))}
        tagline={show.tagline}
        meta={[
          range && <span className="tabular">{range}</span>,
          regularSeasons > 0 && (
            <span className="tabular">
              {regularSeasons} {regularSeasons === 1 ? 'season' : 'seasons'}
            </span>
          ),
          runtime ? <span className="tabular">{formatRuntime(runtime)} episodes</span> : null,
          cert && <CertBadge value={cert.value} region={cert.region} />,
          !!show.created_by?.length && (
            <span>
              Created by{' '}
              {show.created_by.slice(0, 2).map((c, i) => (
                <span key={c.id}>
                  {i > 0 && ' & '}
                  <Link href={`/person/${c.id}`} className="font-medium text-fg hover:text-accent">
                    {c.name}
                  </Link>
                </span>
              ))}
            </span>
          ),
        ]}
      >
        <ScorePanel media={media} trailer={trailer} sharePath={`/tv/${show.id}`} />
      </DetailHero>

      <div className="mt-10 grid gap-10 px-gutter lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <Tabs label={`${show.name} sections`} items={tabs} />
        </div>
        <aside className="space-y-6" aria-label="Watch options and details">
          <WhereToWatch providers={providers} region={region} title={show.name} />
          <FactsCard
            facts={[
              { label: 'Status', value: show.status },
              { label: 'First aired', value: show.first_air_date ? formatDate(show.first_air_date, { year: 'numeric', month: 'long', day: 'numeric' }) : null },
              { label: 'Last aired', value: show.last_air_date ? formatDate(show.last_air_date, { year: 'numeric', month: 'long', day: 'numeric' }) : null },
              { label: 'Episodes', value: show.number_of_episodes ? <span className="tabular">{show.number_of_episodes}</span> : null },
              { label: 'Networks', value: (show.networks ?? []).slice(0, 3).map((n) => n.name).join(', ') },
              { label: 'Original title', value: show.original_name !== show.name ? show.original_name : null },
              {
                label: 'Language',
                value:
                  show.spoken_languages?.find((l) => l.iso_639_1 === show.original_language)?.english_name ?? show.original_language?.toUpperCase(),
              },
              { label: 'Studios', value: (show.production_companies ?? []).slice(0, 3).map((c) => c.name).join(', ') },
            ]}
          />
        </aside>
      </div>
    </article>
  );
}
