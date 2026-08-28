"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  MessageCircle,
  Clock,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { getCase, updateCase, uploadDocument } from "@/lib/api";
import { ReadinessBar } from "@/components/case/readiness-bar";
import { RequirementsList } from "@/components/case/requirements-list";
import { NextActionCard } from "@/components/case/next-action-card";
import { DocumentUpload, ArtifactsList } from "@/components/case/document-upload";
import { ChatPanel } from "@/components/case/chat-panel";
import { cn } from "@/lib/utils";

type Tab = "requirements" | "documents" | "timeline";

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const caseId = params.id as string;
  const [tab, setTab] = useState<Tab>("requirements");
  const [chatOpen, setChatOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const { data: caseData, isLoading, refetch } = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => getCase(caseId),
    refetchInterval: 5000,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["case", caseId] });
    await queryClient.invalidateQueries({ queryKey: ["cases"] });
    refetch();
  };

  const handleAction = async (providerId?: string) => {
    if (!caseData) return;
    setActionLoading(true);
    try {
      const stepId = caseData.workflow.currentStepId;

      if (stepId === "select_provider" && providerId) {
        await updateCase(caseId, { selectProvider: providerId });
      } else if (stepId === "schedule_appointment") {
        const pid = (caseData.workflow.slots.selected_provider_id as string) || "prov-patel";
        await updateCase(caseId, {
          scheduleAppointment: {
            providerId: pid,
            datetime: new Date(Date.now() + 3 * 86400000).toISOString(),
          },
        });
      } else {
        await updateCase(caseId, { confirmStep: true });
      }
      await refresh();
    } finally {
      setActionLoading(false);
    }
  };

  const handleProviderClick = (e: React.MouseEvent) => {
    const btn = (e.target as HTMLElement).closest("[data-provider-id]") as HTMLElement | null;
    if (btn?.dataset.providerId) {
      handleAction(btn.dataset.providerId);
    }
  };

  const handleUpload = async (file: File) => {
    await uploadDocument(caseId, file);
    await refresh();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-slate-600">Case not found</p>
        <Link href="/" className="text-indigo-600 hover:underline">
          Go home
        </Link>
      </div>
    );
  }

  const isHealth = caseData.domain === "healthcare";
  const audit = (caseData as { audit?: Array<{ action: string; timestamp: string; actor: string }> }).audit ?? [];

  return (
    <div className="flex min-h-screen">
      <div className={cn("flex-1", chatOpen && "hidden lg:block")}>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <button
              type="button"
              onClick={() => setChatOpen(!chatOpen)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <MessageCircle className="h-4 w-4" />
              Chat
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
          {isHealth && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                <strong>Not medical advice.</strong> Waypoint helps you navigate care — it does not diagnose or treat conditions.
              </p>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              <span className={isHealth ? "text-teal-600" : "text-blue-600"}>
                {caseData.domain}
              </span>
              <span>·</span>
              <span>{caseData.institution.name}</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{caseData.title}</h1>
            <p className="mt-1 text-sm text-slate-500 capitalize">
              Phase: {caseData.state.phase.replace("_", " ")}
            </p>
          </div>

          <ReadinessBar
            score={caseData.state.readinessScore}
            status={caseData.state.readinessStatus}
          />

          <div onClick={handleProviderClick}>
            <NextActionCard
              caseData={caseData}
              onAction={() => handleAction()}
              loading={actionLoading}
            />
          </div>

          <div className="border-b border-slate-200">
            <nav className="flex gap-6">
              {(["requirements", "documents", "timeline"] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={cn(
                    "border-b-2 pb-2 text-sm font-medium capitalize",
                    tab === t
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  )}
                >
                  {t}
                </button>
              ))}
            </nav>
          </div>

          {tab === "requirements" && (
            <RequirementsList requirements={caseData.requirements} />
          )}

          {tab === "documents" && (
            <div className="space-y-4">
              <DocumentUpload caseId={caseId} onUpload={handleUpload} />
              <ArtifactsList artifacts={caseData.artifacts} />
            </div>
          )}

          {tab === "timeline" && (
            <ul className="space-y-3">
              {audit.length === 0 && (
                <li className="text-sm text-slate-500">No events yet</li>
              )}
              {audit.map((e, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <Clock className="h-4 w-4 mt-0.5 text-slate-400" />
                  <div>
                    <span className="font-medium text-slate-800">{e.action}</span>
                    <span className="text-slate-500"> · {e.actor}</span>
                    <div className="text-xs text-slate-400">
                      {new Date(e.timestamp).toLocaleString()}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>

      {chatOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md lg:relative lg:z-0">
          <ChatPanel caseId={caseId} onClose={() => setChatOpen(false)} />
        </div>
      )}
    </div>
  );
}
