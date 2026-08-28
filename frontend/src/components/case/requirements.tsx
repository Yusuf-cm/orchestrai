"use client";

import { useState } from "react";
import type { Evidence, Requirement, VerificationStatus } from "@waypoint/shared";
import {
  Check,
  ChevronDown,
  Circle,
  ExternalLink,
  ShieldCheck,
  Users,
  HelpCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const VERIFICATION: Record<
  VerificationStatus,
  { label: string; tone: "official" | "community" | "neutral"; icon: typeof ShieldCheck; blurb: string }
> = {
  official: {
    label: "Official",
    tone: "official",
    icon: ShieldCheck,
    blurb: "Documented by the institution itself",
  },
  commonly_reported: {
    label: "Reported",
    tone: "community",
    icon: Users,
    blurb: "Widely reported by applicants but not officially published",
  },
  unverified: {
    label: "Unverified",
    tone: "neutral",
    icon: HelpCircle,
    blurb: "We could not confirm this — check before you rely on it",
  },
};

/**
 * Requirements carry their provenance. Telling someone what to bring is only
 * useful if they can also see who says so, which is why the badge and source
 * are part of the row rather than hidden in a tooltip.
 */
export function RequirementsList({
  requirements,
  evidence,
  onToggle,
  busy,
}: {
  requirements: Requirement[];
  evidence: Evidence[];
  onToggle: (requirement: Requirement) => void;
  busy?: boolean;
}) {
  if (requirements.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-paper-300 p-6 text-center text-sm text-paper-500">
        Requirements appear once Waypoint has worked out which process applies.
      </p>
    );
  }

  const mandatory = requirements.filter((r) => r.mandatory);
  const optional = requirements.filter((r) => !r.mandatory);

  return (
    <div className="space-y-5">
      <Group
        title="Required"
        subtitle={`${mandatory.filter((r) => r.status === "satisfied").length} of ${mandatory.length} done`}
        requirements={mandatory}
        evidence={evidence}
        onToggle={onToggle}
        busy={busy}
      />
      {optional.length > 0 && (
        <Group
          title="Worth having"
          subtitle="Not required, but avoids a second trip"
          requirements={optional}
          evidence={evidence}
          onToggle={onToggle}
          busy={busy}
        />
      )}
    </div>
  );
}

function Group({
  title,
  subtitle,
  requirements,
  evidence,
  onToggle,
  busy,
}: {
  title: string;
  subtitle: string;
  requirements: Requirement[];
  evidence: Evidence[];
  onToggle: (r: Requirement) => void;
  busy?: boolean;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-paper-500">{title}</h3>
        <span className="text-xs text-paper-500">{subtitle}</span>
      </div>
      <ul className="space-y-2">
        {requirements.map((req) => (
          <RequirementRow
            key={req.id}
            requirement={req}
            evidence={evidence.filter((e) => req.evidenceIds.includes(e.id))}
            onToggle={onToggle}
            busy={busy}
          />
        ))}
      </ul>
    </section>
  );
}

function RequirementRow({
  requirement,
  evidence,
  onToggle,
  busy,
}: {
  requirement: Requirement;
  evidence: Evidence[];
  onToggle: (r: Requirement) => void;
  busy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const meta = VERIFICATION[requirement.verificationStatus];
  const Icon = meta.icon;
  const done = requirement.status === "satisfied";

  return (
    <li
      className={cn(
        "rounded-xl border transition-colors",
        done ? "border-forest-200 bg-forest-50/60" : "border-paper-200 bg-white"
      )}
    >
      <div className="flex items-start gap-2 p-3.5">
        {/* Padded to a comfortable thumb target while the visible circle stays small */}
        <button
          type="button"
          disabled={busy}
          onClick={() => onToggle(requirement)}
          aria-pressed={done}
          aria-label={done ? `Mark ${requirement.label} as not done` : `Mark ${requirement.label} as done`}
          className="-m-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90 disabled:opacity-50"
        >
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors",
              done
                ? "border-forest-600 bg-forest-600 text-white"
                : "border-paper-300 bg-white"
            )}
          >
            {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Circle className="h-0 w-0" />}
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={cn(
                "text-[15px] font-medium leading-snug",
                done ? "text-forest-900" : "text-paper-900"
              )}
            >
              {requirement.label}
            </span>
            <Badge tone={meta.tone}>
              <Icon className="h-2.5 w-2.5" />
              {meta.label}
            </Badge>
          </div>

          {requirement.description && (
            <p className="mt-1 text-[13px] leading-relaxed text-paper-600">
              {requirement.description}
            </p>
          )}

          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="-ml-1 mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-[13px] font-medium text-forest-800 hover:bg-forest-50"
          >
            Where this comes from
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
          </button>

          {open && (
            <div className="animate-fade mb-1 space-y-2.5 rounded-lg bg-paper-100 p-3.5">
              <p className="text-[13px] leading-relaxed text-paper-700">{meta.blurb}</p>
              {evidence.length > 0 ? (
                evidence.map((e) => (
                  <div key={e.id} className="text-[13px]">
                    {e.sourceUrl ? (
                      <a
                        href={e.sourceUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex min-h-11 items-center gap-1.5 font-medium text-forest-800 underline decoration-forest-300 underline-offset-2 hover:decoration-forest-700"
                      >
                        {e.sourceLabel}
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      </a>
                    ) : (
                      <span className="font-medium text-paper-800">{e.sourceLabel}</span>
                    )}
                    {e.lastVerified && (
                      <span className="ml-1.5 text-paper-500">· checked {e.lastVerified}</span>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-[13px] text-paper-600">No published source recorded.</p>
              )}

              {requirement.acceptableDocuments && requirement.acceptableDocuments.length > 0 && (
                <p className="text-[13px] leading-relaxed text-paper-700">
                  <span className="font-semibold">Accepted:</span>{" "}
                  {requirement.acceptableDocuments.join(", ")}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
