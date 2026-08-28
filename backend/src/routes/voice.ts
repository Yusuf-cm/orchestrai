import { Router, Request, Response } from 'express';
import { speakText } from '../services/voice/elevenlabs';
import { explainNextAction } from '../services/orchestrator';
import { getCaseById } from '../services/case-store';

export const voiceRouter = Router();

voiceRouter.post('/speak', async (req: Request, res: Response) => {
  try {
    const { text, caseId } = req.body;
    let speakText_ = text as string;

    if (!speakText_ && caseId) {
      const caseData = await getCaseById(caseId);
      if (caseData) {
        speakText_ = await explainNextAction(caseData);
      }
    }

    if (!speakText_) {
      return res.status(400).json({ error: 'text or caseId is required' });
    }

    const result = await speakText(speakText_);

    if (result.fallback || !result.audio) {
      return res.json({ fallback: true, text: result.text });
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(result.audio);
  } catch (err) {
    res.status(500).json({ error: 'Voice synthesis failed', fallback: true });
  }
});
