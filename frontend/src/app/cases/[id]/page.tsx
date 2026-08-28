"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CaseView, Language, Requirement } from "@waypoint/shared";
import { AlertTriangle, ArrowLeft, Loader2, Volume2 } from "lucide-react";
import { toast } from "sonner";
import {
  getCase,
  patchCase,
  speakCase,
  uploadDocument,
  type CasePatch,
} from "@/lib/api";
import { ReadinessRing } from "@/components/case/readiness";
import { NextActionCard } from "@/components/case/next-action";
import { RequirementsList } from "@/components/case/requirements";
import { DocumentsPanel } from "@/components/case/documents-panel";
import { Timeline } from "@/components/case/timeline";
import { AskPanel } from "@/components/case/ask-panel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "checklist", label: "Checklist" },
  { id: "documents", label: "Documents" },
  { id: "ask", label: "Ask" },
  { id: "history", label: "History" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function CasePage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabId>("checklist");
  const [language, setLanguage] = useState<Language>("en");
  const [speaking, setSpeaking] = useState(false);

  const { data: caseData, isLoading, isError } = useQuery({
    queryKey: ["case", id],
    queryFn: () => getCase(id),
  });

  const applyUpdate = (updated: CaseView) => {
    queryClient.setQueryData(["case", id], updated);
    queryClient.invalidateQueries({ queryKey: ["cases"] });
  };

  const patch = useMutation({
    mutationFn: (body: CasePatch) => patchCase(id, body),
    onSuccess: applyUpdate,
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "That change did not go through"),
  });

  const upload = useMutation({
    mutationFn: ({ file, requirementId }: { file: File; requirementId?: string }) =>
      uploadDocument(id, file, requirementId),
    onSuccess: (updated) => {
      applyUpdate(updated);
      toast.success("Document attached");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Upload failed"),
  });

  const readAloud = async () => {
    setSpeaking(true);
    try {
      await speakCase(id, "", language);
    } catch {
      toast.error("Could not play audio");
    } finally {
      setSpeaking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-forest-600" />
      </div>
    );
  }

  if (isError || !caseData) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-paper-700">We could not open that case.</p>
        <Button asChild variant="secondary">
          <Link href="/">Back to your cases</Link>
        </Button>
      </div>
    );
  }

  const isHealth = caseData.domain === "healthcare";
  const busy = patch.isPending;

  const toggleRequirement = (requirement: Requirement) => {
    patch.mutate(
      requirement.status === "satisfied"
        ? { unsatisfyRequirement: requirement.id }
        : { satisfyRequirement: requirement.id }
    );
  };

  return (
    <div className="min-h-dvh pb-20">
      <header className="sticky top-0 z-30 border-b border-paper-200 bg-paper-50/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-3 px-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-paper-600 hover:text-forest-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Cases
          </Link>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-paper-200 bg-white p-0.5">
              {(["en", "sw"] as Language[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLanguage(code)}
                  className={cn(
                    "rounded-md px-2 py-1 text-[11px] font-semibold uppercase transition-colors",
                    language === code
                      ? "bg-forest-700 text-paper-50"
                      : "text-paper-500 hover:text-paper-800"
                  )}
                >
                  {code}
                </button>
              ))}
            </div>
            <Button size="sm" variant="secondary" onClick={readAloud} loading={speaking}>
              {!speaking && <Volume2 className="h-3.5 w-3.5" />}
              Listen
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-5">
        {isHealth && (
          <div className="flex items-start gap-2.5 rounded-xl border border-ochre-200 bg-ochre-50 p-3.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-ochre-500" />
            <p className="text-[13px] leading-relaxed text-paper-700">
              <span className="font-semibold">Waypoint is not a doctor.</span> It helps you reach the
              right level of care. It does not diagnose, prescribe, or replace a clinician.
            </p>
          </div>
        )}

        <Card className="p-5">
          <div className="flex items-center gap-5">
            <ReadinessRing
              score={caseData.state.readinessScore}
              status={caseData.state.readinessStatus}
              size={116}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-paper-400">
                {caseData.domain}
              </p>
              <h1 className="mt-1 font-display text-2xl leading-tight text-paper-900">
                {caseData.title}
              </h1>
              <p className="mt-1 text-[13px] text-paper-500">{caseData.institution.name}</p>
            </div>
          </div>
        </Card>

        <NextActionCard
          caseData={caseData}
          busy={busy}
          onConfirm={() => patch.mutate({ confirmStep: true })}
          onSelectFacility={(facilityId) => patch.mutate({ selectFacility: facilityId })}
          onScheduleVisit={(facilityId, datetime) =>
            patch.mutate({ scheduleVisit: { facilityId, datetime } })
          }
        />

        <div>
          <div className="-mx-4 mb-4 overflow-x-auto px-4">
            <div className="flex gap-1 border-b border-paper-200">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "whitespace-nowrap border-b-2 px-3 pb-2.5 pt-1 text-sm font-medium transition-colors",
                    tab === t.id
                      ? "border-forest-700 text-forest-800"
                      : "border-transparent text-paper-500 hover:text-paper-800"
                  )}
                >
                  {t.label}
                  {t.id === "checklist" && caseData.state.blockers.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-ochre-100 px-1.5 py-0.5 text-[10px] font-semibold text-ochre-600">
                      {caseData.state.blockers.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {tab === "checklist" && (
            <RequirementsList
              requirements={caseData.requirements}
              evidence={caseData.evidence}
              onToggle={toggleRequirement}
              busy={busy}
            />
          )}

          {tab === "documents" && (
            <DocumentsPanel
              artifacts={caseData.artifacts}
              requirements={caseData.requirements}
              uploading={upload.isPending}
              onUpload={(file, requirementId) => upload.mutate({ file, requirementId })}
            />
          )}

          {tab === "ask" && <AskPanel caseId={id} />}

          {tab === "history" && <Timeline events={caseData.audit ?? []} />}
        </div>
      </main>
    </div>
  );
}
