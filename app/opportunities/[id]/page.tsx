import type { Metadata } from 'next';
import OpportunityDetail from '@/components/opportunities/OpportunityDetail';
import { BRAND } from '@/lib/brand';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `创作机会 · ${BRAND.name}`,
};

export default function OpportunityDetailPage() {
  return <OpportunityDetail />;
}
