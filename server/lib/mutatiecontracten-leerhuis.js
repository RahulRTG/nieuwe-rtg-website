/* ============================================================================
   DE MUTATIECONTRACTEN VAN HET LEERHUIS (RTG Academy, server/routes/leerhuis.js),
   plus de drie routes van zijn RTF-bron (routes/rtfos/doelgroepen.js).

   EERST HET CONTRACT, DAN DE ROUTE: deze drie stonden er voordat de routes in
   een commit werden opgehangen, en het bewijs komt uit test/leerhuis-routes.test.js
   tegen een echte server.

   `doe` is ECHTE idempotentie en geen toestandscontrole: de kern zoekt de
   sleutel op in het spoor van de organisatie en geeft het eerste antwoord terug
   met `herhaald: true`, zonder een regel te schrijven. Een tweede handeling met
   een ANDERE sleutel is een tweede handeling, en die weigert de kern waar de
   stand dat eist (een tweede certificaat op dezelfde beoordeling: 409). Die twee
   worden hier niet door elkaar gehaald (MUTATIECONTRACT.md par. 5o). */
'use strict';

const OP = '2026-09-27';
const AFGETEKEND = {
  door: 'Claude (Opus 5.5), op grond van test/leerhuis-routes.test.js tegen een echte server; niet door een mens nagelezen',
  op: OP
};

const CONTRACTEN = Object.fromEntries([
  ['POST /api/leerhuis/lees', {
    mutatieId: 'leerhuis.lees', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED', deur: 'auth' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'leesweg: de handler leest de projectie via kijk() (kern/eigencollectie.js) en schept geen collectie; ' +
      'toets 6 leest zonder dat het spoor groeit', op: OP },
    nagekeken: 'server/routes/leerhuis.js herleid: geen doe(), geen save(), alleen stand() en lees.*',
    afgetekend: AFGETEKEND
  }],
  ['POST /api/leerhuis/doe', {
    mutatieId: 'leerhuis.doe', herkomst: 'mens',
    semantiek: { klasse: 'sleutelVereist' },
    toegang: { klasse: 'AUTHENTICATED', deur: 'auth' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'test/leerhuis-routes.test.js toets 3: zonder sleutel 400; dezelfde sleutel twee keer gaf 200 en daarna 200 ' +
      'met herhaald: true, en het spoor groeide een keer. De mutatie die de sleutelregel weghaalt laat toets 3 zakken.', op: OP },
    afgetekend: AFGETEKEND
  }],
  ['POST /api/office/leerhuis/open', {
    mutatieId: 'office.leerhuis.open', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED', deur: 'kluisAuth' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'test/leerhuis-routes.test.js toets 2: de tweede opening van dezelfde organisatie gaf 200 met herhaald: true ' +
      'op de vaste sleutel open:<id>; er ontstond geen tweede leerhuis en geen tweede eigenaar', op: OP },
    afgetekend: AFGETEKEND
  }],
  /* Besluit B2b: de bron van een RTF-stad. Het account komt uit de SESSIE, en
     de herhaling is op de stand veilig: toets 3 en 6 van
     test/leerhuis-rtfbron.test.js. */
  ['POST /api/rtfos/portaal/vrijwilliger/koppel', {
    mutatieId: 'rtfos.vrijwilliger.account.koppel', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED', deur: 'auth' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'test/leerhuis-rtfbron.test.js toets 3: dezelfde koppeling twee keer gaf 200 en daarna al: true zonder tweede ' +
      'auditregel; een ANDER account met dezelfde code gaf 409 (een toestandscontrole, geen idempotentie). De mutatie die de 409 weghaalt laat toets 3 zakken.', op: OP },
    afgetekend: AFGETEKEND
  }],
  ['POST /api/rtfos/portaal/vrijwilliger/ontkoppel', {
    mutatieId: 'rtfos.vrijwilliger.account.ontkoppel', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED', deur: 'auth' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'test/leerhuis-rtfbron.test.js toets 6: loskoppelen gaf losgemaakt: 1; wat al los is, raakt een tweede oproep niet ' +
      '(de filter op het eigen account uit de sessie vindt dan niets)', op: OP },
    afgetekend: AFGETEKEND
  }],
  ['POST /api/rtfos/vrijwilliger/account-los', {
    mutatieId: 'rtfos.vrijwilliger.account.los', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED', deur: 'officeAuth' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'test/leerhuis-rtfbron.test.js toets 5: zonder reden 400, met reden 200 en losgemaakt: true; een tweede oproep ' +
      'maakt niets meer los en zegt dat (losgemaakt: false). De poort is die van het beheer van vrijwilligers in de stad.', op: OP },
    afgetekend: AFGETEKEND
  }]
]);

module.exports = { CONTRACTEN };
