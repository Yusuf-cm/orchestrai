"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Keyboard } from "lucide-react";
import { toast } from "sonner";
import { listCases, startCase, voiceStatus } from "@/lib/api";
import { CaseCard } from "@/components/case/case-card";
import { VoiceCapture } from "@/components/voice-capture";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const EXAMPLES = [
  { label: "I lost my ID", utterance: "I have lost my national ID and I need a replacement" },
  { label: "Nimepoteza kitambulisho", utterance: "Nimepoteza kitambulisho changu, nahitaji kingine" },
  { label: "My knee hurts", utterance: "My knee has been hurting for 3 weeks and I am in Nairobi" },
];

export default function HomePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);

  const { data: cases = [], isLoading, isError } = useQuery({
    queryKey: ["cases"],
    queryFn: listCases,
  });

  const { data: voice } = useQuery({
    queryKey: ["voice-status"],
    queryFn: voiceStatus,
  });

  const voiceAvailable = voice?.configured === true;
  const showVoice = voiceAvailable && !typing;

  const create = useMutation({
    mutationFn: startCase,
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["cases"] });
      router.push(`/cases/${created.id}`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not start that case");
    },
  });

  const submit = (utterance: string) => {
    const trimmed = utterance.trim();
    if (!trimmed) return;
    setText(trimmed);
    create.mutate(trimmed);
  };

  return (
    <div className="min-h-dvh pb-16">
      <SiteHeader />

      <main className="mx-auto max-w-2xl px-4">
        <section className="pt-10 pb-8 text-center sm:pt-14">
          <h1 className="font-display text-[2rem] leading-[1.15] text-paper-900 sm:text-[2.75rem]">
            Know what to bring,
            <br />
            <span className="text-forest-700">before you go.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-paper-600">
            Say what you need done. Waypoint works out the process, the documents, and the office —
            then tells you when you are actually ready.
          </p>
        </section>

        <Card className="p-6">
          {showVoice ? (
            <div className="flex flex-col items-center">
              <VoiceCapture
                onTranscript={submit}
                onError={(message) => toast.error(message)}
                disabled={create.isPending}
              />
              <p className="mt-3 text-center text-[13px] text-paper-500">
                English or Kiswahili
              </p>
              <button
                type="button"
                onClick={() => setTyping(true)}
                className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-forest-800 hover:bg-forest-50"
              >
                <Keyboard className="h-4 w-4" />
                Type it instead
              </button>
            </div>
          ) : (
            <div>
              <label htmlFor="need" className="text-xs font-semibold uppercase tracking-widest text-paper-500">
                What do you need to get done?
              </label>
              <textarea
                id="need"
                autoFocus
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit(text);
                  }
                }}
                placeholder="I lost my national ID and need a replacement…"
                className="mt-2 w-full resize-none rounded-xl border border-paper-200 bg-paper-50 px-4 py-3 text-[15px] text-paper-900 placeholder:text-paper-400 focus:border-forest-400 focus:bg-white focus:outline-none"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                {voiceAvailable ? (
                  <button
                    type="button"
                    onClick={() => setTyping(false)}
                    className="text-[13px] font-medium text-paper-500 hover:text-forest-700"
                  >
                    Use voice
                  </button>
                ) : (
                  <span />
                )}
                <Button
                  onClick={() => submit(text)}
                  loading={create.isPending}
                  disabled={!text.trim()}
                >
                  Start
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="mt-5 border-t border-paper-200 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-paper-500">
              Try
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example.label}
                  type="button"
                  disabled={create.isPending}
                  onClick={() => submit(example.utterance)}
                  className="min-h-11 rounded-full border border-paper-200 bg-paper-50 px-4 text-sm text-paper-800 transition-colors hover:border-forest-300 hover:bg-forest-50 hover:text-forest-900 disabled:opacity-50"
                >
                  {example.label}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <section className="mt-10">
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-card bg-paper-200/60" />
              ))}
            </div>
          ) : isError ? (
            <div className="rounded-card border border-dashed border-alert-300 bg-alert-50 px-6 py-10 text-center">
              <p className="text-sm font-medium text-paper-800">Could not load your cases</p>
              <p className="mx-auto mt-1 max-w-xs text-[13px] leading-relaxed text-paper-600">
                The API may still be waking up. Wait a few seconds and refresh.
              </p>
            </div>
          ) : cases.length > 0 ? (
            <>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-paper-500">
                Your cases
              </h2>
              <div className="space-y-3">
                {cases.map((c) => (
                  <CaseCard key={c.id} caseData={c} />
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-card border border-dashed border-paper-300 px-6 py-10 text-center">
              <p className="text-sm font-medium text-paper-700">No cases yet</p>
              <p className="mx-auto mt-1 max-w-xs text-[13px] leading-relaxed text-paper-500">
                Start with something real — a lost ID, or a pain you have been putting off. Waypoint
                keeps it until it is done.
              </p>
            </div>
          )}
        </section>

        <section className="mt-12 grid gap-3 sm:grid-cols-3">
          {[
            { title: "Government", body: "Replace a lost national ID through eCitizen and Huduma Centre." },
            { title: "Health", body: "Find the right level of facility instead of queueing at the wrong one." },
            { title: "More later", body: "Insurance, education, and utilities plug into the same engine." },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-paper-200 bg-white p-4">
              <p className="text-sm font-semibold text-paper-900">{item.title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-paper-700">{item.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
