import type { CaseData } from "@waypoint/shared";
import Link from "next/link";
import { Building2, Heart, ChevronRight } from "lucide-react";
import { ReadinessBar } from "./readiness-bar";
import { cn } from "@/lib/utils";

export function CaseCard({ caseData }: { caseData: CaseData }) {
  const Icon = caseData.domain === "healthcare" ? Heart : Building2;
  const domainColor =
    caseData.domain === "healthcare"
      ? "bg-teal-100 text-teal-700"
      : "bg-blue-100 text-blue-700";

  return (
    <Link
      href={`/cases/${caseData.id}`}
      className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("rounded-lg p-2", domainColor)}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">{caseData.title}</h3>
            <p className="text-sm text-slate-500">{caseData.institution.name}</p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-slate-400" />
      </div>
      <div className="mt-4">
        <ReadinessBar score={caseData.state.readinessScore} status={caseData.state.readinessStatus} />
      </div>
    </Link>
  );
}
