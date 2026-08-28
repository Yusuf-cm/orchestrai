import { v4 as uuidv4 } from 'uuid';
import type {
  CaseData,
  Evidence,
  Institution,
  IntentDefinition,
  IntentResult,
  ReadinessResult,
  Requirement,
  SafetyResult,
} from '@waypoint/shared';
import type { ServiceAdapter, StepHandler, StepHandlerResult, ValidationResult } from '../base/types';
import { getWorkflow } from '../../services/workflow/loader';
import { shaHealthConnector, CARE_LEVELS } from '../../connectors/sha-health-ke/data';

const INTENTS: IntentDefinition[] = [
  {
    id: 'health.find_care',
    domain: 'healthcare',
    label: 'Find the right care for symptoms',
    keywords: [
      'pain',
      'hurt',
      'hurting',
      'ache',
      'aching',
      'sick',
      'symptom',
      'doctor',
      'hospital',
      'clinic',
      'knee',
      'back',
      'chest',
      'stomach',
      'head',
      'fever',
      'cough',
      'treatment',
      'maumivu',
      'mgonjwa',
      'daktari',
      'hospitali',
      'sha',
      'nhif',
    ],
    workflowId: 'health.ke_care_navigation_v1',
  },
];

export class HealthcareAdapter implements ServiceAdapter {
  id = 'health-adapter-v1';
  domain = 'healthcare' as const;
  version = '2.0.0';

  handlers: Record<string, StepHandler> = {
    'health.urgencyTriage': this.handleUrgencyTriage.bind(this),
    'health.checkCover': this.handleCheckCover.bind(this),
    'health.findFacilities': this.handleFindFacilities.bind(this),
    'health.prepareVisit': this.handlePrepareVisit.bind(this),
  };

  classifyIntent(utterance: string): IntentResult {
    const lower = utterance.toLowerCase();
    const entities: Record<string, unknown> = {};
    let confidence = 0;

    for (const intent of INTENTS) {
      const matches = intent.keywords.filter((k) => lower.includes(k)).length;
      if (matches > 0) confidence = Math.min(0.4 + matches * 0.14, 0.95);
    }

    const weeks = lower.match(/(\d+)\s*(week|wiki)/);
    const months = lower.match(/(\d+)\s*(month|mwezi|miezi)/);
    const days = lower.match(/(\d+)\s*(day|siku)/);
    if (weeks) entities.duration_days = parseInt(weeks[1], 10) * 7;
    else if (months) entities.duration_days = parseInt(months[1], 10) * 30;
    else if (days) entities.duration_days = parseInt(days[1], 10);

    for (const county of ['nairobi', 'mombasa', 'kisumu', 'nakuru', 'eldoret', 'kiambu']) {
      if (lower.includes(county)) {
        entities.county = county.charAt(0).toUpperCase() + county.slice(1);
      }
    }

    if (confidence > 0) entities.symptom_description = utterance;

    return {
      classifiedIntent: confidence > 0.3 ? 'health.find_care' : 'unknown',
      confidence,
      domain: 'healthcare',
      extractedEntities: entities,
      rawUtterance: utterance,
    };
  }

  getSupportedIntents() {
    return INTENTS;
  }

  resolveWorkflow(intent: string) {
    if (intent !== 'health.find_care') return null;
    return getWorkflow('health.ke_care_navigation_v1');
  }

  getWorkflow(workflowId: string) {
    return getWorkflow(workflowId);
  }

  getCaseTitle(): string {
    return 'Find the right care';
  }

  getDefaultSlots(): Record<string, unknown> {
    return {
      county: 'Nairobi',
      severity_1_10: 5,
      duration_days: 14,
      has_sha_cover: false,
      language: 'en',
    };
  }

