/**
 * Kenyan health system connector — SHA cover and care-level navigation.
 *
 * The product goal is to route a person to the correct level of care. Going
 * straight to a national referral hospital for something a health centre
 * handles costs a whole day in a queue, so the recommendation is deliberate
 * and rule-based rather than generated.
 */

export const RED_FLAG_SYMPTOMS = [
  'chest pain',
  'chest tightness',
  'difficulty breathing',
  'cannot breathe',
  "can't breathe",
  'struggling to breathe',
  'severe bleeding',
  'bleeding heavily',
  'unconscious',
  'passed out',
  'fainted',
  'seizure',
  'convulsion',
  'stiff neck with fever',
  'sudden severe headache',
  'face drooping',
  'slurred speech',
  'weakness on one side',
  'cannot move one side',
  'poisoning',
  'snake bite',
  'severe burns',
  'coughing blood',
  'vomiting blood',
];

/** Kiswahili phrasing for the same emergencies, since intake is voice-first. */
export const RED_FLAG_SYMPTOMS_SW = [
  'maumivu ya kifua',
  'kifua kinauma',
  'shida ya kupumua',
  'siwezi kupumua',
  'kutokwa damu nyingi',
  'kupoteza fahamu',
  'kifafa',
  'kutapika damu',
  'kukohoa damu',
];

export const CARE_LEVELS = {
  level_2_3: {
    id: 'level_2_3',
    label: 'Dispensary or health centre (Level 2–3)',
    description:
      'Nearest facility for common illnesses, minor injuries, and first assessment. Shortest queues and usually walking distance.',
    typicalWait: 'Under an hour',
  },
  level_4: {
    id: 'level_4',
    label: 'Sub-county hospital (Level 4)',
    description:
      'General outpatient and inpatient care, basic imaging, and laboratory services. Where a health centre refers you for further assessment.',
    typicalWait: '1–3 hours',
  },
  level_5: {
    id: 'level_5',
    label: 'County referral hospital (Level 5)',
    description:
      'Specialist clinics and surgery. Best reached with a referral letter, otherwise the queue is long.',
    typicalWait: 'Half a day',
  },
  emergency: {
    id: 'emergency',
    label: 'Emergency — go now',
    description: 'Nearest accident and emergency department. Do not wait for an appointment.',
    typicalWait: 'Immediate',
  },
} as const;

export const KE_FACILITIES = [
  {
    id: 'fac-langata-hc',
    name: 'Lang\u2019ata Health Centre',
    level: 'level_2_3',
    county: 'Nairobi',
    address: 'Lang\u2019ata Road, Nairobi',
    distance: '1.4 km',
    shaAccredited: true,
    openNow: true,
    services: ['Outpatient', 'Laboratory', 'Maternal health'],
  },
  {
    id: 'fac-mbagathi',
    name: 'Mbagathi County Hospital',
    level: 'level_4',
    county: 'Nairobi',
    address: 'Mbagathi Way, Nairobi',
    distance: '3.2 km',
    shaAccredited: true,
    openNow: true,
    services: ['Outpatient', 'X-ray', 'Orthopaedics', 'Inpatient'],
  },
  {
    id: 'fac-mama-lucy',
    name: 'Mama Lucy Kibaki Hospital',
    level: 'level_4',
    county: 'Nairobi',
    address: 'Kangundo Road, Embakasi',
    distance: '6.8 km',
    shaAccredited: true,
    openNow: true,
    services: ['Outpatient', 'Emergency', 'Physiotherapy'],
  },
  {
    id: 'fac-knh',
    name: 'Kenyatta National Hospital',
    level: 'level_5',
    county: 'Nairobi',
    address: 'Hospital Road, Upper Hill',
    distance: '4.1 km',
    shaAccredited: true,
    openNow: true,
    services: ['Specialist clinics', 'Surgery', 'Emergency', 'Imaging'],
  },
  {
    id: 'fac-kiambu-l4',
    name: 'Kiambu Level 4 Hospital',
    level: 'level_4',
    county: 'Kiambu',
    address: 'Kiambu Town',
    distance: '12.5 km',
    shaAccredited: true,
    openNow: false,
    services: ['Outpatient', 'Laboratory', 'Inpatient'],
  },
];

