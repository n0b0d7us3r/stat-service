import '../styles/components/CircularChart.css';

interface CircularChartProps {
  /** Значение от 0 до 100 */
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showValue?: boolean;
  'aria-label'?: string;
}

export function CircularChart({
  value,
  size = 48,
  strokeWidth = 4,
  className = '',
  showValue = false,
  'aria-label': ariaLabel,
}: CircularChartProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const center = size / 2;
  const valueClassName = showValue ? ' circular-chart-with-value' : '';

  return (
    <div
      className={`circular-chart${valueClassName} ${className}`.trim()}
      style={{ width: size, height: size }}
      role="img"
      aria-label={ariaLabel ?? `Прогресс ${clamped}%`}
    >
      <svg
        className="circular-chart-svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          className="circular-chart-track"
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          className="circular-chart-progress"
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      {showValue && (
        <span
          className="circular-chart-value"
          style={{ fontSize: Math.max(9, Math.round(size * 0.24)) }}
          aria-hidden="true"
        >
          {clamped}%
        </span>
      )}
    </div>
  );
}
