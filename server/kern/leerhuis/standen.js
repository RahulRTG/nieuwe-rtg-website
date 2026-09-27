/* ============================================================================
   HET LEERHUIS -- de standen, zonder opslag.

   RTG Academy heet in de code `leerhuis`: "academy" is al een scope van de
   Magnaat-grondwet (scripts/lib/magnaatgrondwet.js, het Oefenkantoor), en een
   tweede betekenis onder dezelfde naam is de VERMOGENS-botsing (OS.md). Zie
   ACADEMY.md par. 2.

   Dit bestand kent geen db, met dezelfde reden als kern/carriereledger/regels.js:
   welke overgang mag, is dan te beproeven zonder server.

   TWEE SOORTEN STAND, en die lopen hier nooit door elkaar:
     - een GEBEURDE stand wordt door een handeling gezet (een beoordeling is
       PROVEN omdat een assessor dat op naam vastlegde);
     - een BEREKENDE stand wordt bij elke vraag opnieuw uitgerekend en nooit
       opgeslagen (een certificaat is EXPIRED omdat de datum voorbij is -- een
       opgeslagen vlag zou op de dag van verlopen nog ACTIVE zeggen, zie
       kern/vakbewijs.js regel 3).
   De namen komen uit de opdracht en zijn het machineleesbare contract; de
   uitleg staat in het Nederlands.
   ========================================================================== */
'use strict';

/* Gebeurde standen: per machine de toegestane overgangen. Wat er niet staat,
   mag niet -- ook niet "voor even". */
const MACHINES = Object.freeze({
  kennis: {
    begin: 'DRAFT',
    naar: { DRAFT: ['REVIEW'], REVIEW: ['DRAFT', 'ACTIVE'], ACTIVE: ['DEPRECATED', 'REVOKED'],
      DEPRECATED: ['REVOKED'], REVOKED: [] }
  },
  curriculum: {
    begin: 'DRAFT',
    naar: { DRAFT: ['REVIEW'], REVIEW: ['DRAFT', 'PILOT', 'ACTIVE'], PILOT: ['ACTIVE', 'RETIRED'],
      ACTIVE: ['MONITORED', 'SUPERSEDED', 'RETIRED'], MONITORED: ['IMPROVEMENT', 'SUPERSEDED', 'RETIRED'],
      IMPROVEMENT: ['REVIEW'], SUPERSEDED: [], RETIRED: [] }
  },
  leren: {
    begin: 'ASSIGNED',
    naar: { ASSIGNED: ['LEARNING'], LEARNING: ['PRACTICING'], PRACTICING: ['SIMULATING'],
      SIMULATING: ['SUPERVISED'], SUPERVISED: ['READY_FOR_ASSESSMENT'],
      READY_FOR_ASSESSMENT: ['ASSESSING'], ASSESSING: ['PROVEN', 'NOT_YET_PROVEN'],
      /* NOT_YET_PROVEN is geen eindstation maar een herstelpad terug. */
      NOT_YET_PROVEN: ['PRACTICING', 'SIMULATING', 'SUPERVISED'],
      PROVEN: ['CERTIFIED', 'PRACTICING_IN_ROLE', 'AUTHORITY_ELIGIBLE'],
      CERTIFIED: ['AUTHORITY_ELIGIBLE', 'PRACTICING_IN_ROLE'],
      AUTHORITY_ELIGIBLE: ['PRACTICING_IN_ROLE'],
      /* een kennisverandering of verval brengt iemand terug naar leren */
      PRACTICING_IN_ROLE: ['LEARNING'] }
  },
  beoordeling: {
    begin: 'REQUESTED',
    naar: { REQUESTED: ['ASSESSING'], ASSESSING: ['PROVEN', 'NOT_YET_PROVEN', 'INCONCLUSIVE'],
      PROVEN: ['INVALIDATED'], NOT_YET_PROVEN: ['INVALIDATED'], INCONCLUSIVE: ['INVALIDATED'], INVALIDATED: [] }
  },
  voorstel: {
    begin: 'SUBMITTED',
    naar: { SUBMITTED: ['TRIAGED'], TRIAGED: ['REVIEW', 'REJECTED'], REVIEW: ['EXPERIMENT', 'APPROVED', 'REJECTED'],
      EXPERIMENT: ['APPROVED', 'REJECTED'], APPROVED: ['IMPLEMENTED'], IMPLEMENTED: ['MEASURED'],
      REJECTED: [], MEASURED: [] }
  },
  bezwaar: {
    begin: 'REVIEW_REQUEST',
    naar: { REVIEW_REQUEST: ['INDEPENDENT_REVIEW'], INDEPENDENT_REVIEW: ['UPHELD', 'CHANGED', 'REASSESSMENT'],
      UPHELD: [], CHANGED: [], REASSESSMENT: [] }
  },
  evc: {
    begin: 'CLAIM',
    naar: { CLAIM: ['EVIDENCE'], EVIDENCE: ['REVIEW'], REVIEW: ['ACCEPTED', 'PARTIAL', 'REJECTED'],
      ACCEPTED: [], PARTIAL: [], REJECTED: [] }
  }
});

