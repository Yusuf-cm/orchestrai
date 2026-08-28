export const DMV_CA_REQUIREMENTS = [
  {
    id: 'req_primary_id',
    label: 'Primary identity document',
    description: 'Original or certified copy of birth certificate, valid passport, or permanent resident card',
    category: 'document' as const,
    acceptableDocuments: ['Birth certificate', 'US Passport', 'Permanent resident card'],
    evidenceId: 'ev_primary_id',
  },
  {
    id: 'req_residency_1',
    label: 'Proof of residency (1 of 2)',
    description: 'Document showing your California address',
    category: 'document' as const,
    acceptableDocuments: ['Utility bill', 'Bank statement', 'Rental agreement', 'Mortgage statement'],
    evidenceId: 'ev_residency',
  },
  {
    id: 'req_residency_2',
    label: 'Proof of residency (2 of 2)',
    description: 'Second document showing your California address (must be different type)',
    category: 'document' as const,
    acceptableDocuments: ['Utility bill', 'Bank statement', 'Rental agreement', 'Mortgage statement'],
    evidenceId: 'ev_residency',
  },
  {
    id: 'req_application_fee',
    label: 'DMV application fee ($38)',
    description: 'Payment accepted at DMV office: cash, check, debit, or credit',
    category: 'fee' as const,
    acceptableDocuments: [],
    evidenceId: 'ev_fee',
  },
  {
    id: 'req_ssn_verification',
    label: 'Social Security verification',
    description: 'DMV may verify SSN electronically; bring SSN card if you have one',
    category: 'document' as const,
    acceptableDocuments: ['Social Security card', 'W-2', 'Pay stub with SSN'],
    evidenceId: 'ev_ssn',
    verificationOverride: 'commonly_reported' as const,
  },
];

export const DMV_CA_EVIDENCE = [
  {
    id: 'ev_primary_id',
    sourceUrl: 'https://www.dmv.ca.gov/portal/driver-licenses-identification-cards/real-id/real-id-req/',
    sourceLabel: 'California DMV — REAL ID Requirements',
    verificationStatus: 'official' as const,
    lastVerified: '2026-01-15',
  },
  {
    id: 'ev_residency',
    sourceUrl: 'https://www.dmv.ca.gov/portal/driver-licenses-identification-cards/real-id/real-id-req/',
    sourceLabel: 'California DMV — Residency Documents',
    verificationStatus: 'official' as const,
    lastVerified: '2026-01-15',
  },
  {
    id: 'ev_fee',
    sourceUrl: 'https://www.dmv.ca.gov/portal/vehicle-registration/registration-fees/',
    sourceLabel: 'California DMV — Fee Schedule',
    verificationStatus: 'official' as const,
    lastVerified: '2026-01-15',
  },
  {
    id: 'ev_ssn',
    sourceUrl: 'https://www.dmv.ca.gov/portal/driver-licenses-identification-cards/',
    sourceLabel: 'California DMV — Driver License Application',
    verificationStatus: 'commonly_reported' as const,
    lastVerified: '2026-01-10',
  },
];

export const DMV_CA_OFFICES = [
  {
    id: 'dmv-beverly-hills',
    name: 'DMV — Beverly Hills',
    address: '8030 Beverly Blvd',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90048',
    hours: 'Mon-Fri 8am-5pm, Sat 8am-12pm',
    phone: '(800) 777-0133',
  },
  {
    id: 'dmv-santa-monica',
    name: 'DMV — Santa Monica',
    address: '2236 Cotner Ave',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90064',
    hours: 'Mon-Fri 8am-5pm',
    phone: '(800) 777-0133',
  },
  {
    id: 'dmv-glendale',
    name: 'DMV — Glendale',
    address: '501 S Brand Blvd',
    city: 'Glendale',
    state: 'CA',
    zip: '91204',
    hours: 'Mon-Fri 8am-5pm, Sat 8am-12pm',
    phone: '(800) 777-0133',
  },
];

export const dmvCaConnector = {
  id: 'dmv-ca',
  institutionId: 'dmv-ca',
  adapterId: 'gov-adapter-v1',
  name: 'California Department of Motor Vehicles',

  getServices() {
    return [
      { id: 'id-replacement', name: 'Replace Lost Driver License/ID', officialUrl: 'https://www.dmv.ca.gov/portal/driver-licenses-identification-cards/' },
    ];
  },

  getRequirements(_serviceId: string, context: Record<string, unknown>) {
    const reqs = [...DMV_CA_REQUIREMENTS];
    if (context.is_us_citizen === false) {
      reqs.push({
        id: 'req_immigration_docs',
        label: 'Immigration documents',
        description: 'Valid immigration documents proving legal presence',
        category: 'document' as const,
        acceptableDocuments: ['I-94', 'Green card', 'Employment authorization'],
        evidenceId: 'ev_primary_id',
      });
    }
    return reqs;
  },

  getLocations(zip: string) {
    const prefix = zip?.slice(0, 3) ?? '900';
    if (prefix.startsWith('90') || prefix.startsWith('91')) {
      return DMV_CA_OFFICES;
    }
    return DMV_CA_OFFICES.slice(0, 1);
  },

  getFees() {
    return [{ label: 'Driver license replacement', amount: 38, currency: 'USD' }];
  },

  getEvidence() {
    return DMV_CA_EVIDENCE;
  },
};
