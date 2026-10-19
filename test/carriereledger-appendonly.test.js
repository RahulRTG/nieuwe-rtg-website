/* Loopbaan: HET LEDGER KAPT NIETS AF, EN EEN ANDER KAN HET NIET VOLSCHRIJVEN.

   Tot 19 oktober 2026 hield `schrijfRegel` het ledger op 500 regels door de
   OUDSTE weg te knippen (rs.splice), en mocht elke manager die een codenaam en
   een regel-id kende onbeperkt bevestigen, zolang de tekst maar verschilde. Zo
   kon een derde de vroegste feiten van een lid wegdrukken. Dat botst met de
   eerste regel van dit domein: een ledger wist niets (carriereledger.test.js).

   Nu:
   - er verdwijnt nooit een regel; een vol ledger weigert een nieuwe met reden;
   - een partij heeft per feit hoogstens een actieve bevestiging, en over de
     hele geschiedenis hoogstens R.MAX_BEVESTIGINGEN_PER_PARTIJ;
   - een ander mag het ledger niet tot de rand vullen: de laatste
     R.RUIMTE_EIGENAAR regels zijn voor de eigenaar zelf.

   Draai los: node --test test/carriereledger-appendonly.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const R = require('../server/kern/carriereledger/regels');
const { maakCarriereLedger } = require('../server/kern/carriereledger');

const GISTEREN = '2025-06-14';

function huis() {
  const db = { data: {} };
  const L = maakCarriereLedger({ db, save: () => {}, bijeen: (f) => f(), inBundel: () => false,
    crypto, schoon: (v, n) => String(v == null ? '' : v).trim().slice(0, n || 200),
    codenaamVan: (k) => ({ ka: 'Zilveren Reiger' }[k] || null) });
  return { db, L };
}
const reeks = (db) => db.data.carriereLedger.ka.regels;

test('een tweede bevestiging van dezelfde partij op hetzelfde feit wordt geweigerd, ook met andere tekst', async () => {
  const { L } = huis();
  const f = (await L.zet('ka', { kapitaal: 'vermogen', wat: 'NK junior', op: GISTEREN })).regel;
  const a = await L.bevestig('ka', f.id, { herkomst: 'bevestigd', door: 'Club Noord (manager)', wat: 'klopt' });
  assert.equal(a.status, 200);
  const b = await L.bevestig('ka', f.id, { herkomst: 'bevestigd', door: 'Club Noord (manager)', wat: 'klopt echt' });
  assert.equal(b.status, 409, 'een partij bevestigt een feit een keer');
});

test('een partij kan niet eindeloos bevestigen en intrekken', async () => {
  const { L } = huis();
  const f = (await L.zet('ka', { kapitaal: 'vermogen', wat: 'NK junior', op: GISTEREN })).regel;
  let laatste;
  for (let i = 0; i < R.MAX_BEVESTIGINGEN_PER_PARTIJ + 2; i++) {
    laatste = await L.bevestig('ka', f.id, { herkomst: 'bevestigd', door: 'Club Noord', wat: 'ronde ' + i });
    if (laatste.status !== 200) break;
    await L.intrek('ka', laatste.regel.id, { door: 'Club Noord', reden: 'vergist' });
  }
  assert.equal(laatste.status, 409, 'na ' + R.MAX_BEVESTIGINGEN_PER_PARTIJ + ' keer houdt het op');
});

test('er verdwijnt nooit een regel, en een vol ledger weigert met reden', async () => {
  const { db, L } = huis();
  const eerste = (await L.zet('ka', { kapitaal: 'vermogen', wat: 'Het allereerste feit', op: GISTEREN })).regel;
  /* Vul tot de rand, rechtstreeks: de vorm van een regel doet hier niet ter zake. */
  const rs = reeks(db);
  while (rs.length < R.MAX_REGELS) rs.push({ id: 'v' + rs.length, at: new Date().toISOString(), soort: 'feit', kapitaal: 'vermogen', wat: 'vul ' + rs.length, op: GISTEREN, herkomst: 'zelf' });
  const r = await L.zet('ka', { kapitaal: 'vermogen', wat: 'Een te veel', op: GISTEREN });
  assert.equal(r.status, 409, 'vol is vol, met een weigering');
  assert.match(r.error, /vol/i);
  assert.equal(rs[0].id, eerste.id, 'het eerste feit staat er nog');
  assert.equal(rs.length, R.MAX_REGELS, 'en er is niets geknipt');
});

test('een ander vult het ledger niet tot de rand: de laatste ruimte is voor de eigenaar', async () => {
  const { db, L } = huis();
  const f = (await L.zet('ka', { kapitaal: 'vermogen', wat: 'NK junior', op: GISTEREN })).regel;
  const rs = reeks(db);
  while (rs.length < R.MAX_REGELS - R.RUIMTE_EIGENAAR) rs.push({ id: 'v' + rs.length, at: new Date().toISOString(), soort: 'feit', kapitaal: 'vermogen', wat: 'vul ' + rs.length, op: GISTEREN, herkomst: 'zelf' });
  const b = await L.bevestig('ka', f.id, { herkomst: 'bevestigd', door: 'Club Noord', wat: 'klopt' });
  assert.equal(b.status, 409, 'een bevestiging past niet meer');
  const z = await L.zet('ka', { kapitaal: 'vermogen', wat: 'Mijn eigen nieuwe feit', op: GISTEREN });
  assert.equal(z.status, 200, 'de eigenaar kan nog wel schrijven');
});

test('een vol afschrift zegt dat het vol is, en niet meer dat er oudere regels kunnen ontbreken', async () => {
  const { db, L } = huis();
  await L.zet('ka', { kapitaal: 'vermogen', wat: 'NK junior', op: GISTEREN });
  const rs = reeks(db);
  while (rs.length < R.MAX_REGELS) rs.push({ id: 'v' + rs.length, at: new Date().toISOString(), soort: 'feit', kapitaal: 'vermogen', wat: 'vul ' + rs.length, op: GISTEREN, herkomst: 'zelf' });
  const a = L.afschrift('ka');
  assert.equal(a.vol, true, 'het afschrift zegt dat het ledger vol is');
  assert.equal(a.misschienAfgekapt, undefined, 'de oude vlag bestaat niet meer: er wordt niets geknipt');
  assert.ok(!a.nietZegt.some((z) => /kunnen oudere regels ontbreken|ontbreken -- ook een intrekking/.test(z)), 'en het belooft geen gemis meer');
  const bron = require('fs').readFileSync('public/apps/loopbaan.html', 'utf8');
  assert.ok(!/oudere regels kunnen ontbreken/.test(bron), 'het scherm zegt het ook niet meer');
});
