import { cn } from "@/lib/utils";
import type { ReadinessStatus } from "@waypoint/shared";

const statusLabels: Record<ReadinessStatus, string> = {
  not_ready: "Not ready",
  almost_ready: "Almost ready",
  ready: "Ready to go",
  completed: "Completed",
};

const statusColors: Record<ReadinessStatus, string> = {
  not_ready: "bg-red-500",
  almost_ready: "bg-amber-500",
  ready: "bg-emerald-500",
  completed: "bg-blue-500",
};

export function ReadinessBar({
  score,
  status,
}: {
  score: number;
  status: ReadinessStatus;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">Readiness</span>
        <span className="font-semibold text-slate-900">
          {score}% — {statusLabels[status]}
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={cn("h-full rounded-full transition-all duration-500", statusColors[status])}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
