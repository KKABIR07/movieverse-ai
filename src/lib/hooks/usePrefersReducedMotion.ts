'use client';

import { useMediaQuery } from './useMediaQuery';

/** True when the user asked the OS to reduce motion. Gate autoplay, parallax and auto-advance on it. */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}
