/* ============================================================================
   MUTATIECONTRACT -- de nazorg van een reisaanvraag (vier routes).

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm. Een
   eigen bestand omdat deze vier bij elkaar horen: ze zijn samen de weg terug uit
   een toezegging (kern/reisbureau-nazorg.js), en ze delen exact één afweging.

   ================== DE AFWEGING: WAAROM PROTECTED ==================

   MUTATIECONTRACT.md par. 5 zegt dat een 409 op een herhaling een
   TOESTANDSCONTROLE is en geen idempotentie. Dat is hier bekeken, en het
   verschil zit -- net als bij ./mutatiecontracten-horeca-correctie.js -- in
   WELKE oproep de 409 kreeg.

   Bij alle vier doet de EERSTE oproep het werk (200, de stand verschuift) en
   wordt pas de TWEEDE geweigerd, door de standcontrole in
   kern/reisbureau-nazorg.js die de reis alleen in de juiste stand aanpakt. De
   stand na twee oproepen is exact die na een -- inclusief de LENGTE VAN HET
   SPOOR, en dat is hier het scherpst: een tweede regel in de geschiedenis zou
   geen enkele waarde veranderen en toch een tweede gebeurtenis zijn.

   ================== HOE HET GEMETEN IS ==================

   Vier keer een verse bevestigde reis, elke route twee keer aangeroepen met
   hetzelfde lijf, over HTTP tegen een wegwerpserver (test/helper.js). Per
   oproep is daarna de stand van het lid opgehaald: status, aantal personen,
   totaalbedrag en het aantal regels in de geschiedenis. Uitslag hieronder per
   route, letterlijk overgenomen.

   WAT DIT NIET BETEKENT: dat de aanroeper op een herhaling hetzelfde ANTWOORD
   krijgt. Dat doet een echte idempotentiesleutel wel en deze vier niet -- de
   tweede krijgt 409 met de reden. Wie hier ooit een sleutel bij bouwt,
   verandert het antwoord en niet de stand.
   ========================================================================== */
'use strict';

const GEMETEN_OP = '2026-09-10';
const AFGETEKEND = {
  door: 'Claude (Opus 5), op grond van de gemeten dubbeltik hieronder plus de afweging in de kop ' +
    'tegen MUTATIECONTRACT.md par. 5; niet door een mens nagelezen',
  op: GEMETEN_OP
};

const CONTRACTEN = {
  /* Het lid vraagt een wijziging op een bevestigde reis. Tweede oproep: de reis
     staat dan op `wijziging-gevraagd` en is dus niet meer `bevestigd`. */
  'POST /api/reisbureau/wijzig': {
    mutatieId: 'reisbureau.wijziging.vraag',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    /* De ref moet van DEZE aanvrager zijn; een ref van een ander lid geeft 404
       en niet 403 -- wie hem niet bezit, hoort niet te weten dat hij bestaat. */
    toegang: { klasse: 'OBJECT_SCOPED', veld: 'ref' },
    stand: 'PROTECTED',
    bewijs: {
      gemeten: '1e: 200 -> wijziging-gevraagd | 2 pers | 4400 | spoor 2. ' +
        '2e: 409 "Deze reis is wijziging-gevraagd; een wijziging vraagt u op een bevestigde reis." ' +
        '-> wijziging-gevraagd | 2 pers | 4400 | spoor 2. Geen tweede spoorregel.',
      op: GEMETEN_OP
    },
    afgetekend: AFGETEKEND
  },

  /* Het lid zegt een bevestigde reis af. Tweede oproep: de reis staat op
     `afgezegd` en dat is geen stand waarin afzeggen nog kan. */
  'POST /api/reisbureau/afzeggen': {
    mutatieId: 'reisbureau.afzegging.lid',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'OBJECT_SCOPED', veld: 'ref' },
    stand: 'PROTECTED',
    bewijs: {
      gemeten: '1e: 200 -> afgezegd | 2 pers | 4400 | spoor 2. ' +
        '2e: 409 "Deze reis is afgezegd; afzeggen kan alleen bij een reis die rond is." ' +
        '-> afgezegd | 2 pers | 4400 | spoor 2. Er ontstaat geen tweede afzegging en geen ' +
        'tweede geldblok.',
      op: GEMETEN_OP
    },
    afgetekend: AFGETEKEND
  },

  /* Het kantoor beslist over een wijzigingsverzoek. Tweede oproep: het verzoek
     is weg -- de reis staat weer op `bevestigd`. Dit is de gevaarlijkste van de
     vier, want een tweede `toegepast` zou het aantal personen nog een keer
     kunnen verzetten; de meting laat zien dat dat niet gebeurt. */
  'POST /api/office/reisbureau/wijziging': {
    mutatieId: 'reisbureau.wijziging.besluit',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: {
      gemeten: '1e: 200 -> bevestigd | 3 pers | 6600 | spoor 3. ' +
        '2e: 409 "Deze reis is bevestigd; er ligt geen wijzigingsverzoek op de balie." ' +
        '-> bevestigd | 3 pers | 6600 | spoor 3. Het aantal personen en het bedrag bewegen ' +
        'niet mee met de tweede oproep.',
      op: GEMETEN_OP
    },
    afgetekend: AFGETEKEND
  },

  /* Het kantoor zegt een bevestigde reis af. Zelfde vorm als de lid-kant; het
     verschil zit in WIE er in de afzegging komt te staan en dat het lid bericht
     krijgt. */
  'POST /api/office/reisbureau/afzeggen': {
    mutatieId: 'reisbureau.afzegging.kantoor',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: {
      gemeten: '1e: 200 -> afgezegd | 2 pers | 4400 | spoor 2. ' +
        '2e: 409 "Deze reis is afgezegd; afzeggen kan alleen bij een reis die rond is." ' +
        '-> afgezegd | 2 pers | 4400 | spoor 2. Het lid krijgt dus ook geen tweede melding.',
      op: GEMETEN_OP
    },
    afgetekend: AFGETEKEND
  }
};

module.exports = { CONTRACTEN };
