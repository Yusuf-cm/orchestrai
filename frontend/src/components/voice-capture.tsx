"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import type { Language } from "@waypoint/shared";
import { transcribeAudio, voiceStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

type Phase = "idle" | "recording" | "transcribing" | "unsupported";

type BrowserSpeech = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function speechCtor(): (new () => BrowserSpeech) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => BrowserSpeech;
    webkitSpeechRecognition?: new () => BrowserSpeech;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function guessLanguage(text: string): Language {
  return /kitambulisho|nimepoteza|nahitaji|maumivu|siku|wiki|mwezi/i.test(text) ? "sw" : "en";
}

/**
 * Voice is the primary way into Waypoint. ElevenLabs Scribe is used when the
 * API key is present; otherwise the browser's own speech recognition runs so
 * the microphone never disappears from the demo.
 */
export function VoiceCapture({
  onTranscript,
  onError,
  disabled,
}: {
  onTranscript: (text: string, language?: Language) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [scribe, setScribe] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const speechRef = useRef<BrowserSpeech | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const speechTextRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const Ctor = speechCtor();
    const hasMic = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
    if (!hasMic && !Ctor) setPhase("unsupported");

    void voiceStatus().then((status) => setScribe(status.configured));

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      speechRef.current?.abort();
    };
  }, []);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = useCallback((onCap: () => void) => {
    setSeconds(0);
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s >= 29) {
          onCap();
          return s;
        }
        return s + 1;
      });
    }, 1000);
  }, []);

  const stopSpeech = useCallback(() => {
    speechRef.current?.stop();
    clearTimer();
  }, []);

  const stopRecorder = useCallback(() => {
    recorderRef.current?.stop();
    clearTimer();
  }, []);

  const startSpeech = useCallback(() => {
    const Ctor = speechCtor();
    if (!Ctor) {
      onError?.("This browser cannot listen. Type your request instead.");
      return;
    }

    const rec = new Ctor();
    rec.lang = "en-KE";
    rec.continuous = true;
    rec.interimResults = true;
    speechTextRef.current = "";

    rec.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      speechTextRef.current = text.trim();
    };

    rec.onerror = (event) => {
      if (event.error === "aborted" || event.error === "no-speech") return;
      onError?.(
        event.error === "not-allowed"
          ? "Microphone access was blocked. You can type your request instead."
          : "Could not hear that. Try again or type instead."
      );
      setPhase("idle");
      clearTimer();
    };

    rec.onend = () => {
      const text = speechTextRef.current;
      setPhase("idle");
      setSeconds(0);
      speechRef.current = null;
      if (text) onTranscript(text, guessLanguage(text));
      else onError?.("Nothing was picked up. Try again or type instead.");
    };

    speechRef.current = rec;
    rec.start();
    setPhase("recording");
    startTimer(stopSpeech);
  }, [onError, onTranscript, startTimer, stopSpeech]);

  const startScribe = useCallback(async () => {
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
          const { text, language } = await transcribeAudio(blob);
          if (text) onTranscript(text, language);
          else onError?.("Nothing was picked up. Try again or type instead.");
          setPhase("idle");
          setSeconds(0);
        } catch {
          // Key missing or Scribe unreachable — switch to on-device listening.
          startSpeech();
        }
      };

      recorderRef.current = recorder;
      recorder.start();
      setPhase("recording");
      startTimer(stopRecorder);
    } catch {
      startSpeech();
    }
  }, [onError, onTranscript, startSpeech, startTimer, stopRecorder]);

  const start = useCallback(() => {
    if (scribe && navigator.mediaDevices) void startScribe();
    else startSpeech();
  }, [scribe, startScribe, startSpeech]);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") stopRecorder();
    else stopSpeech();
  }, [stopRecorder, stopSpeech]);

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
