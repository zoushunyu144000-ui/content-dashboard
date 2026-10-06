interface ProgressBarProps {
  value: number | null | undefined;
}

export default function ProgressBar({ value }: ProgressBarProps) {
  const width = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="progress-track" aria-hidden="true">
      <div className="progress-fill" style={{ width: `${width}%` }} />
    </div>
  );
}
