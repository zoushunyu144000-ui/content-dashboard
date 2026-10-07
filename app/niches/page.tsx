import { Suspense } from 'react';
import NichesHome from '@/components/niches/NichesHome';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default function NichesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">{t('project.loading')}</p>}>
      <NichesHome />
    </Suspense>
  );
}