  /**
   * Deterministic safety screen. This never calls a language model: an
   * emergency must be detected by explicit rules that can be reviewed.
   */
  safetyCheck(caseData: CaseData): SafetyResult {
    const symptoms =
      (caseData.workflow.slots.symptom_description as string) || caseData.intent.rawUtterance;
    const severity = Number(caseData.workflow.slots.severity_1_10 ?? 5);
    const durationDays = Number(caseData.workflow.slots.duration_days ?? 14);
    const triage = shaHealthConnector.triage(symptoms, severity, durationDays);

    return {
      safe: triage.careLevel !== 'emergency',
      careLevel: triage.careLevel,
      redirectMessage: triage.careLevel === 'emergency' ? triage.recommendation : undefined,
      flags: triage.flags,
    };
  }

  async resolveRequirements(caseData: CaseData): Promise<Requirement[]> {
    const hasCover = caseData.workflow.slots.has_sha_cover === true;
    const existing = new Map(caseData.requirements.map((r) => [r.id, r]));

    const defs: Array<Omit<Requirement, 'status'>> = [
      {
        id: 'req_national_id',
        label: 'National ID or waiting card',
        description: 'Facilities ask for identification at registration.',
        category: 'document',
        mandatory: true,
        verificationStatus: 'official',
        evidenceIds: ['ev_sha'],
        acceptableDocuments: ['National ID', 'Waiting card', 'Passport'],
      },
      {
        id: 'req_sha_cover',
        label: hasCover ? 'SHA number' : 'SHA registration',
        description: hasCover
          ? 'Bring your SHA number so cover is applied at registration.'
          : 'Register on *147# before you go. It changes what you pay at the facility.',
        category: hasCover ? 'information' : 'action',
        mandatory: true,
        verificationStatus: 'official',
        evidenceIds: ['ev_sha'],
        acceptableDocuments: [],
      },
      {
        id: 'req_symptom_note',
        label: 'Note of your symptoms',
        description:
          'When it started, what makes it worse, and anything you have already taken. Clinicians have little time, so this matters.',
        category: 'information',
        mandatory: false,
        verificationStatus: 'commonly_reported',
        evidenceIds: [],
        acceptableDocuments: [],
      },
      {
        id: 'req_prior_records',
        label: 'Previous prescriptions or test results',
        description: 'Anything from an earlier visit for the same problem.',
        category: 'document',
        mandatory: false,
        verificationStatus: 'commonly_reported',
        evidenceIds: [],
        acceptableDocuments: ['Prescription', 'Laboratory result', 'Referral letter'],
      },
    ];

    return defs.map((d) => ({
      ...d,
      status: existing.get(d.id)?.status ?? 'needed',
      satisfiedBy: existing.get(d.id)?.satisfiedBy,
    }));
  }

  validateRequirement(req: Requirement, caseData: CaseData): ValidationResult {
    if (req.status === 'satisfied') return { valid: true, errors: [] };
    if (req.category === 'document') {
      const artifact = caseData.artifacts.find((a) => a.requirementId === req.id);
      if (artifact) return { valid: true, errors: [] };
    }
    return { valid: false, errors: [`${req.label} is still outstanding`] };
  }

  calculateReadiness(caseData: CaseData): ReadinessResult {
    const mandatory = caseData.requirements.filter((r) => r.mandatory);
    const satisfied = mandatory.filter((r) => r.status === 'satisfied');
    const slots = caseData.workflow.slots;

    // Readiness answers "can this person walk into the right facility and be
    // seen?", so it weighs knowing where to go alongside having the documents.
    const checkpoints = [
      { done: Boolean(slots.symptom_description), weight: 15 },
      { done: Boolean(slots.care_level), weight: 20 },
      { done: Boolean(slots.selected_facility_id), weight: 25 },
      {
        done: mandatory.length > 0 && satisfied.length === mandatory.length,
        weight: 40,
      },
    ];

    const score = Math.min(
      checkpoints.reduce((total, c) => total + (c.done ? c.weight : 0), 0),
      100
    );

    const blockers: ReadinessResult['blockers'] = [];
    if (!slots.care_level) {
      blockers.push({ requirementId: 'care_level', reason: 'Complete the safety screening' });
    }
    if (!slots.selected_facility_id) {
      blockers.push({ requirementId: 'facility', reason: 'Choose a facility' });
    }
    for (const r of mandatory.filter((r) => r.status !== 'satisfied')) {
      blockers.push({ requirementId: r.id, reason: r.label });
    }

    let status: ReadinessResult['status'] = 'not_ready';
    if (score >= 100) status = 'ready';
    else if (score >= 60) status = 'almost_ready';

    return {
      score,
      status,
      blockers,
      satisfiedCount: satisfied.length,
      totalMandatory: mandatory.length,
    };
  }

