'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Number keys jump between the four product pages.
const NAV_MAP: Record<string, string> = {
  '1': '/',
  '2': '/research',
  '3': '/feed',
  '4': '/insights',
};

export default function GlobalFeatures() {
  const pathname = usePathname();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (pathname === '/login') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const target = NAV_MAP[e.key];
      if (!target || pathname === target) return;
      e.preventDefault();
      window.location.href = target;
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [pathname]);

  return null;
}
