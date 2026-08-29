import { Router, type Response } from 'express';
import fs from 'fs';
import multer from 'multer';
import {
  CaseNotFoundError,
  InvalidUploadError,
  UnsupportedRequestError,
  getCaseView,
  listCaseViews,
  startCase,
  updateCase,
  uploadArtifact,
} from '../services/case-service';
import { getCaseById } from '../services/case-store';
import { generateClarification } from '../services/orchestrator';
import { requireSession, type AuthedRequest } from '../services/session';
import { listWorkflows } from '../services/workflow/loader';

const uploadDir = process.env.UPLOAD_DIR || './uploads/documents';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

/** Express types route params loosely; cases are always addressed by a single id. */
function caseIdOf(req: AuthedRequest): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : String(id);
}

function handleError(res: Response, err: unknown): void {
  if (err instanceof UnsupportedRequestError) {
    res.status(400).json({ error: err.message, code: 'UNSUPPORTED' });
    return;
  }
  if (err instanceof CaseNotFoundError) {
    res.status(404).json({ error: err.message, code: 'NOT_FOUND' });
    return;
  }
  if (err instanceof InvalidUploadError) {
    res.status(400).json({ error: err.message, code: 'INVALID_UPLOAD' });
    return;
  }
  console.error('[api] unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong on our side.', code: 'INTERNAL' });
}

export const casesRouter = Router();

casesRouter.use(requireSession);

casesRouter.post('/start', async (req: AuthedRequest, res) => {
  try {
    const utterance = String(req.body?.utterance ?? '').trim();
    if (!utterance) {
      return res.status(400).json({ error: 'Tell us what you need to get done.', code: 'EMPTY' });
    }
    if (utterance.length > 1000) {
      return res.status(400).json({ error: 'That is too long. A sentence or two is enough.', code: 'TOO_LONG' });
    }
    const view = await startCase(utterance, req.userId!);
    res.status(201).json(view);
  } catch (err) {
    handleError(res, err);
  }
});

casesRouter.get('/', async (req: AuthedRequest, res) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    res.json({ cases: await listCaseViews(req.userId!, status) });
  } catch (err) {
    handleError(res, err);
  }
});

casesRouter.get('/:id', async (req: AuthedRequest, res) => {
  try {
    const view = await getCaseView(caseIdOf(req), req.userId!);
    if (!view) return res.status(404).json({ error: 'Case not found', code: 'NOT_FOUND' });
    res.json(view);
  } catch (err) {
    handleError(res, err);
  }
});

/** Ownership is checked before any mutation so a case id alone grants nothing. */
async function assertOwnership(caseId: string, userId: string): Promise<void> {
  const existing = await getCaseById(caseId);
  if (!existing || existing.userId !== userId) {
    throw new CaseNotFoundError('Case not found');
  }
}

casesRouter.patch('/:id', async (req: AuthedRequest, res) => {
  try {
    await assertOwnership(caseIdOf(req), req.userId!);
    res.json(await updateCase(caseIdOf(req), req.body ?? {}));
  } catch (err) {
    handleError(res, err);
  }
});

casesRouter.post('/:id/documents', upload.single('file'), async (req: AuthedRequest, res) => {
  try {
    await assertOwnership(caseIdOf(req), req.userId!);
    if (!req.file) {
      return res.status(400).json({ error: 'Attach a file to upload.', code: 'NO_FILE' });
    }
    const view = await uploadArtifact(caseIdOf(req), req.file, (req.body?.requirementId as string) ?? undefined);
    res.status(201).json(view);
  } catch (err) {
    handleError(res, err);
  }
});

casesRouter.post('/:id/chat', async (req: AuthedRequest, res) => {
  try {
    const caseData = await getCaseById(caseIdOf(req));
    if (!caseData || caseData.userId !== req.userId) {
      return res.status(404).json({ error: 'Case not found', code: 'NOT_FOUND' });
    }
    const message = String(req.body?.message ?? '').trim();
    if (!message) {
      return res.status(400).json({ error: 'Ask a question first.', code: 'EMPTY' });
    }
    res.json(await generateClarification(caseData, message));
  } catch (err) {
    handleError(res, err);
  }
});

export const workflowsRouter = Router();

workflowsRouter.get('/', (_req, res) => {
  res.json({
    workflows: listWorkflows().map((w) => ({
      id: w.id,
      title: w.title,
      domain: w.domain,
      adapter: w.adapter,
      version: w.version,
      steps: w.steps.length,
    })),
  });
});
