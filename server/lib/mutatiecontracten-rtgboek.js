/* ============================================================================
   MUTATIECONTRACT -- HET BOEK, DE CAMPAGNES, HET BESLISGEHEUGEN EN DE CADEAUBON
   VAN RTG (besluiten C8, C12, C13 en C14).

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm. Een
   eigen bestand omdat deze routes bij de kamer Financien horen en niet bij het
   stuur: Financien leest en vult het boek en het campagneregister, schrijven
   alleen op naam. Afgesplitst uit mutatiecontracten-kantoorstuur.js toen dat
   bestand de omvanggrens naderde.
   ========================================================================== */
'use strict';

const AF27 = { door: 'Claude Code, handler met de hand nagelezen en tegen een server gemeten', op: '2026-09-27' };
const AF = Object.assign({}, AF27, { op: '2026-09-28' });
const CONTRACTEN = {};

/* Het boek van RTG (kern/rtgboek.js, besluit C8): Financien leest en vult het op naam. */
CONTRACTEN['POST /api/office/rtgboek'] = {
  mutatieId: 'office.rtgboek', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
  toegang: { klasse: 'AUTHENTICATED' }, stand: 'NOT_APPLICABLE',
  bewijs: { gemeten: 'test/rtgboek.test.js toets 8: 401 zonder sessie, 200 met de gedeelde code en het bedrag op naam', op: '2026-09-27' },
  nagekeken: 'met de hand, 2026-09-27: de handler roept alleen rtgBoek() aan, die via eigencollectie.kijk leest',
  afgetekend: AF27
};
CONTRACTEN['POST /api/office/rtgboek/zet'] = {
  mutatieId: 'office.rtgboek.zet', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
  toegang: { klasse: 'AUTHENTICATED' }, stand: 'PROTECTED',
  bewijs: { gemeten: 'test/rtgboek.test.js toets 2: dezelfde post, hetzelfde bedrag en dezelfde bron nog eens geeft ' +
    'ongewijzigd: true, en de vorige stand blijft die van voor de eerste oproep; toets 8: de gedeelde code krijgt 403', op: '2026-09-27' },
  afgetekend: AF27
};
/* De campagnes van RTG (kern/rtgcampagne.js, besluit C12): Financien leest het register,
   maakt een campagne en boekt wat die kostte, op naam. */
CONTRACTEN['POST /api/office/rtgcampagne'] = {
  mutatieId: 'office.rtgcampagne', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
  toegang: { klasse: 'AUTHENTICATED' }, stand: 'NOT_APPLICABLE',
  bewijs: { gemeten: 'test/rtgcampagne.test.js toets 5: 401 zonder sessie, 200 met de gedeelde code en het register', op: '2026-09-28' },
  nagekeken: 'met de hand, 2026-09-28: de handler roept alleen rtgCampagnes() aan, die via eigencollectie.kijk leest',
  afgetekend: AF
};
CONTRACTEN['POST /api/office/rtgcampagne/maak'] = {
  mutatieId: 'office.rtgcampagne.maak', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
  toegang: { klasse: 'AUTHENTICATED' }, stand: 'PROTECTED',
  bewijs: { gemeten: 'test/rtgcampagne.test.js toets 1: dezelfde campagne nog eens geeft ongewijzigd: true, een andere ' +
    'onder dezelfde code 409; toets 5: de gedeelde code krijgt 403', op: '2026-09-28' },
  afgetekend: AF
};
CONTRACTEN['POST /api/office/rtgboek/campagne'] = {
  mutatieId: 'office.rtgboek.campagne', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
  toegang: { klasse: 'AUTHENTICATED' }, stand: 'PROTECTED',
  bewijs: { gemeten: 'test/rtgcampagne.test.js toets 3: hetzelfde bedrag en dezelfde bron nog eens geeft ongewijzigd: true; ' +
    'toets 5: de gedeelde code krijgt 403', op: '2026-09-28' },
  afgetekend: AF
};

/* Het beslisgeheugen (kern/beslisgeheugen.js, besluit C13): de boardroom leest, een
   mens op naam legt vast of trekt in. */
CONTRACTEN['POST /api/office/beslisgeheugen'] = {
  mutatieId: 'office.beslisgeheugen', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
  toegang: { klasse: 'AUTHENTICATED' }, stand: 'NOT_APPLICABLE',
  bewijs: { gemeten: 'test/beslisgeheugen.test.js toets 7: 401 zonder sessie, 200 met de besluiten en hun uitkomst', op: '2026-09-28' },
  nagekeken: 'met de hand, 2026-09-28: de handler roept alleen beslisgeheugen() aan, die via eigencollectie.kijk leest en de ' +
    'uitkomst uitrekent zonder iets op te slaan',
  afgetekend: AF
};
CONTRACTEN['POST /api/office/beslisgeheugen/leg'] = {
  mutatieId: 'office.beslisgeheugen.leg', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
  toegang: { klasse: 'AUTHENTICATED' }, stand: 'PROTECTED',
  bewijs: { gemeten: 'test/beslisgeheugen.test.js toets 1: hetzelfde besluit nog eens geeft ongewijzigd: true en hetzelfde id, ' +
    'en er staat er een; toets 7: de gedeelde code krijgt 403', op: '2026-09-28' },
  afgetekend: AF
};
CONTRACTEN['POST /api/office/beslisgeheugen/intrek'] = {
  mutatieId: 'office.beslisgeheugen.intrek', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
  toegang: { klasse: 'AUTHENTICATED' }, stand: 'PROTECTED',
  bewijs: { gemeten: 'test/beslisgeheugen.test.js toets 5: een tweede keer intrekken geeft ongewijzigd: true en de eerste reden ' +
    'blijft staan', op: '2026-09-28' },
  afgetekend: AF
};

/* De cadeaubon (kern/cadeaubon.js, besluit C14): de schakelaar die de e-geldpositie IS. */
CONTRACTEN['POST /api/office/cadeaubon'] = {
  mutatieId: 'office.cadeaubon', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
  toegang: { klasse: 'AUTHENTICATED' }, stand: 'NOT_APPLICABLE',
  bewijs: { gemeten: 'test/cadeaubon.test.js toets 6: 401 zonder sessie, 200 met de stand en het oordeel van de bevoegdheid', op: '2026-09-28' },
  nagekeken: 'met de hand, 2026-09-28: de handler roept alleen cadeaubonBeeld() en bevoegd.mag() aan, die allebei lezen',
  afgetekend: AF
};
CONTRACTEN['POST /api/office/cadeaubon/stand'] = {
  mutatieId: 'office.cadeaubon.stand', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
  toegang: { klasse: 'AUTHENTICATED' }, stand: 'PROTECTED',
  bewijs: { gemeten: 'test/cadeaubon.test.js toets 4: dezelfde stand nog eens geeft ongewijzigd: true en schrijft geen auditregel; ' +
    'toets 6: de gedeelde kantoorcode zet hem niet om', op: '2026-09-28' },
  afgetekend: AF
};

module.exports = { CONTRACTEN };
