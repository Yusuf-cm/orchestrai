import { describe, it, expect, beforeAll } from 'vitest';
import type { CaseData } from '@waypoint/shared';
import { loadWorkflows, getWorkflow, validateWorkflow } from '../services/workflow/loader';
import { evaluateCondition, isValidCondition } from '../services/workflow/conditions';
import { registerAdapter, getAdapter, classifyIntentAcrossAdapters } from '../adapters/registry';
import { GovernmentAdapter } from '../adapters/government';
import { HealthcareAdapter } from '../adapters/healthcare';
import { createInitialCase, tryAdvance } from '../services/workflow/engine';
import { planExecution, requiresUserConfirmation } from '../services/execution';
import { shaHealthConnector } from '../connectors/sha-health-ke/data';
import { classifyByKeyword } from '../services/orchestrator';

beforeAll(() => {
  registerAdapter(new GovernmentAdapter());
  registerAdapter(new HealthcareAdapter());
  const { errors } = loadWorkflows();
  if (errors.length) throw new Error(`Workflow load errors: ${errors.join('; ')}`);
});

function buildCase(
  workflowId: string,
  adapterId: string,
  slots: Record<string, unknown> = {}
): CaseData {
  const workflow = getWorkflow(workflowId)!;
  const adapter = getAdapter(adapterId)!;
  return createInitialCase(workflow, {
    userId: 'test-user',
    title: 'Test case',
    intent: {
      rawUtterance: 'test',
      classifiedIntent: 'test',
      confidence: 1,
      extractedEntities: {},
      clarifications: [],
    },
    adapterId,
    institution: adapter.resolveInstitution(slots),
    slots: { ...adapter.getDefaultSlots('test'), ...slots },
  });
}

describe('Workflow definitions', () => {
  it('loads and validates both Kenyan workflows', () => {
    expect(getWorkflow('gov.ke_id_replacement_v1')).toBeTruthy();
    expect(getWorkflow('health.ke_care_navigation_v1')).toBeTruthy();
  });

  it('rejects a workflow with an unknown condition', () => {
    const errors = validateWorkflow({
      id: 'test.bad',
      version: '1',
      domain: 'government',
      adapter: 'gov-adapter-v1',
      title: 'Bad',
      slots: [],
      steps: [
        { id: 'a', type: 'lookup', mode: 'execute', transitions: [{ to: 'b', when: 'when pigs fly' }] },
        { id: 'b', type: 'completion', mode: 'guide', transitions: [] },
      ],
    });
    expect(errors.some((e) => e.includes('unsupported condition'))).toBe(true);
  });

  it('rejects a transition pointing at a missing step', () => {
    const errors = validateWorkflow({
      id: 'test.bad2',
      version: '1',
      domain: 'government',
      adapter: 'gov-adapter-v1',
      title: 'Bad',
      slots: [],
      steps: [
        { id: 'a', type: 'lookup', mode: 'execute', transitions: [{ to: 'nowhere', when: 'always' }] },
      ],
    });
    expect(errors.some((e) => e.includes('unknown step'))).toBe(true);
  });
});

describe('Condition grammar', () => {
  it('accepts the documented forms and rejects everything else', () => {
    expect(isValidCondition('always')).toBe(true);
    expect(isValidCondition('readiness >= 60')).toBe(true);
    expect(isValidCondition('slot:care_level == emergency')).toBe(true);
    expect(isValidCondition('slots_filled:county,severity_1_10')).toBe(true);
    expect(isValidCondition('probably ready')).toBe(false);
  });

  it('evaluates readiness comparisons against case state', () => {
    const c = buildCase('gov.ke_id_replacement_v1', 'gov-adapter-v1');
    c.state.readinessScore = 70;
    expect(evaluateCondition('readiness >= 60', c)).toBe(true);
    expect(evaluateCondition('readiness == 100', c)).toBe(false);
  });
});

describe('Workflow engine', () => {
  it('starts a case at the first step', () => {
    const c = buildCase('gov.ke_id_replacement_v1', 'gov-adapter-v1');
    expect(c.workflow.currentStepId).toBe('intake_confirm');
  });

  it('refuses to advance when no condition is satisfied', async () => {
    const c = buildCase('gov.ke_id_replacement_v1', 'gov-adapter-v1', { county: '' });
    const result = await tryAdvance(c);
    expect(result.allowed).toBe(false);
  });

  it('clears the confirmation flag after a transition so one click moves one step', async () => {
    const c = buildCase('gov.ke_id_replacement_v1', 'gov-adapter-v1');
    c.workflow.currentStepId = 'confirm_payment';
    c.workflow.slots._user_confirmed = true;

    const first = await tryAdvance(c, 'user_confirms');
    expect(first.allowed).toBe(true);
    expect(first.case.workflow.currentStepId).toBe('centre_guide');
    expect(first.case.workflow.slots._user_confirmed).toBe(false);

    // Without a fresh confirmation the case must stay where it is.
    const second = await tryAdvance(first.case, 'auto');
    expect(second.allowed).toBe(false);
    expect(second.case.workflow.currentStepId).toBe('centre_guide');
  });

  it('does not advance past a document step while requirements are outstanding', async () => {
    let c = buildCase('gov.ke_id_replacement_v1', 'gov-adapter-v1');
    const adapter = getAdapter('gov-adapter-v1')!;
    c.requirements = await adapter.resolveRequirements(c);
    c.workflow.currentStepId = 'collect_documents';

    const result = await tryAdvance(c);
    expect(result.allowed).toBe(false);
  });
});

