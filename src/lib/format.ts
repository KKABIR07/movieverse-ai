/**
 * Display formatters. All date math is done in UTC so a TMDB date like
 * "2024-01-01" never renders as 2023 in a western timezone, and server and
 * client render the same string (no hydration mismatch).
 */

const EMPTY = '—';

/** Parse a TMDB "YYYY-MM-DD" (or full ISO) string as a UTC date. Returns null if invalid. */
export function parseDateUTC(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "2024-05-03" → "2024". Missing/invalid → fallback (default "—"). */
export function formatYear(value: string | null | undefined, fallback = EMPTY): string {
  const d = parseDateUTC(value);
  return d ? String(d.getUTCFullYear()) : fallback;
}

/** "2024-05-03" → "May 3, 2024" (UTC, en-US by default). */
export function formatDate(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' },
  locale = 'en-US',
  fallback = EMPTY,
): string {
  const d = parseDateUTC(value);
  if (!d) return fallback;
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(d);
}

/** 142 → "2h 22m", 45 → "45m", 120 → "2h". Missing/0 → fallback. */
export function formatRuntime(minutes: number | null | undefined, fallback = EMPTY): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return fallback;
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * TMDB vote_average → "8.1". Null/undefined/NaN or a 0 score with no votes → null
 * so callers can hide the chip instead of showing a fake "0.0".
 */
export function formatRating(value: number | null | undefined, voteCount?: number | null): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value <= 0 && (voteCount == null || voteCount === 0)) return null;
  const clamped = Math.min(10, Math.max(0, value));
  return clamped.toFixed(1);
}

/** 1234 → "1.2K", 2_500_000 → "2.5M", 999 → "999". Null → fallback. */
export function formatCount(value: number | null | undefined, fallback = EMPTY): string {
  if (value == null || !Number.isFinite(value)) return fallback;
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const fmt = (n: number, suffix: string) => {
    const s = n >= 100 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString();
    return `${sign}${s}${suffix}`;
  };
  if (abs >= 1e9) return fmt(abs / 1e9, 'B');
  if (abs >= 1e6) return fmt(abs / 1e6, 'M');
  if (abs >= 1e3) {
    const k = abs / 1e3;
    // 999_950 would round to "1000K": promote to M instead
    if (Math.round(k * 10) / 10 >= 1000) return fmt(abs / 1e6, 'M');
    return fmt(k, 'K');
  }
  return `${sign}${Math.round(abs)}`;
}

/** Relative "2m ago" style label, UTC-safe. `now` is injectable for tests. */
export function formatRelativeTime(value: string | null | undefined, now: number = Date.now()): string {
  const d = parseDateUTC(value);
  if (!d) return '';
  const diff = Math.max(0, Math.round((now - d.getTime()) / 1000));
  if (diff < 45) return 'just now';
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.round(diff / 86400)}d ago`;
  return formatDate(value, { month: 'short', day: 'numeric' });
}
