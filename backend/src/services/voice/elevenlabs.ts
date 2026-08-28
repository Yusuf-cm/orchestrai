import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { prisma } from '../../db/prisma';

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1';
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads/voice';

function textHash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export async function speakText(text: string): Promise<{
  audio?: Buffer;
  fallback: boolean;
  text: string;
  cacheKey?: string;
}> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return { fallback: true, text };
  }

  const hash = textHash(text);
  ensureDir(UPLOAD_DIR);

  const cached = await prisma.voiceCache.findUnique({ where: { textHash: hash } });
  if (cached && fs.existsSync(cached.audioPath)) {
    const audio = fs.readFileSync(cached.audioPath);
    return { audio, fallback: false, text, cacheKey: hash };
  }

  try {
    const response = await fetch(`${ELEVENLABS_API}/text-to-speech/${VOICE_ID}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!response.ok) {
      console.warn('ElevenLabs API error:', response.status);
      return { fallback: true, text };
    }

    const arrayBuffer = await response.arrayBuffer();
    const audio = Buffer.from(arrayBuffer);
    const audioPath = path.join(UPLOAD_DIR, `${hash}.mp3`);
    fs.writeFileSync(audioPath, audio);

    await prisma.voiceCache.upsert({
      where: { textHash: hash },
      create: { textHash: hash, audioPath },
      update: { audioPath },
    });

    return { audio, fallback: false, text, cacheKey: hash };
  } catch (err) {
    console.warn('ElevenLabs error:', err);
    return { fallback: true, text };
  }
}
