'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  userInitials: string;
  text: string;
  createdAt: string;
  color: string;
}

export const CHAT_ROOMS = [
  { id: 'general',      label: 'General',       emoji: '💬' },
  { id: 'movies',       label: 'Movies',         emoji: '🎬' },
  { id: 'tv-shows',     label: 'TV Shows',       emoji: '📺' },
  { id: 'recommendations', label: 'Recs',        emoji: '⭐' },
  { id: 'spoilers',     label: 'Spoilers',        emoji: '⚠️' },
] as const;

export type RoomId = (typeof CHAT_ROOMS)[number]['id'];

const USER_COLORS = [
  '#7c3aed', '#4f46e5', '#0891b2', '#059669',
  '#d97706', '#dc2626', '#db2777', '#7c3aed',
];

function userColor(userId: string): string {
  let hash = 0;
  for (const c of userId) hash = ((hash << 5) - hash) + c.charCodeAt(0);
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

interface ChatStore {
  messages: ChatMessage[];
  activeRoom: RoomId;
  chatOpen: boolean;
  unreadCount: number;

  setActiveRoom: (id: RoomId) => void;
  setChatOpen: (v: boolean) => void;
  toggleChat: () => void;
  sendMessage: (text: string, userId: string, userName: string, userInitials: string) => void;
  getRoomMessages: (roomId: RoomId) => ChatMessage[];
  resetUnread: () => void;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      messages: [],
      activeRoom: 'general',
      chatOpen: false,
      unreadCount: 0,

      setActiveRoom: (id) => set({ activeRoom: id, unreadCount: 0 }),
      setChatOpen: (v) => set({ chatOpen: v, unreadCount: v ? 0 : get().unreadCount }),
      toggleChat: () => {
        const next = !get().chatOpen;
        set({ chatOpen: next, unreadCount: next ? 0 : get().unreadCount });
      },

      sendMessage: (text, userId, userName, userInitials) => {
        if (!text.trim()) return;
        const msg: ChatMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          roomId: get().activeRoom,
          userId,
          userName,
          userInitials,
          text: text.trim().slice(0, 500),
          createdAt: new Date().toISOString(),
          color: userColor(userId),
        };
        set((s) => ({
          messages: [...s.messages.slice(-500), msg], // keep last 500
          unreadCount: s.chatOpen ? 0 : s.unreadCount + 1,
        }));

        // Broadcast to other tabs
        if (typeof window !== 'undefined') {
          try {
            const bc = new BroadcastChannel('mkmovies-chat');
            bc.postMessage(msg);
            bc.close();
          } catch {
            // BroadcastChannel not supported — silent fail
          }
        }
      },

      getRoomMessages: (roomId) =>
        get().messages.filter((m) => m.roomId === roomId).slice(-100),

      resetUnread: () => set({ unreadCount: 0 }),
    }),
    {
      name: 'mkmovies-chat',
      partialize: (s) => ({ messages: s.messages, activeRoom: s.activeRoom }),
    }
  )
);
