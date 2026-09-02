/* ============================================================================
   MUTATIECONTRACTEN -- DE ACHTTIEN UIT DE SAMENVOEGING VAN 1 SEPTEMBER 2026.

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm en de
   regels.

   Twaalf PR's landden in een keer en brachten 106 schrijfroutes zonder contract
   mee. scripts/mutatiecontract.js --afleiden handelde er 88 af op een gemeten
   hindernis (BLOCKED_BY_TEST_FIXTURE, en dat mag een machine). Deze achttien
   bleven over omdat zij een UITSPRAAK OVER GEDRAG vragen, en die zet een mens.
   Het voorstel per route stond in CONTRACTEN-TE-TEKENEN.md; de eigenaar gaf op
   1 september 2026 de opdracht ze af te maken, en dat is hier gebeurd -- niet
   door het voorstel over te nemen maar door de handler van elke route te lezen.
   Op drie plekken wijkt het besluit daardoor van het voorstel af, en daar staat
   de reden erbij.
   ========================================================================== */
'use strict';

const AFGETEKEND = {
  door: 'Claude, in opdracht van de eigenaar (1 september 2026); per route de handler gelezen naast ' +
    'de kale ronde -- de eigenaar heeft de uitkomst niet zelf per route nagelezen',
  op: '2026-09-01'
};

const OP = '2026-09-01';

/* A. DE DERTIEN DIE ALLEEN LEZEN staan in ./mutatiecontracten-lezers.js. Ze
   delen alle dertien dezelfde grond en dezelfde vorm en zijn daarmee een lijst;
   de vijf hieronder dragen elk een eigen uitspraak over gedrag. */
const LEZERS = require('./mutatiecontracten-lezers').CONTRACTEN;

const CONTRACTEN = Object.assign({}, LEZERS, Object.fromEntries([
  /* B. EEN DIE DE PROEF NIET IN KWAM. De route ruilt het korte bewijs van
     /api/auth/inloggen om voor een sessie; de proef had zo'n bewijs niet en
     kreeg "Deze inlogpoging is verlopen". Wat een dubbeltik met een GELDIG
     bewijs doet is dus niet vastgesteld -- dat is het tekort van de proef en geen
     oordeel over de route. */
  ['POST /api/auth/tweede', {
    mutatieId: 'auth.tweede', herkomst: 'mens',
    semantiek: { klasse: 'onbekend' },
    toegang: { klasse: 'PUBLIC', waarom: 'de tweede stap van het inloggen: er is nog geen sessie om mee aan te kloppen, ' +
      'het korte bewijs uit stap een IS de sleutel en verloopt (server/routes/auth/inlog.js)' },
    stand: 'BLOCKED_BY_TEST_FIXTURE',
    bewijs: {
      gemeten: 'kale ronde: de EERSTE oproep gaf al 401 -- "Deze inlogpoging is verlopen. Log opnieuw in." ' +
        'Er is geen eerste handeling geweest om te herhalen',
      op: OP
    },
    watErMoetKomen: 'scripts/lib/idemwereld.js moet eerst /api/auth/inloggen doorlopen voor een lid met tweefactor ' +
      'aan en het uitgegeven bewijs in het lijf van deze route zetten (server/routes/member/tweefactor.js)',
    afgetekend: AFGETEKEND
  }],

  /* C. DE OPLEIDING. Het voorstel was PROTECTED; de handler zegt iets anders.
     server/school/organisatie.js: `id = schoon(req.body.id) || rid(4)`. Met een
     id is de route een zuivere zet (zelfde id, zelfde rij, `at` blijft staan);
     ZONDER id maakt elke oproep een nieuwe opleiding met een nieuw id. Dat is
     geen dubbeltik die je wilt afvangen maar het ontwerp: het id is de sleutel,
     en wie hem weglaat vraagt om een nieuwe. Het verschil in `wacht` dat de meter
     zag was de wachtlijstteller van het organisatiebeeld, dus geen rem. */
  ['POST /api/foundation/school/opleiding/zet', {
    mutatieId: 'foundation.school.opleiding.zet', herkomst: 'mens',
    semantiek: { klasse: 'sleutelVereist' },
    toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'schoolCode' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'het id in het lijf is de sleutel: met id zet een tweede oproep dezelfde opleiding opnieuw, zonder id ' +
      'is elke oproep met opzet een nieuwe opleiding (server/school/organisatie.js, `|| rid(4)`)',
    bewijs: {
      gemeten: 'kale ronde zonder sleutel en zonder id: twee geslaagde oproepen, de tweede maakte een tweede ' +
        'opleiding aan -- precies wat de handler zonder id belooft',
      op: OP
    },
    afgetekend: AFGETEKEND
  }],

  /* D. DE TWEE GELDROUTES. Bij allebei is de tweede oproep met opzet een tweede
     handeling, en bij allebei is de reden dezelfde als die van een route die dit
     huis al eerder zo besloot. */

  /* De giftstand: een schakelaar in de boardroom (GIFT.md). Een tweede zet met
     dezelfde waarden laat de STAND ongewijzigd, maar zet `door` en `at` opnieuw
     en schrijft een tweede auditregel (kern/rtfos/gift.js, standZet). Dat hoort
     zo: op een schakelaar die de juridische positie IS, hoort elke druk in het
     journaal -- ook een die niets veranderde. Samenvouwen zou de tweede druk uit
     het journaal laten verdwijnen, en dat is het tegendeel van verantwoording. */
  ['POST /api/rtfos/gift/stand/zet', {
    mutatieId: 'rtfos.gift.stand.zet', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'de stand zelf is idempotent, maar elke druk op deze boardroomschakelaar hoort een eigen auditregel ' +
      'te krijgen (audit(g.door, "gift.stand", ...)); een dubbeltik samenvouwen zou een druk uit het journaal wissen',
    bewijs: {
      gemeten: 'kale ronde zonder sleutel: twee woordelijk gelijke oproepen, dezelfde stand terug, en de tweede ' +
        'schreef opnieuw `door`, `at` en een auditregel',
      op: OP
    },
    afgetekend: AFGETEKEND
  }],

  /* De uitbetaalrekening van een zaak: dezelfde handler als /api/pay/rekening
     voor een lid (kern/pay/zaakrekening.js), en daar staat de reden al in
     ./idemsleutels-geld.js: een herhaalde wijziging start de wachttijd opnieuw,
     en samenvouwen zou terugzetten naar een oud IBAN de wachttijd laten omzeilen.
     De regel staat sinds vandaag ook voor deze route in die lijst; hier wordt hij
     GELEZEN en niet overgetypt. */
  ['POST /api/supplier/pay/rekening', {
    mutatieId: 'supplier.pay.rekening', herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: require('./idemsleutels-geld').SLEUTELS['POST /api/supplier/pay/rekening'].waarom,
    bewijs: {
      gemeten: 'kale ronde zonder sleutel: twee woordelijk gelijke oproepen, en de tweede zette `sinds` en ' +
        '`bruikbaarVanaf` opnieuw -- het gedrag is werkelijk zoals de reden zegt',
      op: OP
    },
    afgetekend: AFGETEKEND
  }]
]));

module.exports = { CONTRACTEN };
