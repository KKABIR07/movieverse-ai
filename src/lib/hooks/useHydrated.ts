'use client';

import { useSyncExternalStore } from 'react';

const noopSubscribe = () => () => {};

/**
 * `false` during SSR and the hydration render, `true` afterwards.
 * Use it to gate client-only UI (localStorage-backed counts, platform labels)
 * without causing hydration mismatches.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
