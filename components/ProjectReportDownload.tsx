'use client';

import { useProject } from '@/components/ProjectProvider';

export default function ProjectReportDownload({ className = 'btn-primary' }: { className?: string }) {
  const { project } = useProject();
  if (!project) return null;
  return (
    <a
      className={className}
      href={`/api/niches/${encodeURIComponent(project.id)}/report/txt`}
      download
    >
      下载整个项目报告 (TXT)
    </a>
  );
}
