'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useFollowingStore } from '@/store/followingStore';
import { cleanupLegacyStorage, reconcileUserScope, rehydratePersistedStores } from '@/store/hydration';
import { Toaster } from '@/components/ui/Toast';

/**
 * Boot sequence (client only, once):
 *  1. rehydrate persisted zustand stores (they use skipHydration, so the first
 *     client render matches the server HTML)
 *  2. ask the server who we are (/api/auth/me)
 * Then, whenever the confirmed user changes, enforce per-user data ownership
 * (wipe on logout / account switch) and sync the following list.
 */
function SessionSync() {
  const status = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [storesReady, setStoresReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    cleanupLegacyStorage();
    rehydratePersistedStores().then(() => {
      if (!cancelled) setStoresReady(true);
    });
    void useAuthStore.getState().hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!storesReady) return;
    reconcileUserScope(status, userId);
    if (status === 'authenticated') void useFollowingStore.getState().hydrate();
  }, [storesReady, status, userId]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            retry: 2,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionSync />
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
