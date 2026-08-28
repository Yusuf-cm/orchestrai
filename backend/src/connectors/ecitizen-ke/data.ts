/**
 * eCitizen / National Registration Bureau connector — replacement of a lost
 * Kenyan national ID card (kitambulisho).
 *
 * Requirement data is hand-curated and carries a verification status so the UI
 * can be honest about what is officially documented versus what applicants
 * commonly report at Huduma Centres. Nothing here should be presented to a user
 * without its source.
 */

export const ECITIZEN_EVIDENCE = [
  {
    id: 'ev_ecitizen_portal',
    sourceUrl: 'https://accounts.ecitizen.go.ke',
    sourceLabel: 'eCitizen — Government of Kenya services portal',
    verificationStatus: 'official' as const,
    lastVerified: '2026-08-01',
  },
  {
    id: 'ev_nrb_replacement',
    sourceUrl: 'https://www.ecitizen.go.ke',
    sourceLabel: 'National Registration Bureau — ID replacement service',
    verificationStatus: 'official' as const,
    lastVerified: '2026-08-01',
  },
  {
    id: 'ev_police_abstract',
    sourceUrl: 'https://www.nationalpolice.go.ke',
    sourceLabel: 'National Police Service — loss report / abstract',
    verificationStatus: 'official' as const,
    lastVerified: '2026-08-01',
  },
  {
    id: 'ev_huduma',
    sourceUrl: 'https://www.hudumakenya.go.ke',
    sourceLabel: 'Huduma Kenya — service centres',
    verificationStatus: 'official' as const,
    lastVerified: '2026-08-01',
  },
  {
    id: 'ev_community_reported',
    sourceLabel: 'Commonly reported by applicants at Huduma Centres',
    verificationStatus: 'commonly_reported' as const,
    lastVerified: '2026-08-20',
  },
];

export const ECITIZEN_ID_REQUIREMENTS = [
  {
    id: 'req_police_abstract',
    label: 'Police abstract for the lost ID',
    description:
      'Report the loss at any police station and obtain an abstract with an OB number. This is the step most people miss and it is the usual reason an application is turned away.',
    category: 'document' as const,
    mandatory: true,
    acceptableDocuments: ['Police abstract showing OB number'],
    evidenceId: 'ev_police_abstract',
  },
  {
    id: 'req_birth_certificate',
    label: 'Birth certificate',
    description: 'Original or certified copy. Used to confirm your registered particulars.',
    category: 'document' as const,
    mandatory: true,
    acceptableDocuments: ['Birth certificate', 'Certified copy of birth certificate'],
    evidenceId: 'ev_nrb_replacement',
  },
  {
    id: 'req_id_number',
    label: 'Your existing ID number',
    description:
      'The number of the lost card. If you do not have it, the registrar can search using your birth particulars, but this takes longer.',
    category: 'information' as const,
    mandatory: true,
    acceptableDocuments: ['Photocopy of the lost ID', 'Written ID number'],
    evidenceId: 'ev_nrb_replacement',
  },
  {
    id: 'req_parent_details',
    label: "Parent's ID details",
    description:
      "Your father's or mother's ID number, or their birth certificate details, for verification.",
    category: 'information' as const,
    mandatory: true,
    acceptableDocuments: ["Parent's ID copy", "Parent's birth certificate"],
    evidenceId: 'ev_community_reported',
  },
  {
    id: 'req_replacement_fee',
    label: 'Replacement fee (KES 1,000)',
    description:
      'Paid through eCitizen. M-Pesa, card, and bank options are available on the payment page.',
    category: 'fee' as const,
    mandatory: true,
    acceptableDocuments: [],
    evidenceId: 'ev_ecitizen_portal',
  },
  {
    id: 'req_ecitizen_account',
    label: 'eCitizen account',
    description:
      'Applications are submitted through eCitizen. You will need a registered account and access to the phone number linked to it.',
    category: 'action' as const,
    mandatory: true,
    acceptableDocuments: [],
    evidenceId: 'ev_ecitizen_portal',
  },
  {
    id: 'req_passport_photo',
    label: 'Passport-size photograph',
    description:
      'Some centres capture your photo on site; others ask you to bring one. Carrying a recent photo avoids a second trip.',
    category: 'document' as const,
    mandatory: false,
    acceptableDocuments: ['Recent passport-size photograph'],
    evidenceId: 'ev_community_reported',
  },
];

