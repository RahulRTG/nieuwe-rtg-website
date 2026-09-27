/* DE TIKCODE EN HET VASTZETTEN (CODECREDENTIALS.json, deuren pay.tikcode en
   pay.kascode_en_vooraf). Zelfde wereld als test/kascode-credential.test.js
   (test/lib/kaswereld.js). De mutaties waarop deze toetsen zakken staan in de
   commit.

   Draai los: node --test test/kascode-tik-vooraf.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const wereld = require('./lib/kaswereld');

test('de tik: 128 bits, een gebruik per betaler en sleutel, een plafond en intrekken', async () => {
  const w = wereld();
  const t = await w.tik.tikCode({ codenaam: 'B' });
  assert.match(t.code, /^TK(-[0-9A-F]{4}){8}$/);
  const rij = () => Object.values(w.data.payTikToegang)[0];
  assert.equal(JSON.stringify(w.data).includes(w.kaal(t.code).slice(2)), false, 'nergens een kale code');
  assert.deepEqual([rij().toegang.issuer, rij().toegang.doel, rij().toegang.max_gebruik], ['rtg.lid.tik', 'pay-tik', 25]);
  assert.equal((await w.tik.tikBetaal({ van: 'A', code: t.code, centen: 100, idem: 'p' })).ok, true);
  await w.tik.tikBetaal({ van: 'A', code: t.code, centen: 100, idem: 'p' });
  assert.equal(rij().toegang.gebruik, 1, 'dezelfde betaler met dezelfde sleutel telt een keer');
  assert.equal((await w.tik.tikBetaal({ van: 'C', code: t.code, centen: 99999, idem: 'q' })).status, 402);
  assert.equal(rij().toegang.gebruik, 1, 'een weigering geeft haar gebruik terug');
  assert.equal((await w.tik.tikBetaal({ van: 'B', code: t.code, centen: 1, idem: 'z' })).status, 400, 'eigen tik');
  for (let i = 1; i < 25; i++) await w.tik.tikBetaal({ van: 'A', code: t.code, centen: 1, idem: 'r' + i });
  assert.equal((await w.tik.tikBetaal({ van: 'C', code: t.code, centen: 1, idem: 's' })).status, 409, 'de tafel is vol');
  const u = await w.tik.tikCode({ codenaam: 'B' });
  assert.equal((await w.tik.tikCode({ codenaam: 'B', idem: 'k' })).ok, true);
  assert.equal((await w.tik.tikCode({ codenaam: 'B', idem: 'k' })).status, 409, 'geen tweede code op dezelfde sleutel');
  assert.equal((await w.tik.tikBetaal({ van: 'A', code: u.code, centen: 1, idem: 't' })).status, 404, 'geroteerd');
  assert.equal((await w.tik.tikIntrek({ codenaam: 'B' })).ingetrokken, 1);
  assert.equal((await w.tik.tikIntrek({ codenaam: 'B' })).ingetrokken, 0);
});

test('de tik verloopt, en tegelijk tikken telt elk gebruik precies een keer', async () => {
  const w = wereld();
  const t = await w.tik.tikCode({ codenaam: 'B' });
  await Promise.all([1, 2, 3].map(i => w.tik.tikBetaal({ van: 'A', code: t.code, centen: 10, idem: 'g' + i })));
  assert.equal(Object.values(w.data.payTikToegang)[0].toegang.gebruik, 3);
  assert.equal(w.saldi()['lid:B'], 30);
  w.klok.t += 300001;
  assert.equal((await w.tik.tikBetaal({ van: 'A', code: t.code, centen: 10, idem: 'h' })).status, 404);
});

test('vooraf: een claim, een reservering met een id uit de claim, en een keer vastleggen', async () => {
  const w = wereld();
  const k = await w.kassa.kasCode({ codenaam: 'A', maxCenten: 20000 });
  const [x, y] = await Promise.all([
    w.vooraf.kasVooraf({ supplierCode: 'H', code: k.code, maxCenten: 8000, idem: 'v1' }),
    w.vooraf.kasVooraf({ supplierCode: 'H2', code: k.code, maxCenten: 8000, idem: 'v2' })]);
  assert.equal([x, y].filter(r => r.ok).length, 1);
  const v = x.ok ? x : y, zaak = x.ok ? 'H' : 'H2';
  assert.match(v.reservering, /^RS[0-9A-F]{10}$/);
  assert.equal(w.waarde.reserveringenVan(zaak).length, 1, 'precies een reservering');
  const [a, b] = await Promise.all([
    w.vooraf.kasVastleg({ supplierCode: zaak, reservering: v.reservering, centen: 6000, idem: 'c1' }),
    w.vooraf.kasVastleg({ supplierCode: zaak, reservering: v.reservering, centen: 6000, idem: 'c2' })]);
  assert.equal([a, b].filter(r => r.ok).length, 1, JSON.stringify([a, b]));
  assert.equal(w.regels('kassa').length, 1, 'een keer geboekt');
  assert.equal((a.ok ? a : b).vrijgevallen, 2000);
  assert.equal((await w.vooraf.kasVastleg({ supplierCode: zaak, reservering: v.reservering, centen: 6000,
    idem: a.ok ? 'c1' : 'c2' })).herhaald, true);
  assert.equal((await w.vooraf.kasVrijgeef({ supplierCode: zaak, reservering: v.reservering })).status, 409,
    'wat is vastgelegd, geeft niemand meer vrij');
});

test('vooraf en vastleggen overleven een crash zonder tweede reservering of boeking', async () => {
  const w = wereld();
  const k = await w.kassa.kasCode({ codenaam: 'A', maxCenten: 20000 });
  const v = await w.vooraf.kasVooraf({ supplierCode: 'H', code: k.code, maxCenten: 5000, idem: 'v' });
  /* Een proces dat na het reserveren wegviel: de claim staat nog open. */
  const rij = Object.values(w.data.payKasToegang)[0];
  Object.assign(rij, { stand: 'claimend', uitkomst: null });
  w.klok.t += 61000;
  const nog = await w.vooraf.kasVooraf({ supplierCode: 'H', code: k.code, maxCenten: 5000, idem: 'v' });
  assert.equal(nog.reservering, v.reservering, 'dezelfde reservering, geen tweede');
  assert.equal(w.waarde.reserveringenVan('H').length, 1);
  w.stuk.crash = true;
  assert.equal((await w.vooraf.kasVastleg({ supplierCode: 'H', reservering: v.reservering, centen: 3000, idem: 'c' })).status, 503);
  assert.equal((await w.vooraf.kasVastleg({ supplierCode: 'H', reservering: v.reservering, centen: 3000, idem: 'c' })).code, 'KASCODE_BEZIG');
  w.klok.t += 61000;
  assert.equal((await w.vooraf.kasVastleg({ supplierCode: 'H', reservering: v.reservering, centen: 3000, idem: 'c' })).ok, true);
  assert.equal(w.regels('kassa').length, 1, 'een boeking, ook na de hervatting');
});

