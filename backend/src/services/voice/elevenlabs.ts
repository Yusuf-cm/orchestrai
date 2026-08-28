import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Language } from '@waypoint/shared';
import { prisma } from '../../db/prisma';

/**
 * ElevenLabs voice layer.
 *
 * Waypoint is voice-first because the people who lose the most time to
 * institutional paperwork are often the least served by dense text on a screen.
 * Speech comes in through Scribe, and the next action is read back through
 * text-to-speech in English or Kiswahili.
 *
 * Audio is cached by a hash of the text and voice settings, so repeated
 * playback during a demo costs nothing and returns immediately.
 */

const API_BASE = 'https://api.elevenlabs.io/v1';
const DEFAULT_VOICE = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
const SW_VOICE = process.env.ELEVENLABS_VOICE_ID_SW || DEFAULT_VOICE;
const AUDIO_DIR = process.env.VOICE_CACHE_DIR || './uploads/voice';
const REQUEST_TIMEOUT_MS = 12_000;

export function isVoiceConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

function voiceFor(language: Language): string {
  return language === 'sw' ? SW_VOICE : DEFAULT_VOICE;
}

/**
 * Turbo is noticeably faster for English. Kiswahili needs the multilingual
 * model, which is worth the extra latency for correct pronunciation.
 */
function modelFor(language: Language): string {
  return language === 'sw' ? 'eleven_multilingual_v2' : 'eleven_turbo_v2_5';
}

function cacheKeyFor(text: string, language: Language): string {
  return crypto
    .createHash('sha256')
    .update(`${modelFor(language)}:${voiceFor(language)}:${text}`)
    .digest('hex');
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export interface SpeakResult {
  audio?: Buffer;
  cached: boolean;
  /** True when the client should fall back to on-device speech synthesis. */
  fallback: boolean;
  text: string;
}

export async function speak(text: string, language: Language = 'en'): Promise<SpeakResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return { fallback: true, cached: false, text };

  const cacheKey = cacheKeyFor(text, language);
  ensureDir(AUDIO_DIR);

  const cached = await prisma.voiceCache.findUnique({ where: { textHash: cacheKey } });
  if (cached && fs.existsSync(cached.audioPath)) {
    return {
      audio: fs.readFileSync(cached.audioPath),
      cached: true,
      fallback: false,
      text,
    };
  }

  try {
    const response = await withTimeout((signal) =>
      fetch(`${API_BASE}/text-to-speech/${voiceFor(language)}`, {
        method: 'POST',
        signal,
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: modelFor(language),
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.75,
            speed: 1.0,
          },
        }),
      })
    );

    if (!response.ok) {
      console.warn(`[voice] text-to-speech returned ${response.status}`);
      return { fallback: true, cached: false, text };
    }

    const audio = Buffer.from(await response.arrayBuffer());
    const audioPath = path.join(AUDIO_DIR, `${cacheKey}.mp3`);
    fs.writeFileSync(audioPath, audio);
    await prisma.voiceCache.upsert({
      where: { textHash: cacheKey },
      create: { textHash: cacheKey, audioPath },
      update: { audioPath },
    });

    return { audio, cached: false, fallback: false, text };
  } catch (err) {
    console.warn('[voice] text-to-speech failed:', err instanceof Error ? err.message : err);
    return { fallback: true, cached: false, text };
  }
}

export interface TranscribeResult {
  text: string;
  language?: string;
  fallback: boolean;
}

/**
 * Transcribes a recording. Kenyan speech is frequently a mix of English and
 * Kiswahili in one sentence, so language detection is left to the model rather
 * than forced by the client.
 */
export async function transcribe(
  audio: Buffer,
  filename = 'recording.webm'
): Promise<TranscribeResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return { text: '', fallback: true };

  try {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(audio)]), filename);
    form.append('model_id', 'scribe_v1');

    const response = await withTimeout((signal) =>
      fetch(`${API_BASE}/speech-to-text`, {
        method: 'POST',
        signal,
        headers: { 'xi-api-key': apiKey },
        body: form,
      })
    );

    if (!response.ok) {
      console.warn(`[voice] speech-to-text returned ${response.status}`);
      return { text: '', fallback: true };
    }

    const data = (await response.json()) as { text?: string; language_code?: string };
    if (!data.text) return { text: '', fallback: true };

    return {
      text: data.text.trim(),
      language: data.language_code,
      fallback: false,
    };
  } catch (err) {
    console.warn('[voice] speech-to-text failed:', err instanceof Error ? err.message : err);
    return { text: '', fallback: true };
  }
}
