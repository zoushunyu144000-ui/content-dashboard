'use client';

import { useEffect } from 'react';

export function useTheme() {
  return { theme: 'dark' as const, toggleTheme: () => {} };
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  return <>{children}</>;
}