describe('Government adapter', () => {
  it('requires a police abstract with an official source', async () => {
    const adapter = getAdapter('gov-adapter-v1')!;
    const c = buildCase('gov.ke_id_replacement_v1', 'gov-adapter-v1');
    const reqs = await adapter.resolveRequirements(c);

    const abstract = reqs.find((r) => r.id === 'req_police_abstract');
    expect(abstract).toBeTruthy();
    expect(abstract!.mandatory).toBe(true);
    expect(abstract!.verificationStatus).toBe('official');
  });

  it('labels community knowledge separately from official requirements', async () => {
    const adapter = getAdapter('gov-adapter-v1')!;
    const c = buildCase('gov.ke_id_replacement_v1', 'gov-adapter-v1');
    const reqs = await adapter.resolveRequirements(c);
    expect(reqs.some((r) => r.verificationStatus === 'commonly_reported')).toBe(true);
  });

  it('reaches full readiness only when every mandatory item is satisfied', async () => {
    const adapter = getAdapter('gov-adapter-v1')!;
    const c = buildCase('gov.ke_id_replacement_v1', 'gov-adapter-v1');
    c.requirements = await adapter.resolveRequirements(c);

    expect(adapter.calculateReadiness(c).score).toBe(0);

    c.requirements = c.requirements.map((r) =>
      r.mandatory ? { ...r, status: 'satisfied' as const } : r
    );
    const readiness = adapter.calculateReadiness(c);
    expect(readiness.score).toBe(100);
    expect(readiness.status).toBe('ready');
  });
});

describe('Healthcare safety', () => {
  it('routes red-flag symptoms to emergency care', () => {
    expect(shaHealthConnector.triage('chest pain and difficulty breathing', 9, 1).careLevel)
      .toBe('emergency');
  });

  it('detects emergencies described in Kiswahili', () => {
    expect(shaHealthConnector.triage('nina maumivu ya kifua', 7, 1).careLevel).toBe('emergency');
  });

  it('starts ordinary complaints at the nearest health centre', () => {
    const triage = shaHealthConnector.triage('knee hurts when I run', 4, 14);
    expect(triage.careLevel).toBe('level_2_3');
  });

  it('escalates persistent or severe symptoms to a sub-county hospital', () => {
    expect(shaHealthConnector.triage('knee pain getting worse', 8, 21).careLevel).toBe('level_4');
    expect(shaHealthConnector.triage('back pain for months', 5, 60).careLevel).toBe('level_4');
  });

  it('sends an emergency case to a hard stop with no onward transition', async () => {
    const c = buildCase('health.ke_care_navigation_v1', 'health-adapter-v1', {
      symptom_description: 'severe chest pain',
      severity_1_10: 9,
      duration_days: 1,
    });
    const result = await tryAdvance(c);
    expect(result.allowed).toBe(true);

    const screened = await tryAdvance(result.case);
    expect(screened.case.workflow.currentStepId).toBe('emergency_redirect');

    const beyond = await tryAdvance(screened.case, 'user_confirms');
    expect(beyond.allowed).toBe(false);
  });

  it('does not count documents as carried just because a facility was chosen', async () => {
    const adapter = getAdapter('health-adapter-v1')!;
    const c = buildCase('health.ke_care_navigation_v1', 'health-adapter-v1', {
      symptom_description: 'knee pain',
      care_level: 'level_2_3',
      selected_facility_id: 'fac-langata-hc',
    });
    c.requirements = await adapter.resolveRequirements(c);

    const readiness = adapter.calculateReadiness(c);
    expect(readiness.score).toBeLessThan(100);
    expect(readiness.blockers.length).toBeGreaterThan(0);
  });
});

describe('Execution layer', () => {
  it('runs lookups automatically and holds real-world actions for the user', () => {
    const c = buildCase('gov.ke_id_replacement_v1', 'gov-adapter-v1');
    const lookup = { id: 'l', type: 'lookup' as const, mode: 'execute' as const, transitions: [] };
    const guide = { id: 'g', type: 'guide_user' as const, mode: 'guide' as const, transitions: [] };

    expect(requiresUserConfirmation(lookup)).toBe(false);
    expect(requiresUserConfirmation(guide)).toBe(true);
    expect(planExecution(guide, c).actor).toBe('user');
    expect(planExecution(lookup, c).autoExecute).toBe(true);
  });

  it('withholds automation for an appointment until it is authorised', () => {
    const c = buildCase('health.ke_care_navigation_v1', 'health-adapter-v1');
    const appointment = {
      id: 'plan_visit',
      type: 'appointment' as const,
      mode: 'execute' as const,
      transitions: [],
    };
    expect(planExecution(appointment, c).requiresConfirmation).toBe(true);

    c.workflow.slots._execution_grants = ['plan_visit'];
    expect(planExecution(appointment, c).autoExecute).toBe(true);
  });
});

describe('Intent routing', () => {
  it('recognises a lost ID in English and Kiswahili without a language model', () => {
    expect(classifyByKeyword('I lost my national ID').classifiedIntent).toBe('gov.id_replacement');
    expect(classifyByKeyword('nimepoteza kitambulisho changu').classifiedIntent)
      .toBe('gov.id_replacement');
  });

  it('extracts county and duration deterministically', () => {
    const result = classifyByKeyword('my knee has hurt for 3 weeks, I am in Kisumu');
    expect(result.domain).toBe('healthcare');
    expect(result.extractedEntities.county).toBe('Kisumu');
    expect(result.extractedEntities.duration_days).toBe(21);
  });

  it('routes through whichever adapter is most confident', () => {
    const match = classifyIntentAcrossAdapters('I need to replace my lost kitambulisho');
    expect(match?.adapter.domain).toBe('government');
  });

  it('returns unknown for a request outside the supported domains', () => {
    expect(classifyByKeyword('what is the capital of France').classifiedIntent).toBe('unknown');
    expect(classifyIntentAcrossAdapters('what is the capital of France')).toBeNull();
  });
});
