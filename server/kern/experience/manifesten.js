/* De vier World Manifests. Dit is productconfiguratie, geen domeinwaarheid:
   geen boeking, betaling, persoon of taak wordt hier opgeslagen. */
'use strict';

const { valideerManifest, diepBevries } = require('./contract');

const LIJST = [
  {
    id: 'living', version: 1, name: 'LivingOS', mentalModel: 'feed',
    primaryObjects: ['moment', 'person', 'commitment', 'payment'],
    contextTypes: ['person', 'household'],
    home: { projection: 'living.today.v1', emptyState: 'Uw dag staat rustig klaar.' },
    attention: { reasons: ['relationship', 'time', 'money', 'home', 'safety'] },
    navigation: { slots: 4, defaults: ['today', 'social', 'people', 'money'], optionalSlots: 1 },
    rahul: { role: 'personal_concierge', directExecution: false },
    experience: { density: 'low', theme: 'human', composition: 'stream' },
    governance: {
      prohibit: ['human_scoring', 'relationship_scoring', 'engagement_optimization',
        'autonomous_message', 'autonomous_payment'],
      recommendationObjectives: ['direct_relationship', 'temporal_relevance',
        'explicit_interest', 'actionable_utility', 'trusted_discovery']
    }
  },
  {
    id: 'travel', version: 1, name: 'TravelOS', mentalModel: 'journey',
    primaryObjects: ['journey', 'leg', 'booking', 'place'],
    contextTypes: ['journey', 'destination', 'local_area'],
    home: { projection: 'travel.journey-home.v1', emptyState: 'Plan een reis wanneer u daar klaar voor bent.' },
    attention: { reasons: ['departure', 'disruption', 'check_in', 'transfer', 'booking_change'] },
    navigation: { slots: 4, defaults: ['journey', 'discover', 'trips', 'bookings'], optionalSlots: 0 },
    rahul: { role: 'travel_operator', directExecution: false },
    experience: { density: 'medium', theme: 'spatial', composition: 'timeline_map' },
    governance: { prohibit: ['booking_duplication', 'silent_source_correction',
      'issuer_barcode_replacement', 'autonomous_financial_commitment'] }
  },
  {
    id: 'work', version: 1, name: 'WorkOS', mentalModel: 'workspace',
    primaryObjects: ['work_item', 'operation', 'incident', 'organization'],
    contextTypes: ['workspace', 'organization', 'location', 'team', 'role'],
    home: { projection: 'work.operations-pulse.v1', emptyState: 'Er staat niets open.' },
    attention: { reasons: ['operational', 'financial', 'staffing', 'compliance', 'incident'] },
    navigation: { slots: 4, defaults: ['home', 'operations', 'work', 'control'], optionalSlots: 1 },
    rahul: { role: 'professional_copilot', directExecution: false },
    experience: { density: 'high', theme: 'precise', composition: 'command_workspace' },
    governance: { prohibit: ['authority_inference', 'unlogged_mutation',
      'cross_organization_projection', 'ai_legal_authority'] }
  },
  {
    id: 'foundation', version: 1, name: 'FoundationOS', mentalModel: 'progress',
    primaryObjects: ['goal', 'case', 'next_step', 'achievement'],
    contextTypes: ['participant', 'program', 'case'],
    home: { projection: 'foundation.next-step.v1', emptyState: 'Uw mogelijkheden blijven open.' },
    attention: { reasons: ['next_step', 'support_response', 'deadline', 'opportunity'] },
    navigation: { slots: 4, defaults: ['today', 'development', 'opportunities', 'help'], optionalSlots: 0 },
    rahul: { role: 'human_guide', directExecution: false },
    experience: { density: 'calm', theme: 'supportive', composition: 'progress_editorial' },
    governance: { prohibit: ['human_worth_scoring', 'vulnerability_ranking',
      'engagement_optimization', 'manipulative_streaks', 'public_failure_metrics',
      'eligibility_exclusion', 'autonomous_external_submission'] }
  }
];

LIJST.forEach(valideerManifest);
const MANIFESTS = diepBevries(Object.fromEntries(LIJST.map(m => [m.id, m])));
const ids = () => Object.keys(MANIFESTS);
/* ALLEEN EIGEN SLEUTELS, en dat is geen zuinigheid maar de wachter zelf.

   `MANIFESTS[w]` leest ook wat op Object.prototype staat: `haal('constructor')`
   gaf een FUNCTIE terug en `haal('__proto__')` een object, allebei waarheidsgetrouw
   genoeg om door `if (!manifest)` te komen. De aanroeper (kern/experience/projections.js)
   gebruikt die uitkomst als bewijs dat de wereld bestaat en doet daarna
   `BOUWERS[w](...)` -- met een prototypesleutel is dat een aanroep van iets heel
   anders dan een wereldbouwer. De wereld komt uit het lijf van een verzoek
   (routes/experience.js), dus dit is invoer en geen interne waarde.

   De reparatie hoort HIER en niet bij de aanroeper: wie de wachter vraagt of een
   wereld bestaat, hoort geen halve waarheid terug te krijgen. */
const haal = (id) => {
  const w = String(id || '').toLowerCase();
  return Object.prototype.hasOwnProperty.call(MANIFESTS, w) ? MANIFESTS[w] : null;
};
const publiek = () => JSON.parse(JSON.stringify(MANIFESTS));

module.exports = { MANIFESTS, ids, haal, publiek };
