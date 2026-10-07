'use client';

import { useRouter } from 'next/navigation';
import { t } from '@/lib/i18n';
import { useProject } from './ProjectProvider';

export default function ProjectSwitcher() {
  const router = useRouter();
  const { projects, project, loading, error, setProjectId } = useProject();

  function openCreate() {
    router.push('/niches?new=1');
    const backdrop = document.querySelector('button.fixed.inset-0');
    if (backdrop instanceof HTMLButtonElement) backdrop.click();
  }

  return (
    <div className="px-2">
      <label className="block">
        <span className="mb-1 block px-1 text-[10px] font-semibold uppercase tracking-[1.4px] text-muted">
          {t('project.label')}
        </span>
        <select
          value={project?.id || ''}
          onChange={(event) => setProjectId(event.target.value)}
          disabled={loading || projects.length === 0}
          className="field"
          aria-label={t('project.label')}
        >
          {loading ? <option value="">{t('project.loading')}</option> : null}
          {!loading && projects.length === 0 ? <option value="">{t('project.none')}</option> : null}
          {projects.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        {error ? <span className="mt-1 block px-1 text-[11px] text-red">{error}</span> : null}
      </label>
      <button type="button" className="btn-ghost mt-2 w-full" onClick={openCreate}>
        {t('project.newNiche')}
      </button>
    </div>
  );
}
