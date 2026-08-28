import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import type { Language } from '@waypoint/shared';
import { speak, transcribe, isVoiceConfigured } from '../services/voice/elevenlabs';
import { buildSpokenSummary } from '../services/orchestrator';
import { getCaseById } from '../services/case-store';
import { getCurrentStepInfo } from '../services/workflow/engine';
import { requireSession, type AuthedRequest } from '../services/session';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
});

export const voiceRouter = Router();

voiceRouter.get('/status', (_req, res) => {
  res.json({ configured: isVoiceConfigured(), languages: ['en', 'sw'] });
});

voiceRouter.use(requireSession);

/** Transcribes a recording so a person can start a case by speaking. */
voiceRouter.post('/transcribe', upload.single('audio'), async (req: AuthedRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio received.', code: 'NO_AUDIO' });
    }
    const result = await transcribe(req.file.buffer, req.file.originalname || 'recording.webm');
    if (result.fallback) {
      return res.status(503).json({
        fallback: true,
        error: 'Speech recognition is unavailable. Type your request instead.',
      });
    }
    res.json(result);
  } catch (err) {
    console.error('[voice] transcribe failed:', err);
    res.status(500).json({ error: 'Could not process the recording.', fallback: true });
  }
});

/** Reads a case's next action aloud, or any supplied text. */
voiceRouter.post('/speak', async (req: AuthedRequest, res) => {
  try {
    const language = (req.body?.language === 'sw' ? 'sw' : 'en') as Language;
    let text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';

    if (!text && req.body?.caseId) {
      const caseData = await getCaseById(String(req.body.caseId));
      if (!caseData || caseData.userId !== req.userId) {
        return res.status(404).json({ error: 'Case not found', code: 'NOT_FOUND' });
      }
      const step = getCurrentStepInfo(caseData);
      text = buildSpokenSummary(caseData, step?.title, language);
    }

    if (!text) {
      return res.status(400).json({ error: 'Nothing to read aloud.', code: 'EMPTY' });
    }
    if (text.length > 1200) text = `${text.slice(0, 1200)}…`;

    const result = await speak(text, language);
    if (result.fallback || !result.audio) {
      return res.json({ fallback: true, text: result.text });
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('X-Voice-Cached', String(result.cached));
    res.send(result.audio);
  } catch (err) {
    console.error('[voice] speak failed:', err);
    res.status(500).json({ error: 'Voice synthesis failed.', fallback: true });
  }
});
