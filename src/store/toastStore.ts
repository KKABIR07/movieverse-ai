'use client';

import { create } from 'zustand';

export type ToastTone = 'neutral' | 'success' | 'danger';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
  /** ms before auto-dismiss; 0 = sticky. Default 4000. */
  duration: number;
  action?: { label: string; onClick: () => void };
}

export type ToastInput = Omit<Toast, 'id' | 'tone' | 'duration'> & Partial<Pick<Toast, 'tone' | 'duration'>>;

const MAX_TOASTS = 3;

interface ToastStore {
  toasts: Toast[];
  push: (t: ToastInput) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const useToastStore = create<ToastStore>()((set) => ({
  toasts: [],
  push: (t) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const toast: Toast = { tone: 'neutral', duration: 4000, ...t, id };
    set((s) => ({ toasts: [...s.toasts, toast].slice(-MAX_TOASTS) }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

/**
 * Fire a toast from anywhere (no hook needed).
 * @example toast({ title: 'Added to watchlist', tone: 'success' })
 */
export function toast(t: ToastInput | string): string {
  return useToastStore.getState().push(typeof t === 'string' ? { title: t } : t);
}
