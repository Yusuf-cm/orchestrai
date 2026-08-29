import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../db/prisma';

const SESSION_DAYS = 30;

export interface AuthedRequest extends Request {
  userId?: string;
  params: Record<string, string>;
  query: Record<string, string | string[] | undefined>;
  body: Record<string, unknown>;
  file?: Express.Multer.File;
}

/**
 * Lightweight session handling. Cases contain identity documents and health
 * information, so they are scoped to a session rather than left open to anyone
 * who knows a case id. Production would add real identity, but nothing here
 * should be readable by an unauthenticated caller.
 */
export async function createSession(displayName = 'Guest'): Promise<{
  token: string;
  userId: string;
}> {
  const token = crypto.randomBytes(32).toString('hex');
  const user = await prisma.user.create({ data: { name: displayName, email: `guest-${Date.now()}@waypoint.local` } });

  await prisma.session.create({
    data: {
      token,
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000),
    },
  });

  return { token, userId: user.id };
}

export async function resolveSession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { token } });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;
  return session.userId;
}

function readToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  const alt = req.headers['x-waypoint-session'];
  return typeof alt === 'string' ? alt : undefined;
}

export async function requireSession(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = await resolveSession(readToken(req));
  if (!userId) {
    res.status(401).json({
      error: 'Your session has expired. Reload the page to continue.',
      code: 'NO_SESSION',
    });
    return;
  }
  req.userId = userId;
  next();
}
