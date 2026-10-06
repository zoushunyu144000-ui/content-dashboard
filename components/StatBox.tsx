interface StatBoxProps {
  label: string;
  value: string;
  change?: string;
  changeType?: 'up' | 'down' | 'neutral';
  glow?: 'green' | 'amber' | 'red';
  onClick?: () => void;
}

export default function StatBox({ label, value, change, changeType = 'neutral', onClick }: StatBoxProps) {
  return (
    <div
      onClick={onClick}
      className={`stat-box ${onClick ? 'cursor-pointer' : ''}`}
      role={onClick ? 'button' : undefined}
    >
      <div className="stat-box-label">{label}</div>
      <div className="stat-box-value">{value}</div>
      {change ? (
        <div className={`mt-1 text-[12px] ${changeType === 'down' ? 'text-red' : 'text-muted'}`}>{change}</div>
      ) : null}
    </div>
  );
}
