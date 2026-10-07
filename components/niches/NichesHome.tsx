'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useProject } from '@/components/ProjectProvider';
import { useToast } from '@/components/ToastProvider';
import { ApiError, api } from '@/lib/client/api';
import { formatTime, stepLabel } from '@/lib/client/format';
import { t } from '@/lib/i18n';

interface ClientNiche {
  id: string;
  name: string;
  target_audience: string | null;
  core_business: string | null;
  content_goal: string | null;
  core_pain_points: string[];
  content_pillars: string[];
  search_keywords: string[];
}

interface NicheOverview {
  niche: ClientNiche;
  counts: { videos: number; analysed: number; opportunities: number };
  top_pain_points: Array<{ key: string; label: string; count: number }>;
  audience_insights: Array<{ title: string; evidence_count: number; confidence: string | null }>;
  opportunities: Array<{ id: string; title: string }>;
  runs: Array<{ id: string; topic: string; status: string; created_at: string }>;
}

interface NicheCardData extends NicheOverview {
  loadError?: string;
}

interface NicheDraft {
  name: string;
  target_audience: string;
  core_business: string;
  content_goal: string;
  core_pain_points: string;
  content_pillars: string;
  search_keywords: string;
}

function emptyDraft(): NicheDraft {
  return {
    name: '',
    target_audience: '',
    core_business: '',
    content_goal: '',
    core_pain_points: '',
    content_pillars: '',
    search_keywords: '',
  };
}

function draftFromNiche(niche: ClientNiche): NicheDraft {
  return {
    name: niche.name || '',
    target_audience: niche.target_audience || '',
    core_business: niche.core_business || '',
    content_goal: niche.content_goal || '',
    core_pain_points: (niche.core_pain_points || []).join('\n'),
    content_pillars: (niche.content_pillars || []).join('\n'),
    search_keywords: (niche.search_keywords || []).join('\n'),
  };
}

