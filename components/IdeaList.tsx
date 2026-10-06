import { t } from '@/lib/i18n';

export interface ContentIdea {
  id: string;
  position: number;
  topic: string | null;
  hook: string | null;
  angle: string | null;
  structure: string | null;
  reason: string | null;
}

export default function IdeaList({ ideas }: { ideas: ContentIdea[] }) {
  if (ideas.length === 0) {
    return <p className="text-sm text-muted">{t('ideas.empty')}</p>;
  }
  return (
    <ol className="grid gap-3">
      {ideas.map((idea) => (
        <li key={idea.id} className="panel p-4">
          <div className="text-[11px] uppercase tracking-[0.08em] text-muted">{t('ideas.ideaN', { n: idea.position })}</div>
          <h3 className="mt-1 text-base font-semibold">{idea.topic || t('ideas.untitled')}</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-[11px] uppercase tracking-[0.08em] text-muted">{t('ideas.hook')}</dt>
              <dd>{idea.hook || '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.08em] text-muted">{t('ideas.angle')}</dt>
              <dd>{idea.angle || '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.08em] text-muted">{t('ideas.structure')}</dt>
              <dd>{idea.structure || '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.08em] text-muted">{t('ideas.reason')}</dt>
              <dd>{idea.reason || '—'}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ol>
  );
}
