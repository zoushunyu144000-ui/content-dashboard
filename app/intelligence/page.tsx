import ProjectHubPage from '@/components/ProjectHubPage';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default function IntelligencePage() {
  return <ProjectHubPage title={t('nav.aiIntelligence')} legacyInsights />;
}
