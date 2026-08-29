import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Language } from '@waypoint/shared';
import { prisma } from '../../db/prisma';

/**
 * ElevenLabs voice layer.
 *
 * Speech in: Scribe v2, which handles the English/Kiswahili mixing that is
 * normal in Kenyan speech. Speech out: Flash for English (low latency on
 * stage), v3 for Kiswahili (Swahili is in the 70+ language set; multilingual
 * v2 is not). Audio is cached so repeating a demo line costs one generation.
 */

const API_BASE = 'https://api.elevenlabs.io/v1';
const DEFAULT_VOICE = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
const SW_VOICE = process.env.ELEVENLABS_VOICE_ID_SW || DEFAULT_VOICE;
const AUDIO_DIR = process.env.VOICE_CACHE_DIR || './uploads/voice';
const REQUEST_TIMEOUT_MS = 18_000;

const KENYA_KEYTERMS = [
  'kitambulisho',
  'Huduma Centre',
  'eCitizen',
  'SHA',
  'NHIF',
  'M-Pesa',
  'Kenyatta National Hospital',
  'Mbagathi',
  'Langata Health Centre',
  'police abstract',
];

export function isVoiceConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
}

function voiceFor(language: Language): string {
  return language === 'sw' ? SW_VOICE : DEFAULT_VOICE;
}

/** Flash for English speed; v3 is the model that actually speaks Swahili. */
export function ttsModelsFor(language: Language): string[] {
  if (language === 'sw') return ['eleven_v3', 'eleven_multilingual_v2'];
  return ['eleven_flash_v2_5', 'eleven_turbo_v2_5', 'eleven_multilingual_v2'];
}

export function mapScribeLanguage(code: string | undefined): Language {
  const normalised = (code ?? '').toLowerCase();
  if (normalised.startsWith('sw')) return 'sw';
  return 'en';
}

function cacheKeyFor(text: string, language: Language, model: string): string {
  return crypto
    .createHash('sha256')
    .update(`${model}:${voiceFor(language)}:${text}`)
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

async function readErrorBody(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 280);
  } catch {
    return '';
  }
}

export interface SpeakResult {
  audio?: Buffer;
  cached: boolean;
  /** True when the client should fall back to on-device speech synthesis. */
  fallback: boolean;
  text: string;
}

async function readCachedAudio(cacheKey: string): Promise<Buffer | null> {
  try {
    const cached = await prisma.voiceCache.findUnique({ where: { cacheKey } });
    if (cached && fs.existsSync(cached.audioPath)) {
      return fs.readFileSync(cached.audioPath);
    }
  } catch (err) {
    console.warn('[voice] cache read failed:', err instanceof Error ? err.message : err);
  }
  return null;
}

async function writeCachedAudio(cacheKey: string, audio: Buffer): Promise<void> {
  try {
    ensureDir(AUDIO_DIR);
    const audioPath = path.join(AUDIO_DIR, `${cacheKey}.mp3`);
    fs.writeFileSync(audioPath, audio);
    await prisma.voiceCache.upsert({
      where: { cacheKey },
      create: { cacheKey, audioPath },
      update: { audioPath },
    });
  } catch (err) {
    console.warn('[voice] cache write failed:', err instanceof Error ? err.message : err);
  }
}

export async function speak(text: string, language: Language = 'en'): Promise<SpeakResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) return { fallback: true, cached: false, text };

  const models = ttsModelsFor(language);

  for (const model of models) {
    const cacheKey = cacheKeyFor(text, language, model);
    const cached = await readCachedAudio(cacheKey);
    if (cached) return { audio: cached, cached: true, fallback: false, text };

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
            model_id: model,
            voice_settings: {
              stability: 0.45,
              similarity_boost: 0.75,
              speed: 1.0,
            },
          }),
        })
      );

      if (!response.ok) {
        console.warn(`[voice] tts ${model} returned ${response.status} ${await readErrorBody(response)}`);
        continue;
      }

      const audio = Buffer.from(await response.arrayBuffer());
      await writeCachedAudio(cacheKey, audio);
      return { audio, cached: false, fallback: false, text };
    } catch (err) {
      console.warn(`[voice] tts ${model} failed:`, err instanceof Error ? err.message : err);
    }
  }

  return { fallback: true, cached: false, text };
}

export interface TranscribeResult {
  text: string;
  language?: Language;
  fallback: boolean;
}

async function transcribeOnce(
  apiKey: string,
  audio: Buffer,
  filename: string,
  withKeyterms: boolean
): Promise<{ ok: boolean; status: number; result?: TranscribeResult }> {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(audio)]), filename);
  form.append('model_id', 'scribe_v2');
  form.append('no_verbatim', 'true');
  if (withKeyterms) {
    for (const term of KENYA_KEYTERMS) form.append('keyterms', term);
  }

  const response = await withTimeout((signal) =>
    fetch(`${API_BASE}/speech-to-text`, {
      method: 'POST',
      signal,
      headers: { 'xi-api-key': apiKey },
      body: form,
    })
  );

  if (!response.ok) {
    console.warn(`[voice] stt returned ${response.status} ${await readErrorBody(response)}`);
    return { ok: false, status: response.status };
  }

  const data = (await response.json()) as { text?: string; language_code?: string };
  if (!data.text) return { ok: true, status: 200, result: { text: '', fallback: true } };

  return {
    ok: true,
    status: 200,
    result: {
      text: data.text.trim(),
      language: mapScribeLanguage(data.language_code),
      fallback: false,
    },
  };
}

/**
 * Transcribes a recording. Language is not forced — Scribe decides — so a
 * sentence that mixes English and Kiswahili still comes through as one line.
 */
export async function transcribe(
  audio: Buffer,
  filename = 'recording.webm'
): Promise<TranscribeResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) return { text: '', fallback: true };

  try {
    const first = await transcribeOnce(apiKey, audio, filename, true);
    if (first.result) return first.result;
    // Keyterms are billed extra and some accounts reject the field; retry bare.
    if (first.status === 400) {
      const retry = await transcribeOnce(apiKey, audio, filename, false);
      if (retry.result) return retry.result;
    }
    return { text: '', fallback: true };
  } catch (err) {
    console.warn('[voice] speech-to-text failed:', err instanceof Error ? err.message : err);
    return { text: '', fallback: true };
  }
}
