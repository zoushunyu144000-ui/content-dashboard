'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { t } from '@/lib/i18n';
import {
  AUDIENCE_LABELS,
  CTA_LABELS,
  EMOTION_LABEL_MAP,
  FORMAT_LABELS,
  HOOK_LABELS,
  PAIN_LABELS,
  STRUCTURE_LABELS,
  TOPIC_LABELS,
  VALUE_TYPES,
  authorLabel,
  detailText,
  isAnalyzed,
  labelOf,
  mergeAnalysis,
  platformLabel,
  readTags,
  readValueLevels,
  scoreText,
  textOrDash,
  valueLevelLabel,
  valueTypeLabel,
  type LibraryVideo,
  type ValueLevel,
} from './shared';

interface AnalysisDrawerProps {
  video: LibraryVideo | null;
  nicheId: string;
  loading: boolean;
  missing: boolean;
  onClose: () => void;
  onAnalyzed: (video: LibraryVideo) => void;
}

interface AnalyzeError {
  detail: string;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-sm">{children}</dd>
    </div>
  );
}

function levelClass(level: ValueLevel): string {
  if (level === 'high') return 'border-accent/60 text-accent';
  if (level === 'medium') return 'border-amber/50 text-amber';
  if (level === 'low') return 'border-border text-cream';
  return 'border-border text-muted';
}

