import { Suspense } from 'react';
import type { Metadata } from 'next';
import LibraryHome from '@/components/library/LibraryHome';
import { BRAND } from '@/lib/brand';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `爆款库 · ${BRAND.name}`,
};

export default function LibraryPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">正在加载爆款库…</p>}>
      <LibraryHome />
    </Suspense>
  );
}
