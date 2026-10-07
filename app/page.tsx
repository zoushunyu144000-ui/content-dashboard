import type { Metadata } from 'next';
import DashboardHome from '@/components/dashboard/DashboardHome';
import { BRAND } from '@/lib/brand';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `下一条该做什么？ · ${BRAND.name}`,
};

export default function DashboardPage() {
  return <DashboardHome />;
}
