import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { startCase, updateCase, uploadArtifact } from '../services/case-service';
import { listCases, getCaseById } from '../services/case-store';
import { tryAdvance } from '../services/workflow/engine';
import { saveCase } from '../services/case-store';
import { generateClarification } from '../services/orchestrator';
import { getAuditEvents } from '../services/audit';
import { listWorkflows } from '../services/workflow/loader';

const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({ dest: uploadDir });

export const casesRouter = Router();

casesRouter.post('/start', async (req: Request, res: Response) => {
  try {
    const { utterance, userId = 'demo-user' } = req.body;
    if (!utterance) return res.status(400).json({ error: 'utterance is required' });
    const caseData = await startCase(utterance, userId);
    res.status(201).json(caseData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to start case' });
  }
});

casesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || 'demo-user';
    const status = req.query.status as string | undefined;
    const cases = await listCases(userId, status);
    res.json({ cases });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list cases' });
  }
});

casesRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const caseData = await getCaseById(req.params.id);
    if (!caseData) return res.status(404).json({ error: 'Case not found' });
    const audit = await getAuditEvents(req.params.id);
    res.json({ ...caseData, audit });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get case' });
  }
});

casesRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const caseData = await updateCase(req.params.id, req.body);
    res.json(caseData);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Update failed' });
  }
});

casesRouter.post('/:id/advance', async (req: Request, res: Response) => {
  try {
    const caseData = await getCaseById(req.params.id);
    if (!caseData) return res.status(404).json({ error: 'Case not found' });
    const result = await tryAdvance(caseData, req.body.action || 'user_confirms');
    const saved = await saveCase(result.case);
    res.json({ ...result, case: saved });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Advance failed' });
  }
});

casesRouter.post('/:id/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required' });
    const caseData = await uploadArtifact(req.params.id, req.file, req.body.requirementId);
    res.status(201).json({ artifact: caseData.artifacts[caseData.artifacts.length - 1], case: caseData });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Upload failed' });
  }
});

casesRouter.post('/:id/chat', async (req: Request, res: Response) => {
  try {
    const caseData = await getCaseById(req.params.id);
    if (!caseData) return res.status(404).json({ error: 'Case not found' });
    const { message } = req.body;
    const reply = await generateClarification(caseData, message);
    res.json({ reply, case: caseData });
  } catch (err) {
    res.status(500).json({ error: 'Chat failed' });
  }
});

export const workflowsRouter = Router();

workflowsRouter.get('/', (_req, res) => {
  res.json({ workflows: listWorkflows().map((w) => ({ id: w.id, title: w.title, domain: w.domain })) });
});
