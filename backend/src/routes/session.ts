import { Router } from 'express';
import { createSession, resolveSession } from '../services/session';

export const sessionRouter = Router();

/**
 * Issues a session so a visitor can hold cases without creating an account.
 * The client stores the token and sends it on every request.
 */
sessionRouter.post('/', async (req, res) => {
  try {
    const name = typeof req.body?.name === 'string' && req.body.name.trim()
      ? req.body.name.trim().slice(0, 80)
      : 'Guest';
    const { token, userId } = await createSession(name);
    res.status(201).json({ token, userId, name });
  } catch (err) {
    console.error('[session] create failed:', err);
    res.status(500).json({ error: 'Could not start a session.' });
  }
});

sessionRouter.get('/', async (req, res) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  const userId = await resolveSession(token);
  if (!userId) return res.status(401).json({ valid: false });
  res.json({ valid: true, userId });
});