export const HUDUMA_CENTRES = [
  {
    id: 'huduma-gpo',
    name: 'Huduma Centre — Nairobi GPO',
    address: 'General Post Office, Kenyatta Avenue',
    city: 'Nairobi',
    county: 'Nairobi',
    hours: 'Mon–Fri 7:00am–7:00pm, Sat 9:00am–1:00pm',
    phone: '020 6900020',
    services: ['ID replacement', 'Birth certificate', 'SHA registration'],
  },
  {
    id: 'huduma-city-square',
    name: 'Huduma Centre — City Square',
    address: 'Bishops Road, Community',
    city: 'Nairobi',
    county: 'Nairobi',
    hours: 'Mon–Fri 7:00am–7:00pm',
    phone: '020 6900020',
    services: ['ID replacement', 'Passport', 'SHA registration'],
  },
  {
    id: 'huduma-makadara',
    name: 'Huduma Centre — Makadara',
    address: 'Makadara Law Courts Road',
    city: 'Nairobi',
    county: 'Nairobi',
    hours: 'Mon–Fri 7:00am–5:00pm',
    phone: '020 6900020',
    services: ['ID replacement', 'Birth certificate'],
  },
  {
    id: 'huduma-mombasa',
    name: 'Huduma Centre — Mombasa',
    address: 'Treasury Square',
    city: 'Mombasa',
    county: 'Mombasa',
    hours: 'Mon–Fri 8:00am–5:00pm',
    phone: '041 2319000',
    services: ['ID replacement', 'Birth certificate', 'SHA registration'],
  },
  {
    id: 'huduma-kisumu',
    name: 'Huduma Centre — Kisumu',
    address: 'Prosperity House, Oginga Odinga Street',
    city: 'Kisumu',
    county: 'Kisumu',
    hours: 'Mon–Fri 8:00am–5:00pm',
    phone: '057 2020000',
    services: ['ID replacement', 'SHA registration'],
  },
  {
    id: 'huduma-nakuru',
    name: 'Huduma Centre — Nakuru',
    address: 'Nakuru Town, Kenyatta Avenue',
    city: 'Nakuru',
    county: 'Nakuru',
    hours: 'Mon–Fri 8:00am–5:00pm',
    phone: '051 2210000',
    services: ['ID replacement', 'Birth certificate'],
  },
  {
    id: 'huduma-eldoret',
    name: 'Huduma Centre — Eldoret',
    address: 'Uasin Gishu County Offices',
    city: 'Eldoret',
    county: 'Uasin Gishu',
    hours: 'Mon–Fri 8:00am–5:00pm',
    phone: '053 2033000',
    services: ['ID replacement', 'SHA registration'],
  },
];

const COUNTY_ALIASES: Record<string, string> = {
  nairobi: 'Nairobi',
  mombasa: 'Mombasa',
  kisumu: 'Kisumu',
  nakuru: 'Nakuru',
  eldoret: 'Uasin Gishu',
  'uasin gishu': 'Uasin Gishu',
};

export const ecitizenConnector = {
  id: 'ecitizen-ke',
  institutionId: 'ecitizen-ke',
  adapterId: 'gov-adapter-v1',
  name: 'eCitizen — National Registration Bureau',

  getServices() {
    return [
      {
        id: 'id-replacement',
        name: 'Replace a lost national ID',
        officialUrl: 'https://accounts.ecitizen.go.ke',
      },
    ];
  },

  getRequirements(_serviceId: string, context: Record<string, unknown>) {
    const requirements = [...ECITIZEN_ID_REQUIREMENTS];

    // Applicants who still have the old ID number skip the slower particulars search.
    if (context.has_id_number === false) {
      return requirements.map((r) =>
        r.id === 'req_id_number'
          ? {
              ...r,
              label: 'Registered particulars for a records search',
              description:
                'Without the old ID number the registrar searches by your birth particulars. Bring your birth certificate and, if possible, a parent\u2019s ID.',
            }
          : r
      );
    }

    return requirements;
  },

  getCentres(county?: string) {
    if (!county) return HUDUMA_CENTRES;
    const normalised = COUNTY_ALIASES[county.trim().toLowerCase()] ?? county;
    const matches = HUDUMA_CENTRES.filter(
      (c) => c.county.toLowerCase() === normalised.toLowerCase()
    );
    return matches.length > 0 ? matches : HUDUMA_CENTRES.slice(0, 3);
  },

  getFees() {
    return [
      { label: 'Lost ID replacement', amount: 1000, currency: 'KES' },
    ];
  },

  getPaymentOptions() {
    return {
      channel: 'eCitizen',
      methods: ['M-Pesa', 'Airtel Money', 'Debit/credit card', 'Bank transfer'],
      note: 'Pay inside eCitizen after submitting the application so the payment attaches to your reference number.',
    };
  },

  getEvidence() {
    return ECITIZEN_EVIDENCE;
  },
};
