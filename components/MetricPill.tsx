import { formatCount } from '@/lib/client/format';

interface MetricPillProps {
  label: string;
  value: number | null | undefined;
}

export default function MetricPill({ label, value }: MetricPillProps) {
  return (
    <span className="metric-pill">
      <span className="metric-pill-label">{label}</span>
      <span className="metric-pill-value">{formatCount(value)}</span>
    </span>
  );
}
