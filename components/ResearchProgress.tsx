import ProgressBar from './ProgressBar';
import ScraperNote from './ScraperNote';
import { formatTime, providerLabel, stepLabel } from '@/lib/client/format';

const STEPS = [
  'created',
  'keyword_expansion',
  'scraping',
  'normalizing',
  'scoring',
  'analyzing',
  'clustering',
  'generating_insights',
  'completed',
] as const;

export interface ResearchRunView {
  id: string;
  topic: string;
  status: string;
  current_step: string | null;
  progress: number | null;
  error_message: string | null;
  scraper_provider: string | null;
  scraper_note: string | null;
  completed_at?: string | null;
  created_at?: string | null;
}

export interface ResearchEventView {
  id: string;
  phase: string | null;
  message: string | null;
  created_at: string;
}

interface ResearchProgressProps {
  run: ResearchRunView;
  events: ResearchEventView[];
}

export default function ResearchProgress({ run, events }: ResearchProgressProps) {
  const active = run.status === 'completed' ? 'completed' : (run.current_step || run.status);
  const index = STEPS.indexOf(active as (typeof STEPS)[number]);
  const failed = run.status === 'failed' || run.status === 'cancelled';

  return (
    <section className="panel space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{run.topic}</h2>
          <p className="provider-label mt-1">{providerLabel(run.scraper_provider)}</p>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm">{Math.round(Number(run.progress) || 0)}%</div>
          <div className="text-xs capitalize text-muted">{stepLabel(run.status)}</div>
        </div>
      </div>
      <ScraperNote note={run.scraper_note} />
      <ProgressBar value={run.progress} />
      <ol className="flex gap-1.5 overflow-x-auto pb-1">
        {STEPS.map((step, stepIndex) => {
          let className = 'step-chip';
          if (!failed && index >= 0 && stepIndex < index) className += ' step-chip-done';
          if (!failed && step === active) className += ' step-chip-current';
          if (run.status === 'completed') className = 'step-chip step-chip-done';
          return (
            <li key={step} className={className}>{stepLabel(step)}</li>
          );
        })}
      </ol>
      <p className="text-xs text-muted">
        Current step: {stepLabel(run.current_step || run.status)}
        {run.completed_at ? ` · Finished ${formatTime(run.completed_at)}` : ''}
      </p>
      {run.error_message ? <p className="error-banner">{run.error_message}</p> : null}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Recent events</h3>
        {events.length === 0 ? <p className="mt-2 text-sm text-muted">No events yet.</p> : null}
        <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
          {events.slice(0, 12).map((event) => (
            <li key={event.id} className="text-sm">
              <span className="text-muted">{formatTime(event.created_at)} · {stepLabel(event.phase)}</span>
              {event.message ? <span> — {event.message}</span> : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
