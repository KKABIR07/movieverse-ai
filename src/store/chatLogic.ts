/**
 * Pure chat helpers (node-testable). The server is the source of truth:
 * GET  /api/chat?roomId=<room>&after=<iso>  → { messages: ServerMessage[] } oldest→newest (public read)
 * POST /api/chat { roomId, text }            → { message: ServerMessage } (auth required)
 */

export const CHAT_ROOMS = [
  { id: 'general', label: 'General' },
  { id: 'movies', label: 'Movies' },
  { id: 'tv-shows', label: 'TV shows' },
  { id: 'recommendations', label: 'Recs' },
  { id: 'spoilers', label: 'Spoilers' },
] as const;

export type RoomId = (typeof CHAT_ROOMS)[number]['id'];

export const MAX_MESSAGES_PER_ROOM = 200;
export const MAX_MESSAGE_LENGTH = 500;

export interface ChatMessage {
  id: string;
  roomId: string;
  text: string;
  userName: string;
  initials: string;
  createdAt: string;
  isMine: boolean;
  /** Client-only: optimistic message waiting for the server. */
  pending?: boolean;
  /** Client-only: POST failed. */
  failed?: boolean;
}

/**
 * Accepts the new API shape `{id, initials, isMine}` and the legacy Mongo shape
 * `{_id, userInitials, userId}` so the widget works during the backend rollout.
 */
export function normalizeMessage(raw: unknown, currentUserId?: string | null): ChatMessage | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = (r.id ?? r._id) as string | undefined;
  const text = r.text as string | undefined;
  const createdAt = r.createdAt as string | undefined;
  if (!id || typeof text !== 'string' || !createdAt) return null;
  const userName = (r.userName as string) || 'Someone';
  const initials =
    (r.initials as string) ||
    (r.userInitials as string) ||
    userName
      .split(/\s+/)
      .map((p) => p[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase();
  const isMine =
    typeof r.isMine === 'boolean' ? r.isMine : !!currentUserId && r.userId != null && String(r.userId) === currentUserId;
  return {
    id: String(id),
    roomId: String(r.roomId ?? 'general'),
    text,
    userName,
    initials,
    createdAt: String(createdAt),
    isMine,
  };
}

/** Merge incoming messages into a room: dedupe by id, sort oldest→newest, cap length. */
export function mergeMessages(
  existing: readonly ChatMessage[],
  incoming: readonly ChatMessage[],
  cap = MAX_MESSAGES_PER_ROOM,
): ChatMessage[] {
  if (!incoming.length) return existing as ChatMessage[];
  const byId = new Map<string, ChatMessage>();
  for (const m of existing) byId.set(m.id, m);
  for (const m of incoming) byId.set(m.id, m);
  const merged = [...byId.values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  return merged.length > cap ? merged.slice(merged.length - cap) : merged;
}

/** ISO timestamp of the newest confirmed (non-optimistic) message, for `?after=`. */
export function latestTimestamp(messages: readonly ChatMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m.pending && !m.failed) return m.createdAt;
  }
  return null;
}

export function isRoomId(v: string): v is RoomId {
  return CHAT_ROOMS.some((r) => r.id === v);
}
