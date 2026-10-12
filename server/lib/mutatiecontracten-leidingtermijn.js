/* ============================================================================
   MUTATIECONTRACT -- DE TERMIJN VAN DE LEIDINGSPLEK (besluit 584A).

   Deel van server/lib/mutatiecontracten.js. Twee routes, allebei met opzet niet
   herhaalbaar (de reden staat in ./idemsleutels-leidingtermijn.js en wordt hier
   opgehaald, niet overgetypt). De toegang is smaller dan de deur: verlengen mag
   alleen een manager van DEZE zaak, de toets alleen de eigenaar op naam -- en dat
   is beproefd in test/rtmail-leidingtermijn.test.js.
   ========================================================================== */
'use strict';

const { SLEUTELS } = require('./idemsleutels-leidingtermijn');
const AF = { door: 'Claude Code, handler met de hand nagelezen en tegen een server gemeten', op: '2026-10-12' };
const CONTRACTEN = {};

function open(route, mutatieId, toegang, gemeten) {
  const v = SLEUTELS[route];
  if (!v || !v.waarom) throw new Error('mutatiecontracten-leidingtermijn: ' + route + ' heeft geen `waarom`.');
  CONTRACTEN[route] = { mutatieId, herkomst: 'mens', semantiek: { klasse: 'nietHerhaalbaar' }, toegang,
    stand: 'INTENTIONALLY_NON_IDEMPOTENT', waarom: v.waarom, bewijs: { gemeten, op: '2026-10-12' }, afgetekend: AF };
}

open('POST /api/supplier/rtmail/leiding/verleng', 'supplier.rtmail.leiding.verleng', { klasse: 'AUTHENTICATED' },
  'test/rtmail-leidingtermijn.test.js toets 1: dezelfde verlenging twee keer laat twee spoorregels na; ' +
  'een collega en een manager van een andere zaak krijgen 403 met de reden');
open('POST /api/office/rtmail/leiding/toets', 'office.rtmail.leiding.toets', { klasse: 'AUTHENTICATED' },
  'test/rtmail-leidingtermijn.test.js toets 3: de gedeelde kantoorcode zet hem niet, de eigenaar wel en op naam');

module.exports = { CONTRACTEN };
