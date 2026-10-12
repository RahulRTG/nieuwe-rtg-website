/* ============================================================================
   MUTATIECONTRACT -- het reisconcept op het scherm (EDGE.md par. 14.6).

   Deel van ./mutatiecontracten.js; zie de kop daar voor de vorm.

   POST /api/fluister/concept past een concept aan dat Rahul in het eigen
   geheugen van het lid zette (kern/fluister/reis/reisconcept.js). Twee vormen van
   herhaling, en ze zijn allebei veilig:
     - dezelfde waarden nog een keer: de route ziet dat er niets verandert en
       geeft 200 met `gewijzigd: false`, zonder nieuwe versie -- ook met een oude
       versie, want er is niets om over te botsen;
     - andere waarden op een oude versie: 409 met de stand van nu. Dat is een
       toestandscontrole en geen idempotentie (MUTATIECONTRACT.md par. 5), maar
       de stand na twee aanroepen is die na een, en dat belooft PROTECTED.
   Gemeten in test/concept-live.test.js 3 (gelijktijdig, een wint) en 4 (dubbel).
   ========================================================================== */
'use strict';

const OP = '2026-10-12';
const CONTRACTEN = {
  'POST /api/fluister/concept': {
    mutatieId: 'fluister.concept.wijzig',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'id',
      uitleg: 'het concept uit `id`, en alleen een concept in het geheugen van dit lid; dat van een ander geeft 404' },
    stand: 'PROTECTED',
    herkomst: 'mens',
    afgetekend: { door: 'Claude, op grond van test/concept-live.test.js en de handler in kern/fluister/reis/reisconcept.js; ' +
      'niet door een mens nagelezen', op: OP },
    bewijs: { gemeten: 'test/concept-live.test.js: dezelfde waarden twee keer gelijktijdig geven een nieuwe versie en een ' +
      'no-op; twee verschillende waarden op dezelfde versie geven een 200 en een 409 met de stand van de winnaar', op: OP }
  }
};

module.exports = { CONTRACTEN };
