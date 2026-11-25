import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { cache } from 'react';
import { ExternalLink } from 'lucide-react';
import { getPerson } from '@/lib/tmdb/server';
import { formatDate } from '@/lib/format';
import { MediaGrid } from '@/components/media/MediaGrid';
import { tmdbUrl } from '@/components/media/tmdbImage';
import type { MediaSummary } from '@/components/media/types';
import { Tabs } from '@/components/ui/Tabs';
import { DetailHero } from '@/components/detail/DetailHero';
import { JsonLd } from '@/components/detail/JsonLdScript';
import { personJsonLd } from '@/components/detail/jsonld';
import { DetailSection, FactsCard, Prose } from '@/components/detail/Sections';
import { ShareButton } from '@/components/detail/ShareButton';
import { clampDescription, metadataBase, parseId } from '@/components/detail/seo';
import { FollowButton } from '@/components/people/FollowButton';
import { CreditList } from '@/components/person/CreditList';
import { FollowerCount } from '@/components/person/FollowerCount';
import { ageInYears, buildFilmography, groupCrewByDepartment, type PersonCredit } from '@/components/person/credits';

type Props = { params: Promise<{ id: string }> };

/** One TMDB request per render (generateMetadata + page share it). */
const loadPerson = cache((id: number) => getPerson(id, 'combined_credits,external_ids'));

const GENDER: Record<number, string> = { 1: 'Female', 2: 'Male', 3: 'Non-binary' };