  resolveInstitution(): Institution {
    return {
      id: 'sha-health-ke',
      name: 'SHA & county health facilities',
      jurisdiction: 'KE',
      domain: 'healthcare',
    };
  }

  getEvidence(): Evidence[] {
    const guidance = shaHealthConnector.getRegistrationGuidance();
    return [
      {
        id: 'ev_sha',
        sourceUrl: guidance.sourceUrl,
        sourceLabel: guidance.sourceLabel,
        verificationStatus: guidance.verificationStatus,
        lastVerified: '2026-08-01',
      },
    ];
  }

  private async handleUrgencyTriage(caseData: CaseData): Promise<StepHandlerResult> {
    const symptoms =
      (caseData.workflow.slots.symptom_description as string) || caseData.intent.rawUtterance;
    const severity = Number(caseData.workflow.slots.severity_1_10 ?? 5);
    const durationDays = Number(caseData.workflow.slots.duration_days ?? 14);
    const triage = shaHealthConnector.triage(symptoms, severity, durationDays);
    const level = CARE_LEVELS[triage.careLevel];

    return {
      success: true,
      output: {
        care_level: triage.careLevel,
        care_level_label: level.label,
        care_level_description: level.description,
        typical_wait: level.typicalWait,
        recommendation: triage.recommendation,
        matched_red_flag: triage.matchedRedFlag ?? null,
      },
      flags: triage.flags,
    };
  }

  private async handleCheckCover(caseData: CaseData): Promise<StepHandlerResult> {
    const requirements = await this.resolveRequirements(caseData);
    return {
      success: true,
      requirements,
      output: { sha_guidance: shaHealthConnector.getRegistrationGuidance() },
    };
  }

  private async handleFindFacilities(caseData: CaseData): Promise<StepHandlerResult> {
    const county = caseData.workflow.slots.county as string | undefined;
    const careLevel = (caseData.workflow.slots.care_level ??
      'level_2_3') as keyof typeof CARE_LEVELS;
    return {
      success: true,
      output: { facilities: shaHealthConnector.getFacilities(county, careLevel) },
    };
  }

  private async handlePrepareVisit(caseData: CaseData): Promise<StepHandlerResult> {
    const hasCover = caseData.workflow.slots.has_sha_cover === true;
    return {
      success: true,
      output: { visit_checklist: shaHealthConnector.getVisitChecklist(hasCover) },
    };
  }
}

/**
 * Records a facility choice. Choosing where to go does not satisfy the document
 * requirements — the person still has to carry them.
 */
export function selectFacility(caseData: CaseData, facilityId: string): CaseData {
  return {
    ...caseData,
    workflow: {
      ...caseData.workflow,
      slots: { ...caseData.workflow.slots, selected_facility_id: facilityId },
    },
  };
}

export function scheduleVisit(caseData: CaseData, facilityId: string, datetime: string): CaseData {
  const facility = shaHealthConnector
    .getFacilities(caseData.workflow.slots.county as string, 'level_4')
    .find((f) => f.id === facilityId);

  return {
    ...caseData,
    appointments: [
      ...caseData.appointments,
      {
        id: uuidv4(),
        providerName: facility?.name ?? 'Selected facility',
        providerSpecialty: facility?.level,
        datetime,
        location: facility?.address,
        status: 'scheduled',
        notes: 'Planned visit recorded in Waypoint. Facilities are walk-in unless stated otherwise.',
      },
    ],
    workflow: {
      ...caseData.workflow,
      slots: {
        ...caseData.workflow.slots,
        selected_facility_id: facilityId,
        visit_datetime: datetime,
      },
    },
  };
}
