'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  CHAT_ROOMS,
  MAX_MESSAGE_LENGTH,
  latestTimestamp,
  mergeMessages,
  normalizeMessage,
  type ChatMessage,
  type RoomId,
} from './chatLogic';

export { CHAT_ROOMS, type ChatMessage, type RoomId } from './chatLogic';

/**
 * Shared community chat. Messages live on the server (`/api/chat`) and are
 * polled while the panel is open; nothing but the selected room is stored
 * locally. The AI assistant tab is local-only UI state inside ChatWidget.
 */
interface ChatStore {
  activeRoom: RoomId;
  chatOpen: boolean;
  unreadCount: number;
  messagesByRoom: Partial<Record<RoomId, ChatMessage[]>>;
  loadingRoom: RoomId | null;
  loadError: string | null;

  setActiveRoom: (id: RoomId) => void;
  setChatOpen: (v: boolean) => void;
  toggleChat: () => void;
  resetUnread: () => void;
  getRoomMessages: (roomId: RoomId) => ChatMessage[];

  /** Fetch messages newer than the last one we have. Safe to call on an interval. */
  fetchRoom: (roomId: RoomId, opts?: { signal?: AbortSignal; currentUserId?: string | null }) => Promise<void>;
  /** POST a message (requires login). Optimistic; marks `failed` on error. Returns success. */
  sendMessage: (text: string, sender: { userName: string; initials: string }) => Promise<boolean>;
  /** Drop cached messages (e.g. on logout so `isMine` flags are recomputed). */
  reset: () => void;
}

const EMPTY: ChatMessage[] = [];

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      activeRoom: 'general',
      chatOpen: false,
      unreadCount: 0,
      messagesByRoom: {},
      loadingRoom: null,
      loadError: null,

      setActiveRoom: (id) => set({ activeRoom: id, unreadCount: 0 }),
      setChatOpen: (v) => set((s) => ({ chatOpen: v, unreadCount: v ? 0 : s.unreadCount })),
      toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen, unreadCount: !s.chatOpen ? 0 : s.unreadCount })),
      resetUnread: () => set({ unreadCount: 0 }),
      getRoomMessages: (roomId) => get().messagesByRoom[roomId] ?? EMPTY,

      fetchRoom: async (roomId, { signal, currentUserId } = {}) => {
        const existing = get().messagesByRoom[roomId] ?? EMPTY;
        const after = latestTimestamp(existing);
        const params = new URLSearchParams({ roomId });
        if (after) params.set('after', after);
        if (!existing.length) set({ loadingRoom: roomId });
        try {
          const res = await fetch(`/api/chat?${params.toString()}`, { signal, cache: 'no-store' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as { messages?: unknown[] };
          const incoming = (data.messages ?? [])
            .map((m) => normalizeMessage(m, currentUserId))
            .filter((m): m is ChatMessage => m !== null);
          set((s) => {
            const prev = s.messagesByRoom[roomId] ?? EMPTY;
            const next = mergeMessages(prev, incoming);
            const fresh = incoming.filter((m) => !m.isMine && !prev.some((p) => p.id === m.id)).length;
            const counting = prev.length > 0 && (!s.chatOpen || s.activeRoom !== roomId);
            return {
              messagesByRoom: { ...s.messagesByRoom, [roomId]: next },
              loadingRoom: s.loadingRoom === roomId ? null : s.loadingRoom,
              loadError: null,
              unreadCount: counting ? s.unreadCount + fresh : s.unreadCount,
            };
          });
        } catch (err) {
          if ((err as Error)?.name === 'AbortError') return;
          set((s) => ({
            loadingRoom: s.loadingRoom === roomId ? null : s.loadingRoom,
            loadError: 'Could not load messages.',
          }));
        }
      },

      sendMessage: async (text, sender) => {
        const body = text.trim().slice(0, MAX_MESSAGE_LENGTH);
        if (!body) return false;
        const roomId = get().activeRoom;
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const optimistic: ChatMessage = {
          id: tempId,
          roomId,
          text: body,
          userName: sender.userName,
          initials: sender.initials,
          createdAt: new Date().toISOString(),
          isMine: true,
          pending: true,
        };
        const replace = (fn: (list: ChatMessage[]) => ChatMessage[]) =>
          set((s) => ({ messagesByRoom: { ...s.messagesByRoom, [roomId]: fn(s.messagesByRoom[roomId] ?? EMPTY) } }));

        replace((list) => [...list, optimistic]);
        try {
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId, text: body }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as { message?: unknown };
          const saved = normalizeMessage(data.message, null);
          replace((list) => {
            const without = list.filter((m) => m.id !== tempId);
            return saved ? mergeMessages(without, [{ ...saved, isMine: true }]) : [...without, { ...optimistic, pending: false }];
          });
          return true;
        } catch {
          replace((list) => list.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)));
          return false;
        }
      },

      reset: () => set({ messagesByRoom: {}, unreadCount: 0, loadError: null }),
    }),
    {
      name: 'mkmovies-chat',
      version: 2,
      skipHydration: true,
      // Only the selected room is remembered; messages always come from the server.
      partialize: (s) => ({ activeRoom: s.activeRoom }),
      migrate: (persisted) => {
        const room = (persisted as { activeRoom?: string } | null)?.activeRoom;
        return { activeRoom: CHAT_ROOMS.some((r) => r.id === room) ? (room as RoomId) : 'general' };
      },
    },
  ),
);
