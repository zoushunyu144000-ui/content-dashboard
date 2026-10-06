import { t } from '@/lib/i18n';

interface ScoreBadgeProps {
  score: number | null | undefined;
  high?: boolean;
}

export default function ScoreBadge({ score, high = false }: ScoreBadgeProps) {
  const text = score == null || Number.isNaN(Number(score)) ? '—' : String(Math.round(Number(score)));
  return (
    <span className={`score-badge${high ? ' score-badge-high' : ''}`} title={t('score.viral')}>
      <span className="score-badge-value">{text}</span>
      {high ? <span className="score-badge-tag">{t('score.high')}</span> : null}
    </span>
  );
}
