export type PageToken = number | 'gap-start' | 'gap-end';

/**
 * Compact page list with ellipses. Always shows first, last, current ± siblings.
 * paginationRange(6, 20) → [1, 'gap-start', 5, 6, 7, 'gap-end', 20]
 */
export function paginationRange(page: number, totalPages: number, siblings = 1): PageToken[] {
  const total = Math.max(1, Math.floor(totalPages));
  const current = Math.min(Math.max(1, Math.floor(page)), total);
  // first + last + current + 2*siblings + 2 gaps
  const slots = siblings * 2 + 5;
  if (total <= slots) return Array.from({ length: total }, (_, i) => i + 1);

  const left = Math.max(current - siblings, 2);
  const right = Math.min(current + siblings, total - 1);
  const showLeftGap = left > 3;
  const showRightGap = right < total - 2;

  if (!showLeftGap && showRightGap) {
    const count = siblings * 2 + 3;
    return [...Array.from({ length: count }, (_, i) => i + 1), 'gap-end', total];
  }
  if (showLeftGap && !showRightGap) {
    const count = siblings * 2 + 3;
    return [1, 'gap-start', ...Array.from({ length: count }, (_, i) => total - count + 1 + i)];
  }
  const middle = Array.from({ length: right - left + 1 }, (_, i) => left + i);
  return [1, 'gap-start', ...middle, 'gap-end', total];
}
