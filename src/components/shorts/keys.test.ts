import { describe, expect, it } from 'vitest';
import { clampIndex, isTypingTarget, playerCommand, shortsEmbedUrl, shortsKeyAction } from './keys';

const el = (tagName: string, extra: Record<string, unknown> = {}) => ({
  tagName,
  getAttribute: () => null,
  closest: () => null,
  ...extra,
});

describe('shortsKeyAction', () => {
  it('maps arrows, page keys, j/k and m', () => {
    expect(shortsKeyAction({ key: 'ArrowUp' })).toBe('prev');
    expect(shortsKeyAction({ key: 'PageUp' })).toBe('prev');
    expect(shortsKeyAction({ key: 'k' })).toBe('prev');
    expect(shortsKeyAction({ key: 'ArrowDown' })).toBe('next');
    expect(shortsKeyAction({ key: 'J' })).toBe('next');
    expect(shortsKeyAction({ key: 'm' })).toBe('mute');
    expect(shortsKeyAction({ key: 'a' })).toBeNull();
  });

  it('ignores typing in inputs, textareas, selects and contenteditable', () => {
    for (const t of [el('INPUT'), el('textarea'), el('SELECT'), el('DIV', { isContentEditable: true })]) {
      expect(shortsKeyAction({ key: 'ArrowDown', target: t })).toBeNull();
      expect(shortsKeyAction({ key: 'm', target: t })).toBeNull();
    }
  });

  it('ignores keys inside dialogs and text-like roles', () => {
    expect(
      shortsKeyAction({
        key: 'ArrowDown',
        target: el('BUTTON', { closest: () => ({}) }),
      }),
    ).toBeNull();
    expect(
      shortsKeyAction({
        key: 'ArrowDown',
        target: el('DIV', {
          getAttribute: (n: string) => (n === 'role' ? 'combobox' : null),
        }),
      }),
    ).toBeNull();
  });

  it('ignores modified, composing, already-handled and repeated mute presses', () => {
    expect(shortsKeyAction({ key: 'ArrowDown', ctrlKey: true })).toBeNull();
    expect(shortsKeyAction({ key: 'ArrowDown', metaKey: true })).toBeNull();
    expect(shortsKeyAction({ key: 'ArrowDown', altKey: true })).toBeNull();
    expect(shortsKeyAction({ key: 'ArrowDown', isComposing: true })).toBeNull();
    expect(shortsKeyAction({ key: 'ArrowDown', defaultPrevented: true })).toBeNull();
    expect(shortsKeyAction({ key: 'm', repeat: true })).toBeNull();
    expect(shortsKeyAction({ key: 'ArrowDown', repeat: true })).toBe('next');
  });

  it('acts on plain page targets', () => {
    expect(shortsKeyAction({ key: 'ArrowDown', target: el('BODY') })).toBe('next');
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('shortsEmbedUrl', () => {
  it('enables the JS API, starts muted and loops one video', () => {
    const url = new URL(shortsEmbedUrl('dQw4w9WgXcQ', 'https://www.mkmovies.site')!);
    expect(url.origin).toBe('https://www.youtube-nocookie.com');
    expect(url.pathname).toBe('/embed/dQw4w9WgXcQ');
    expect(url.searchParams.get('enablejsapi')).toBe('1');
    expect(url.searchParams.get('mute')).toBe('1');
    expect(url.searchParams.get('playlist')).toBe('dQw4w9WgXcQ');
    expect(url.searchParams.get('origin')).toBe('https://www.mkmovies.site');
  });

  it('rejects bad ids and ignores bad origins', () => {
    expect(shortsEmbedUrl('../evil')).toBeNull();
    expect(shortsEmbedUrl('abc')).toBeNull();
    const url = new URL(shortsEmbedUrl('dQw4w9WgXcQ', 'javascript:alert(1)')!);
    expect(url.searchParams.has('origin')).toBe(false);
  });
});

describe('playerCommand / clampIndex', () => {
  it('builds IFrame API commands', () => {
    expect(JSON.parse(playerCommand('unMute'))).toEqual({
      event: 'command',
      func: 'unMute',
      args: [],
    });
  });
  it('clamps indexes', () => {
    expect(clampIndex(-1, 5)).toBe(0);
    expect(clampIndex(9, 5)).toBe(4);
    expect(clampIndex(2, 0)).toBe(0);
    expect(clampIndex(Number.NaN, 3)).toBe(0);
  });
});
