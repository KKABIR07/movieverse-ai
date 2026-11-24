'use client';

import { useEffect, useRef } from 'react';

export interface HotkeyOptions {
  /** Default true. */
  enabled?: boolean;
  /** Fire even when focus is in an input/textarea/contenteditable. Default false. */
  allowInInputs?: boolean;
  /** Call preventDefault when matched. Default true. */
  preventDefault?: boolean;
}

/** True when the event target is somewhere the user is typing. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target as HTMLElement).tagName) return false;
  const el = target as HTMLElement;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

type KeyLike = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>;

/**
 * Match "mod+k", "shift+?", "/", "escape". `mod` = Cmd or Ctrl (either is
 * accepted so the shortcut works on any keyboard).
 */
export function matchesHotkey(e: KeyLike, combo: string): boolean {
  const parts = combo.toLowerCase().split('+').map((p) => p.trim());
  const key = parts.pop() ?? '';
  const wantMod = parts.includes('mod');
  const wantCtrl = parts.includes('ctrl');
  const wantMeta = parts.includes('meta');
  const wantShift = parts.includes('shift');
  const wantAlt = parts.includes('alt');
  const hasMod = e.metaKey || e.ctrlKey;
  if (wantMod && !hasMod) return false;
  if (!wantMod && !wantCtrl && !wantMeta && hasMod) return false;
  if (wantCtrl && !e.ctrlKey) return false;
  if (wantMeta && !e.metaKey) return false;
  if (wantAlt !== e.altKey) return false;
  if (wantShift && !e.shiftKey) return false;
  return e.key.toLowerCase() === key;
}

/**
 * Global keyboard shortcut.
 * @example useHotkey('mod+k', () => setOpen(true));
 * @example useHotkey('/', openSearch); // ignored while typing
 */
export function useHotkey(
  combo: string | readonly string[],
  handler: (e: KeyboardEvent) => void,
  { enabled = true, allowInInputs = false, preventDefault = true }: HotkeyOptions = {},
): void {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });

  const key = typeof combo === 'string' ? combo : combo.join('|');

  useEffect(() => {
    if (!enabled) return;
    const combos = key.split('|');
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (!allowInInputs && isTypingTarget(e.target)) return;
      if (combos.some((c) => matchesHotkey(e, c))) {
        if (preventDefault) e.preventDefault();
        ref.current(e);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, allowInInputs, preventDefault, key]);
}
