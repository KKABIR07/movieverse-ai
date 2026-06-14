'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useFollowingStore } from '@/store/followingStore';

function AuthHydrator() {
  const { hydrate, user } = useAuthStore();
  const { hydrate: hydrateFollowing, reset: resetFollowing } = useFollowingStore();

  useEffect(() => {
    hydrate().then(() => {
      // After auth hydration, sync following list from server
      useAuthStore.getState().user ? hydrateFollowing() : undefined;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When user logs in, sync following; when logs out, clear it
  useEffect(() => {
    if (user) hydrateFollowing();
    else resetFollowing();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

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
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthHydrator />
      {children}
    </QueryClientProvider>
  );
}
