import type { ReadinessStatus } from "@waypoint/shared";
import { cn } from "@/lib/utils";

const STATUS_COPY: Record<ReadinessStatus, string> = {
  not_ready: "Not ready yet",
  almost_ready: "Almost ready",
  ready: "Ready to go",
  completed: "Complete",
};

const STATUS_COLOR: Record<ReadinessStatus, string> = {
  not_ready: "var(--color-ochre-400)",
  almost_ready: "var(--color-ochre-300)",
  ready: "var(--color-forest-500)",
  completed: "var(--color-forest-600)",
};

/**
 * The readiness ring is the product's central promise: it answers "can I go
 * now?" at a glance, which a list of requirements does not.
 */
export function ReadinessRing({
  score,
  status,
  size = 132,
}: {
  score: number;
  status: ReadinessStatus;
  size?: number;
}) {
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(Math.max(score, 0), 100) / 100) * circumference;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${score} percent ready. ${STATUS_COPY[status]}.`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-paper-200)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={STATUS_COLOR[status]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl leading-none text-paper-900">{score}%</span>
        <span className="mt-1 px-2 text-center text-[11px] font-medium leading-tight text-paper-500">
          {STATUS_COPY[status]}
        </span>
      </div>
    </div>
  );
}

export function ReadinessBar({
  score,
  status,
  showLabel = true,
}: {
  score: number;
  status: ReadinessStatus;
  showLabel?: boolean;
}) {
  return (
    <div className="w-full">
      {showLabel && (
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-xs font-medium text-paper-500">{STATUS_COPY[status]}</span>
          <span className="text-xs font-semibold text-paper-700">{score}%</span>
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-200">
        <div
          className={cn("h-full rounded-full transition-all duration-700 ease-out")}
          style={{ width: `${score}%`, backgroundColor: STATUS_COLOR[status] }}
        />
      </div>
    </div>
  );
}
