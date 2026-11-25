/**
 * Follows API (`/api/follows`). Mapping between the server shape and `FollowedPerson`.
 */
import type { FollowedPerson } from '../../types/tmdb';
import { apiJson, type FetchLike } from './http';

interface ServerFollow {
  personId: number;
  personName: string;
  personImage?: string | null;
  department?: string | null;
  followedAt?: string | null;
}

export function fromServerFollow(f: ServerFollow): FollowedPerson | null {
  if (!f || typeof f.personId !== 'number' || f.personId <= 0) return null;
  return {
    id: f.personId,
    name: f.personName || 'Unknown',
    profile_path: f.personImage ?? null,
    known_for_department: f.department || 'Acting',
    followedAt: f.followedAt ?? new Date().toISOString(),
  };
}

export function createFollowsApi(fetchImpl?: FetchLike) {
  return {
    async list(): Promise<FollowedPerson[]> {
      const r = await apiJson<{ following?: ServerFollow[] }>('/api/follows', {}, fetchImpl);
      return (r.following ?? []).map(fromServerFollow).filter((p): p is FollowedPerson => p !== null);
    },
    async follow(p: Omit<FollowedPerson, 'followedAt'>): Promise<number | null> {
      const r = await apiJson<{ followerCount?: number }>(
        '/api/follows',
        {
          method: 'POST',
          body: {
            personId: p.id,
            personName: p.name,
            personImage: p.profile_path ?? undefined,
            department: p.known_for_department || 'Acting',
          },
        },
        fetchImpl,
      );
      return typeof r.followerCount === 'number' ? r.followerCount : null;
    },
    async unfollow(personId: number): Promise<number | null> {
      const r = await apiJson<{ followerCount?: number }>('/api/follows', { method: 'DELETE', body: { personId } }, fetchImpl);
      return typeof r?.followerCount === 'number' ? r.followerCount : null;
    },
    async counts(ids: number[]): Promise<Record<number, number>> {
      const clean = [...new Set(ids.filter((i) => Number.isInteger(i) && i > 0))].slice(0, 100);
      if (!clean.length) return {};
      const r = await apiJson<{ counts?: Record<string, number> }>(`/api/follows/counts?ids=${clean.join(',')}`, {}, fetchImpl);
      const out: Record<number, number> = {};
      for (const [k, v] of Object.entries(r.counts ?? {})) if (typeof v === 'number') out[Number(k)] = v;
      return out;
    },
  };
}

export const followsApi = createFollowsApi();
