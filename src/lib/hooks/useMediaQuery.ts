'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Subscribe to a CSS media query. Returns `serverValue` (default false) on the
 * server and during hydration, then the live match.
 *
 * @example const isDesktop = useMediaQuery('(min-width: 768px)');
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query],
  );
  const getSnapshot = () =>
    typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches;
  return useSyncExternalStore(subscribe, getSnapshot, () => serverValue);
}

/** True on devices with a real hovering pointer (mouse/trackpad). */
export function useCanHover(): boolean {
  return useMediaQuery('(hover: hover) and (pointer: fine)');
}
