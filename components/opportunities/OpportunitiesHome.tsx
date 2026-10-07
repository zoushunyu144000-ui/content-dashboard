'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useProject } from '@/components/ProjectProvider';
import { ApiError, api } from '@/lib/client/api';
import { t } from '@/lib/i18n';
import { textOrDash } from '@/components/library/shared';
import {
  evidenceLine,
  opportunityHref,
  opportunityTypeLabel,
  structureLabel,
  type Opportunity,
} from './shared';

class GenerateError extends Error {
  detail: string;

  constructor(message: string, detail: string) {
    super(message);
    this.detail = detail;
  }
}

async function generateOpportunities(nicheId: string): Promise<Opportunity[]> {
  const response = await fetch(`/api/niches/${encodeURIComponent(nicheId)}/opportunities`, { method: 'POST' });
  if (response.status === 401 && typeof window !== 'undefined' && window.location.pathname !== '/login') {
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.href = `/login?next=${encodeURIComponent(next)}`;
    throw new GenerateError(t('api.signInRequired'), '');
  }
  const data = await response.json().catch(() => ({} as { error?: unknown; detail?: unknown; opportunities?: Opportunity[] }));
  if (!response.ok) {
    const message = typeof data.error === 'string' && data.error ? data.error : t('ai.analysisFailed');
    const detail = typeof data.detail === 'string' ? data.detail : '';
    throw new GenerateError(message, detail);
  }
  return Array.isArray(data.opportunities) ? data.opportunities : [];
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-muted">{label}</div>
      <p className="mt-0.5 whitespace-pre-wrap text-sm">{value}</p>
    </div>
  );
}

function OpportunityCard({ item, projectId }: { item: Opportunity; projectId: string | undefined }) {
  const typeLabel = item.opportunity_type ? opportunityTypeLabel(item.opportunity_type) : '';
  return (
    <article className="panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="min-w-0 text-base font-semibold">{item.title || t('common.untitled')}</h2>
        {typeLabel && typeLabel !== '—' ? <span className="status-badge shrink-0">{typeLabel}</span> : null}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label={t('opportunities.audience')} value={textOrDash(item.target_audience)} />
        <Field label={t('opportunities.pain')} value={textOrDash(item.pain_point)} />
        <Field label={t('opportunities.hook')} value={textOrDash(item.recommended_hook)} />
        <Field label={t('opportunities.angle')} value={textOrDash(item.angle)} />
        <Field label={t('opportunities.structure')} value={structureLabel(item.content_structure)} />
        <Field label={t('opportunities.platform')} value={textOrDash(item.platform_suggestion)} />
      </div>
      <div className="mt-3">
        <Field label={t('opportunities.whyNow')} value={textOrDash(item.why_now)} />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted">{evidenceLine(item.evidence)}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={opportunityHref(projectId, item.id)} className="btn-ghost">
          {t('opportunities.viewEvidence')}
        </Link>
        <Link href={opportunityHref(projectId, item.id, 'brief')} className="btn-primary">
          {t('opportunities.create')}
        </Link>
      </div>
    </article>
  );
}

export default function OpportunitiesHome() {
  const { project, loading: projectLoading, error: projectError } = useProject();
  const [items, setItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [genDetail, setGenDetail] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const projectId = project?.id;

  useEffect(() => {
    if (!projectId) {
      if (!projectLoading) setLoading(false);
      return;
    }
    let cancelled = false;
    setItems([]);
    setLoading(true);
    setLoadError('');
    api<{ opportunities?: Opportunity[] }>(`/api/opportunities?niche=${encodeURIComponent(projectId)}`)
      .then((data) => {
        if (!cancelled) setItems(Array.isArray(data.opportunities) ? data.opportunities : []);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : t('opportunities.loadError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, projectLoading, reloadToken]);

  const generate = useCallback(() => {
    if (!projectId || generating) return;
    setGenerating(true);
    setGenError('');
    setGenDetail('');
    generateOpportunities(projectId)
      .then((next) => {
        setItems(next);
        setLoadError('');
      })
      .catch((err: unknown) => {
        if (err instanceof GenerateError) {
          setGenError(err.message || t('ai.analysisFailed'));
          setGenDetail(err.detail);
          return;
        }
        if (err instanceof ApiError) {
          setGenError(t('ai.analysisFailed'));
          setGenDetail(err.message);
          return;
        }
        setGenError(t('ai.analysisFailed'));
        setGenDetail(err instanceof Error ? err.message : '');
      })
      .finally(() => setGenerating(false));
  }, [generating, projectId]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl">{t('opportunities.title')}</h1>
          <p className="mt-1 text-sm text-muted">
            {project?.name || (projectLoading ? t('project.loading') : t('project.choose'))}
          </p>
        </div>
        <button
          type="button"
          className="btn-primary max-w-full whitespace-normal text-center"
          onClick={generate}
          disabled={!projectId || generating}
          aria-busy={generating}
        >
          {generating ? t('opportunities.generating') : t('opportunities.generate')}
        </button>
      </div>

      {projectError ? <p className="error-banner">{projectError}</p> : null}

      {genError ? (
        <div className="error-banner" role="alert">
          <p className="text-red">{genError}</p>
          {genDetail ? <p className="mt-1 text-xs text-red">{genDetail}</p> : null}
          <button type="button" className="btn-ghost mt-2" onClick={generate} disabled={generating || !projectId}>
            {t('ai.retry')}
          </button>
        </div>
      ) : null}

      {loadError ? (
        <div className="error-banner" role="alert">
          <p>{loadError}</p>
          <button type="button" className="btn-ghost mt-2" onClick={() => setReloadToken((count) => count + 1)}>
            {t('ai.retry')}
          </button>
        </div>
      ) : null}

      {projectLoading || (loading && items.length === 0 && !loadError) ? (
        <p className="text-sm text-muted">{t('opportunities.loading')}</p>
      ) : null}

      {!projectLoading && !project && !projectError ? (
        <p className="text-sm text-muted">{t('project.none')}</p>
      ) : null}

      {project && !loading && !loadError && items.length === 0 ? (
        <section className="panel p-6">
          <h2 className="text-base font-semibold">{t('opportunities.emptyTitle')}</h2>
          <p className="mt-2 max-w-lg text-sm text-muted">{t('opportunities.emptyBody')}</p>
          <button
            type="button"
            className="btn-primary mt-4 max-w-full whitespace-normal text-center"
            onClick={generate}
            disabled={generating}
            aria-busy={generating}
          >
            {generating ? t('opportunities.generating') : t('opportunities.generate')}
          </button>
        </section>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => (
          <OpportunityCard key={item.id} item={item} projectId={projectId} />
        ))}
      </div>
    </div>
  );
}
