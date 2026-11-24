/**
 * Pure decision logic for per-user local data (watchlist, reviews, ratings,
 * following). Data in localStorage belongs to the last confirmed user ("owner").
 */
import type { AuthStatus } from './authStore';

export const OWNER_STORAGE_KEY = 'mkmovies-owner';

export interface ScopeDecision {
  /** Wipe per-user stores (memory + storage). */
  clear: boolean;
  /** New owner to record (`undefined` = leave as is). */
  nextOwner: string | null | undefined;
}

/**
 * - status unknown (network failure / not loaded yet): do nothing.
 * - anonymous: wipe if anything belonged to someone, forget the owner.
 * - authenticated as X: wipe if data belonged to a different user; adopt it
 *   if it had no owner (anonymous browsing before signing in), then owner = X.
 */
export function decideUserScope(prevOwner: string | null, status: AuthStatus, userId: string | null): ScopeDecision {
  if (status === 'unknown') return { clear: false, nextOwner: undefined };
  if (status === 'anonymous' || !userId) {
    return { clear: prevOwner !== null, nextOwner: null };
  }
  return { clear: prevOwner !== null && prevOwner !== userId, nextOwner: userId };
}
