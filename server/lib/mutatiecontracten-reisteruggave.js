/* ============================================================================
   MUTATIECONTRACTEN -- HET TERUGGAVERECHT VAN EEN REIS UITVOEREN.

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm.
   Drie routes (routes/kantoren/reisteruggave.js): de lijst, het loket van de
   ceremonie, en het besluit. Alle drie achter kluisAuth: een naam, nooit de
   gedeelde code -- en dat is een IDENTITEIT en geen bevoegdheid, dus
   `AUTHENTICATED` (de redenering staat in ./mutatiecontracten-tweedehand.js).
   ========================================================================== */
'use strict';

const AFGETEKEND = {
  door: 'Claude (Opus 5), op grond van routes/kantoren/reisteruggave.js, kern/reisbureau-teruggave.js ' +
    'en test/reisteruggave.test.js; niet door een mens nagelezen',
  op: '2026-10-04'
};
const BEWIJS = {
  gemeten: 'test/reisteruggave.test.js tegen een echte server: de gedeelde code krijgt 403, uitvoeren ' +
    'zonder passkey 401 (bevestigingNodig), met passkey boekt het een keer en een tweede besluit geeft 409; vanaf duizend ' +
    'euro wordt het een aanvraag die een tweede mens met zijn eigen passkey bevestigt.',
  op: '2026-10-04'
};

const CONTRACTEN = {
  'POST /api/office/reisbureau/teruggaven': {
    mutatieId: 'reisbureau.teruggave.lezen',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED', deur: 'kluisAuth' },
    stand: 'NOT_APPLICABLE',
    bewijs: BEWIJS,
    nagekeken: 'Claude (Opus 5), 2026-10-04: de handler geeft `teruggavenOpen()` terug, een filter op ' +
      'de eigen bak van kern/reisbureau-betaling. Er wordt niets geschreven.',
    afgetekend: AFGETEKEND
  },
  'POST /api/office/reisbureau/teruggave/opties': {
    mutatieId: 'zwaar.opties.reisteruggave',
    herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: { klasse: 'AUTHENTICATED', deur: 'kluisAuth' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'de ceremonie voor een teruggave, gebonden aan dat ene recht (besluit eigenaar 25-09-2026: ' +
      'geld op kantoor met een passkey). Een verse uitdaging per aanroep, om dezelfde reden als de andere ' +
      'loketten: een herhaalde challenge is een herbruikbare challenge.',
    bewijs: BEWIJS,
    afgetekend: AFGETEKEND
  },
  'POST /api/office/reisbureau/teruggave': {
    mutatieId: 'reisbureau.teruggave.besluiten',
    herkomst: 'mens',
    semantiek: { klasse: 'hooguitEens' },
    toegang: { klasse: 'AUTHENTICATED', deur: 'kluisAuth' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Een recht wordt een keer uitgevoerd of afgewezen; een tweede besluit geeft 409 -- een ' +
      'TOESTANDSCONTROLE en geen idempotentie (MUTATIECONTRACT.md). De geldboeking zelf is wel ' +
      'idempotent op het id van het recht (lib/idem.js via kern/pay/verkoop.js), zodat een storing ' +
      'tussen boeken en markeren bij herhaling niet nog eens boekt. Vanaf duizend euro maakt een ' +
      'aanroep een AANVRAAG voor de tweede handtekening, en een tweede aanroep een tweede aanvraag.',
    bewijs: BEWIJS,
    afgetekend: AFGETEKEND
  }
};

module.exports = { CONTRACTEN };
