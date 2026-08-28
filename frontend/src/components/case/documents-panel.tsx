"use client";

import { useRef, useState } from "react";
import type { Artifact, Requirement } from "@waypoint/shared";
import { FileText, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/utils";

export function DocumentsPanel({
  artifacts,
  requirements,
  onUpload,
  uploading,
}: {
  artifacts: Artifact[];
  requirements: Requirement[];
  onUpload: (file: File, requirementId?: string) => void;
  uploading?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<string>("");

  const documentRequirements = requirements.filter((r) => r.category === "document");

  return (
    <div className="space-y-4">
      <div className="rounded-card border border-paper-200 bg-white p-5">
        <p className="text-sm font-medium text-paper-900">Attach a document</p>
        <p className="mt-1 text-[13px] leading-relaxed text-paper-600">
          A clear phone photo is fine. Waypoint stores it against the requirement so you can find it
          again — it does not read your document or verify it with the institution.
        </p>

        {documentRequirements.length > 0 && (
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="mt-3 w-full rounded-xl border border-paper-200 bg-paper-50 px-3 py-2.5 text-sm text-paper-800 focus:border-forest-400 focus:outline-none"
          >
            <option value="">Choose what this is for…</option>
            {documentRequirements.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
                {r.status === "satisfied" ? " (already done)" : ""}
              </option>
            ))}
          </select>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file, target || undefined);
            e.target.value = "";
          }}
        />

        <Button
          variant="secondary"
          full
          className="mt-3"
          loading={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {!uploading && <Upload className="h-4 w-4" />}
          Choose photo or PDF
        </Button>
        <p className="mt-2 text-center text-[11px] text-paper-500">JPEG, PNG, HEIC or PDF · up to 10 MB</p>
      </div>

      {artifacts.length > 0 ? (
        <ul className="space-y-2">
          {artifacts.map((a) => {
            const requirement = requirements.find((r) => r.id === a.requirementId);
            return (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-xl border border-paper-200 bg-white p-3.5"
              >
                <FileText className="h-4 w-4 shrink-0 text-forest-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-paper-900">{a.name}</p>
                  <p className="truncate text-xs text-paper-500">
                    {requirement ? requirement.label : "Not linked to a requirement"} ·{" "}
                    {formatRelative(a.uploadedAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-card border border-dashed border-paper-300 p-6 text-center text-[13px] text-paper-500">
          Nothing attached yet. You can also tick items off without uploading anything.
        </p>
      )}
    </div>
  );
}
