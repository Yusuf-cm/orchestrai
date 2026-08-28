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
  WorkflowStep,
} from '@waypoint/shared';
import type { ServiceAdapter, StepHandlerResult, ValidationResult } from './base/types';
import { getWorkflow } from '../../services/workflow/loader';
import { healthMockConnector } from '../../connectors/health-mock/data';

const INTENTS: IntentDefinition[] = [
  {
    id: 'health.find_care',
    domain: 'healthcare',
    label: 'Find care for symptoms',
    keywords: ['pain', 'hurt', 'ache', 'symptom', 'doctor', 'knee', 'back', 'shoulder', 'see someone', 'appointment'],
    workflowId: 'health.musculoskeletal_nav_v1',
  },
];

export class HealthcareAdapter implements ServiceAdapter {
  id = 'health-adapter-v1';
  domain = 'healthcare' as const;
  version = '1.0.0';

  handlers: Record<string, (caseData: CaseData, step: WorkflowStep) => Promise<StepHandlerResult>> = {
    'health.urgencyTriage': this.handleUrgencyTriage.bind(this),
    'health.recommendCareType': this.handleRecommendCareType.bind(this),
    'health.findProviders': this.handleFindProviders.bind(this),
    'health.prepareVisit': this.handlePrepareVisit.bind(this),
  };

  classifyIntent(utterance: string): IntentResult {
    const lower = utterance.toLowerCase();
    let confidence = 0;
    const entities: Record<string, unknown> = {};

    for (const intent of INTENTS) {
      const matches = intent.keywords.filter((k) => lower.includes(k)).length;
      if (matches > 0) confidence = Math.min(0.4 + matches * 0.12, 0.95);
    }

    if (lower.includes('knee')) entities.body_part = 'knee';
    if (lower.includes('back')) entities.body_part = 'back';
    if (lower.includes('week')) {
      const match = lower.match(/(\d+)\s*week/);
      if (match) entities.duration_weeks = parseInt(match[1], 10);
    }
    if (lower.includes('run') || lower.includes('running')) entities.activity = 'running';

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
    return getWorkflow('health.musculoskeletal_nav_v1');
  }

  getWorkflow(workflowId: string) {
    return getWorkflow(workflowId);
  }

  safetyCheck(caseData: CaseData): SafetyResult {
    const symptoms = (caseData.workflow.slots.symptom_description as string) || caseData.intent.rawUtterance;
    const severity = (caseData.workflow.slots.severity_1_10 as number) || 5;
    const duration = (caseData.workflow.slots.duration_weeks as number) || 1;
    const triage = healthMockConnector.triage(symptoms, severity, duration);

    return {
      safe: triage.careLevel !== 'emergency',
      careLevel: triage.careLevel,
      redirectMessage: triage.careLevel === 'emergency' ? triage.recommendation : undefined,
      flags: triage.flags,
    };
  }

  async resolveRequirements(caseData: CaseData): Promise<Requirement[]> {
    return [
      {
        id: 'req_insurance_card',
        label: 'Insurance card',
        description: 'Bring your health insurance card to the appointment',
        category: 'document',
        status: 'needed',
        mandatory: true,
        verificationStatus: 'official',
        evidenceIds: [],
        acceptableDocuments: ['Insurance card', 'Digital insurance app'],
      },
      {
        id: 'req_photo_id',
        label: 'Photo ID',
        description: 'Government-issued photo identification',
        category: 'document',
        status: 'needed',
        mandatory: true,
        verificationStatus: 'official',
        evidenceIds: [],
        acceptableDocuments: ["Driver's license", 'Passport', 'State ID'],
      },
      {
        id: 'req_symptom_log',
        label: 'Symptom timeline',
        description: 'When symptoms started, what makes them better/worse',
        category: 'information',
        status: 'needed',
        mandatory: false,
        verificationStatus: 'official',
        evidenceIds: [],
      },
    ];
  }

  validateRequirement(req: Requirement, caseData: CaseData): ValidationResult {
    if (req.status === 'satisfied') return { valid: true, errors: [] };
    return { valid: false, errors: [`${req.label} not yet satisfied`] };
  }

