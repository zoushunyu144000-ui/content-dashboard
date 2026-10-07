import type { Metadata } from 'next';
import OpportunitiesHome from '@/components/opportunities/OpportunitiesHome';
import { BRAND } from '@/lib/brand';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `创作机会 · ${BRAND.name}`,
};

export default function OpportunitiesPage() {
  return <OpportunitiesHome />;
}
