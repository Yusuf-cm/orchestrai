"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { transcribeAudio } from "@/lib/api";
import { cn } from "@/lib/utils";

type Phase = "idle" | "recording" | "transcribing" | "unsupported";

/**
 * Voice is the primary way into Waypoint. Someone standing outside a Huduma
 * Centre can describe their problem out loud instead of typing it, in English
 * or Kiswahili, and the recording is transcribed server-side by ElevenLabs.
 */
export function VoiceCapture({
  onTranscript,
  onError,
  disabled,
}: {
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && !navigator.mediaDevices?.getUserMedia) {
      setPhase("unsupported");
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setPhase("transcribing");
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          if (blob.size < 1200) {
            setPhase("idle");
            onError?.("That was too short to hear. Hold the button and speak.");
            return;
          }
          const text = await transcribeAudio(blob);
          if (text) onTranscript(text);
          else onError?.("Nothing was picked up. Try again or type instead.");
        } catch (err) {
          onError?.(
            err instanceof Error ? err.message : "Could not transcribe. Type your request instead."
          );
        } finally {
          setPhase("idle");
          setSeconds(0);
        }
      };

      recorderRef.current = recorder;
      recorder.start();
      setPhase("recording");
      setSeconds(0);

      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          // Cap recordings so a forgotten button does not upload minutes of audio.
          if (s >= 29) {
            stop();
            return s;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      onError?.("Microphone access was blocked. You can type your request instead.");
      setPhase("idle");
    }
  }, [onError, onTranscript, stop]);

  if (phase === "unsupported") return null;

  const isRecording = phase === "recording";
  const isBusy = phase === "transcribing";

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={isRecording ? stop : start}
        disabled={disabled || isBusy}
        aria-label={isRecording ? "Stop recording" : "Record your request"}
        className={cn(
          "relative flex h-16 w-16 items-center justify-center rounded-full transition-all active:scale-95 disabled:opacity-60",
          isRecording
            ? "bg-alert-500 text-white"
            : "bg-forest-700 text-paper-50 hover:bg-forest-800"
        )}
      >
        {isRecording && (
          <span
            className="absolute inset-0 rounded-full bg-alert-500"
            style={{ animation: "pulse-ring 1.5s ease-out infinite" }}
          />
        )}
        <span className="relative">
          {isBusy ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : isRecording ? (
            <Square className="h-5 w-5 fill-current" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </span>
      </button>

      <p className="min-h-5 text-xs font-medium text-paper-500" aria-live="polite">
        {isRecording
          ? `Listening… ${seconds}s — tap to stop`
          : isBusy
            ? "Writing down what you said…"
            : "Tap to speak"}
      </p>
    </div>
  );
}