const toSummary = (c: PersonCredit): MediaSummary => ({
  id: c.id,
  mediaType: c.mediaType,
  title: c.title,
  posterPath: c.posterPath,
  backdropPath: c.backdropPath,
  date: c.date || null,
  rating: c.voteAverage || null,
  voteCount: c.voteCount || null,
  overview: '',
  genreIds: c.genreIds,
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection();
  const id = parseId((await params).id);
  const person = id ? await loadPerson(id) : null;
  if (!person) return { title: 'Person not found', robots: { index: false } };
  const role = person.known_for_department ? `${person.known_for_department === 'Acting' ? 'Actor' : person.known_for_department}` : '';
  const description =
    clampDescription(person.biography) || `${person.name}${role ? ` (${role})` : ''}: biography, movies and TV shows.`;
  const image = tmdbUrl(person.profile_path, 'h632');
  return {
    metadataBase,
    title: person.name,
    description,
    alternates: { canonical: `/person/${person.id}` },
    openGraph: {
      type: 'profile',
      title: person.name,
      description,
      url: `/person/${person.id}`,
      images: image ? [{ url: image, width: 421, height: 632, alt: person.name }] : undefined,
    },
    twitter: { card: 'summary', title: person.name, description, images: image ? [image] : undefined },
  };
}

export default async function PersonPage({ params }: Props) {
  const id = parseId((await params).id);
  if (!id) notFound();
  const person = await loadPerson(id);
  if (!person) notFound();

  const film = buildFilmography(person, 12);
  const crewGroups = groupCrewByDepartment(film.crew);
  const heroBackdrop = film.knownFor.find((c) => c.backdropPath)?.backdropPath ?? null;
  const deathAge = person.deathday ? ageInYears(person.birthday, person.deathday) : null;
  const age = person.deathday ? null : ageInYears(person.birthday);
  const imdb = (person as { external_ids?: { imdb_id?: string | null } }).external_ids?.imdb_id ?? person.imdb_id;
  const dateLong = (d: string | null) => (d ? formatDate(d, { year: 'numeric', month: 'long', day: 'numeric' }) : null);

  const overview = (
    <div className="space-y-10">
      <DetailSection title="Biography" id="bio-title">
        <Prose text={person.biography} empty={`TMDB has no biography for ${person.name} yet.`} />
      </DetailSection>
      {film.knownFor.length > 0 && (
        <DetailSection title="Known for" id="known-title">
          <MediaGrid items={film.knownFor.map(toSummary)} label={`${person.name} is known for`} />
        </DetailSection>
      )}
    </div>
  );

  const tabs = [
    { id: 'overview', label: 'Overview', panel: overview },
    {
      id: 'movies',
      label: 'Movies',
      count: film.movies.length || undefined,
      panel: (
        <DetailSection title="Movies" id="movies-title" srOnlyTitle>
          <CreditList credits={film.movies} label={`Movies with ${person.name}`} />
        </DetailSection>
      ),
    },
    {
      id: 'tv',
      label: 'TV',
      count: film.tv.length || undefined,
      panel: (
        <DetailSection title="TV shows" id="tv-title" srOnlyTitle>
          <CreditList credits={film.tv} label={`TV shows with ${person.name}`} />
        </DetailSection>
      ),
    },
    ...(crewGroups.length
      ? [
          {
            id: 'crew',
            label: 'Crew',
            count: film.crew.length,
            panel: (
              <div className="space-y-10">
                {crewGroups.map((g) => {
                  const slug = g.department.toLowerCase().replace(/[^a-z]+/g, '-');
                  return (
                    <DetailSection key={g.department} title={g.department} id={`crew-${slug}`}>
                      <CreditList credits={g.credits} label={`${g.department} credits`} limit={40} />
                    </DetailSection>
                  );
                })}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <article className="pb-16">
      <JsonLd data={personJsonLd(person)} />
      <DetailHero
        title={person.name}
        backdropPath={heroBackdrop}
        posterPath={person.profile_path}
        posterAlt={`Photo of ${person.name}`}
        eyebrow={person.known_for_department || undefined}
        meta={[
          person.birthday && (
            <span>
              Born <time dateTime={person.birthday}>{dateLong(person.birthday)}</time>
              {age !== null && <span className="tabular"> (age {age})</span>}
            </span>
          ),
          person.deathday && (
            <span>
              Died <time dateTime={person.deathday}>{dateLong(person.deathday)}</time>
              {deathAge !== null && <span className="tabular"> (aged {deathAge})</span>}
            </span>
          ),
          person.place_of_birth && <span>{person.place_of_birth}</span>,
        ]}
      >
        <div className="flex flex-wrap items-center gap-3">
          <FollowButton
            person={{
              id: person.id,
              name: person.name,
              profile_path: person.profile_path,
              known_for_department: person.known_for_department,
            }}
          />
          <ShareButton title={person.name} url={`/person/${person.id}`} />
          <FollowerCount personId={person.id} />
        </div>
      </DetailHero>

      <div className="mt-10 grid gap-10 px-gutter lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <Tabs label={`${person.name} sections`} items={tabs} />
        </div>
        <aside className="space-y-6" aria-label={`About ${person.name}`}>
          <FactsCard
            title="Personal info"
            facts={[
              { label: 'Known for', value: person.known_for_department },
              { label: 'Credits', value: film.totalTitles ? <span className="tabular">{film.totalTitles} titles</span> : null },
              { label: 'Gender', value: person.gender ? GENDER[person.gender] : null },
              { label: 'Birthday', value: dateLong(person.birthday) },
              { label: 'Died', value: dateLong(person.deathday) },
              { label: 'Place of birth', value: person.place_of_birth },
              {
                label: 'Also known as',
                value: (person.also_known_as ?? []).length ? (person.also_known_as ?? []).slice(0, 4).join(', ') : null,
              },
            ]}
          />
          <section aria-labelledby="links-title" className="rounded-panel border border-line bg-surface-1 p-5">
            <h2 id="links-title" className="text-h3 text-fg">
              Elsewhere
            </h2>
            <ul className="mt-3 space-y-2 text-caption">
              <li>
                <a
                  href={`https://www.themoviedb.org/person/${person.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-fg-secondary hover:text-accent"
                >
                  TMDB profile <ExternalLink aria-hidden className="size-3.5" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </li>
              {imdb && /^nm\d+$/.test(imdb) && (
                <li>
                  <a
                    href={`https://www.imdb.com/name/${imdb}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-fg-secondary hover:text-accent"
                  >
                    IMDb page <ExternalLink aria-hidden className="size-3.5" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </li>
              )}
              {person.homepage && /^https?:\/\//.test(person.homepage) && (
                <li>
                  <a
                    href={person.homepage}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-1.5 text-fg-secondary hover:text-accent"
                  >
                    Official website <ExternalLink aria-hidden className="size-3.5" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </li>
              )}
            </ul>
            <p className="mt-4 text-micro text-fg-muted">Biography and credits from TMDB.</p>
          </section>
        </aside>
      </div>
    </article>
  );
}
