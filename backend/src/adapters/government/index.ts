import type {
  CaseData,
  Evidence,
  Institution,
  IntentDefinition,
  IntentResult,
  ReadinessResult,
  Requirement,
} from '@waypoint/shared';
import type { ServiceAdapter, StepHandler, StepHandlerResult, ValidationResult } from '../base/types';
import { getWorkflow } from '../../services/workflow/loader';
import {
  ecitizenConnector,
  ECITIZEN_EVIDENCE,
  ECITIZEN_ID_REQUIREMENTS,
} from '../../connectors/ecitizen-ke/data';

const INTENTS: IntentDefinition[] = [
  {
    id: 'gov.id_replacement',
    domain: 'government',
    label: 'Replace a lost national ID',
    keywords: [
      'lost',
      'id',
      'identity',
      'kitambulisho',
      'national id',
      'card',
      'stolen',
      'replace',
      'replacement',
      'ecitizen',
      'huduma',
      'nimepoteza',
    ],
    workflowId: 'gov.ke_id_replacement_v1',
  },
];

export class GovernmentAdapter implements ServiceAdapter {
  id = 'gov-adapter-v1';
  domain = 'government' as const;
  version = '2.0.0';

  handlers: Record<string, StepHandler> = {
    'gov.resolveRequirements': this.handleResolveRequirements.bind(this),
    'gov.checkReadiness': this.handleCheckReadiness.bind(this),
    'gov.getPaymentDetails': this.handlePaymentDetails.bind(this),
    'gov.getCentreGuide': this.handleCentreGuide.bind(this),
  };

  classifyIntent(utterance: string): IntentResult {
    const lower = utterance.toLowerCase();
    const entities: Record<string, unknown> = {};
    let confidence = 0;

    for (const intent of INTENTS) {
      const matches = intent.keywords.filter((k) => lower.includes(k)).length;
      if (matches > 0) confidence = Math.min(0.45 + matches * 0.12, 0.95);
    }

    for (const county of ['nairobi', 'mombasa', 'kisumu', 'nakuru', 'eldoret', 'kiambu']) {
      if (lower.includes(county)) {
        entities.county = county.charAt(0).toUpperCase() + county.slice(1);
        confidence = Math.max(confidence, 0.7);
      }
    }

    if (lower.includes('police') || lower.includes('abstract') || lower.includes('ob number')) {
      entities.has_police_abstract = true;
    }

    return {
      classifiedIntent: confidence > 0.3 ? 'gov.id_replacement' : 'unknown',
      confidence,
      domain: 'government',
      extractedEntities: entities,
      rawUtterance: utterance,
    };
  }

  getSupportedIntents() {
    return INTENTS;
  }

  resolveWorkflow(intent: string) {
    if (intent !== 'gov.id_replacement') return null;
    return getWorkflow('gov.ke_id_replacement_v1');
  }

  getWorkflow(workflowId: string) {
    return getWorkflow(workflowId);
  }

  getCaseTitle(): string {
    return 'Replace a lost national ID';
  }

  getDefaultSlots(): Record<string, unknown> {
    return {
      county: 'Nairobi',
      has_id_number: true,
      language: 'en',
    };
  }

  async resolveRequirements(caseData: CaseData): Promise<Requirement[]> {
    const raw = ecitizenConnector.getRequirements('id-replacement', caseData.workflow.slots);
    const existing = new Map(caseData.requirements.map((r) => [r.id, r]));

    return raw.map((r) => {
      const evidence = ECITIZEN_EVIDENCE.find((e) => e.id === r.evidenceId);
      const prior = existing.get(r.id);
      return {
        id: r.id,
        label: r.label,
        description: r.description,
        category: r.category,
        status: prior?.status ?? 'needed',
        satisfiedBy: prior?.satisfiedBy,
        mandatory: r.mandatory,
        verificationStatus: evidence?.verificationStatus ?? 'unverified',
        evidenceIds: evidence ? [evidence.id] : [],
        acceptableDocuments: r.acceptableDocuments,
      };
    });
  }

  validateRequirement(req: Requirement, caseData: CaseData): ValidationResult {
    if (req.status === 'satisfied') return { valid: true, errors: [] };

    if (req.category === 'document') {
      const artifact = caseData.artifacts.find((a) => a.requirementId === req.id);
      if (!artifact) {
        return { valid: false, errors: [`Upload or confirm: ${req.label}`] };
      }
      if (artifact.validationStatus === 'invalid') {
        return { valid: false, errors: [`${artifact.name} could not be read. Try a clearer photo.`] };
      }
      return { valid: true, errors: [] };
    }

    return { valid: false, errors: [`${req.label} is still outstanding`] };
  }

  calculateReadiness(caseData: CaseData): ReadinessResult {
    const mandatory = caseData.requirements.filter((r) => r.mandatory);
    const satisfied = mandatory.filter((r) => r.status === 'satisfied');
    const score = mandatory.length === 0 ? 0 : Math.round((satisfied.length / mandatory.length) * 100);

    const blockers = mandatory
      .filter((r) => r.status !== 'satisfied')
      .map((r) => ({ requirementId: r.id, reason: r.label }));

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
      id: 'ecitizen-ke',
      name: 'eCitizen — National Registration Bureau',
      jurisdiction: 'KE',
      domain: 'government',
    };
  }

  getEvidence(requirementId: string): Evidence[] {
    const req = ECITIZEN_ID_REQUIREMENTS.find((r) => r.id === requirementId);
    if (!req) return [];
    return ECITIZEN_EVIDENCE.filter((e) => e.id === req.evidenceId);
  }

  private async handleResolveRequirements(caseData: CaseData): Promise<StepHandlerResult> {
    const requirements = await this.resolveRequirements(caseData);
    return {
      success: true,
      requirements,
      output: { requirements_loaded: true },
    };
  }

  private async handleCheckReadiness(caseData: CaseData): Promise<StepHandlerResult> {
    const readiness = this.calculateReadiness(caseData);
    return {
      success: true,
      output: {
        readiness_score: readiness.score,
        outstanding: readiness.blockers.map((b) => b.reason),
      },
    };
  }

  private async handlePaymentDetails(): Promise<StepHandlerResult> {
    return {
      success: true,
      output: {
        fees: ecitizenConnector.getFees(),
        payment: ecitizenConnector.getPaymentOptions(),
      },
    };
  }

  private async handleCentreGuide(caseData: CaseData): Promise<StepHandlerResult> {
    const county = caseData.workflow.slots.county as string | undefined;
    return {
      success: true,
      output: {
        centres: ecitizenConnector.getCentres(county),
        fees: ecitizenConnector.getFees(),
      },
    };
  }
}