function splitLines(value: string): string[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function toPayload(draft: NicheDraft) {
  return {
    name: draft.name.trim(),
    target_audience: draft.target_audience.trim(),
    core_business: draft.core_business.trim(),
    content_goal: draft.content_goal.trim(),
    core_pain_points: splitLines(draft.core_pain_points),
    content_pillars: splitLines(draft.content_pillars),
    search_keywords: splitLines(draft.search_keywords),
  };
}

function messageOf(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status === 409) return t('niches.duplicate');
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function confidenceText(value: string | null): string {
  if (value === 'high' || value === 'medium' || value === 'low') return t(`enum.${value}`);
  return '';
}

function NicheFields({
  draft,
  onChange,
  idPrefix,
  disabled,
}: {
  draft: NicheDraft;
  onChange: (next: NicheDraft) => void;
  idPrefix: string;
  disabled: boolean;
}) {
  function bind(key: keyof NicheDraft, label: string, multiline = false) {
    const id = `${idPrefix}-${key}`;
    return (
      <label className="block" htmlFor={id}>
        <span className="mb-1 block text-xs text-muted">{label}</span>
        {multiline ? (
          <textarea
            id={id}
            className="field min-h-[96px]"
            rows={4}
            value={draft[key]}
            disabled={disabled}
            placeholder={t('niches.onePerLine')}
            onChange={(event) => onChange({ ...draft, [key]: event.target.value })}
          />
        ) : (
          <input
            id={id}
            className="field"
            value={draft[key]}
            disabled={disabled}
            required={key === 'name'}
            onChange={(event) => onChange({ ...draft, [key]: event.target.value })}
          />
        )}
      </label>
    );
  }

  return (
    <div className="space-y-3">
      {bind('name', t('niches.name'))}
      {bind('target_audience', t('niches.targetAudience'))}
      {bind('core_business', t('niches.coreBusiness'))}
      {bind('content_goal', t('niches.contentGoal'))}
      {bind('core_pain_points', t('niches.painPoints'), true)}
      {bind('content_pillars', t('niches.pillars'), true)}
      {bind('search_keywords', t('niches.keywords'), true)}
    </div>
  );
}

function Chips({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="text-[11px] text-muted">{label}</div>
      {items.length === 0 ? <p className="mt-1 text-sm">{t('niches.emptyValue')}</p> : (
        <ul className="mt-1 flex flex-wrap gap-1.5">
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className="max-w-full break-words rounded-full border border-border px-2 py-0.5 text-xs">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TextField({ label, value }: { label: string; value: string | null }) {
  const text = value?.trim() || '';
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-muted">{label}</div>
      <p className="mt-0.5 whitespace-pre-wrap text-sm">{text || t('niches.emptyValue')}</p>
    </div>
  );
}

function NicheCard({
  item,
  detail,
  isCurrent,
  editing,
  editDraft,
  editError,
  saving,
  onEditDraft,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onSetCurrent,
  onStartResearch,
}: {
  item: NicheCardData;
  detail: boolean;
  isCurrent: boolean;
  editing: boolean;
  editDraft: NicheDraft;
  editError: string;
  saving: boolean;
  onEditDraft: (next: NicheDraft) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onSetCurrent: () => void;
  onStartResearch: () => void;
}) {
  const niche = item.niche;
  const params = useSearchParams();
  const detailParams = new URLSearchParams(params.toString());
  detailParams.delete('new');
  detailParams.set('id', niche.id);
  const counts = [
    { label: t('niches.videos'), value: item.counts.videos },
    { label: t('niches.analysed'), value: item.counts.analysed },
    { label: t('niches.opportunities'), value: item.counts.opportunities },
  ];

  return (
    <article className="panel space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="min-w-0 font-heading text-xl">
          {detail ? niche.name : (
            <Link href={`/niches?${detailParams.toString()}`} className="hover:underline">
              {niche.name}
            </Link>
          )}
        </h2>
        {isCurrent ? <span className="text-xs text-muted">{t('niches.current')}</span> : null}
      </div>

      {editing ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            onSaveEdit();
          }}
        >
          <NicheFields draft={editDraft} onChange={onEditDraft} idPrefix={`edit-${niche.id}`} disabled={saving} />
          {editError ? <p className="error-banner" role="alert">{editError}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? t('niches.saving') : t('niches.save')}
            </button>
            <button type="button" className="btn-ghost" onClick={onCancelEdit} disabled={saving}>
              {t('niches.cancel')}
            </button>
          </div>
        </form>
      ) : (
        <>
          {item.loadError ? <p className="error-banner" role="alert">{item.loadError}</p> : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField label={t('niches.targetAudience')} value={niche.target_audience} />
            <TextField label={t('niches.coreBusiness')} value={niche.core_business} />
            <TextField label={t('niches.contentGoal')} value={niche.content_goal} />
          </div>
          <Chips label={t('niches.painPoints')} items={niche.core_pain_points || []} />
          <Chips label={t('niches.pillars')} items={niche.content_pillars || []} />
          <Chips label={t('niches.keywords')} items={niche.search_keywords || []} />
          <div className="grid grid-cols-3 gap-2">
            {counts.map((count) => (
              <div key={count.label} className="rounded-lg border border-border px-2 py-2">
                <div className="text-[11px] text-muted">{count.label}</div>
                <div className="mt-1 font-mono text-lg">{count.value}</div>
              </div>
            ))}
          </div>
          <section>
            <h3 className="text-xs font-medium text-muted">{t('niches.hotPain')}</h3>
            {item.top_pain_points.length === 0 ? <p className="mt-1 text-sm text-muted">{t('niches.none')}</p> : (
              <ul className="mt-1 space-y-1">
                {item.top_pain_points.map((pain) => (
                  <li key={pain.key} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">{pain.label}</span>
                    <span className="font-mono text-xs text-muted">{pain.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className="text-xs font-medium text-muted">{t('niches.audiencePain')}</h3>
            {item.audience_insights.length === 0 ? <p className="mt-1 text-sm text-muted">{t('niches.none')}</p> : (
              <ul className="mt-1 space-y-2">
                {item.audience_insights.map((insight, index) => {
                  const confidence = confidenceText(insight.confidence);
                  return (
                    <li key={`${insight.title}-${index}`}>
                      <div className="text-sm">{insight.title}</div>
                      <div className="text-xs text-muted">
                        {t('niches.evidence', { count: insight.evidence_count })}
                        {confidence ? ` · ${confidence}` : ''}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <section>
            <h3 className="text-xs font-medium text-muted">{t('niches.opportunities')}</h3>
            {item.opportunities.length === 0 ? <p className="mt-1 text-sm text-muted">{t('niches.none')}</p> : (
              <ul className="mt-1 space-y-1">
                {item.opportunities.map((opportunity) => (
                  <li key={opportunity.id}>
                    <Link href={`/opportunities/${opportunity.id}`} className="text-sm hover:underline">
                      {opportunity.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className="text-xs font-medium text-muted">{t('niches.recentResearch')}</h3>
            {item.runs.length === 0 ? <p className="mt-1 text-sm text-muted">{t('niches.none')}</p> : (
              <ul className="mt-1 space-y-2">
                {item.runs.map((run) => (
                  <li key={run.id}>
                    <Link href={`/research?run=${encodeURIComponent(run.id)}`} className="block min-w-0 hover:underline">
                      <span className="block truncate text-sm">{run.topic}</span>
                      <span className="text-xs text-muted">{stepLabel(run.status)} · {formatTime(run.created_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={onStartEdit}>{t('niches.edit')}</button>
            <button type="button" className="btn-ghost" onClick={onSetCurrent}>{t('niches.setCurrent')}</button>
            <button type="button" className="btn-primary" onClick={onStartResearch}>{t('niches.startResearch')}</button>
          </div>
        </>
      )}

      <a
        className="btn-ghost w-full whitespace-normal text-center"
        href={`/api/niches/${encodeURIComponent(niche.id)}/report/txt`}
        download
      >
        {t('niches.download')}
      </a>
    </article>
  );
}

export default function NichesHome() {
  const router = useRouter();
  const search = useSearchParams();
  const { project, setProjectId, refresh } = useProject();
  const { showToast } = useToast();
  const openNew = search.get('new') === '1';
  const focusId = search.get('id');
  const [items, setItems] = useState<NicheCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<NicheDraft>(emptyDraft);
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<NicheDraft>(emptyDraft);
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api<{ niches: ClientNiche[] }>('/api/niches')
      .then(async (data) => {
        const niches = data.niches || [];
        const next = await Promise.all(niches.map(async (niche) => {
          try {
            return await api<NicheOverview>(`/api/niches/${encodeURIComponent(niche.id)}/overview`);
          } catch (err) {
            const empty: NicheCardData = {
              niche,
              counts: { videos: 0, analysed: 0, opportunities: 0 },
              top_pain_points: [],
              audience_insights: [],
              opportunities: [],
              runs: [],
              loadError: messageOf(err, t('niches.loadError')),
            };
            return empty;
          }
        }));
        if (!cancelled) setItems(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(messageOf(err, t('niches.loadError')));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  useEffect(() => {
    if (!openNew) return;
    setCreateDraft(emptyDraft());
    setFormError('');
    setFormOpen(true);
  }, [openNew]);

  useEffect(() => {
    if (!formOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setFormOpen(false);
        if (new URLSearchParams(window.location.search).get('new') === '1') {
          const params = new URLSearchParams(window.location.search);
          params.delete('new');
          const query = params.toString();
          router.replace(query ? `/niches?${query}` : '/niches');
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [formOpen, router]);

  function closeForm() {
    setFormOpen(false);
    setFormError('');
    if (search.get('new') === '1') {
      const params = new URLSearchParams(search.toString());
      params.delete('new');
      const query = params.toString();
      router.replace(query ? `/niches?${query}` : '/niches');
    }
  }

  function openCreate() {
    setCreateDraft(emptyDraft());
    setFormError('');
    setFormOpen(true);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const payload = toPayload(createDraft);
    if (!payload.name) {
      setFormError(t('niches.nameRequired'));
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const data = await api<{ niche: { id: string } }>('/api/niches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      try {
        await refresh();
      } catch {
        // Switcher reloads on the next navigation if this refresh fails.
      }
      const params = new URLSearchParams(window.location.search);
      params.delete('new');
      params.delete('id');
      params.set('project', data.niche.id);
      const query = params.toString();
      window.history.replaceState(null, '', query ? `/niches?${query}` : '/niches');
      setProjectId(data.niche.id);
      setFormOpen(false);
      setCreateDraft(emptyDraft());
      showToast(t('niches.created'));
      setReloadToken((count) => count + 1);
    } catch (err) {
      setFormError(messageOf(err, t('niches.createError')));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit() {
    const id = editingId;
    if (!id || saving) return;
    const payload = toPayload(editDraft);
    if (!payload.name) {
      setEditError(t('niches.nameRequired'));
      return;
    }
    setSaving(true);
    setEditError('');
    try {
      const data = await api<{ niche: ClientNiche }>(`/api/niches/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setItems((current) => current.map((item) => (
        item.niche.id === id ? { ...item, niche: data.niche } : item
      )));
      setEditingId((current) => (current === id ? null : current));
      try {
        await refresh();
      } catch {
        // Name in the switcher updates on the next project reload.
      }
      showToast(t('niches.saved'));
    } catch (err) {
      setEditError(messageOf(err, t('niches.saveError')));
    } finally {
      setSaving(false);
    }
  }

  const visible = focusId ? items.filter((item) => item.niche.id === focusId) : items;
  const backParams = new URLSearchParams(search.toString());
  backParams.delete('id');
  backParams.delete('new');
  const backHref = backParams.toString() ? `/niches?${backParams.toString()}` : '/niches';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl">{t('niches.title')}</h1>
        <button type="button" className="btn-primary" onClick={openCreate}>
          {t('niches.create')}
        </button>
      </div>
      {focusId ? (
        <Link href={backHref} className="inline-block text-sm text-muted hover:underline">
          {t('niches.back')}
        </Link>
      ) : null}
      {error ? (
        <div className="error-banner" role="alert">
          <p>{error}</p>
          <button type="button" className="btn-ghost mt-2" onClick={() => setReloadToken((count) => count + 1)}>
            {t('niches.retry')}
          </button>
        </div>
      ) : null}
      {loading ? <p className="text-sm text-muted">{t('project.loading')}</p> : null}
      {!loading && !error && visible.length === 0 ? (
        <p className="text-sm text-muted">{focusId ? t('niches.notFound') : t('niches.empty')}</p>
      ) : null}
      <div className="space-y-4">
        {visible.map((item) => (
          <NicheCard
            key={item.niche.id}
            item={item}
            detail={Boolean(focusId)}
            isCurrent={project?.id === item.niche.id}
            editing={editingId === item.niche.id}
            editDraft={editDraft}
            editError={editError}
            saving={saving && editingId === item.niche.id}
            onEditDraft={setEditDraft}
            onStartEdit={() => {
              setEditingId(item.niche.id);
              setEditDraft(draftFromNiche(item.niche));
              setEditError('');
            }}
            onCancelEdit={() => {
              setEditingId(null);
              setEditError('');
            }}
            onSaveEdit={handleSaveEdit}
            onSetCurrent={() => setProjectId(item.niche.id)}
            onStartResearch={() => {
              setProjectId(item.niche.id);
              window.location.assign(`/research?project=${encodeURIComponent(item.niche.id)}`);
            }}
          />
        ))}
      </div>

      {formOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 md:items-center md:p-6"
          onClick={closeForm}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="niche-create-title"
            className="panel max-h-[92dvh] w-full overflow-y-auto rounded-b-none p-4 md:max-w-lg md:rounded-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="niche-create-title" className="font-heading text-lg">{t('niches.create')}</h2>
              <button type="button" className="btn-ghost" onClick={closeForm}>{t('niches.close')}</button>
            </div>
            <form className="space-y-3" onSubmit={handleCreate}>
              <NicheFields draft={createDraft} onChange={setCreateDraft} idPrefix="create" disabled={saving} />
              {formError ? <p className="error-banner" role="alert">{formError}</p> : null}
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? t('niches.creating') : t('niches.create')}
                </button>
                <button type="button" className="btn-ghost" onClick={closeForm} disabled={saving}>
                  {t('niches.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
