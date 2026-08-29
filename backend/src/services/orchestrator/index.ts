import OpenAI from 'openai';
import type { CaseData, Domain, IntentResult, Language } from '@waypoint/shared';

/**
 * AI orchestrator.
 *
 * The language model reads and writes language: it classifies intent, pulls
 * entities out of a sentence, and explains institutional wording in plain
 * terms. It never decides what happens next. Workflow position, requirement
 * status, readiness, and triage are computed by the engine, the adapters, and
 * explicit rules, so behaviour stays the same whether or not a key is
 * configured.
 */

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    })
  : null;

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

export function isAiConfigured(): boolean {
  return openai !== null;
}

const GOV_KEYWORDS = [
  'lost', 'id', 'identity', 'kitambulisho', 'national id', 'card', 'stolen',
  'replace', 'replacement', 'ecitizen', 'huduma', 'nimepoteza', 'registrar',
];

const HEALTH_KEYWORDS = [
  'pain', 'hurt', 'hurting', 'ache', 'sick', 'symptom', 'doctor', 'hospital',
  'clinic', 'knee', 'back', 'chest', 'stomach', 'fever', 'cough', 'maumivu',
  'mgonjwa', 'daktari', 'hospitali', 'sha', 'nhif',
];

const COUNTIES = ['nairobi', 'mombasa', 'kisumu', 'nakuru', 'eldoret', 'kiambu', 'machakos', 'nyeri'];

function extractShared(lower: string): Record<string, unknown> {
  const entities: Record<string, unknown> = {};

  for (const county of COUNTIES) {
    if (lower.includes(county)) {
      entities.county = county.charAt(0).toUpperCase() + county.slice(1);
      break;
    }
  }

  const weeks = lower.match(/(\d+)\s*(week|wiki)/);
  const months = lower.match(/(\d+)\s*(month|mwezi|miezi)/);
  const days = lower.match(/(\d+)\s*(day|siku)/);
  if (weeks) entities.duration_days = parseInt(weeks[1], 10) * 7;
  else if (months) entities.duration_days = parseInt(months[1], 10) * 30;
  else if (days) entities.duration_days = parseInt(days[1], 10);

  return entities;
}

/**
 * Keyword classifier. This is the baseline path, not a degraded one — the demo
 * behaves identically without an OpenAI key.
 */
export function classifyByKeyword(utterance: string): IntentResult {
  const lower = utterance.toLowerCase();
  const govScore = GOV_KEYWORDS.filter((k) => lower.includes(k)).length;
  const healthScore = HEALTH_KEYWORDS.filter((k) => lower.includes(k)).length;
  const shared = extractShared(lower);

  if (govScore > 0 && govScore >= healthScore) {
    return {
      classifiedIntent: 'gov.id_replacement',
      confidence: Math.min(0.5 + govScore * 0.1, 0.9),
      domain: 'government',
      extractedEntities: shared,
      rawUtterance: utterance,
    };
  }

  if (healthScore > 0) {
    return {
      classifiedIntent: 'health.find_care',
      confidence: Math.min(0.5 + healthScore * 0.1, 0.9),
      domain: 'healthcare',
      extractedEntities: { ...shared, symptom_description: utterance },
      rawUtterance: utterance,
    };
  }

  return {
    classifiedIntent: 'unknown',
    confidence: 0,
    domain: 'government',
    extractedEntities: {},
    rawUtterance: utterance,
  };
}

const INTENT_SCHEMA_PROMPT = `You classify what a person in Kenya is trying to accomplish with an institution.

Return JSON only:
{
  "classifiedIntent": "gov.id_replacement" | "health.find_care" | "unknown",
  "confidence": number between 0 and 1,
  "domain": "government" | "healthcare",
  "extractedEntities": object
}

gov.id_replacement covers replacing a lost or stolen Kenyan national ID.
Entities: county (string), has_id_number (boolean), has_police_abstract (boolean)

health.find_care covers someone with symptoms who needs to know where to seek care.
Entities: symptom_description (string), duration_days (number), severity_1_10 (number), county (string), has_sha_cover (boolean)

Input may be English, Kiswahili, or a mix. Use "unknown" if it fits neither.
Do not infer a medical diagnosis. Only extract what the person said.`;

