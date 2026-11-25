/**
 * Watchlist sync engine (framework-free, unit-tested).
 *
 * Signed in, the server is the source of truth:
 *  - `pushAdd` / `pushRemove` are called AFTER the store applied the change optimistically.
 *    On failure the single change is rolled back (not the whole list, so concurrent edits
 *    survive) and the user is told why.
 *  - `syncOnLogin(merge)` runs once per confirmed session. With `merge = true` (local items
 *    that never reached this account, e.g. saved while signed out) every local item the
 *    server lacks is POSTed once; then the server list replaces the local one.
 *  - In-flight optimistic changes are re-applied on top of a pulled list so a slow pull
 *    can't resurrect or drop a title the user just toggled.
 *
 * Signed out, nothing here runs and the store stays a plain local list.
 */
import type { WatchlistItem } from '../../types/tmdb';
import { ApiError, friendlyError } from './http';
import type { WatchlistApi } from './watchlistApi';

type MediaType = 'movie' | 'tv';

export interface SyncNotice {
  title: string;
  description?: string;
  tone: 'neutral' | 'success' | 'danger';
}

export interface WatchlistSyncDeps {
  api: WatchlistApi;
  /** Current items of the server-backed list. */
  getItems: () => WatchlistItem[];
  /** Replace the server-backed list. */
  setItems: (items: WatchlistItem[]) => void;
  notify: (n: SyncNotice) => void;
  /** Called on 401 (session expired). */
  onAuthLost?: () => void;
}

export type MergeResult = { ok: true; pushed: number; skipped: number } | { ok: false; error: unknown };

const key = (id: number, t: MediaType) => `${t}:${id}`;
const itemKey = (i: Pick<WatchlistItem, 'id' | 'media_type'>) => key(i.id, i.media_type ?? 'movie');

/** Newest first; stable for equal timestamps. */
export function sortByAdded(items: WatchlistItem[]): WatchlistItem[] {
  return items
    .map((it, idx) => ({ it, idx }))
    .sort((a, b) => {
      const d = Date.parse(b.it.addedAt) - Date.parse(a.it.addedAt);
      return Number.isFinite(d) && d !== 0 ? d : a.idx - b.idx;
    })
    .map((x) => x.it);
}

export function createWatchlistSync(deps: WatchlistSyncDeps) {
  /** key → pending op (latest wins). */
  const pending = new Map<string, { op: 'add' | 'remove'; item: WatchlistItem }>();
  const seq = new Map<string, number>();

  const without = (items: WatchlistItem[], k: string) => items.filter((i) => itemKey(i) !== k);

  function applyPending(server: WatchlistItem[]): WatchlistItem[] {
    let out = server;
    for (const [k, p] of pending) {
      out = without(out, k);
      if (p.op === 'add') out = [p.item, ...out];
    }
    return sortByAdded(out);
  }

  function handleFailure(err: unknown, title: string, item: WatchlistItem) {
    if (err instanceof ApiError && err.isAuth) deps.onAuthLost?.();
    deps.notify({ title, description: `${item.title}: ${friendlyError(err)}`, tone: 'danger' });
  }

  async function run(op: 'add' | 'remove', item: WatchlistItem): Promise<boolean> {
    const k = itemKey(item);
    const mySeq = (seq.get(k) ?? 0) + 1;
    seq.set(k, mySeq);
    pending.set(k, { op, item });
    try {
      if (op === 'add') await deps.api.add(item);
      else await deps.api.remove(item.id, item.media_type ?? 'movie');
      if (seq.get(k) === mySeq) pending.delete(k);
      return true;
    } catch (err) {
      // A newer toggle of the same title superseded this one: leave its state alone.
      if (seq.get(k) !== mySeq) return false;
      pending.delete(k);
      const items = deps.getItems();
      if (op === 'add') {
        deps.setItems(without(items, k));
        handleFailure(err, "Couldn't save to your watchlist", item);
      } else {
        deps.setItems(sortByAdded([item, ...without(items, k)]));
        handleFailure(err, "Couldn't remove from your watchlist", item);
      }
      return false;
    }
  }

  return {
    /** The item is already in the local list. */
    pushAdd: (item: WatchlistItem) => run('add', item),
    /** The item is already gone from the local list; `item` is what was removed (for rollback). */
    pushRemove: (item: WatchlistItem) => run('remove', item),

    /** Replace local with the server list (plus in-flight changes). Silent on failure. */
    async pull(): Promise<boolean> {
      try {
        const server = await deps.api.list();
        deps.setItems(applyPending(server));
        return true;
      } catch (err) {
        if (err instanceof ApiError && err.isAuth) deps.onAuthLost?.();
        return false;
      }
    },

    /**
     * First sync of a session. `merge`: push local items the server doesn't have (once).
     * Returns ok:false (local list untouched) if the server can't be reached.
     */
    async syncOnLogin(merge: boolean): Promise<MergeResult> {
      let server: WatchlistItem[];
      try {
        server = await deps.api.list();
      } catch (err) {
        if (err instanceof ApiError && err.isAuth) deps.onAuthLost?.();
        return { ok: false, error: err };
      }
      let pushed = 0;
      let skipped = 0;
      if (merge) {
        const have = new Set(server.map(itemKey));
        // Oldest first so the server's newest-first order matches the local one.
        const toPush = sortByAdded(deps.getItems().filter((i) => !have.has(itemKey(i)))).reverse();
        for (const item of toPush) {
          try {
            server = await deps.api.add(item);
            pushed++;
          } catch (err) {
            if (err instanceof ApiError && err.code === 'WATCHLIST_FULL') {
              skipped += toPush.length - pushed - skipped;
              deps.notify({ title: 'Watchlist is full', description: friendlyError(err), tone: 'danger' });
              break;
            }
            if (err instanceof ApiError && (err.status === 0 || err.status >= 500 || err.isAuth)) {
              // Server trouble: keep the local list and retry the whole merge next session.
              return { ok: false, error: err };
            }
            skipped++; // bad item (400): drop it rather than block the merge
          }
        }
        if (pushed > 0) {
          deps.notify({
            title: 'Watchlist synced',
            description: `${pushed} saved ${pushed === 1 ? 'title was' : 'titles were'} added to your account.`,
            tone: 'success',
          });
        }
      }
      deps.setItems(applyPending(server));
      return { ok: true, pushed, skipped };
    },

    /** For tests / diagnostics. */
    pendingCount: () => pending.size,
  };
}

export type WatchlistSync = ReturnType<typeof createWatchlistSync>;
