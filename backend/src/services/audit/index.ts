import type { AuditEvent } from '@waypoint/shared';
import { prisma } from '../../db/prisma';

export interface AuditInput {
  caseId: string;
  actor: 'user' | 'system' | 'ai' | 'human_agent';
  action: string;
  stepId?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  success?: boolean;
}

/**
 * Appends an audit event. Failures are surfaced rather than swallowed: an
 * audit trail that silently loses entries is worse than one that complains,
 * because the case history is what users and reviewers rely on.
 */
export async function logAudit(params: AuditInput): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        caseId: params.caseId,
        actor: params.actor,
        action: params.action,
        stepId: params.stepId,
        input: params.input ? JSON.stringify(params.input) : null,
        output: params.output ? JSON.stringify(params.output) : null,
        success: params.success ?? true,
      },
    });
  } catch (err) {
    console.error(
      `[audit] failed to record "${params.action}" for case ${params.caseId}:`,
      err instanceof Error ? err.message : err
    );
  }
}

export async function getAuditEvents(caseId: string, limit = 100): Promise<AuditEvent[]> {
  const events = await prisma.auditEvent.findMany({
    where: { caseId },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });

  return events.map((e) => ({
    id: e.id,
    caseId: e.caseId,
    timestamp: e.timestamp.toISOString(),
    actor: e.actor as AuditEvent['actor'],
    action: e.action,
    stepId: e.stepId ?? undefined,
    input: e.input ? JSON.parse(e.input) : undefined,
    output: e.output ? JSON.parse(e.output) : undefined,
    success: e.success,
  }));
}
