export const RED_FLAG_SYMPTOMS = [
  'chest pain',
  'difficulty breathing',
  'can\'t breathe',
  'cannot breathe',
  'sudden severe headache',
  'loss of consciousness',
  'passed out',
  'stroke',
  'face drooping',
  'slurred speech',
  'numbness on one side',
  'fever with hot swollen joint',
];

export const MOCK_PROVIDERS = [
  {
    id: 'prov-patel',
    name: 'Dr. Anika Patel, MD',
    specialty: 'Family Medicine',
    distance: '1.2 mi',
    acceptingNewPatients: true,
    rating: 4.8,
    address: '1240 Wilshire Blvd, Los Angeles, CA 90017',
    phone: '(213) 555-0142',
    inNetwork: true,
  },
  {
    id: 'prov-chen',
    name: 'Dr. Michael Chen, MD',
    specialty: 'Sports Medicine',
    distance: '2.4 mi',
    acceptingNewPatients: true,
    rating: 4.6,
    address: '8500 Beverly Blvd, Los Angeles, CA 90048',
    phone: '(310) 555-0198',
    inNetwork: true,
  },
  {
    id: 'prov-rivera',
    name: 'Dr. Sofia Rivera, DO',
    specialty: 'Internal Medicine',
    distance: '3.1 mi',
    acceptingNewPatients: false,
    rating: 4.9,
    address: '4567 Sunset Blvd, Los Angeles, CA 90027',
    phone: '(323) 555-0167',
    inNetwork: true,
  },
  {
    id: 'prov-kim',
    name: 'Dr. James Kim, MD',
    specialty: 'Orthopedics',
    distance: '4.5 mi',
    acceptingNewPatients: true,
    rating: 4.7,
    address: '200 Medical Plaza, Los Angeles, CA 90095',
    phone: '(310) 555-0133',
    inNetwork: false,
  },
  {
    id: 'prov-williams',
    name: 'Dr. Lisa Williams, NP',
    specialty: 'Urgent Care',
    distance: '0.8 mi',
    acceptingNewPatients: true,
    rating: 4.4,
    address: '789 Vermont Ave, Los Angeles, CA 90005',
    phone: '(213) 555-0189',
    inNetwork: true,
  },
];

export const healthMockConnector = {
  id: 'health-mock',
  institutionId: 'health-mock',
  adapterId: 'health-adapter-v1',
  name: 'LA Health Network (Demo)',

  getProviders(zip: string, insurance?: string) {
    return MOCK_PROVIDERS.filter((p) => {
      if (insurance && !p.inNetwork) return false;
      return true;
    });
  },

  triage(symptoms: string, severity: number, durationWeeks: number): {
    careLevel: 'self_care' | 'primary_care' | 'urgent_care' | 'emergency';
    recommendation: string;
    flags: string[];
  } {
    const lower = symptoms.toLowerCase();
    const flags: string[] = [];

    for (const flag of RED_FLAG_SYMPTOMS) {
      if (lower.includes(flag)) {
        return {
          careLevel: 'emergency',
          recommendation: 'Seek emergency care immediately. Call 911 or go to the nearest emergency room.',
          flags: ['emergency_detected', flag],
        };
      }
    }

    if (severity >= 8 || durationWeeks >= 6) {
      flags.push('elevated_severity');
      return {
        careLevel: 'urgent_care',
        recommendation: 'Consider urgent care or schedule a primary care visit within 48 hours.',
        flags,
      };
    }

    if (severity >= 4 || durationWeeks >= 2) {
      return {
        careLevel: 'primary_care',
        recommendation: 'Schedule a visit with your primary care provider. They can evaluate your symptoms and refer you to a specialist if needed.',
        flags: ['musculoskeletal', 'primary_care_recommended'],
      };
    }

    return {
      careLevel: 'self_care',
      recommendation: 'Try rest, ice, and over-the-counter pain relief. If symptoms persist beyond 2 weeks, schedule a primary care visit.',
      flags: ['self_care_appropriate'],
    };
  },
};
