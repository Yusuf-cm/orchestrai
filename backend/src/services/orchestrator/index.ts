import OpenAI from 'openai';
import type { CaseData } from '@waypoint/shared';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const GOV_KEYWORDS = ['lost', 'id', 'license', 'driver', 'wallet', 'stolen', 'replacement', 'dmv', 'california'];
const HEALTH_KEYWORDS = ['pain', 'hurt', 'ache', 'symptom', 'doctor', 'knee', 'back', 'shoulder', 'appointment', 'run'];

function fallbackClassify(utterance: string) {
  const lower = utterance.toLowerCase();
  const govScore = GOV_KEYWORDS.filter((k) => lower.includes(k)).length;
  const healthScore = HEALTH_KEYWORDS.filter((k) => lower.includes(k)).length;

  if (govScore >= healthScore && govScore > 0) {
    const entities: Record<string, unknown> = {};
    if (lower.includes('california') || lower.includes('ca ')) entities.state = 'CA';
    if (lower.includes('driver') || lower.includes('license')) entities.id_type = 'drivers_license';
    return {
      classifiedIntent: 'gov.id_replacement',
      confidence: Math.min(0.5 + govScore * 0.1, 0.9),
      domain: 'government' as const,
      extractedEntities: entities,
      rawUtterance: utterance,
    };
  }

  if (healthScore > 0) {
    const entities: Record<string, unknown> = {};
    if (lower.includes('knee')) entities.body_part = 'knee';
    const weekMatch = lower.match(/(\d+)\s*week/);
    if (weekMatch) entities.duration_weeks = parseInt(weekMatch[1], 10);
    return {
      classifiedIntent: 'health.find_care',
      confidence: Math.min(0.5 + healthScore * 0.1, 0.9),
      domain: 'healthcare' as const,
      extractedEntities: entities,
      rawUtterance: utterance,
    };
  }

  return {
    classifiedIntent: 'unknown',
    confidence: 0,
    domain: 'government' as const,
    extractedEntities: {},
    rawUtterance: utterance,
  };
}

export async function classifyIntentWithAI(utterance: string) {
  if (!openai) return fallbackClassify(utterance);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Classify user intent for a case management platform. Return JSON:
{
  "classifiedIntent": "gov.id_replacement" | "health.find_care" | "unknown",
  "confidence": 0.0-1.0,
  "domain": "government" | "healthcare",
  "extractedEntities": { ... }
}
For gov.id_replacement extract: state, id_type (drivers_license|state_id), is_us_citizen (boolean), zip_code
For health.find_care extract: symptom_description, duration_weeks, severity_1_10, body_part, insurance_carrier, zip_code`,
        },
        { role: 'user', content: utterance },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return fallbackClassify(utterance);
    const parsed = JSON.parse(content);
    return { ...parsed, rawUtterance: utterance };
  } catch {
    return fallbackClassify(utterance);
  }
}

export async function generateClarification(caseData: CaseData, userMessage: string): Promise<string> {
  if (!openai) {
    return `I understand you're asking about "${userMessage}". Check the requirements checklist for details. This is guidance only — verify with the official source.`;
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `You are Waypoint, a case assistant. Explain requirements in plain language. Never diagnose medical conditions. Never invent requirements not in the case data. Always say to verify with official sources for government matters.`,
        },
        {
          role: 'user',
          content: `Case: ${caseData.title}\nDomain: ${caseData.domain}\nRequirements: ${JSON.stringify(caseData.requirements.map((r) => r.label))}\nUser question: ${userMessage}`,
        },
      ],
      max_tokens: 300,
    });
    return response.choices[0]?.message?.content ?? 'I can help clarify your case requirements. What would you like to know?';
  } catch {
    return 'I can help clarify your case requirements. What would you like to know?';
  }
}

export async function explainNextAction(caseData: CaseData, stepTitle?: string): Promise<string> {
  const step = stepTitle ?? caseData.workflow.currentStepId;
  const readiness = caseData.state.readinessScore;
  return `For your case "${caseData.title}", you are ${readiness}% ready. Current step: ${step}. ${caseData.state.blockers.length > 0 ? `Still needed: ${caseData.state.blockers.map((b) => b.reason).join(', ')}.` : 'You may be ready for your next action.'}`;
}
