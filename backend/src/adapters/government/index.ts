import type {
  CaseData,
  Evidence,
  Institution,
  IntentDefinition,
  IntentResult,
  ReadinessResult,
  Requirement,
  WorkflowStep,
} from '@waypoint/shared';
import type { ServiceAdapter, StepHandlerResult, ValidationResult } from './base/types';
import { getWorkflow } from '../../services/workflow/loader';
import { dmvCaConnector, DMV_CA_EVIDENCE, DMV_CA_REQUIREMENTS } from '../../connectors/dmv-ca/data';

const INTENTS: IntentDefinition[] = [
  {
    id: 'gov.id_replacement',
    domain: 'government',
    label: 'Replace lost ID or driver license',
    keywords: ['lost', 'id', 'license', 'driver', 'wallet', 'stolen', 'replacement', 'dmv'],
    workflowId: 'gov.ca_id_replacement_v1',
  },
];

export class GovernmentAdapter implements ServiceAdapter {
  id = 'gov-adapter-v1';
  domain = 'government' as const;
  version = '1.0.0';

  handlers: Record<string, (caseData: CaseData, step: WorkflowStep) => Promise<StepHandlerResult>> = {
    'gov.resolveRequirements': this.handleResolveRequirements.bind(this),
    'gov.checkReadiness': this.handleCheckReadiness.bind(this),
    'gov.getOfficeGuide': this.handleGetOfficeGuide.bind(this),
  };

  classifyIntent(utterance: string): IntentResult {
    const lower = utterance.toLowerCase();
    let confidence = 0;
    const entities: Record<string, unknown> = {};

    for (const intent of INTENTS) {
      const matches = intent.keywords.filter((k) => lower.includes(k)).length;
      if (matches > 0) {
        confidence = Math.min(0.5 + matches * 0.1, 0.95);
      }
    }

    if (lower.includes('california') || lower.includes(' ca ') || lower.includes('ca license')) {
      entities.state = 'CA';
      confidence = Math.max(confidence, 0.7);
    }
    if (lower.includes('driver') || lower.includes('license')) {
      entities.id_type = 'drivers_license';
    }
    if (lower.includes('state id') || lower.includes('identification card')) {
      entities.id_type = 'state_id';
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

  resolveWorkflow(intent: string, slots: Record<string, unknown>) {
    if (intent !== 'gov.id_replacement') return null;
    return getWorkflow('gov.ca_id_replacement_v1');
  }

  getWorkflow(workflowId: string) {
    return getWorkflow(workflowId);
  }

  async resolveRequirements(caseData: CaseData): Promise<Requirement[]> {
    const rawReqs = dmvCaConnector.getRequirements('id-replacement', caseData.workflow.slots);
    const evidence = DMV_CA_EVIDENCE;

    return rawReqs.map((r) => {
      const ev = evidence.find((e) => e.id === r.evidenceId);
      return {
        id: r.id,
        label: r.label,
        description: r.description,
        category: r.category,
        status: 'needed' as const,
        mandatory: r.id !== 'req_ssn_verification',
        verificationStatus: (r as { verificationOverride?: string }).verificationOverride === 'commonly_reported'
          ? 'commonly_reported'
          : (ev?.verificationStatus ?? 'official'),
        evidenceIds: ev ? [ev.id] : [],
        acceptableDocuments: r.acceptableDocuments,
      };
    });
  }

  validateRequirement(req: Requirement, caseData: CaseData): ValidationResult {
    if (req.status === 'satisfied') return { valid: true, errors: [] };
    const artifact = caseData.artifacts.find((a) => a.requirementId === req.id);
    if (artifact && artifact.validationStatus === 'valid') return { valid: true, errors: [] };
    return { valid: false, errors: [`${req.label} not yet satisfied`] };
  }

  calculateReadiness(caseData: CaseData): ReadinessResult {
    const mandatory = caseData.requirements.filter((r) => r.mandatory);
    const satisfied = mandatory.filter((r) => r.status === 'satisfied');
    const score = mandatory.length === 0 ? 0 : Math.round((satisfied.length / mandatory.length) * 100);
    const blockers = mandatory
      .filter((r) => r.status !== 'satisfied')
      .map((r) => ({ requirementId: r.id, reason: `${r.label} is still needed` }));

    let status: ReadinessResult['status'] = 'not_ready';
    if (score >= 100) status = 'ready';
    else if (score >= 60) status = 'almost_ready';

    return { score, status, blockers, satisfiedCount: satisfied.length, totalMandatory: mandatory.length };
  }

  resolveInstitution(slots: Record<string, unknown>): Institution {
    return {
      id: 'dmv-ca',
      name: 'California Department of Motor Vehicles',
      jurisdiction: 'state:CA',
      domain: 'government',
    };
  }

  getEvidence(requirementId: string): Evidence[] {
    const req = DMV_CA_REQUIREMENTS.find((r) => r.id === requirementId);
    if (!req) return [];
    return DMV_CA_EVIDENCE.filter((e) => e.id === req.evidenceId);
  }

  private async handleResolveRequirements(caseData: CaseData): Promise<StepHandlerResult> {
    const requirements = await this.resolveRequirements(caseData);
    const evidence = DMV_CA_EVIDENCE;
    return { success: true, requirements, output: { requirements_loaded: true }, flags: [], blockers: [] };
  }

  private async handleCheckReadiness(caseData: CaseData): Promise<StepHandlerResult> {
    const readiness = this.calculateReadiness(caseData);
    return {
      success: true,
      output: { readiness_score: readiness.score },
      blockers: readiness.blockers,
    };
  }

  private async handleGetOfficeGuide(caseData: CaseData): Promise<StepHandlerResult> {
    const zip = (caseData.workflow.slots.zip_code as string) || '90048';
    const offices = dmvCaConnector.getLocations(zip);
    const fees = dmvCaConnector.getFees();
    return {
      success: true,
      output: {
        offices,
        fees,
        guide_ready: true,
      },
    };
  }
}
