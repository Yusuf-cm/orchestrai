"use client";

import { Volume2, Loader2 } from "lucide-react";
import { useState } from "react";
import { speakText } from "@/lib/api";

export function VoiceButton({ text, caseId }: { text: string; caseId?: string }) {
  const [loading, setLoading] = useState(false);

  const handleSpeak = async () => {
    setLoading(true);
    try {
      const blob = await speakText(text, caseId);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        await audio.play();
        audio.onended = () => URL.revokeObjectURL(url);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSpeak}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
      title="Listen (ElevenLabs)"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
      Listen
    </button>
  );
}
