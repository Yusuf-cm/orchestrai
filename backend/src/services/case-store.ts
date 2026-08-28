import type { CaseData } from '@waypoint/shared';
import { prisma } from '../db/prisma';

type CaseRow = {
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
  evidence: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function rowToCaseData(row: CaseRow): CaseData {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    domain: row.domain as CaseData['domain'],
    adapterId: row.adapterId,
    institution: parseJson(row.institution, {
      id: '',
      name: '',
      domain: 'government' as const,
    }),
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
      status: 'active' as const,
      completedSteps: [],
      slots: {},
    }),
    state: parseJson(row.state, {
      phase: 'intake' as const,
      readinessScore: 0,
      readinessStatus: 'not_ready' as const,
      blockers: [],
      flags: [],
    }),
    requirements: parseJson(row.requirements, []),
    artifacts: parseJson(row.artifacts, []),
    appointments: parseJson(row.appointments, []),
    evidence: parseJson(row.evidence, []),
    status: row.status as CaseData['status'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toRowFields(caseData: CaseData) {
  return {
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
    evidence: JSON.stringify(caseData.evidence),
    status: caseData.status,
  };
}

export async function getCaseById(id: string): Promise<CaseData | null> {
  const row = await prisma.case.findUnique({ where: { id } });
  return row ? rowToCaseData(row) : null;
}

export async function saveCase(caseData: CaseData): Promise<CaseData> {
  const fields = toRowFields(caseData);
  const row = await prisma.case.upsert({
    where: { id: caseData.id },
    create: { id: caseData.id, ...fields },
    update: fields,
  });
  return rowToCaseData(row);
}

export async function listCases(userId: string, status?: string): Promise<CaseData[]> {
  const rows = await prisma.case.findMany({
    where: { userId, ...(status ? { status } : {}) },
    orderBy: { updatedAt: 'desc' },
  });
  return rows.map(rowToCaseData);
}
