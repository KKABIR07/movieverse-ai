import { describe, expect, it } from 'vitest';
import { latestTimestamp, mergeMessages, normalizeMessage, type ChatMessage } from './chatLogic';
import { decideUserScope } from './userScope';

const msg = (id: string, createdAt: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  roomId: 'general',
  text: id,
  userName: 'Ada',
  initials: 'A',
  createdAt,
  isMine: false,
  ...extra,
});

describe('normalizeMessage', () => {
  it('accepts the new API shape', () => {
    const m = normalizeMessage({
      id: 'm1',
      roomId: 'movies',
      text: 'hi',
      userName: 'Ada Lovelace',
      initials: 'AL',
      createdAt: '2026-01-01T00:00:00.000Z',
      isMine: true,
    });
    expect(m).toEqual({
      id: 'm1',
      roomId: 'movies',
      text: 'hi',
      userName: 'Ada Lovelace',
      initials: 'AL',
      createdAt: '2026-01-01T00:00:00.000Z',
      isMine: true,
    });
  });

  it('accepts the legacy Mongo shape and derives isMine from userId', () => {
    const m = normalizeMessage(
      { _id: 'x', userId: 'u1', userName: 'Grace Hopper', userInitials: 'GH', text: 't', createdAt: '2026-01-01' },
      'u1',
    );
    expect(m).toMatchObject({ id: 'x', initials: 'GH', isMine: true, roomId: 'general' });
  });

  it('derives initials when missing and rejects malformed input', () => {
    expect(normalizeMessage({ id: '1', text: 'a', userName: 'grace hopper', createdAt: 'x' })?.initials).toBe('GH');
    expect(normalizeMessage(null)).toBeNull();
    expect(normalizeMessage({ id: '1', createdAt: 'x' })).toBeNull();
  });
});

describe('mergeMessages', () => {
  it('dedupes by id, sorts oldest→newest, caps length', () => {
    const a = [msg('1', '2026-01-01T00:00:01Z'), msg('2', '2026-01-01T00:00:02Z')];
    const merged = mergeMessages(a, [msg('3', '2026-01-01T00:00:00Z'), msg('2', '2026-01-01T00:00:02Z', { text: 'edited' })]);
    expect(merged.map((m) => m.id)).toEqual(['3', '1', '2']);
    expect(merged[2].text).toBe('edited');
    expect(mergeMessages(a, [msg('3', '2026-01-01T00:00:03Z')], 2).map((m) => m.id)).toEqual(['2', '3']);
  });

  it('returns the same array when nothing comes in', () => {
    const a = [msg('1', '2026-01-01T00:00:01Z')];
    expect(mergeMessages(a, [])).toBe(a);
  });
});

describe('latestTimestamp', () => {
  it('skips optimistic and failed messages', () => {
    expect(
      latestTimestamp([
        msg('1', 'A'),
        msg('2', 'B'),
        msg('t', 'C', { pending: true }),
        msg('f', 'D', { failed: true }),
      ]),
    ).toBe('B');
    expect(latestTimestamp([])).toBeNull();
  });
});

describe('decideUserScope', () => {
  it('does nothing while status is unknown', () => {
    expect(decideUserScope('a', 'unknown', null)).toEqual({ clear: false, nextOwner: undefined });
  });
  it('clears on logout only if data had an owner', () => {
    expect(decideUserScope('a', 'anonymous', null)).toEqual({ clear: true, nextOwner: null });
    expect(decideUserScope(null, 'anonymous', null)).toEqual({ clear: false, nextOwner: null });
  });
  it('clears on account switch, adopts unowned data', () => {
    expect(decideUserScope('a', 'authenticated', 'b')).toEqual({ clear: true, nextOwner: 'b' });
    expect(decideUserScope('a', 'authenticated', 'a')).toEqual({ clear: false, nextOwner: 'a' });
    expect(decideUserScope(null, 'authenticated', 'a')).toEqual({ clear: false, nextOwner: 'a' });
  });
});
