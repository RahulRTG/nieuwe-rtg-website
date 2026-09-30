/* De code van een festivalpas (festivalos.toegangspas,
   server/kern/festival/pas-toegang.js). Elke control uit RELEASEKANDIDAAT.md
   B9 heeft hier een toets die zakt als de control weg is; de routes met een
   echte server staan in test/festival-routes.test.js toets 31.
   Draai los: node --test test/festivalpas.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const nodeCrypto = require('node:crypto');
const { schoon } = require('../server/kern/util');
const maakFestival = require('../server/kern/festival');

/* Met een collectietransactie die telkens uit JSON leest (de vorm van
   PostgreSQL): wat alleen in de werkkopie zou staan, overleeft hem niet. */
function wereld({ crypto = nodeCrypto } = {}) {
  const db = { data: {} };
  const bewerkCollectie = (sleutel, werk) => {
    const waarde = JSON.parse(JSON.stringify(db.data[sleutel] || {}));
    const uit = werk(waarde);
    db.data[sleutel] = waarde;
    return uit;
  };
  const k = maakFestival({ db, save() {}, crypto, schoon, bewerkCollectie });
  const fid = k.festivalNieuw('ZAAK1', { naam: 'Testival' }).festival.id;
  const eid = k.editieNieuw(fid, { jaar: 2027 }).editie.id;
  const dag = k.dagZet(fid, eid, { datum: '2027-07-02', open: '12:00', sluit: '23:00' }).dag;
  const terrein = k.plekZet(fid, eid, { naam: 'Terrein', soort: 'terrein', capaciteit: 100 }).plek;
  const poort = k.plekZet(fid, eid, { naam: 'Noord', soort: 'ingang', ouder: terrein.id }).plek;
  const pas = drager => k.pasUitgeven(fid, eid, { drager, rechten: [{ soort: 'festival.entree', dagen: [dag.id] }] });
  const scan = (code, richting) => k.scan(fid, eid, { code, plek: poort.id, datum: '2027-07-02', tijd: '13:00', poort: 'Noord', richting });
  const editie = () => db.data.festivals[fid].edities[eid];
  return { db, k, fid, eid, pas, scan, editie };
}

test('1. 128 bits, issuer/doel/scope, verval aan het eind van de editie; op schijf alleen de hash', () => {
  const w = wereld();
  const uit = w.pas('KOBALT');
  assert.match(uit.pas.code, /^FP\.[0-9A-F]{32}$/);
  assert.equal(uit.eenmalig, true);
  const t = w.editie().passen[uit.pas.id].toegang;
  assert.equal(t.doel, 'festival-toegang');
  assert.deepEqual(t.scope, ['festival.poort.scan']);
  assert.equal(t.issuer, 'rtg.festival.organisator');
  assert.ok(Math.abs(Date.parse(t.expires_at) - Date.parse('2027-07-03T23:59:59.999Z')) < 5000, 'de laatste dag plus een nacht');
  assert.ok(!JSON.stringify(w.db.data.festivals).includes(uit.pas.code.slice(3)), 'de kale code staat niet in de opslag');
  assert.equal(w.editie().passen[uit.pas.id].code, undefined);
});

test('2. de scan telt binnenkomen op de pas, in de transactie', () => {
  const w = wereld();
  const uit = w.pas('KOBALT');
  assert.equal(w.scan(uit.pas.code).stand, 'groen');
  assert.equal(w.scan(uit.pas.code).stand, 'oranje', 'al binnen');
  assert.equal(w.editie().passen[uit.pas.id].toegang.gebruik, 1);
});

test('3. de drager toont: dat roteert, en de vorige code opent niets meer', () => {
  const w = wereld();
  const uit = w.pas('KOBALT');
  assert.equal(w.k.pasToon(w.fid, w.eid, 'AMBER', uit.pas.id).status, 404, 'alleen de drager zelf');
  const toon = w.k.pasToon(w.fid, w.eid, 'KOBALT', uit.pas.id);
  assert.equal(toon.ok, true);
  assert.equal(toon.pas.toegang.rotatie, 2);
  assert.equal(w.scan(uit.pas.code).status, 404);
  assert.equal(w.scan(toon.code).stand, 'groen');
});

test('4. intrekken op pas-id sluit de code aan de poort (naar buiten mag nog)', () => {
  const w = wereld();
  const uit = w.pas('KOBALT');
  assert.equal(w.scan(uit.pas.code).stand, 'groen');
  assert.equal(w.k.pasIntrekken(w.fid, w.eid, uit.pas.id, 'gestolen').ok, true);
  assert.ok(w.editie().passen[uit.pas.id].toegang.ingetrokken_at);
  assert.equal(w.scan(uit.pas.code, 'uit').stand, 'groen');
  assert.equal(w.scan(uit.pas.code).stand, 'rood');
});

test('5. verlopen: na de editie opent de code niets, ook als de dag in de vraag klopt', () => {
  const w = wereld();
  const uit = w.pas('KOBALT');
  w.editie().passen[uit.pas.id].toegang.expires_at = '2020-01-01T00:00:00.000Z';
  const r = w.scan(uit.pas.code);
  assert.equal(r.stand, 'rood');
  assert.match(r.zin, /verlopen/);
});

test('6. constant-time: elke pas van de editie wordt vergeleken, ook na een treffer', () => {
  let vergeleken = 0;
  const crypto = Object.assign(Object.create(nodeCrypto), {
    timingSafeEqual: (a, b) => { vergeleken++; return nodeCrypto.timingSafeEqual(a, b); } });
  const w = wereld({ crypto });
  const eerste = w.pas('P0');
  for (let i = 1; i < 7; i++) w.pas('P' + i);
  vergeleken = 0;
  assert.ok(w.k.pasOpCode(w.editie(), eerste.pas.code));
  assert.equal(vergeleken, 7);
});

test('7. een oude kale pascode wordt niet gehonoreerd en verdwijnt uit de opslag', () => {
  const w = wereld();
  const uit = w.pas('KOBALT');
  const p = w.editie().passen[uit.pas.id];
  p.code = 'ABCDEFGHJK'; p.toegang = null;
  assert.equal(w.scan('ABCDEFGHJK').status, 404);
  assert.equal(w.editie().passen[uit.pas.id].code, undefined);
  assert.equal(w.editie().passen[uit.pas.id].codeLegacy, true);
});

/* MUTATIES (handmatig, op een schone boom; allemaal zakten ze):
   F1 pas-toegang.js: `eind + DAG` -> `eind + 30 * DAG`               -> toets 1
   F2 toegang.js: `pasTelBinnen(oordeel.pas)` weg                     -> toets 2
   F3 pas-toegang.js: in geef() de vorige toegang niet intrekken en als
      extra hash laten meezoeken (opCode ook over toegang_historie)     -> toets 3
   F4 rechten.js: `pt.trekIn` in pasIntrekken weg en `p.ingetrokken` niet zetten
                                                                      -> toets 4
   F5 poort.js: de `pasReden`-controle weg                           -> toets 5
   F6 bearercode.vind met vroege uitgang (return bij de eerste treffer) -> toets 6
   F7 pas-toegang.js: migreer() niet aanroepen en opCode ook op p.code laten
      zoeken                                                          -> toets 7 */