test('vrijgeven wint van vastleggen, en een andere zaak komt er niet bij', async () => {
  const w = wereld();
  const k = await w.kassa.kasCode({ codenaam: 'A', maxCenten: 20000 });
  const v = await w.vooraf.kasVooraf({ supplierCode: 'H', code: k.code, maxCenten: 5000, idem: 'v' });
  assert.equal((await w.vooraf.kasVastleg({ supplierCode: 'X', reservering: v.reservering, idem: 'x' })).status, 404);
  assert.equal((await w.vooraf.kasVrijgeef({ supplierCode: 'X', reservering: v.reservering })).status, 404);
  assert.equal((await w.vooraf.kasVrijgeef({ supplierCode: 'H', reservering: v.reservering })).vrijgevallen, 5000);
  assert.equal((await w.vooraf.kasVastleg({ supplierCode: 'H', reservering: v.reservering, idem: 'y' })).status, 409);
  assert.equal(w.regels('kassa').length, 0);
});

test('twee potjes: een weigering op het tweede deel draait het eerste terug, ook na een crash', async () => {
  const w = wereld({ delen: [{ rek: 'budget:A', centen: 400 }, { rek: 'lid:A', centen: 600, eigen: true }] });
  w.saldi()['budget:A'] = 400;
  const k = await w.kassa.kasCode({ codenaam: 'A', maxCenten: 5000 });
  /* Deel 1 boekt (aanroep 1), deel 2 weigert (2), de tegenboeking commit en het
     antwoord raakt kwijt (3). De terugdraaistand staat dan al vast. */
  Object.assign(w.stuk, { weiger: { status: 403, error: 'grens' }, weigerRek: 'lid:A', crashBij: 3 });
  assert.equal((await w.kassa.kasInt({ supplierCode: 'Z', code: k.code, centen: 1000, idem: 'd' })).status, 503);
  assert.equal(w.saldi()['budget:A'], 400, 'het budgetdeel is teruggedraaid');
  w.stuk.weiger = null;
  w.klok.t += 61000;
  /* Deel 2 zou nu slagen. Een hervatting die de stand niet las, boekte vooruit. */
  const r = await w.kassa.kasInt({ supplierCode: 'Z', code: k.code, centen: 1000, idem: 'd' });
  assert.equal(r.status, 403, 'de hervatting maakt het terugdraaien af, niet de betaling');
  assert.equal(w.saldi()['partner:Z'] || 0, 0);
  assert.equal(w.regels('terug').length, 1, 'een tegenboeking, ook na de herhaling');
  assert.equal(Object.values(w.data.payKasToegang)[0].stand, 'open', 'de code is terug bij het lid');
  assert.equal((await w.kassa.kasInt({ supplierCode: 'Z', code: k.code, centen: 1000, idem: 'd2' })).ok, true);
  assert.equal(w.saldi()['partner:Z'], 1000 - 20, 'min de betaaldienstkosten');
});

test('de oude kale codes openen niets en worden gewist', async () => {
  const w = wereld();
  w.data.payCodes = [{ code: 'A1B2C3', codenaam: 'A', maxCenten: 5000, geldigTot: w.klok.t + 1000, gebruikt: false }];
  w.data.payTikCodes = [{ code: 'D4E5F6', codenaam: 'B', geldigTot: w.klok.t + 1000 }];
  assert.equal((await w.kassa.kasInt({ supplierCode: 'Z', code: 'A1B2C3', centen: 100, idem: 'o' })).status, 404);
  assert.equal((await w.tik.tikBetaal({ van: 'A', code: 'D4E5F6', centen: 100, idem: 'o' })).status, 404);
  await w.kassa.kasCode({ codenaam: 'A' });
  await w.tik.tikCode({ codenaam: 'B' });
  assert.deepEqual([w.data.payCodes, w.data.payTikCodes], [[], []]);
});
