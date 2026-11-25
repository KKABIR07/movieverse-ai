/** Tiny className joiner (no dependency). Falsy values are dropped. */
export function cn(...parts: Array<string | false | null | undefined | 0>): string {
  return parts.filter(Boolean).join(' ');
}

const BASE_DISPLAY = /(^|\s)(hidden|block|inline|inline-block|flex|inline-flex|grid|inline-grid|contents)(\s|$)/;

/**
 * Return `fallback` (e.g. 'inline-flex') unless the caller's className already sets an
 * un-prefixed display utility. Without tailwind-merge, `inline-flex` + `hidden` on one
 * element resolves by stylesheet order, so components must not emit both.
 * @example displayClass('hidden md:inline-flex', 'inline-flex') // → ''
 */
export function displayClass(className: string | undefined, fallback: string): string {
  return className && BASE_DISPLAY.test(className) ? '' : fallback;
}