function overgang(machine, van, naar) {
  const m = MACHINES[machine];
  if (!m) return { ok: false, reden: 'onbekende machine: ' + machine };
  if (van == null) return naar === m.begin ? { ok: true }
    : { ok: false, reden: machine + ' begint bij ' + m.begin + ', niet bij ' + naar };
  const mag = m.naar[van];
  if (!mag) return { ok: false, reden: 'onbekende stand ' + van + ' in ' + machine };
  return mag.includes(naar) ? { ok: true }
    : { ok: false, reden: machine + ': van ' + van + ' naar ' + naar + ' bestaat niet (wel: ' + (mag.join(', ') || 'niets, eindstand') + ')' };
}

/* Berekende standen. */
const CERTIFICAAT = ['ACTIVE', 'EXPIRING', 'REFRESH_REQUIRED', 'SUSPENDED', 'EXPIRED', 'REVOKED'];
const BEWIJS_VERS = ['CURRENT', 'AGING', 'STALE'];
const GESCHIKT = ['AUTHORITY_ELIGIBLE', 'NOT_ELIGIBLE'];
const GEREED = ['READY', 'CONDITIONAL', 'BLOCKED'];
const EENHEID = ['SELF_SUSTAINING', 'DEPENDENT', 'BLOCKED'];
const LOOPBAAN_GEREED = ['READY', 'NEARLY_READY', 'DEVELOPING', 'NOT_ELIGIBLE'];

/* Vaste lijsten uit de opdracht. */
const VAARDIGHEIDSNIVEAUS = ['AWARE', 'FOUNDATIONAL', 'PRACTITIONER', 'ADVANCED', 'EXPERT'];
const ROLSOORTEN = ['EXECUTIVE', 'MANAGEMENT', 'EXPERT', 'PROFESSIONAL', 'TRAINER', 'ASSESSOR',
  'FOUNDATION', 'VOLUNTEER', 'BUSINESS', 'SUPPLIER', 'TECHNICAL', 'OPERATIONS'];
const LEERFASEN = ['UNDERSTAND', 'OBSERVE', 'PRACTICE', 'SIMULATE', 'SUPERVISED_WORK', 'PROVE', 'CERTIFY', 'REFRESH'];
const LEERBEWIJS = ['KNOWLEDGE_EVIDENCE', 'SIMULATION_EVIDENCE', 'OBSERVATION_EVIDENCE', 'WORK_EVIDENCE',
  'ASSESSMENT_EVIDENCE', 'MENTOR_EVIDENCE', 'TRAINER_EVIDENCE'];
/* Sterkte is een trede, geen kommagetal: een samenstelling is een MINIMUM. */
const STERKTE = ['SELF_REPORTED', 'DOCUMENTED', 'OBSERVED', 'ASSESSED', 'SYSTEM_VERIFIED'];
const IMPACT = ['INFORMATION_ONLY', 'LEARNING_UPDATE', 'ASSESSMENT_REQUIRED', 'RECERTIFICATION_REQUIRED', 'AUTHORITY_REVIEW_REQUIRED'];
const HERCERT = ['PERMANENT_UNLESS_CHANGED', 'PERIODIC', 'EVENT_DRIVEN', 'PRACTICE_DEPENDENT'];
const DRAAGBAAR = ['PORTABLE', 'ORGANIZATION_SPECIFIC', 'ROLE_SPECIFIC', 'LOCAL_POLICY_SPECIFIC', 'REGULATED'];
const RELATIESOORTEN = ['EMPLOYEE', 'VOLUNTEER', 'BUSINESS_MEMBER', 'SUPPLIER_MEMBER', 'PARTNER', 'PROJECT'];
const TRAINERLADDER = ['PRACTITIONER', 'SENIOR_PRACTITIONER', 'BUDDY', 'MENTOR', 'TRAINER_CANDIDATE',
  'CERTIFIED_TRAINER', 'SENIOR_TRAINER', 'TRAINER_OF_TRAINERS'];
/* Governance-rollen: bij kleine schaal mag een mens er meer dragen, maar de
   bevoegdheden blijven gescheiden (de opdracht, par. 22). */
const BESTUUR = ['ACADEMY_OWNER', 'CURRICULUM_OWNER', 'KNOWLEDGE_OWNER', 'TRAINER_AUTHORITY',
  'ASSESSMENT_AUTHORITY', 'QUALITY_AUTHORITY', 'ASSESSOR'];
/* Soorten organisatie. RTG en de RTFoundation zijn twee soorten, niet een. */
const ORGSOORTEN = ['RTG', 'RTF', 'BUSINESS', 'SUPPLIER', 'PARTNER', 'PROJECT'];

const index = (lijst, x) => lijst.indexOf(x);
const minimumSterkte = (lijst) => lijst.length
  ? lijst.reduce((a, b) => (index(STERKTE, a) <= index(STERKTE, b) ? a : b)) : null;

module.exports = { MACHINES, overgang, CERTIFICAAT, BEWIJS_VERS, GESCHIKT, GEREED, EENHEID, LOOPBAAN_GEREED,
  VAARDIGHEIDSNIVEAUS, ROLSOORTEN, LEERFASEN, LEERBEWIJS, STERKTE, IMPACT, HERCERT, DRAAGBAAR, RELATIESOORTEN,
  TRAINERLADDER, BESTUUR, ORGSOORTEN, minimumSterkte };
