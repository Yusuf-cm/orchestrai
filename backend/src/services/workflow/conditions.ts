import type { CaseData } from '@waypoint/shared';

export function evaluateCondition(condition: string, caseData: CaseData): boolean {
  const slots = caseData.workflow.slots;
  const readiness = caseData.state.readinessScore;
  const mandatoryReqs = caseData.requirements.filter((r) => r.mandatory);
  const satisfiedMandatory = mandatoryReqs.filter((r) => r.status === 'satisfied');
  const careLevel = slots.care_level as string | undefined;
  const flags = caseData.state.flags;

  switch (condition) {
    case 'always':
      return true;
    case 'slots_filled':
      return Object.keys(slots).length > 0;
    case 'all_requirements_satisfied':
      return mandatoryReqs.length > 0 && satisfiedMandatory.length === mandatoryReqs.length;
    case 'requirements_pending':
      return satisfiedMandatory.length < mandatoryReqs.length;
    case 'readiness == 100':
    case 'readiness === 100':
      return readiness >= 100;
    case 'readiness < 100':
      return readiness < 100;
    case 'user_confirms':
      return slots._user_confirmed === true;
    case 'care_level == emergency':
      return careLevel === 'emergency';
    case 'care_level != emergency':
      return careLevel !== 'emergency';
    case 'provider_selected':
      return !!slots.selected_provider_id;
    case 'appointment_scheduled':
      return caseData.appointments.some((a) => a.status === 'scheduled');
    case 'has_referral':
      return flags.includes('has_referral');
    default:
      if (condition.startsWith('readiness >=')) {
        const threshold = parseInt(condition.split('>=')[1], 10);
        return readiness >= threshold;
      }
      if (condition.startsWith('slot:')) {
        const slotName = condition.replace('slot:', '');
        return slots[slotName] !== undefined && slots[slotName] !== null && slots[slotName] !== '';
      }
      return false;
  }
}

export function getMatchingTransition(
  transitions: Array<{ to: string; when: string }>,
  caseData: CaseData
): string | null {
  for (const t of transitions) {
    if (evaluateCondition(t.when, caseData)) {
      return t.to;
    }
  }
  return null;
}
