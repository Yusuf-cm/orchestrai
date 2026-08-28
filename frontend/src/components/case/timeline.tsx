import type { AuditEvent } from "@waypoint/shared";
import { Bot, User, Cog, AlertCircle } from "lucide-react";
import { humaniseAction, formatDateTime } from "@/lib/utils";

const ACTOR_ICON = {
  user: User,
  system: Cog,
  ai: Bot,
  human_agent: User,
} as const;

const ACTOR_LABEL = {
  user: "You",
  system: "Waypoint engine",
  ai: "Language model",
  human_agent: "Support",
} as const;

/**
 * Every state change is recorded and shown. Someone trusting software with an
 * ID application should be able to see exactly what it did on their behalf.
 */
export function Timeline({ events }: { events: AuditEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-paper-300 p-6 text-center text-[13px] text-paper-500">
        Nothing has happened on this case yet.
      </p>
    );
  }

  return (
    <ol className="relative space-y-4 border-l border-paper-200 pl-5">
      {events.map((event) => {
        const Icon = event.success ? ACTOR_ICON[event.actor] : AlertCircle;
        return (
          <li key={event.id} className="relative">
            <span
              className={
                event.success
                  ? "absolute -left-[27px] flex h-5 w-5 items-center justify-center rounded-full border border-paper-200 bg-white text-paper-500"
                  : "absolute -left-[27px] flex h-5 w-5 items-center justify-center rounded-full border border-alert-100 bg-alert-50 text-alert-600"
              }
            >
              <Icon className="h-2.5 w-2.5" />
            </span>
            <p className="text-sm font-medium text-paper-900">{humaniseAction(event.action)}</p>
            <p className="mt-0.5 text-xs text-paper-500">
              {ACTOR_LABEL[event.actor]} · {formatDateTime(event.timestamp)}
            </p>
            {event.stepId && (
              <p className="mt-0.5 font-mono text-[11px] text-paper-500">{event.stepId}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
