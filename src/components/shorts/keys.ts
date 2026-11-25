/**
 * Shorts player keyboard + YouTube embed helpers (pure, unit-tested).
 */

export type ShortsKeyAction = 'prev' | 'next' | 'mute';

/** The subset of KeyboardEvent the guard reads (so tests don't need a DOM). */
export interface KeyLike {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  repeat?: boolean;
  defaultPrevented?: boolean;
  isComposing?: boolean;
  target?: unknown;
}

interface ElementLike {
  tagName?: string;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
  closest?: (selector: string) => unknown;
}

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const TEXT_ROLES = new Set(['textbox', 'combobox', 'searchbox', 'spinbutton', 'slider']);

/**
 * True when the key press belongs to something else: a text field, a contenteditable, a slider,
 * or anything inside an open dialog (search palette, sign-in, chat). Shorts must not steal those.
 */
export function isTypingTarget(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as ElementLike;
  const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : '';
  if (EDITABLE_TAGS.has(tag)) return true;
  if (el.isContentEditable) return true;
  const role = el.getAttribute?.('role');
  if (role && TEXT_ROLES.has(role)) return true;
  if (typeof el.closest === 'function' && el.closest('[role="dialog"],[aria-modal="true"],[contenteditable="true"]')) return true;
  return false;
}

/** Map a key press to a player action, or null to leave it alone. */
export function shortsKeyAction(e: KeyLike): ShortsKeyAction | null {
  if (e.defaultPrevented || e.isComposing) return null;
  if (e.altKey || e.ctrlKey || e.metaKey) return null;
  if (isTypingTarget(e.target)) return null;
  switch (e.key) {
    case 'ArrowUp':
    case 'PageUp':
    case 'k':
    case 'K':
      return 'prev';
    case 'ArrowDown':
    case 'PageDown':
    case 'j':
    case 'J':
      return 'next';
    case 'm':
    case 'M':
      return e.repeat ? null : 'mute';
    default:
      return null;
  }
}

export const YT_EMBED_ORIGIN = 'https://www.youtube-nocookie.com';
const VIDEO_ID = /^[A-Za-z0-9_-]{6,20}$/;

/**
 * Embed URL with the IFrame API enabled, so mute / unmute are sent as postMessage commands
 * instead of changing `src` (which reloads the player and restarts the video).
 * Starts muted: browsers only allow autoplay with sound off.
 */
export function shortsEmbedUrl(videoId: string, origin?: string): string | null {
  if (!VIDEO_ID.test(videoId)) return null;
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    controls: '1',
    rel: '0',
    playsinline: '1',
    loop: '1',
    playlist: videoId,
    enablejsapi: '1',
  });
  if (origin && /^https?:\/\/[^/]+$/.test(origin)) params.set('origin', origin);
  return `${YT_EMBED_ORIGIN}/embed/${videoId}?${params}`;
}

/** Message for the YouTube IFrame API (`player.postMessage(msg, YT_EMBED_ORIGIN)`). */
export function playerCommand(func: 'mute' | 'unMute' | 'playVideo' | 'pauseVideo'): string {
  return JSON.stringify({ event: 'command', func, args: [] });
}

/** Keep an index inside [0, total - 1] (0 when empty). */
export function clampIndex(i: number, total: number): number {
  if (total <= 0 || !Number.isFinite(i)) return 0;
  return Math.min(total - 1, Math.max(0, Math.trunc(i)));
}
