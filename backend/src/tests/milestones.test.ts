import { describe, it, expect, beforeAll } from 'vitest';
import { loadWorkflows, getWorkflow } from '../services/workflow/loader';
import { registerAdapter } from '../adapters/registry';
import { GovernmentAdapter } from '../adapters/government';
import { HealthcareAdapter } from '../adapters/healthcare';
import { createInitialCase, tryAdvance } from '../services/workflow/engine';
import { healthMockConnector } from '../connectors/health-mock/data';

beforeAll(() => {
  loadWorkflows();
  registerAdapter(new GovernmentAdapter());
  registerAdapter(new HealthcareAdapter());
});

describe('Milestone 1 — Shared types + Database', () => {
  it('loads workflow definitions', () => {
    const gov = getWorkflow('gov.ca_id_replacement_v1');
    const health = getWorkflow('health.musculoskeletal_nav_v1');
    expect(gov).toBeTruthy();
    expect(health).toBeTruthy();
    expect(gov?.domain).toBe('government');
    expect(health?.domain).toBe('healthcare');
  });
});

describe('Milestone 2 — Workflow Engine', () => {
  it('creates initial case at first step', () => {
    const workflow = getWorkflow('gov.ca_id_replacement_v1')!;
    const caseData = createInitialCase(workflow, {
      userId: 'test',
      title: 'Test',
      intent: {
        rawUtterance: 'test',
        classifiedIntent: 'gov.id_replacement',
        confidence: 0.9,
        extractedEntities: {},
        clarifications: [],
      },
      adapterId: 'gov-adapter-v1',
      institution: { id: 'dmv-ca', name: 'DMV', domain: 'government' },
      slots: { state: 'CA', id_type: 'drivers_license', is_us_citizen: true },
    });
    expect(caseData.workflow.currentStepId).toBe('intake_confirm');
  });

  it('advances workflow when slots filled', async () => {
    const workflow = getWorkflow('gov.ca_id_replacement_v1')!;
    let caseData = createInitialCase(workflow, {
      userId: 'test',
      title: 'Test',
      intent: {
        rawUtterance: 'test',
        classifiedIntent: 'gov.id_replacement',
        confidence: 0.9,
        extractedEntities: {},
        clarifications: [],
      },
      adapterId: 'gov-adapter-v1',
      institution: { id: 'dmv-ca', name: 'DMV', domain: 'government' },
      slots: { state: 'CA', id_type: 'drivers_license', is_us_citizen: true, zip_code: '90048' },
    });
    const result = await tryAdvance(caseData, 'auto');
    expect(result.allowed).toBe(true);
    expect(result.case.workflow.currentStepId).not.toBe('intake_confirm');
  });
});

describe('Milestone 3 — Adapters + Connectors', () => {
  it('gov adapter resolves CA ID requirements', async () => {
    const adapter = new GovernmentAdapter();
    const workflow = getWorkflow('gov.ca_id_replacement_v1')!;
    const caseData = createInitialCase(workflow, {
      userId: 'test',
      title: 'Test',
      intent: {
        rawUtterance: 'lost id',
        classifiedIntent: 'gov.id_replacement',
        confidence: 0.9,
        extractedEntities: {},
        clarifications: [],
      },
      adapterId: 'gov-adapter-v1',
      institution: adapter.resolveInstitution({ state: 'CA' }),
      slots: { state: 'CA', is_us_citizen: true },
    });
    const reqs = await adapter.resolveRequirements(caseData);
    expect(reqs.length).toBeGreaterThan(0);
    expect(reqs.some((r) => r.verificationStatus === 'official')).toBe(true);
  });

  it('health triage redirects emergencies', () => {
    const triage = healthMockConnector.triage('chest pain and difficulty breathing', 9, 1);
    expect(triage.careLevel).toBe('emergency');
  });

  it('health triage recommends primary care for knee pain', () => {
    const triage = healthMockConnector.triage('knee pain when running', 5, 3);
    expect(triage.careLevel).toBe('primary_care');
  });
});

describe('Milestone 4 — API logic', () => {
  it('gov adapter classifies lost ID intent', () => {
    const adapter = new GovernmentAdapter();
    const result = adapter.classifyIntent('I lost my California driver license');
    expect(result.classifiedIntent).toBe('gov.id_replacement');
    expect(result.confidence).toBeGreaterThan(0.3);
    expect(result.extractedEntities.state).toBe('CA');
  });

  it('healthcare adapter classifies knee pain', () => {
    const adapter = new HealthcareAdapter();
    const result = adapter.classifyIntent('My knee has been hurting for 3 weeks');
    expect(result.classifiedIntent).toBe('health.find_care');
    expect(result.confidence).toBeGreaterThan(0.3);
  });
});
