"use client";

import { useRef } from "react";
import { Upload, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export function DocumentUpload({
  caseId,
  onUpload,
  disabled,
}: {
  caseId: string;
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onUpload(file);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition-colors hover:border-indigo-400 hover:bg-indigo-50/30",
        disabled && "opacity-50 pointer-events-none"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="image/*,.pdf"
        onChange={handleChange}
        disabled={disabled}
      />
      <Upload className="mx-auto h-8 w-8 text-slate-400" />
      <p className="mt-2 text-sm font-medium text-slate-700">Upload a document</p>
      <p className="mt-1 text-xs text-slate-500">
        Try: passport.pdf, utility-bill.pdf, bank-statement.pdf
      </p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        disabled={disabled}
      >
        Choose file
      </button>
    </div>
  );
}

export function ArtifactsList({
  artifacts,
}: {
  artifacts: Array<{ id: string; name: string; validationStatus: string; extractedFields?: Record<string, unknown> }>;
}) {
  if (artifacts.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-slate-700">Uploaded documents</h3>
      {artifacts.map((a) => (
        <div key={a.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
          <FileText className="h-4 w-4 text-indigo-600" />
          <span className="text-sm text-slate-800">{a.name}</span>
          {a.validationStatus === "valid" && (
            <span className="ml-auto text-xs text-emerald-600">Verified</span>
          )}
        </div>
      ))}
    </div>
  );
}