  calculateReadiness(caseData: CaseData): ReadinessResult {
    const hasAppointment = caseData.appointments.some((a) => a.status === 'scheduled');
    const hasProvider = !!caseData.workflow.slots.selected_provider_id;
    const mandatory = caseData.requirements.filter((r) => r.mandatory);
    const satisfied = mandatory.filter((r) => r.status === 'satisfied');

    let score = 0;
    if (caseData.workflow.slots.symptom_description) score += 20;
    if (caseData.workflow.slots.care_level) score += 20;
    if (hasProvider) score += 25;
    if (hasAppointment) score += 25;
    if (satisfied.length === mandatory.length && mandatory.length > 0) score += 10;
    score = Math.min(score, 100);

    const blockers: ReadinessResult['blockers'] = [];
    if (!hasProvider) blockers.push({ requirementId: 'provider', reason: 'Select a provider' });
    if (!hasAppointment) blockers.push({ requirementId: 'appointment', reason: 'Schedule an appointment' });

    let status: ReadinessResult['status'] = 'not_ready';
    if (score >= 100) status = 'ready';
    else if (score >= 60) status = 'almost_ready';

    return { score, status, blockers, satisfiedCount: satisfied.length, totalMandatory: mandatory.length };
  }

  resolveInstitution(): Institution {
    return {
      id: 'health-mock',
      name: 'LA Health Network (Demo)',
      domain: 'healthcare',
    };
  }

  getEvidence(): Evidence[] {
    return [];
  }

  private async handleUrgencyTriage(caseData: CaseData): Promise<StepHandlerResult> {
    const safety = this.safetyCheck(caseData);
    const symptoms = (caseData.workflow.slots.symptom_description as string) || caseData.intent.rawUtterance;
    const severity = (caseData.workflow.slots.severity_1_10 as number) || 5;
    const duration = (caseData.workflow.slots.duration_weeks as number) || 3;
    const triage = healthMockConnector.triage(symptoms, severity, duration);

    return {
      success: true,
      output: {
        care_level: triage.careLevel,
        recommendation: triage.recommendation,
      },
      flags: triage.flags,
    };
  }

  private async handleRecommendCareType(caseData: CaseData): Promise<StepHandlerResult> {
    const careLevel = caseData.workflow.slots.care_level as string;
    const requirements = await this.resolveRequirements(caseData);
    return {
      success: true,
      requirements,
      output: {
        care_recommendation: `Based on your symptoms, we recommend ${careLevel?.replace('_', ' ')}. This is not a diagnosis.`,
      },
    };
  }

  private async handleFindProviders(caseData: CaseData): Promise<StepHandlerResult> {
    const zip = (caseData.workflow.slots.zip_code as string) || '90017';
    const insurance = caseData.workflow.slots.insurance_carrier as string;
    const providers = healthMockConnector.getProviders(zip, insurance);
    return {
      success: true,
      output: { providers },
    };
  }

  private async handlePrepareVisit(caseData: CaseData): Promise<StepHandlerResult> {
    const providerId = caseData.workflow.slots.selected_provider_id as string;
    const providers = healthMockConnector.getProviders('90017');
    const provider = providers.find((p) => p.id === providerId);
    return {
      success: true,
      output: {
        visit_prep: {
          bring: ['Insurance card', 'Photo ID', 'List of current medications', 'Symptom timeline'],
          questions: [
            'How long have you had this pain?',
            'What activities make it worse?',
            'Have you tried any treatments?',
          ],
          provider: provider?.name,
        },
      },
    };
  }
}

export function scheduleAppointment(caseData: CaseData, providerId: string, datetime: string): CaseData {
  const providers = healthMockConnector.getProviders('90017');
  const provider = providers.find((p) => p.id === providerId);
  const appointment = {
    id: uuidv4(),
    providerName: provider?.name ?? 'Selected Provider',
    providerSpecialty: provider?.specialty,
    datetime,
    location: provider?.address,
    status: 'scheduled' as const,
    notes: 'Demo appointment — not a real booking',
  };

  const requirements = caseData.requirements.map((r) =>
    r.id === 'req_symptom_log' ? { ...r, status: 'satisfied' as const } : r
  );

  return {
    ...caseData,
    appointments: [...caseData.appointments, appointment],
    requirements,
    workflow: {
      ...caseData.workflow,
      slots: {
        ...caseData.workflow.slots,
        selected_provider_id: providerId,
        appointment_datetime: datetime,
      },
    },
  };
}
