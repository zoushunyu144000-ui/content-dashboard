'use client';

import Link from 'next/link';
import ProjectReportDownload from '@/components/ProjectReportDownload';
import { useProject } from '@/components/ProjectProvider';
import { t } from '@/lib/i18n';

export default function ProjectHubPage({
  title,
  legacyInsights = false,
}: {
  title: string;
  legacyInsights?: boolean;
}) {
  const { project, loading, error } = useProject();
  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl">{title}</h1>
      {error ? <p className="error-banner">{error}</p> : null}
      {loading ? <p className="text-sm text-muted">{t('project.loading')}</p> : null}
      {!loading && !project && !error ? <p className="text-sm text-muted">{t('project.none')}</p> : null}
      <ProjectReportDownload />
      <div className="flex flex-wrap gap-2">
        <Link className="btn-ghost" href="/opportunities">{t('nav.opportunities')}</Link>
        <Link className="btn-ghost" href="/library">{t('nav.library')}</Link>
        {legacyInsights ? <Link className="btn-ghost" href="/insights">旧洞察</Link> : null}
      </div>
    </div>
  );
}
