"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Send, Sparkles } from "lucide-react";
import { askQuestion } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Entry {
  question: string;
  answer: string;
  source: "ai" | "fallback";
}

const SUGGESTIONS = [
  "What is a police abstract?",
  "Can someone else collect it for me?",
  "How long will this take?",
];

/**
 * Questions are answered against the case data only. This panel deliberately
 * sits beside the checklist rather than replacing it — the case is the product,
 * conversation is a way to interrogate it.
 */
export function AskPanel({ caseId }: { caseId: string }) {
  const [input, setInput] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);

  const ask = useMutation({
    mutationFn: (message: string) => askQuestion(caseId, message),
    onSuccess: (result, message) => {
      setEntries((prev) => [{ question: message, answer: result.reply, source: result.source }, ...prev]);
      setInput("");
    },
  });

  const submit = (message: string) => {
    const trimmed = message.trim();
    if (trimmed && !ask.isPending) ask.mutate(trimmed);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-card border border-paper-200 bg-white p-4">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit(input)}
            placeholder="Ask about this case…"
            className="min-w-0 flex-1 rounded-xl border border-paper-200 bg-paper-50 px-3 py-2.5 text-sm text-paper-900 placeholder:text-paper-400 focus:border-forest-400 focus:bg-white focus:outline-none"
          />
          <Button
            size="icon"
            onClick={() => submit(input)}
            loading={ask.isPending}
            disabled={!input.trim()}
            aria-label="Send question"
          >
            {!ask.isPending && <Send className="h-4 w-4" />}
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => submit(s)}
              disabled={ask.isPending}
              className="rounded-full border border-paper-200 px-2.5 py-1 text-xs text-paper-600 hover:border-forest-300 hover:text-forest-700 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-paper-500">
          Answers come only from this case&apos;s recorded requirements and their sources. Always
          confirm anything important on the official portal.
        </p>
      </div>

      {ask.isError && (
        <p className="rounded-xl bg-alert-50 p-3 text-[13px] text-alert-700">
          That question could not be answered just now. Try again shortly.
        </p>
      )}

      {entries.map((entry, i) => (
        <div key={i} className="animate-rise rounded-card border border-paper-200 bg-white p-4">
          <p className="text-[13px] font-medium text-paper-900">{entry.question}</p>
          <p className="mt-2 text-sm leading-relaxed text-paper-700">{entry.answer}</p>
          {entry.source === "fallback" && (
            <Badge className="mt-2">
              <Sparkles className="h-2.5 w-2.5" />
              From case data
            </Badge>
          )}
        </div>
      ))}
    </div>
  );
}