export async function classifyIntentWithAI(utterance: string): Promise<IntentResult> {
  const keyword = classifyByKeyword(utterance);
  if (!openai) return keyword;

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: INTENT_SCHEMA_PROMPT },
        { role: 'user', content: utterance },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return keyword;

    const parsed = JSON.parse(content) as Partial<IntentResult>;
    if (!parsed.classifiedIntent || parsed.classifiedIntent === 'unknown') return keyword;

    return {
      classifiedIntent: parsed.classifiedIntent,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
      domain: (parsed.domain as Domain) ?? keyword.domain,
      // Keyword extraction is deterministic, so it wins where both found a value.
      extractedEntities: { ...parsed.extractedEntities, ...keyword.extractedEntities },
      rawUtterance: utterance,
    };
  } catch (err) {
    console.warn('[orchestrator] falling back to keyword classification:', err instanceof Error ? err.message : err);
    return keyword;
  }
}

const CLARIFY_SYSTEM = `You are Waypoint, helping someone in Kenya deal with a government or health institution.

Rules:
- Explain only what is in the case data you are given. Never invent a requirement, fee, office, or document.
- If you do not know, say so and point to the official source.
- Never diagnose a medical condition or recommend treatment. You may explain what a level of facility does.
- Keep answers under 80 words. Plain language. No lists unless asked.
- Reply in the language the person used. Kiswahili if they wrote Kiswahili.`;

export async function generateClarification(
  caseData: CaseData,
  userMessage: string
): Promise<{ reply: string; source: 'ai' | 'fallback' }> {
  if (!openai) {
    const outstanding = caseData.state.blockers.map((b) => b.reason);
    return {
      source: 'fallback',
      reply: outstanding.length
        ? `Still outstanding: ${outstanding.join(', ')}. Open the Requirements tab for what each item means and where it came from.`
        : 'Everything on your checklist is done. The next action card shows what to do now.',
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      max_tokens: 220,
      messages: [
        { role: 'system', content: CLARIFY_SYSTEM },
        {
          role: 'user',
          content: [
            `Case: ${caseData.title}`,
            `Institution: ${caseData.institution.name}`,
            `Current step: ${caseData.workflow.currentStepId}`,
            `Requirements: ${JSON.stringify(
              caseData.requirements.map((r) => ({
                label: r.label,
                status: r.status,
                source: r.verificationStatus,
                detail: r.description,
              }))
            )}`,
            `Outstanding: ${JSON.stringify(caseData.state.blockers.map((b) => b.reason))}`,
            '',
            `Question: ${userMessage}`,
          ].join('\n'),
        },
      ],
    });

    const reply = response.choices[0]?.message?.content?.trim();
    if (!reply) throw new Error('empty completion');
    return { reply, source: 'ai' };
  } catch (err) {
    console.warn('[orchestrator] clarification failed:', err instanceof Error ? err.message : err);
    return {
      source: 'fallback',
      reply: 'I could not reach the language model just now. The Requirements tab lists every item and its source.',
    };
  }
}

const SPOKEN_LABELS: Record<Language, {
  ready: (n: number) => string;
  outstanding: (items: string[]) => string;
  step: (title: string) => string;
}> = {
  en: {
    ready: (n) => `You are ${n} percent ready.`,
    outstanding: (items) => `Still needed: ${items.join(', ')}.`,
    step: (title) => `Next: ${title}.`,
  },
  sw: {
    ready: (n) => `Umekamilisha asilimia ${n}.`,
    outstanding: (items) => `Bado unahitaji: ${items.join(', ')}.`,
    step: (title) => `Hatua inayofuata: ${title}.`,
  },
};

/**
 * Builds the sentence spoken aloud for a case. Deterministic so the audio cache
 * stays warm and the wording never drifts mid-demo.
 */
export function buildSpokenSummary(
  caseData: CaseData,
  stepTitle: string | undefined,
  language: Language = 'en'
): string {
  const labels = SPOKEN_LABELS[language] ?? SPOKEN_LABELS.en;
  const parts = [labels.ready(caseData.state.readinessScore)];

  if (stepTitle) parts.push(labels.step(stepTitle));

  const outstanding = caseData.state.blockers.slice(0, 3).map((b) => b.reason);
  if (outstanding.length) parts.push(labels.outstanding(outstanding));

  return parts.join(' ');
}