export const shaHealthConnector = {
  id: 'sha-health-ke',
  institutionId: 'sha-health-ke',
  adapterId: 'health-adapter-v1',
  name: 'Social Health Authority (SHA) & county facilities',

  getRegistrationGuidance() {
    return {
      channels: [
        { label: 'USSD', value: '*147#', note: 'Works on any phone, no internet needed' },
        { label: 'Afya Yangu portal', value: 'https://afyayangu.go.ke' },
        { label: 'Huduma Centre', value: 'In person, bring your national ID' },
      ],
      requirements: ['National ID number', 'Phone number registered in your name'],
      verificationStatus: 'official' as const,
      sourceUrl: 'https://sha.go.ke',
      sourceLabel: 'Social Health Authority',
    };
  },

  /**
   * Rule-based triage. Deterministic by design: an emergency must never depend
   * on a language model's judgement.
   */
  triage(
    symptoms: string,
    severity: number,
    durationDays: number
  ): {
    careLevel: keyof typeof CARE_LEVELS;
    recommendation: string;
    flags: string[];
    matchedRedFlag?: string;
  } {
    const text = symptoms.toLowerCase();

    for (const flag of [...RED_FLAG_SYMPTOMS, ...RED_FLAG_SYMPTOMS_SW]) {
      if (text.includes(flag)) {
        return {
          careLevel: 'emergency',
          recommendation:
            'These symptoms need emergency care now. Go to the nearest accident and emergency department, or call 999 / 112.',
          flags: ['emergency_detected'],
          matchedRedFlag: flag,
        };
      }
    }

    if (severity >= 8) {
      return {
        careLevel: 'level_4',
        recommendation:
          'Pain at this level should be assessed today at a sub-county hospital, where imaging and laboratory tests are available.',
        flags: ['high_severity'],
      };
    }

    if (durationDays >= 42 || severity >= 6) {
      return {
        careLevel: 'level_4',
        recommendation:
          'This has gone on long enough to need proper assessment. A sub-county hospital can examine you, run tests, and refer you to a specialist if necessary.',
        flags: ['persistent_symptoms'],
      };
    }

    if (durationDays >= 14) {
      return {
        careLevel: 'level_2_3',
        recommendation:
          'Start at your nearest health centre. They can examine you and refer you upward if needed, which is faster than queueing at a referral hospital without a letter.',
        flags: ['start_at_primary'],
      };
    }

    return {
      careLevel: 'level_2_3',
      recommendation:
        'Your nearest dispensary or health centre can handle this. If it has not improved in two weeks, go back and ask for a referral.',
      flags: ['start_at_primary'],
    };
  },

  getFacilities(county: string | undefined, careLevel: keyof typeof CARE_LEVELS) {
    const targetLevel = careLevel === 'emergency' ? 'level_5' : careLevel;
    const normalised = (county ?? 'Nairobi').trim().toLowerCase();

    const inCounty = KE_FACILITIES.filter((f) => f.county.toLowerCase() === normalised);
    const pool = inCounty.length > 0 ? inCounty : KE_FACILITIES;

    const atLevel = pool.filter((f) => f.level === targetLevel);
    const nearby = pool.filter((f) => f.level !== targetLevel);

    return [...atLevel, ...nearby].slice(0, 4);
  },

  getVisitChecklist(hasShaCover: boolean) {
    const base = [
      'National ID (or waiting card)',
      'Any previous prescriptions or test results',
      'A note of when symptoms started and what makes them worse',
      'Money for transport and any items not covered',
    ];
    if (!hasShaCover) {
      base.unshift('Register for SHA on *147# before you go — it changes what you pay');
    } else {
      base.unshift('Your SHA number');
    }
    return base;
  },
};
