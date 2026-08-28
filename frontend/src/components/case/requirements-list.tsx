import { cn } from "@/lib/utils";
import type { VerificationStatus, RequirementStatus } from "@waypoint/shared";
import { CheckCircle2, Circle, AlertCircle, ShieldCheck, Users, HelpCircle } from "lucide-react";

const verificationConfig: Record<
  VerificationStatus,
  { label: string; className: string; icon: typeof ShieldCheck }
> = {
  official: {
    label: "Official",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: ShieldCheck,
  },
  commonly_reported: {
    label: "Community",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Users,
  },
  unverified: {
    label: "Unverified",
    className: "bg-slate-50 text-slate-600 border-slate-200",
    icon: HelpCircle,
  },
};

function StatusIcon({ status }: { status: RequirementStatus }) {
  if (status === "satisfied") return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
  if (status === "failed") return <AlertCircle className="h-5 w-5 text-red-500" />;
  return <Circle className="h-5 w-5 text-slate-300" />;
}

export function RequirementsList({
  requirements,
}: {
  requirements: Array<{
    id: string;
    label: string;
    description?: string;
    status: RequirementStatus;
    verificationStatus: VerificationStatus;
    acceptableDocuments?: string[];
  }>;
}) {
  return (
    <ul className="space-y-3">
      {requirements.map((req) => {
        const badge = verificationConfig[req.verificationStatus];
        const BadgeIcon = badge.icon;
        return (
          <li
            key={req.id}
            className={cn(
              "rounded-xl border p-4 transition-colors",
              req.status === "satisfied" ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-white"
            )}
          >
            <div className="flex items-start gap-3">
              <StatusIcon status={req.status} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-900">{req.label}</span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                      badge.className
                    )}
                  >
                    <BadgeIcon className="h-3 w-3" />
                    {badge.label}
                  </span>
                </div>
                {req.description && (
                  <p className="mt-1 text-sm text-slate-600">{req.description}</p>
                )}
                {req.acceptableDocuments && req.acceptableDocuments.length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    Acceptable: {req.acceptableDocuments.join(", ")}
                  </p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
