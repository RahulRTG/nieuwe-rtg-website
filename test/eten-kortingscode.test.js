/* De kortingscode van RTG Eten (eten.kortingscode) als PROMOTIECODE: geen
   geheim (besluit B13), maar wel vier grenzen in code -- een vervaldatum, een
   maximum over alle leden, een grens per lid en (in de routes) een rem op
   raden. En het tellen is atomair: het laatste gebruik gaat naar EEN lid. De
   routes tegen een echte server staan in test/eten-kortingscode-routes.test.js,
   de raceproef over twee instances in test/eten-kortingscode.pg.test.js.

   Draai los: node --test test/eten-kortingscode.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const T0 = Date.parse('2026-09-27T12:00:00.000Z');
const DAG = 86400000;

function wereld() {
  let klok = T0;
  const sleutels = [];
  const db = { data: {}, writable: true };
  const basis = require('../server/db/collectie-bewerken')({ store: 'json', db, save() {} });
  const bewerkCollectie = (s, werk) => { sleutels.push(s); return basis(s, werk); };
  const k = require('../server/kern/eten/kortingscode')({ db, bewerkCollectie, crypto, nu: () => new Date(klok) });
  return { db, k, sleutels, schuif: ms => { klok += ms; } };
}

test('1. elke code krijgt een vervaldatum, een maximum en een grens per lid -- nooit zonder', () => {
  const { k } = wereld();
  const n = k.normaliseer({ code: 'kerst10', procent: 10 });
  assert.equal(n.ok, true);
  assert.deepEqual(n.regel, { code: 'KERST10', procent: 10, centen: 0, actief: true,
    geldigTot: '2026-10-27', maxGebruik: 100, perLid: 1 });
  const eigen = k.normaliseer({ code: 'VAST5', centen: 500, geldigTot: '2026-12-31', maxGebruik: 3, perLid: 2 }).regel;
  assert.equal(eigen.geldigTot, '2026-12-31'); assert.equal(eigen.maxGebruik, 3); assert.equal(eigen.perLid, 2);
  assert.equal(k.normaliseer({ code: 'OUD', procent: 5, geldigTot: '2026-09-26' }).status, 400, 'niet in het verleden');
  assert.equal(k.normaliseer({ code: 'VER', procent: 5, geldigTot: '2027-12-31' }).status, 400, 'hooguit een jaar vooruit');
  assert.equal(k.normaliseer({ code: 'VEEL', procent: 5, maxGebruik: 10 ** 9 }).regel.maxGebruik, 100000);
  assert.equal(k.normaliseer({ code: 'AB', procent: 5 }).status, 400);
});

test('2. geldig: onbekend, uit, onvolledig (oude code), verlopen', () => {
  const w = wereld();
  const lijst = [w.k.normaliseer({ code: 'KERST10', procent: 10, geldigTot: '2026-10-01' }).regel,
    { code: 'OUD10', procent: 10, actief: true }, Object.assign(w.k.normaliseer({ code: 'UIT', procent: 5 }).regel, { actief: false })];
  assert.ok(w.k.geldig('Z', lijst, 'kerst10', 'lid').korting);
  assert.equal(w.k.geldig('Z', lijst, 'NIETS', 'lid').reden, 'onbekend');
  assert.equal(w.k.geldig('Z', lijst, 'UIT', 'lid').reden, 'uit');
  assert.equal(w.k.geldig('Z', lijst, 'OUD10', 'lid').reden, 'onvolledig', 'een code zonder grenzen geeft niets');
  w.schuif(5 * DAG);
  assert.equal(w.k.geldig('Z', lijst, 'KERST10', 'lid').reden, 'verlopen');
});

test('3. het maximum en de grens per lid, geteld in EEN transactie', async () => {
  const w = wereld();
  const korting = w.k.normaliseer({ code: 'TWEE', procent: 10, maxGebruik: 2, perLid: 1 }).regel;
  w.sleutels.length = 0;
  assert.equal((await w.k.claim({ zaak: 'Z', korting, lidKey: 'a', rekeningId: 'r1' })).ok, true);
  assert.deepEqual(w.sleutels, ['etenKortingGebruik']);
  assert.equal((await w.k.claim({ zaak: 'Z', korting, lidKey: 'a', rekeningId: 'r1' })).herhaald, true, 'dezelfde rekening telt een keer');
  assert.equal((await w.k.claim({ zaak: 'Z', korting, lidKey: 'a', rekeningId: 'r2' })).reden, 'per-lid');
  assert.ok(w.k.geldig('Z', [korting], 'TWEE', 'a', rid => rid === 'r1').korting, 'een vervolg op de open rekening mag');
  assert.equal(w.k.geldig('Z', [korting], 'TWEE', 'a', () => false).reden, 'per-lid', 'een nieuwe rekening niet');
  assert.equal((await w.k.claim({ zaak: 'Z', korting, lidKey: 'b', rekeningId: 'r3' })).ok, true);
  assert.equal((await w.k.claim({ zaak: 'Z', korting, lidKey: 'c', rekeningId: 'r4' })).reden, 'op');
  assert.equal(w.k.geldig('Z', [korting], 'TWEE', 'c').reden, 'op', 'de controlesheet ziet het ook');
  assert.equal(w.k.geldig('Z', [korting], 'TWEE', 'x').reden, 'op');
  assert.equal(w.k.stand('Z', 'TWEE').gebruik, 2);
  assert.equal(JSON.stringify(w.db.data).includes('"a"'), false, 'het lid staat er als hash');
  await w.k.laat({ zaak: 'Z', code: 'TWEE', rekeningId: 'r3' });
  assert.equal(w.k.stand('Z', 'TWEE').gebruik, 1, 'een teruggegeven claim telt niet meer');
  assert.equal((await w.k.claim({ zaak: 'Z', korting, lidKey: 'c', rekeningId: 'r4' })).ok, true);
  assert.equal((await w.k.claim({ zaak: 'ANDER', korting, lidKey: 'c', rekeningId: 'r9' })).ok, true, 'per zaak geteld');
  w.schuif(40 * DAG);
  assert.equal((await w.k.claim({ zaak: 'Z', korting, lidKey: 'd', rekeningId: 'r5' })).reden, 'verlopen', 'de claim toetst de datum zelf');
});
