"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Compass, Loader2, Sparkles } from "lucide-react";
import { listCases, startCase } from "@/lib/api";
import { CaseCard } from "@/components/case/case-card";

const SUGGESTIONS = [
  "I lost my California driver's license",
  "My knee has been hurting for 3 weeks when I run",
];

export default function HomePage() {
  const router = useRouter();
  const [utterance, setUtterance] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { data: cases = [], refetch } = useQuery({
    queryKey: ["cases"],
    queryFn: listCases,
  });

  const handleStart = async (text?: string) => {
    const q = text || utterance;
    if (!q.trim()) return;
    setLoading(true);
    setError("");
    try {
      const newCase = await startCase(q.trim());
      await refetch();
      router.push(`/cases/${newCase.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start case");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Waypoint</h1>
            <p className="text-xs text-slate-500">Navigate institutions with confidence</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            What do you need to get done?
          </h2>
          <p className="mt-3 text-slate-600">
            Tell us your goal. We&apos;ll build a case, check requirements, and tell you when you&apos;re ready.
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-2xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            <textarea
              value={utterance}
              onChange={(e) => setUtterance(e.target.value)}
              placeholder="I lost my ID and need a replacement..."
              rows={3}
              className="w-full resize-none rounded-xl border-0 bg-transparent px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleStart();
                }
              }}
            />
            <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2">
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setUtterance(s);
                      handleStart(s);
                    }}
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 hover:bg-indigo-100 hover:text-indigo-700"
                  >
                    {s.length > 40 ? s.slice(0, 40) + "…" : s}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => handleStart()}
                disabled={loading || !utterance.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Start case
              </button>
            </div>
          </div>
          {error && <p className="mt-2 text-center text-sm text-red-600">{error}</p>}
        </div>

        {cases.length > 0 && (
          <section className="mt-14">
            <h3 className="text-lg font-semibold text-slate-900">Active cases</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {cases.map((c) => (
                <CaseCard key={c.id} caseData={c} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
