/* ============================================================================
   RTG PAY VERZOEKEN (server/kern/pay/verzoeken.js), ZONDER SERVER.

   Geld sturen, Klompjes maken, betalen en intrekken, en het overzicht voor
   het lid. De boeking zelf is een nep-betaalMetDekking die per geval een
   tekort, een weigering, een herhaling of een gewone boeking teruggeeft; de
   idem-laag is de echte. Getoetst: wie wat betaalt, het bedrag per persoon
   bij splitsen, een betaling per verzoek (ook gelijktijdig), en welke
   getallen het overzicht toont met en zonder waardelaag.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const maakIdem = require('../server/lib/idem');
const maakVerzoeken = require('../server/kern/pay/verzoeken');

const rekLid = c => 'lid:' + c;

function opzet(extra) {
  const data = { paySaldi: {}, payKlompjes: [], payBoekingen: [] };
  const staat = { seintjes: [], dekking: [], saves: 0, n: 0, antwoord: null };
  const saldoVan = k => data.paySaldi[k] || 0;
  const ctx = Object.assign({
    crypto, save: () => { staat.saves++; }, schoon: (s, n) => String(s == null ? '' : s).trim().slice(0, n),
    nu: () => '2026-10-01T09:00:00.000Z', d: () => data,
    klompjes: () => data.payKlompjes, klompjesKijk: () => data.payKlompjes,
    grootboek: () => data.payBoekingen, grootboekKijk: () => data.payBoekingen,
    rekLid, saldoVan, walletRuimte: () => 12345, walletMax: () => 500000,
    id: p => p + '-' + (++staat.n),
    metIdem: maakIdem({ d: () => data, save: () => {}, naam: 'payIdem' }),
    boekAsync: async () => ({ ok: true }),
    betaalMetDekking: async (v) => {
      staat.dekking.push(v);
      if (staat.wacht) await staat.wacht;
      if (staat.antwoord) return staat.antwoord(v);
      data.paySaldi[v.boeking.van] = saldoVan(v.boeking.van) - v.centen;
      data.paySaldi[v.boeking.naar] = saldoVan(v.boeking.naar) + v.centen;
      return { z: { ok: true, bijgeladen: 0 }, b: { ok: true, boeking: { id: 'PB-' + staat.dekking.length } } };
    },
    seintje: c => staat.seintjes.push(c),
    bestaatLid: async c => ['ANNA', 'BOB', 'CEES', 'DIRK'].includes(c),
    waarde: null,
    MIN_CENTEN: 1, MAX_CENTEN: 500000, KASCODE_MS: 60000
  }, extra || {});
  return { v: maakVerzoeken(ctx), data, staat };
}

test('stuur: aan niemand, aan jezelf of aan een onbekende gaat niet', async () => {
  const { v, staat } = opzet();
  assert.equal((await v.stuur({ van: 'ANNA', aanCodenaam: '', centen: 5, idem: 'a' })).status, 400);
  assert.equal((await v.stuur({ van: 'ANNA', aanCodenaam: 'ANNA', centen: 5, idem: 'a' })).status, 400);
  assert.equal((await v.stuur({ van: 'ANNA', aanCodenaam: 'ZOE', centen: 5, idem: 'a' })).status, 404);
  assert.equal((await v.stuur({ van: 'ANNA', aanCodenaam: 'BOB', centen: 5 })).code, 'IDEMPOTENTIESLEUTEL_VERPLICHT');
  assert.equal(staat.dekking.length, 0);
});

test('stuur: boekt een keer, meldt de ontvanger, en een herhaling boekt niet opnieuw', async () => {
  const { v, data, staat } = opzet();
  const r = await v.stuur({ van: 'ANNA', aanCodenaam: ' BOB ', centen: 750, idem: 's1' });
  assert.deepEqual(r, { ok: true, saldo: -750, bijgeladen: 0, boeking: 'PB-1' });
  assert.deepEqual(staat.dekking[0].boeking, { van: 'lid:ANNA', naar: 'lid:BOB', centen: 750, soort: 'p2p', oms: 'Zomaar' });
  assert.deepEqual(staat.seintjes, ['BOB']);
  const nog = await v.stuur({ van: 'ANNA', aanCodenaam: 'BOB', centen: 750, idem: 's1', oms: 'andere tekst' });
  assert.equal(nog.herhaald, true, 'een andere omschrijving is geen ander verzoek');
  assert.equal(data.paySaldi['lid:BOB'], 750);
  const ander = await v.stuur({ van: 'ANNA', aanCodenaam: 'BOB', centen: 751, idem: 's1' });
  assert.equal(ander.status, 409);
  await v.stuur({ van: 'ANNA', aanCodenaam: 'BOB', centen: 5, idem: 's2', soort: 'fooi', oms: 'dank' });
  assert.deepEqual([staat.dekking[1].boeking.soort, staat.dekking[1].boeking.oms], ['fooi', 'dank']);
});

test('stuur: een mislukt bijladen of een geweigerde boeking komt ongewijzigd terug', async () => {
  const { v, staat } = opzet();
  staat.antwoord = () => ({ z: { status: 503, error: 'kaart weg' }, b: null });
  assert.equal((await v.stuur({ van: 'ANNA', aanCodenaam: 'BOB', centen: 5, idem: 'f1' })).error, 'kaart weg');
  staat.antwoord = () => ({ z: { ok: true, bijgeladen: 0 }, b: { status: 402, error: 'te weinig' } });
  assert.equal((await v.stuur({ van: 'ANNA', aanCodenaam: 'BOB', centen: 5, idem: 'f2' })).status, 402);
  assert.deepEqual(staat.seintjes, [], 'niemand gemeld');
});

test('verzoekMaak: ontvangers worden ontdubbeld en gekeurd, het bedrag ingevuld', async () => {
  const { v } = opzet();
  assert.equal((await v.verzoekMaak({ van: 'ANNA', aan: ['ANNA', '', null] })).status, 400);
  assert.match((await v.verzoekMaak({ van: 'ANNA', aan: ['BOB', 'ZOE'], totaalCenten: 100 })).error, /ZOE/);
  assert.equal((await v.verzoekMaak({ van: 'ANNA', aan: 'BOB' })).error, 'Vul een bedrag in.');
  assert.equal((await v.verzoekMaak({ van: 'ANNA', aan: 'BOB', totaalCenten: -5 })).status, 400);
  assert.match((await v.verzoekMaak({ van: 'ANNA', aan: 'BOB', perCenten: 600000 })).error, /per persoon/);
  assert.equal((await v.verzoekMaak({ van: 'ANNA', aan: ['BOB', 'CEES', 'DIRK'], totaalCenten: 2 })).status, 400,
    'twee centen over drie is nul per persoon');
});

test('verzoekMaak: splitsen met jezelf deelt door de hele groep', async () => {
  const { v, data, staat } = opzet();
  const r = await v.verzoekMaak({ van: 'ANNA', aan: ['BOB', 'CEES', 'BOB'], totaalCenten: 3000, splitsMetMij: true, oms: 'Diner' });
  assert.equal(r.ok, true);
  assert.equal(r.perPersoon, 1000);
  assert.deepEqual(r.verzoeken.map(x => [x.aan, x.centen, x.status, x.oms]), [['BOB', 1000, 'open', 'Diner'], ['CEES', 1000, 'open', 'Diner']]);
  assert.equal(r.verzoeken[0].groep, r.verzoeken[1].groep);
  assert.deepEqual(staat.seintjes, ['BOB', 'CEES']);
  const zonder = await v.verzoekMaak({ van: 'ANNA', aan: ['BOB', 'CEES'], totaalCenten: 3000 });
  assert.equal(zonder.perPersoon, 1500);
  const vast = await v.verzoekMaak({ van: 'ANNA', aan: 'DIRK', perCenten: 250 });
  assert.equal(vast.verzoeken[0].oms, 'Klompje');
  assert.equal(data.payKlompjes.length, 5);
  assert.equal(data.payKlompjes[0].aan, 'DIRK', 'het nieuwste staat vooraan');
});

test('verzoekMaak met sleutel: een herhaling maakt geen tweede klompje, en de lijst blijft op 5000', async () => {
  const { v, data } = opzet();
  for (let i = 0; i < 5000; i++) data.payKlompjes.push({ id: 'oud' + i, van: 'X', aan: 'Y', status: 'open' });
  const a = await v.verzoekMaak({ van: 'ANNA', aan: 'BOB', perCenten: 500, idem: 'k1' });
  const b = await v.verzoekMaak({ van: 'ANNA', aan: 'BOB', perCenten: 500, idem: 'k1' });
  assert.equal(b.herhaald, true);
  assert.equal(b.verzoeken[0].id, a.verzoeken[0].id);
  assert.equal(data.payKlompjes.length, 5000);
  assert.equal(data.payKlompjes[0].id, a.verzoeken[0].id);
});

test('verzoekenVoor: open aan mij, en alles van mij', async () => {
  const { v } = opzet();
  const { verzoeken: [k] } = await v.verzoekMaak({ van: 'ANNA', aan: 'BOB', perCenten: 500 });
  await v.verzoekMaak({ van: 'BOB', aan: 'ANNA', perCenten: 200 });
  assert.equal(v.verzoekIntrek({ codenaam: 'ANNA', verzoekId: k.id }).ok, true);
  const bob = v.verzoekenVoor('BOB');
  assert.deepEqual(bob.aanMij, [], 'een ingetrokken verzoek staat niet meer open');
  assert.equal(bob.vanMij.length, 1);
  assert.equal(v.verzoekenVoor('ANNA').aanMij.length, 1);
});

test('verzoekBetaal: alleen de ontvanger, alleen open, en een keer', async () => {
  const { v, data, staat } = opzet();
  const { verzoeken: [k] } = await v.verzoekMaak({ van: 'ANNA', aan: 'BOB', perCenten: 2500 });
  staat.seintjes.length = 0;
  assert.equal((await v.verzoekBetaal({ codenaam: 'CEES', verzoekId: k.id, idem: 'b' })).status, 404);
  assert.equal((await v.verzoekBetaal({ codenaam: 'BOB', verzoekId: k.id })).code, 'IDEMPOTENTIESLEUTEL_VERPLICHT');
  const r = await v.verzoekBetaal({ codenaam: 'BOB', verzoekId: k.id, idem: 'b1' });
  assert.deepEqual(r, { ok: true, saldo: -2500, bijgeladen: 0 });
  assert.equal(k.status, 'betaald');
  assert.equal(k.betaaldAt, '2026-10-01T09:00:00.000Z');
  assert.match(staat.dekking[0].boeking.economischeSleutel, /^pay-klompje:[0-9a-f]{64}$/);
  assert.equal(staat.dekking[0].boeking.ref, k.id);
  assert.deepEqual(staat.seintjes, ['ANNA']);
  assert.equal((await v.verzoekBetaal({ codenaam: 'BOB', verzoekId: k.id, idem: 'b2' })).status, 409);
  assert.equal(data.paySaldi['lid:ANNA'], 2500);
});

test('verzoekBetaal: twee gelijktijdige betalingen met eigen sleutels, maar een gaat door', async () => {
  const { v, staat } = opzet();
  const { verzoeken: [k] } = await v.verzoekMaak({ van: 'ANNA', aan: 'BOB', perCenten: 2500 });
  let los;
  staat.wacht = new Promise(res => { los = res; });
  const eerste = v.verzoekBetaal({ codenaam: 'BOB', verzoekId: k.id, idem: 'r1' });
  await new Promise(res => setImmediate(res));
  const tweede = await v.verzoekBetaal({ codenaam: 'BOB', verzoekId: k.id, idem: 'r2' });
  assert.equal(tweede.status, 409);
  assert.match(tweede.error, /op dit moment al betaald/);
  los();
  assert.equal((await eerste).ok, true);
  assert.equal(staat.dekking.length, 1);
});

test('verzoekBetaal: een herhaling bij het grootboek is al betaald en meldt niemand', async () => {
  const { v, staat } = opzet();
  const { verzoeken: [k] } = await v.verzoekMaak({ van: 'ANNA', aan: 'BOB', perCenten: 900 });
  staat.seintjes.length = 0;
  staat.antwoord = () => ({ z: { ok: true, bijgeladen: 1000 }, b: { ok: true, herhaald: true, boeking: { id: 'PB-x' } } });
  const r = await v.verzoekBetaal({ codenaam: 'BOB', verzoekId: k.id, idem: 'h1' });
  assert.deepEqual(r, { ok: true, alBetaald: true, saldo: 0, bijgeladen: 1000 });
  assert.equal(k.status, 'betaald');
  assert.deepEqual(staat.seintjes, []);
});

test('verzoekBetaal: bijladen mislukt of boeking geweigerd laat het verzoek open', async () => {
  const { v, staat } = opzet();
  const { verzoeken: [k] } = await v.verzoekMaak({ van: 'ANNA', aan: 'BOB', perCenten: 900 });
  staat.antwoord = () => ({ z: { status: 502, error: 'kaart' }, b: null });
  assert.equal((await v.verzoekBetaal({ codenaam: 'BOB', verzoekId: k.id, idem: 'e1' })).status, 502);
  staat.antwoord = () => ({ z: { ok: true }, b: { status: 403, error: 'waardepoort' } });
  assert.equal((await v.verzoekBetaal({ codenaam: 'BOB', verzoekId: k.id, idem: 'e2' })).status, 403);
  assert.equal(k.status, 'open');
  staat.antwoord = () => { k.status = 'ingetrokken'; return { z: { ok: true, bijgeladen: 0 }, b: { ok: true, boeking: { id: 'B' } } }; };
  const r = await v.verzoekBetaal({ codenaam: 'BOB', verzoekId: k.id, idem: 'e3' });
  assert.equal(r.ok, true);
  assert.equal(k.status, 'ingetrokken', 'een stand die intussen veranderde wordt niet overschreven');
});

test('verzoekBetaal: een verzoek dat binnen het slot al dicht blijkt, boekt niet', async () => {
  const { v, data, staat } = opzet();
  const { verzoeken: [k] } = await v.verzoekMaak({ van: 'ANNA', aan: 'BOB', perCenten: 900 });
  const echteIdem = maakIdem({ d: () => data, save: () => {}, naam: 'x' });
  const { v: v2 } = opzet({ klompjesKijk: () => data.payKlompjes,
    metIdem: (s, a, werk, o) => { k.status = 'betaald'; return echteIdem(s, a, werk, o); } });
  const r = await v2.verzoekBetaal({ codenaam: 'BOB', verzoekId: k.id, idem: 'z1' });
  assert.equal(r.status, 409);
  assert.equal(staat.dekking.length, 0);
  assert.equal(v.verzoekenVoor('BOB').aanMij.length, 0, 'het verzoek staat niet meer open');
});

test('verzoekIntrek: alleen de maker, alleen open', async () => {
  const { v } = opzet();
  const { verzoeken: [k] } = await v.verzoekMaak({ van: 'ANNA', aan: 'BOB', perCenten: 100 });
  assert.equal(v.verzoekIntrek({ codenaam: 'BOB', verzoekId: k.id }).status, 404);
  assert.deepEqual(v.verzoekIntrek({ codenaam: 'ANNA', verzoekId: k.id }), { ok: true });
  assert.equal(v.verzoekIntrek({ codenaam: 'ANNA', verzoekId: k.id }).status, 409);
});

test('overzicht: geschiedenis met tegenpartij en teken, zonder waardelaag', async () => {
  const { v, data } = opzet();
  data.paySaldi['lid:ANNA'] = 4000;
  data.payBoekingen.push(
    { id: '1', van: 'extern:oplaad', naar: 'lid:ANNA', centen: 5000, soort: 'oplaad', oms: 'Opladen', at: 't1' },
    { id: '2', van: 'lid:ANNA', naar: 'partner:KIKUNOI', centen: 800, soort: 'betaal', oms: 'Lunch', at: 't2' },
    { id: '3', van: 'lid:ANNA', naar: 'extern:uitbetaald', centen: 200, soort: 'uit', oms: 'Bank', at: 't3' },
    { id: '4', van: 'lid:BOB', naar: 'lid:CEES', centen: 1, soort: 'p2p', oms: 'x', at: 't4' });
  const o = v.overzicht('ANNA');
  assert.deepEqual(o.geschiedenis.map(r => [r.id, r.centen, r.tegen]),
    [['1', 5000, 'opgeladen'], ['2', -800, 'zaak KIKUNOI'], ['3', -200, 'bank']]);
  assert.deepEqual([o.saldo, o.gereserveerd, o.beschikbaar, o.plafond, o.ruimte], [4000, 0, 4000, 500000, 12345]);
  assert.deepEqual(o.reserveringen, []);
  assert.equal(v.overzicht('BOB').geschiedenis.length, 1);
});

test('overzicht met waardelaag: gereserveerd gaat van beschikbaar af', () => {
  const waarde = { gereserveerd: () => 1500,
    reserveringen: () => [{ id: 'R1', centen: 1500, doel: 'borg', tot: 't', ref: 'zaak:X', extra: 'weg' }] };
  const { v, data } = opzet({ waarde });
  data.paySaldi['lid:ANNA'] = 4000;
  const o = v.overzicht('ANNA');
  assert.equal(o.beschikbaar, 2500);
  assert.deepEqual(o.reserveringen, [{ id: 'R1', centen: 1500, doel: 'borg', tot: 't', door: 'zaak:X' }]);
});
