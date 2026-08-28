import Link from "next/link";
import type { CaseView } from "@waypoint/shared";
import { ChevronRight, Landmark, HeartPulse } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ReadinessBar } from "./readiness";
import { formatRelative } from "@/lib/utils";

export function CaseCard({ caseData }: { caseData: CaseView }) {
  const isHealth = caseData.domain === "healthcare";
  const Icon = isHealth ? HeartPulse : Landmark;

  return (
    <Link href={`/cases/${caseData.id}`} className="block">
      <Card interactive className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={
              isHealth
                ? "shrink-0 rounded-xl bg-ochre-50 p-2 text-ochre-500"
                : "shrink-0 rounded-xl bg-forest-50 p-2 text-forest-700"
            }
          >
            <Icon className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="truncate font-medium text-paper-900">{caseData.title}</h3>
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-paper-400" />
            </div>
            <p className="truncate text-[13px] text-paper-500">{caseData.institution.name}</p>

            {caseData.currentStep && (
              <p className="mt-2 truncate text-[13px] font-medium text-forest-700">
                {caseData.currentStep.title}
              </p>
            )}

            <div className="mt-3">
              <ReadinessBar
                score={caseData.state.readinessScore}
                status={caseData.state.readinessStatus}
              />
            </div>

            <p className="mt-2 text-[11px] text-paper-400">
              Updated {formatRelative(caseData.updatedAt)}
            </p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
