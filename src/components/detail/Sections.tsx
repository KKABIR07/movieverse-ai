import type { ReactNode } from 'react';
import { PersonCard, type PersonLike } from '@/components/media/PersonCard';
import { cn } from '@/components/ui/cn';

/** Titled content block inside a detail page. */
export function DetailSection({
  title,
  id,
  children,
  actions,
  className,
  srOnlyTitle,
}: {
  title: string;
  id: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  srOnlyTitle?: boolean;
}) {
  return (
    <section aria-labelledby={id} className={cn('min-w-0', className)}>
      <div className={cn('mb-4 flex items-end justify-between gap-3', srOnlyTitle && 'sr-only')}>
        <h2 id={id} className="text-h2 text-fg">
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** Horizontal rail of circular cast avatars. */
export function CastRail({ people, title = 'Top cast' }: { people: PersonLike[]; title?: string }) {
  if (!people.length) return null;
  const id = `cast-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  return (
    <section aria-labelledby={id} className="min-w-0">
      <h2 id={id} className="mb-4 text-h2 text-fg">
        {title}
      </h2>
      {/* Column-width scroller (the shared Rail is page-gutter aligned, which breaks inside a column). */}
      <ul className="no-scrollbar fade-x -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 pt-1" aria-label={title}>
        {people.map((p) => (
          <li key={`${p.id}-${p.character ?? p.job ?? ''}`} className="w-28 shrink-0 snap-start">
            <PersonCard person={p} size="md" />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Wrapping grid of people (full cast / crew). */
export function PeopleGrid({ people, label }: { people: PersonLike[]; label: string }) {
  if (!people.length) return null;
  return (
    <ul aria-label={label} className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
      {people.map((p, i) => (
        <li key={`${p.id}-${i}`}>
          <PersonCard person={p} size="md" />
        </li>
      ))}
    </ul>
  );
}

export interface Fact {
  label: string;
  value: ReactNode;
}

/** Definition list card ("Details" sidebar). Empty values are skipped. */
export function FactsCard({ title = 'Details', facts }: { title?: string; facts: Fact[] }) {
  const list = facts.filter((f) => f.value !== null && f.value !== undefined && f.value !== '' && f.value !== false);
  if (!list.length) return null;
  return (
    <section aria-labelledby="facts-title" className="rounded-panel border border-line bg-surface-1 p-5">
      <h2 id="facts-title" className="text-h3 text-fg">
        {title}
      </h2>
      <dl className="mt-4 space-y-3">
        {list.map((f) => (
          <div key={f.label} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 text-caption">
            <dt className="text-fg-muted">{f.label}</dt>
            <dd className="text-fg break-words">{f.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Ordered prose paragraphs from a TMDB text blob. */
export function Prose({ text, empty }: { text: string | null | undefined; empty: string }) {
  const paras = (text ?? '')
    .split(/\n{2,}|\r\n\r\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!paras.length) return <p className="text-body text-fg-muted">{empty}</p>;
  return (
    <div className="max-w-3xl space-y-4 text-body-lg text-fg-secondary text-pretty">
      {paras.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}
