import type { CaseData } from '@waypoint/shared';
import { prisma } from '../db/prisma';

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function dbCaseToCaseData(row: {
  id: string;
  userId: string;
  title: string;
  domain: string;
  adapterId: string;
  institution: string;
  service: string | null;
  intent: string;
  workflow: string;
  state: string;
  requirements: string;
  artifacts: string;
  appointments: string;
  tasks: string;
  evidence: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): CaseData {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    domain: row.domain as CaseData['domain'],
    adapterId: row.adapterId,
    institution: parseJson(row.institution, { id: '', name: '', domain: 'government' as const }),
    service: row.service ? parseJson(row.service, undefined) : undefined,
    intent: parseJson(row.intent, {
      rawUtterance: '',
      classifiedIntent: '',
      confidence: 0,
      extractedEntities: {},
      clarifications: [],
    }),
    workflow: parseJson(row.workflow, {
      definitionId: '',
      definitionVersion: '',
      currentStepId: '',
      currentStepIndex: 0,
      status: 'active',
      completedSteps: [],
      slots: {},
    }),
    state: parseJson(row.state, {
      phase: 'intake',
      readinessScore: 0,
      readinessStatus: 'not_ready',
      blockers: [],
      flags: [],
    }),
    requirements: parseJson(row.requirements, []),
    artifacts: parseJson(row.artifacts, []),
    appointments: parseJson(row.appointments, []),
    tasks: parseJson(row.tasks, []),
    evidence: parseJson(row.evidence, []),
    status: row.status as CaseData['status'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getCaseById(id: string): Promise<CaseData | null> {
  const row = await prisma.case.findUnique({ where: { id } });
  return row ? dbCaseToCaseData(row) : null;
}

export async function saveCase(caseData: CaseData): Promise<CaseData> {
  const row = await prisma.case.upsert({
    where: { id: caseData.id },
    create: {
      id: caseData.id,
      userId: caseData.userId,
      title: caseData.title,
      domain: caseData.domain,
      adapterId: caseData.adapterId,
      institution: JSON.stringify(caseData.institution),
      service: caseData.service ? JSON.stringify(caseData.service) : null,
      intent: JSON.stringify(caseData.intent),
      workflow: JSON.stringify(caseData.workflow),
      state: JSON.stringify(caseData.state),
      requirements: JSON.stringify(caseData.requirements),
      artifacts: JSON.stringify(caseData.artifacts),
      appointments: JSON.stringify(caseData.appointments),
      tasks: JSON.stringify(caseData.tasks),
      evidence: JSON.stringify(caseData.evidence),
      status: caseData.status,
    },
    update: {
      title: caseData.title,
      workflow: JSON.stringify(caseData.workflow),
      state: JSON.stringify(caseData.state),
      requirements: JSON.stringify(caseData.requirements),
      artifacts: JSON.stringify(caseData.artifacts),
      appointments: JSON.stringify(caseData.appointments),
      tasks: JSON.stringify(caseData.tasks),
      evidence: JSON.stringify(caseData.evidence),
      status: caseData.status,
    },
  });
  return dbCaseToCaseData(row);
}

export async function listCases(userId: string, status?: string): Promise<CaseData[]> {
  const rows = await prisma.case.findMany({
    where: {
      userId,
      ...(status ? { status } : {}),
    },
    orderBy: { updatedAt: 'desc' },
  });
  return rows.map(dbCaseToCaseData);
}
