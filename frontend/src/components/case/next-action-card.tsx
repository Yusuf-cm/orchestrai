"use client";

import type { CaseData } from "@waypoint/shared";
import { ArrowRight, MapPin, AlertTriangle, Calendar, Stethoscope } from "lucide-react";
import { VoiceButton } from "./voice-button";

export function NextActionCard({
  caseData,
  onAction,
  loading,
}: {
  caseData: CaseData;
  onAction: () => void;
  loading?: boolean;
}) {
  const stepId = caseData.workflow.currentStepId;
  const readiness = caseData.state.readinessScore;
  const isHealth = caseData.domain === "healthcare";
  const providers = caseData.workflow.slots.providers as Array<{
    id: string;
    name: string;
    specialty: string;
    distance: string;
    rating: number;
    inNetwork: boolean;
  }> | undefined;

  let title = "Continue your case";
  let description = "Complete the current step to move forward.";
  let actionLabel = "Continue";
  let showAction = true;

  if (stepId === "collect_documents" || stepId === "not_ready_brief") {
    const pending = caseData.requirements.filter((r) => r.mandatory && r.status !== "satisfied");
    title = pending.length > 0 ? `Upload: ${pending[0]?.label}` : "All documents collected";
    description =
      pending.length > 0
        ? `You need ${pending.length} more item(s) before you're ready.`
        : "Great — checking readiness...";
    showAction = false;
  } else if (stepId === "schedule_visit" && readiness >= 100) {
    title = "You're ready to visit the DMV!";
    description = "Bring your documents, $38 fee, and visit the nearest office.";
    actionLabel = "I've completed my visit";
  } else if (stepId === "emergency_redirect") {
    title = "Seek emergency care immediately";
    description = String(caseData.workflow.slots.recommendation || "Call 911 or go to the nearest ER.");
    showAction = false;
  } else if (stepId === "select_provider" && providers) {
    title = "Choose a provider";
    description = "Select an in-network provider to continue.";
    showAction = false;
    return (
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
        <div className="mt-4 space-y-2">
          {providers.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onAction()}
              data-provider-id={p.id}
              className="provider-btn w-full rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-indigo-400 hover:shadow-sm"
            >
              <div className="font-medium text-slate-900">{p.name}</div>
              <div className="text-sm text-slate-600">{p.specialty} · {p.distance}</div>
              <div className="mt-1 text-xs text-slate-500">
                ★ {p.rating} {p.inNetwork && "· In network"}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  } else if (stepId === "schedule_appointment") {
    title = "Schedule your appointment";
    description = "Pick a time for your visit.";
    actionLabel = "Book Tuesday 2:30 PM";
  } else if (stepId === "appointment_reminder") {
    title = "Appointment scheduled!";
    description = caseData.appointments[0]
      ? `${caseData.appointments[0].providerName} — ${new Date(caseData.appointments[0].datetime).toLocaleString()}`
      : "Your appointment is confirmed.";
    actionLabel = "Continue";
  }

  const voiceText = `${title}. ${description}`;

  return (
    <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          {isHealth && stepId === "emergency_redirect" && (
            <AlertTriangle className="mb-2 h-6 w-6 text-red-600" />
          )}
          {stepId === "schedule_visit" && <MapPin className="mb-2 h-6 w-6 text-indigo-600" />}
          {isHealth && stepId.includes("appointment") && (
            <Calendar className="mb-2 h-6 w-6 text-emerald-600" />
          )}
          {isHealth && stepId === "care_recommendation" && (
            <Stethoscope className="mb-2 h-6 w-6 text-teal-600" />
          )}
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        <VoiceButton text={voiceText} caseId={caseData.id} />
      </div>

      {stepId === "schedule_visit" && Boolean(caseData.workflow.slots.offices) && (
        <div className="mt-4 rounded-lg bg-white p-4 border border-slate-200">
          <p className="text-sm font-medium text-slate-800">Nearest DMV</p>
          <p className="text-sm text-slate-600">DMV — Beverly Hills, 8030 Beverly Blvd</p>
          <p className="text-xs text-slate-500 mt-1">Mon-Fri 8am-5pm · Fee: $38</p>
        </div>
      )}

      {stepId === "care_recommendation" && (
        <div className="mt-4 rounded-lg bg-teal-50 border border-teal-200 p-3 text-sm text-teal-800">
          {String(caseData.workflow.slots.care_recommendation || caseData.workflow.slots.recommendation || "")}
          <p className="mt-2 text-xs text-teal-600 font-medium">
            This is not a medical diagnosis. Consult a healthcare professional.
          </p>
        </div>
      )}

      {showAction && (
        <button
          type="button"
          onClick={onAction}
          disabled={loading}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {actionLabel}
          <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
