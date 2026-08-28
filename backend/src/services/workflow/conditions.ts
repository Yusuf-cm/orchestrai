import type { CaseData } from '@waypoint/shared';

/**
 * Supported condition grammar. Anything outside this set is rejected at
 * workflow load time so a malformed YAML fails loudly instead of stranding a case.
 *
 *   always
 *   slots_filled:<slot>[,<slot>...]
 *   requirements_satisfied
 *   requirements_pending
 *   readiness <op> <number>       (op: >= <= > < ==)
 *   slot:<name>                   truthy check
 *   slot:<name> == <value>
 *   flag:<name>
 *   appointment_scheduled
 *   user_confirmed
 */

export type ConditionContext = {
  caseData: CaseData;
};

const READINESS_RE = /^readiness\s*(>=|<=|==|>|<)\s*(\d+)$/;
const SLOT_EQ_RE = /^slot:([a-z0-9_]+)\s*==\s*(.+)$/i;
const SLOT_RE = /^slot:([a-z0-9_]+)$/i;
const FLAG_RE = /^flag:([a-z0-9_]+)$/i;
const SLOTS_FILLED_RE = /^slots_filled:([a-z0-9_,\s]+)$/i;

export function isValidCondition(condition: string): boolean {
  const c = condition.trim();
  if (
    c === 'always' ||
    c === 'requirements_satisfied' ||
    c === 'requirements_pending' ||
    c === 'appointment_scheduled' ||
    c === 'user_confirmed'
  ) {
    return true;
  }
  return (
    READINESS_RE.test(c) ||
    SLOT_EQ_RE.test(c) ||
    SLOT_RE.test(c) ||
    FLAG_RE.test(c) ||
    SLOTS_FILLED_RE.test(c)
  );
}

function isTruthySlot(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '' && value !== false;
}

export function evaluateCondition(condition: string, caseData: CaseData): boolean {
  const c = condition.trim();
  const slots = caseData.workflow.slots;
  const mandatory = caseData.requirements.filter((r) => r.mandatory);
  const satisfied = mandatory.filter((r) => r.status === 'satisfied');

  if (c === 'always') return true;

  if (c === 'user_confirmed') {
    return slots._user_confirmed === true;
  }

  if (c === 'requirements_satisfied') {
    return mandatory.length > 0 && satisfied.length === mandatory.length;
  }

  if (c === 'requirements_pending') {
    return mandatory.length === 0 || satisfied.length < mandatory.length;
  }

  if (c === 'appointment_scheduled') {
    return caseData.appointments.some((a) => a.status === 'scheduled');
  }

  const slotsFilled = c.match(SLOTS_FILLED_RE);
  if (slotsFilled) {
    const names = slotsFilled[1].split(',').map((n) => n.trim()).filter(Boolean);
    return names.every((n) => isTruthySlot(slots[n]));
  }

  const readiness = c.match(READINESS_RE);
  if (readiness) {
    const [, op, rawValue] = readiness;
    const value = parseInt(rawValue, 10);
    const score = caseData.state.readinessScore;
    switch (op) {
      case '>=': return score >= value;
      case '<=': return score <= value;
      case '>': return score > value;
      case '<': return score < value;
      case '==': return score === value;
    }
  }

  const slotEq = c.match(SLOT_EQ_RE);
  if (slotEq) {
    const [, name, rawExpected] = slotEq;
    const expected = rawExpected.trim().replace(/^['"]|['"]$/g, '');
    return String(slots[name] ?? '') === expected;
  }

  const slot = c.match(SLOT_RE);
  if (slot) {
    return isTruthySlot(slots[slot[1]]);
  }

  const flag = c.match(FLAG_RE);
  if (flag) {
    return caseData.state.flags.includes(flag[1]);
  }

  return false;
}

export function getMatchingTransition(
  transitions: Array<{ to: string; when: string }> | undefined,
  caseData: CaseData
): string | null {
  for (const t of transitions ?? []) {
    if (evaluateCondition(t.when, caseData)) return t.to;
  }
  return null;
}
