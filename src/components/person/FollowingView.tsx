'use client';

import { useState } from 'react';
import { SearchX, UserPlus, Users } from 'lucide-react';
import { useFollowingStore } from '@/store/followingStore';
import { useStoresHydrated } from '@/store/hydration';
import { PersonCard } from '@/components/media/PersonCard';
import { Button } from '@/components/ui/Button';
import { ToggleGroup } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { AuthGate } from '@/components/profile/AuthGate';
import { FilterInput } from '@/components/profile/FilterInput';
import { FollowButton } from '@/components/people/FollowButton';
import { departmentLabel, departments, filterFollowing, type FollowingSort } from './following';

const GRID = 'grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';

function Skeleton() {
  return (
    <div aria-hidden className={GRID}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2.5">
          <div className="skeleton aspect-square w-24 rounded-full" />
          <div className="skeleton h-3.5 w-20 rounded-chip" />
          <div className="skeleton h-9 w-24 rounded-control" />
        </div>
      ))}
    </div>
  );
}

function FollowingBody() {
  const hydrated = useStoresHydrated();
  const following = useFollowingStore((s) => s.following);
  const [department, setDepartment] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<FollowingSort>('recent');

  if (!hydrated) return <Skeleton />;

  if (following.length === 0) {
    return (
      <EmptyState
        icon={<UserPlus />}
        title="You are not following anyone yet"
        description="Follow actors, directors and writers from their pages to build your feed."
        action={<Button href="/stars">Find people to follow</Button>}
      />
    );
  }

  const depts = departments(following);
  const activeDept = department && depts.some((d) => d.value === department) ? department : null;
  const list = filterFollowing(following, {
    department: activeDept,
    query,
    sort,
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4">
        <FilterInput value={query} onChange={setQuery} label="Filter people you follow by name" placeholder="Filter by name…" />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {depts.length > 1 ? (
            <ToggleGroup
              label="Department"
              layout="scroll"
              value={activeDept ?? 'all'}
              onChange={(v) => setDepartment(v === 'all' ? null : v)}
              options={[
                { value: 'all', label: `Everyone (${following.length})` },
                ...depts.map((d) => ({
                  value: d.value,
                  label: `${departmentLabel(d.value)} (${d.count})`,
                })),
              ]}
            />
          ) : (
            <span />
          )}
          <ToggleGroup
            label="Sort"
            size="sm"
            value={sort}
            onChange={setSort}
            options={[
              { value: 'recent', label: 'Recently followed' },
              { value: 'name', label: 'Name A–Z' },
            ]}
          />
        </div>
      </div>

      <p role="status" className="text-caption text-fg-muted tabular">
        {list.length === following.length
          ? `${following.length} ${following.length === 1 ? 'person' : 'people'}`
          : `${list.length} of ${following.length} people`}
      </p>

      {list.length === 0 ? (
        <EmptyState compact icon={<SearchX />} title="Nobody matches these filters" />
      ) : (
        <ul aria-label="People you follow" className={GRID}>
          {list.map((p) => (
            <li key={p.id}>
              <PersonCard person={p} size="lg" footer={<FollowButton person={p} size="sm" />} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** People the signed-in user follows (server-backed via /api/follows). */
export function FollowingView() {
  return (
    <>
      <PageHeader
        eyebrow="Your people"
        title="Following"
        description="Actors, directors and writers you follow. Their new releases show up in your feed."
        actions={
          <Button href="/feed" variant="secondary" size="sm">
            Open your feed
          </Button>
        }
      />
      <div className="px-gutter pb-16">
        <AuthGate
          icon={<Users />}
          title="Sign in to follow people"
          description="Follow your favourite actors and directors and keep their work in one place."
          loading={<Skeleton />}
        >
          <FollowingBody />
        </AuthGate>
      </div>
    </>
  );
}
