'use client';

import { useFilterStore } from '@/store/filterStore';

export function SidebarShift({ children }: { children: React.ReactNode }) {
  const { sidebarOpen } = useFilterStore();

  return (
    <div
      className={`flex-1 flex flex-col min-w-0 transition-all duration-300
        ${sidebarOpen ? 'md:ml-64' : 'md:ml-14'}`}
    >
      {children}
    </div>
  );
}
