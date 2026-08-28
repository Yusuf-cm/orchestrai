import { prisma } from '../../db/prisma';

export async function logAudit(params: {
  caseId: string;
  actor: 'user' | 'system' | 'ai' | 'human_agent';
  action: string;
  stepId?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  success?: boolean;
}) {
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
  } catch {
    // Case may not be persisted yet — skip silently
  }
}

export async function getAuditEvents(caseId: string, limit = 50) {
  const events = await prisma.auditEvent.findMany({
    where: { caseId },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });
  return events.map((e) => ({
    id: e.id,
    caseId: e.caseId,
    timestamp: e.timestamp.toISOString(),
    actor: e.actor as 'user' | 'system' | 'ai' | 'human_agent',
    action: e.action,
    stepId: e.stepId ?? undefined,
    input: e.input ? JSON.parse(e.input) : undefined,
    output: e.output ? JSON.parse(e.output) : undefined,
    success: e.success,
  }));
}
