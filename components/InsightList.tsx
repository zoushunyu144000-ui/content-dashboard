'use client';

import { useState } from 'react';
import Link from 'next/link';
import { humanize, percentPoints } from '@/lib/client/format';
import { t } from '@/lib/i18n';

export interface InsightExample {
  id: string;
  thumbnail_url: string | null;
  author_handle: string | null;
  caption: string | null;
}

export interface InsightRow {
  label: string;
  count: number;
  percent: number;
  summary?: string | null;
  examples?: InsightExample[];
}

interface InsightListProps {
  title: string;
  items: InsightRow[];
  runId: string;
  projectId: string;
}

export default function InsightList({ title, items, runId, projectId }: InsightListProps) {
  const [open, setOpen] = useState('');

  return (
    <section className="panel p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {items.length === 0 ? <p className="mt-3 text-sm text-muted">{t('insights.noneForRun')}</p> : null}
      <ul className="mt-3 space-y-3">
        {items.map((item) => {
          const points = percentPoints(item.percent);
          const key = `${title}:${item.label}`;
          const expanded = open === key;
          return (
            <li key={key}>
              <button type="button" className="w-full text-left" onClick={() => setOpen(expanded ? '' : key)}>
                <div className="bar-row text-sm">
                  <span className="truncate">{humanize(item.label)} {points}%</span>
                  <span className="text-muted">{item.count}</span>
                </div>
                <div className="thin-bar mt-1.5" aria-hidden="true">
                  <span style={{ width: `${points}%` }} />
                </div>
              </button>
              {expanded ? (
                <div className="mt-2 space-y-2 text-sm">
                  <p style={{ color: 'var(--text-secondary)' }}>{item.summary || t('insights.noSummary')}</p>
                  {(item.examples || []).length === 0 ? <p className="text-xs text-muted">{t('insights.noExamples')}</p> : null}
                  <ul className="space-y-2">
                    {(item.examples || []).map((example) => (
                      <li key={example.id}>
                        <Link
                          href={`/feed?project=${encodeURIComponent(projectId)}&run=${encodeURIComponent(runId)}&video=${encodeURIComponent(example.id)}`}
                          className="flex items-center gap-3"
                        >
                          {example.thumbnail_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={example.thumbnail_url} alt="" className="h-14 w-10 rounded object-cover" />
                          ) : (
                            <span className="block h-14 w-10 rounded" style={{ background: 'var(--surface)' }} />
                          )}
                          <span className="min-w-0">
                            <span className="block truncate text-sm">{example.author_handle ? `@${example.author_handle}` : t('insights.video')}</span>
                            <span className="block truncate text-xs text-muted">{example.caption || t('insights.openInFeed')}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
