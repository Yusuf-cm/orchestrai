"use client";

import type { CaseView, ExecutionMode, HealthFacility, HudumaCentre } from "@waypoint/shared";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Clock,
  CreditCard,
  MapPin,
  Phone,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn, formatKes } from "@/lib/utils";

const MODE_COPY: Record<ExecutionMode, { label: string; hint: string }> = {
  guide: { label: "You do this", hint: "Waypoint tells you exactly what is needed" },
  assist: { label: "We prepare it", hint: "Waypoint gets this ready for you" },
  execute: { label: "We do this", hint: "Waypoint handles this for you" },
  escalate: { label: "Handed over", hint: "This needs a person, not automation" },
};

export function ModeBadge({ mode }: { mode: ExecutionMode }) {
  return (
    <Badge tone={mode === "escalate" ? "alert" : mode === "execute" ? "forest" : "neutral"}>
      {MODE_COPY[mode].label}
    </Badge>
  );
}

/**
 * Renders the current step from workflow metadata rather than a hardcoded list
 * of step names. Adding a step to a YAML definition, or a whole new domain,
 * needs no change here.
 */
export function NextActionCard({
  caseData,
  onConfirm,
  onSelectFacility,
  onScheduleVisit,
  busy,
}: {
  caseData: CaseView;
  onConfirm: () => void;
  onSelectFacility: (id: string) => void;
  onScheduleVisit: (facilityId: string, datetime: string) => void;
  busy?: boolean;
}) {
  const step = caseData.currentStep;
  if (!step) return null;

  const slots = caseData.workflow.slots as Record<string, unknown>;
  const outstanding = caseData.state.blockers;
  const isEmergency = step.mode === "escalate";

  return (
    <Card
      className={cn(
        "animate-rise overflow-hidden",
        isEmergency ? "border-alert-300 bg-alert-50" : "border-forest-200"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-3 border-b px-5 py-2.5",
          isEmergency ? "border-alert-100 bg-alert-100/60" : "border-forest-100 bg-forest-50"
        )}
      >
        <span
          className={cn(
            "text-[11px] font-bold uppercase tracking-widest",
            isEmergency ? "text-alert-700" : "text-forest-800"
          )}
        >
          {isEmergency ? "Urgent" : "Next step"}
        </span>
        <ModeBadge mode={step.mode} />
      </div>

      <div className="p-5">
        <div className="flex items-start gap-3">
          <StepIcon type={step.type} emergency={isEmergency} />
          <div className="min-w-0 flex-1">
            <h2
              className={cn(
                "font-display text-xl leading-tight",
                isEmergency ? "text-alert-700" : "text-paper-900"
              )}
            >
              {step.title}
            </h2>
            {step.description && (
              <p className="mt-1.5 text-sm leading-relaxed text-paper-600">{step.description}</p>
            )}
          </div>
        </div>

        {isEmergency && <EmergencyActions />}

        {step.type === "document_required" && outstanding.length > 0 && (
          <OutstandingList items={outstanding.map((b) => b.reason)} />
        )}

        {step.type === "payment" && <PaymentPanel slots={slots} />}

        {step.type === "guide_user" && <CentreList slots={slots} />}

        {step.type === "collect_input" && (
          <FacilityChoices slots={slots} selected={slots.selected_facility_id as string | undefined} onSelect={onSelectFacility} busy={busy} />
        )}

        {step.type === "appointment" && (
          <VisitPlanner
            slots={slots}
            onSchedule={onScheduleVisit}
            busy={busy}
            scheduled={caseData.appointments[0]}
          />
        )}

        {step.isTerminal && !isEmergency && <ResolvedNote />}

        {shouldShowConfirm(step.type, step.isTerminal, isEmergency, outstanding.length) && (
          <Button
            onClick={onConfirm}
            loading={busy}
            size="lg"
            full
            className="mt-5"
          >
            {confirmLabel(step.type)}
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Card>
  );
}

function shouldShowConfirm(
  type: string,
  isTerminal: boolean,
  isEmergency: boolean,
  outstandingCount: number
): boolean {
  if (isEmergency || isTerminal) return false;
  if (type === "document_required") return outstandingCount === 0;
  if (type === "collect_input" || type === "appointment") return false;
  return true;
}

function confirmLabel(type: string): string {
  switch (type) {
    case "payment":
      return "I have paid";
    case "guide_user":
      return "Done — what's next";
    case "ask_question":
      return "Mark as followed up";
    default:
      return "Continue";
  }
}

function StepIcon({ type, emergency }: { type: string; emergency: boolean }) {
  const className = cn(
    "mt-0.5 h-9 w-9 shrink-0 rounded-xl p-2",
    emergency ? "bg-alert-100 text-alert-600" : "bg-forest-100 text-forest-700"
  );

  if (emergency) return <AlertTriangle className={className} />;
  switch (type) {
    case "document_required":
      return <ClipboardList className={className} />;
    case "payment":
      return <CreditCard className={className} />;
    case "guide_user":
      return <MapPin className={className} />;
    case "appointment":
      return <CalendarCheck className={className} />;
    case "completion":
      return <CheckCircle2 className={className} />;
    default:
      return <Sparkles className={className} />;
  }
}

function EmergencyActions() {
  return (
    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
      <Button asChild variant="danger" size="lg" className="flex-1">
        <a href="tel:999">
          <Phone className="h-4 w-4" />
          Call 999
        </a>
      </Button>
      <Button asChild variant="secondary" size="lg" className="flex-1">
        <a href="tel:112">Call 112</a>
      </Button>
    </div>
  );
}

function OutstandingList({ items }: { items: string[] }) {
  return (
    <div className="mt-4 rounded-xl bg-paper-100 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-paper-500">
        Still needed ({items.length})
      </p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-paper-700">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ochre-400" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResolvedNote() {
  return (
    <div className="mt-4 flex items-start gap-2 rounded-xl bg-forest-50 p-4 text-sm text-forest-800">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      <p>This case stays saved. Reopen it any time if something changes.</p>
    </div>
  );
}

function PaymentPanel({ slots }: { slots: Record<string, unknown> }) {
  const fees = slots.fees as Array<{ label: string; amount: number }> | undefined;
  const payment = slots.payment as
    | { channel: string; methods: string[]; note: string }
    | undefined;
  if (!fees?.length) return null;

  return (
    <div className="mt-4 rounded-xl border border-paper-200 bg-paper-50 p-4">
      {fees.map((fee) => (
        <div key={fee.label} className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-paper-600">{fee.label}</span>
          <span className="font-display text-2xl text-paper-900">{formatKes(fee.amount)}</span>
        </div>
      ))}
      {payment && (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {payment.methods.map((m) => (
              <Badge key={m}>{m}</Badge>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-paper-500">{payment.note}</p>
        </>
      )}
    </div>
  );
}

function CentreList({ slots }: { slots: Record<string, unknown> }) {
  const centres = slots.centres as HudumaCentre[] | undefined;
  if (!centres?.length) return null;

  return (
    <div className="mt-4 space-y-2">
      {centres.slice(0, 3).map((centre) => (
        <div key={centre.id} className="rounded-xl border border-paper-200 bg-white p-4">
          <p className="font-medium text-paper-900">{centre.name}</p>
          <p className="mt-0.5 text-sm text-paper-600">{centre.address}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-paper-600">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              {centre.hours}
            </span>
            <a
              href={`tel:${centre.phone.replace(/\s/g, "")}`}
              className="inline-flex min-h-11 items-center gap-1.5 font-medium text-forest-800 hover:underline"
            >
              <Phone className="h-3.5 w-3.5 shrink-0" />
              {centre.phone}
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

function FacilityChoices({
  slots,
  selected,
  onSelect,
  busy,
}: {
  slots: Record<string, unknown>;
  selected?: string;
  onSelect: (id: string) => void;
  busy?: boolean;
}) {
  const facilities = slots.facilities as HealthFacility[] | undefined;
  const recommendedLevel = slots.care_level as string | undefined;
  if (!facilities?.length) return null;

  return (
    <div className="mt-4 space-y-2">
      {Boolean(slots.care_level_label) && (
        <div className="rounded-xl border border-forest-200 bg-forest-50 p-3.5">
          <p className="text-sm font-semibold text-forest-900">
            Recommended: {String(slots.care_level_label)}
          </p>
          {Boolean(slots.typical_wait) && (
            <p className="mt-1 text-[13px] text-forest-800">
              Typical wait: {String(slots.typical_wait)}
            </p>
          )}
        </div>
      )}

      {facilities.map((facility) => {
        const isRecommended = facility.level === recommendedLevel;
        const isSelected = facility.id === selected;
        return (
          <button
            key={facility.id}
            type="button"
            disabled={busy}
            onClick={() => onSelect(facility.id)}
            className={cn(
              "w-full rounded-xl border p-4 text-left transition-all active:scale-[0.99] disabled:opacity-60 sm:p-4",
              isSelected
                ? "border-forest-500 bg-forest-50 ring-1 ring-forest-500"
                : "border-paper-200 bg-white hover:border-forest-300"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-paper-900">{facility.name}</p>
              {isRecommended && <Badge tone="official">Right level</Badge>}
            </div>
            <p className="mt-1 text-sm text-paper-600">{facility.address}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-paper-600">
              <span>{facility.distance}</span>
              {facility.shaAccredited && <span className="text-forest-800">SHA accredited</span>}
              <span className={facility.openNow ? "text-forest-800" : "text-ochre-600"}>
                {facility.openNow ? "Open now" : "Closed now"}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function VisitPlanner({
  slots,
  onSchedule,
  busy,
  scheduled,
}: {
  slots: Record<string, unknown>;
  onSchedule: (facilityId: string, datetime: string) => void;
  busy?: boolean;
  scheduled?: CaseView["appointments"][number];
}) {
  const facilityId = slots.selected_facility_id as string | undefined;
  const checklist = slots.visit_checklist as string[] | undefined;

  if (scheduled) {
    return (
      <div className="mt-4 rounded-xl border border-forest-200 bg-forest-50 p-4">
        <p className="font-medium text-forest-900">{scheduled.providerName}</p>
        <p className="mt-0.5 text-sm text-forest-700">
          {new Date(scheduled.datetime).toLocaleString("en-KE", {
            weekday: "long",
            day: "numeric",
            month: "long",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </div>
    );
  }

  const options = nextThreeMornings();

  return (
    <div className="mt-4">
      {checklist && checklist.length > 0 && (
        <div className="mb-4 rounded-xl bg-paper-100 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-paper-500">Carry with you</p>
          <ul className="mt-2 space-y-1">
            {checklist.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-paper-700">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest-500" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-paper-500">
        When will you go?
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((option) => (
          <Button
            key={option.iso}
            variant="secondary"
            disabled={busy || !facilityId}
            onClick={() => facilityId && onSchedule(facilityId, option.iso)}
            className="h-auto flex-col items-start gap-0.5 py-3"
          >
            <span className="text-[13px] font-semibold text-paper-800">{option.day}</span>
            <span className="text-xs font-normal text-paper-500">{option.time}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

/** County facilities are busiest late morning, so early slots are offered first. */
function nextThreeMornings() {
  const options: Array<{ iso: string; day: string; time: string }> = [];
  const date = new Date();
  date.setHours(8, 0, 0, 0);

  while (options.length < 3) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() === 0) continue;
    options.push({
      iso: date.toISOString(),
      day: date.toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" }),
      time: "8:00 am",
    });
  }
  return options;
}