export default function AnalysisDrawer({ video, nicheId, loading, missing, onClose, onAnalyzed }: AnalysisDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const alive = useRef(true);
  const videoIdRef = useRef(video?.id);
  videoIdRef.current = video?.id;
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<AnalyzeError | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    setAnalyzeError(null);
    setAnalyzing(false);
  }, [video?.id]);

  useEffect(() => {
    closeRef.current?.focus();
  }, [video?.id, missing]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  async function runAnalyze() {
    if (!video || analyzing) return;
    const requestId = video.id;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const response = await fetch(`/api/videos/${encodeURIComponent(requestId)}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nicheId ? { niche_id: nicheId } : {}),
      });
      const data: unknown = await response.json().catch(() => ({}));
      if (!alive.current || videoIdRef.current !== requestId) return;
      if (response.status === 401 && window.location.pathname !== '/login') {
        const next = `${window.location.pathname}${window.location.search}`;
        window.location.href = `/login?next=${encodeURIComponent(next)}`;
        return;
      }
      if (!response.ok) {
        const record = data && typeof data === 'object' ? data as Record<string, unknown> : {};
        const detail = detailText(record.detail)
          || (typeof record.error === 'string' && record.error !== t('ai.analysisFailed') ? record.error : '');
        setAnalyzeError({ detail });
        return;
      }
      onAnalyzed(mergeAnalysis(video, data));
    } catch (err) {
      if (!alive.current || videoIdRef.current !== requestId) return;
      setAnalyzeError({ detail: err instanceof Error ? err.message : '' });
    } finally {
      if (alive.current && videoIdRef.current === requestId) setAnalyzing(false);
    }
  }

  const analyzed = video ? isAnalyzed(video) : false;
  const levels = video ? readValueLevels(video.value_types) : null;
  const tags = video ? readTags(video.tags) : [];

  return (
    <div className="fixed inset-0 z-[80]" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label={t('common.dismiss')}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-drawer-title"
        className="absolute inset-0 flex flex-col bg-surface md:left-auto md:w-[28rem] md:border-l md:border-border"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 id="library-drawer-title" className="line-clamp-2 text-sm font-semibold">
              {video?.caption?.trim() || (missing ? '未找到该视频' : '视频分析')}
            </h2>
            {video ? (
              <p className="mt-1 truncate text-xs text-muted">
                {authorLabel(video.author_handle)}
                <span className="px-1">·</span>
                {platformLabel(video.platform)}
              </p>
            ) : null}
          </div>
          <button ref={closeRef} type="button" className="btn-ghost shrink-0" onClick={onClose}>
            {t('common.dismiss')}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {!video && loading ? <p className="text-sm text-muted">正在加载…</p> : null}
          {!video && missing ? <p className="text-sm text-muted">未找到该视频。它可能不在当前项目的前 100 条里。</p> : null}
          {video ? (
            <dl className="space-y-4">
              <Field label="目标受众">
                {textOrDash(video.audience)}
                {video.audience_category ? <span className="ml-2 text-xs text-muted">{labelOf(AUDIENCE_LABELS, video.audience_category)}</span> : null}
              </Field>
              <Field label="核心痛点">
                {textOrDash(video.pain_point)}
                {video.pain_point_category ? <span className="ml-2 text-xs text-muted">{labelOf(PAIN_LABELS, video.pain_point_category)}</span> : null}
              </Field>
              <Field label="话题">
                {textOrDash(video.topic)}
                {video.topic_category ? <span className="ml-2 text-xs text-muted">{labelOf(TOPIC_LABELS, video.topic_category)}</span> : null}
              </Field>
              <Field label="Hook">{textOrDash(video.hook)}</Field>
              <Field label="Hook 类型">{video.hook_type ? labelOf(HOOK_LABELS, video.hook_type) : '—'}</Field>
              <Field label="情绪">{video.emotion ? labelOf(EMOTION_LABEL_MAP, video.emotion) : '—'}</Field>
              <Field label="内容结构">{video.content_structure ? labelOf(STRUCTURE_LABELS, video.content_structure) : '—'}</Field>
              <Field label="内容形式">{video.content_format ? labelOf(FORMAT_LABELS, video.content_format) : '—'}</Field>
              <Field label="CTA">{video.cta_type ? labelOf(CTA_LABELS, video.cta_type) : '—'}</Field>
              <Field label="为什么有效">{textOrDash(video.why_it_works)}</Field>
              <Field label="可复用模式">{textOrDash(video.reusable_pattern)}</Field>
              <Field label="不要照抄的部分">{textOrDash(video.what_not_to_copy)}</Field>
              <Field label="可复制度评分">{scoreText(video.replicability_score)}</Field>
              <Field label="爆款假设">{textOrDash(video.viral_hypothesis)}</Field>
              <div>
                <dt className="text-[11px] text-muted">价值类型</dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {levels ? VALUE_TYPES.map((key) => (
                    <span key={key} className={`rounded-full border px-2 py-1 text-[11px] ${levelClass(levels[key])}`}>
                      {valueTypeLabel(key)} {valueLevelLabel(levels[key])}
                    </span>
                  )) : null}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted">标签</dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {tags.length === 0 ? <span className="text-sm">—</span> : tags.map((tag) => (
                    <span key={tag} className="status-badge">{tag}</span>
                  ))}
                </dd>
              </div>
              <Field label="提示词版本">{textOrDash(video.prompt_version)}</Field>
            </dl>
          ) : null}
        </div>

        {video ? (
          <div className="border-t border-border px-4 py-3">
            {analyzeError ? (
              <div className="error-banner mb-3" role="alert">
                <p>「{t('ai.analysisFailed')}」</p>
                {analyzeError.detail ? <p className="mt-1 text-xs">{analyzeError.detail}</p> : null}
                <button type="button" className="btn-ghost mt-2" onClick={runAnalyze} disabled={analyzing}>
                  {t('ai.retry')}
                </button>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              {video.url ? (
                <a href={video.url} target="_blank" rel="noreferrer noopener" className="btn-ghost">
                  {t('feed.openOriginal')}
                </a>
              ) : (
                <span className="text-xs text-muted">{t('feed.noOriginalUrl')}</span>
              )}
              <button type="button" className="btn-primary" onClick={runAnalyze} disabled={analyzing} aria-busy={analyzing}>
                {analyzing ? '分析中…' : analyzed ? '重新分析' : '分析视频'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
