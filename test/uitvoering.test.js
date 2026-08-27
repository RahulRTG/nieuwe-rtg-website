/* UITVOERENDE MEDIA: een maker publiceert een partituur, en RTG maakt daar op
   het moment van vragen één uitvoering van (UITVOEREND.md).

   Wat hier bewezen moet worden is vooral wat de laag NIET doet. Een montage
   die het gevraagde niet haalt, hoort te WEIGEREN met de reden -- niet iets
   anders te leveren dat er ongeveer op lijkt. En een fragment is nooit een weg
   naar werk dat de kijker niet mag zien.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - de kern-past-niet-controle uit uitvoer.js gehaald
     -> "een budget onder de kern levert een weigering, geen korter werk" ZAKT (RAAK)
   - de aanspraakcontrole altijd laten slagen
     -> "zonder aanspraak komt er geen uitvoering" ZAKT (RAAK)
   - de eigendomscontrole (`rij.mijn`) uit partituur.js gehaald
     -> "een partituur gaat over eigen werk" ZAKT (RAAK)
   - de ontbrekende-kern-weigering uit uitvoer.js gehaald
     -> "een verdwenen kern weigert" ZAKT (RAAK)
   - de (code, bron)-controle uit aanspraak.js gehaald
     -> "dezelfde bron verleent maar EEN aanspraak" ZAKT (RAAK)

   Draai los: node --experimental-sqlite --test test/uitvoering.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, maker, kijker, makerNaam, kijkerNaam;
let kernFrag, fragA, fragB, clipA, clipB, clipC, p1;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-uitv-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function lid(naam) {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  return (await api('/api/auth/register', { name: naam, email: 'uit' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-04-04', geslacht: 'x', tier: 'rtg', pasApp: 'rtg' })).body.token;
}
const codenaamVan = async (t) => ((await api('/api/state', {}, t)).body.state || {}).user.codename;
const clip = async (titel, duurS, token) => (await api('/api/clips/maak', { titel, duurS, mbGeschat: 2 }, token)).body.id;

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  maker = await lid('Maker'); kijker = await lid('Kijker');
  makerNaam = await codenaamVan(maker); kijkerNaam = await codenaamVan(kijker);

  // het eigen werk van de maker: een uitgegeven stuk en drie korte video's
  const trackId = (await api('/api/muziek/maak', {}, maker)).body.track.id;
  await api('/api/muziek/bewaar', { id: trackId, naam: 'Middernacht', klaar: true }, maker);
  const uitgaveId = (await api('/api/muziek/uitgeven', { id: trackId, toelichting: 'x' }, maker)).body.uitgave.id;
  clipA = await clip('Aanloop', 20, maker);
  clipB = await clip('Uitloop', 20, maker);
  clipC = await clip('Los stuk', 20, maker);
  kernFrag = 'fragment:track:' + uitgaveId + '@0-60';
  fragA = 'fragment:clip:' + clipA + '@0-10';
  fragB = 'fragment:clip:' + clipB + '@0-20';

  p1 = (await api('/api/uitvoering/partituur/maak', { naam: 'De lange weg' }, maker)).body.partituur.id;
  assert.ok(p1, 'de partituur is aangemaakt');
  assert.equal((await api('/api/uitvoering/partituur/onderdeel',
    { id: p1, fragmentId: kernFrag, rol: 'kern', naam: 'Het stuk zelf' }, maker)).status, 200);
  assert.equal((await api('/api/uitvoering/partituur/onderdeel',
    { id: p1, fragmentId: fragA, rol: 'verdieping', diepte: 1, naam: 'Aanloop' }, maker)).status, 200);
  assert.equal((await api('/api/uitvoering/partituur/onderdeel',
    { id: p1, fragmentId: fragB, rol: 'verdieping', diepte: 3, naam: 'Uitloop' }, maker)).status, 200);
  await api('/api/uitvoering/partituur/zet', { id: p1, toestemming: { inkorten: true }, klaar: true }, maker);
});
test.after(() => stop(srv));

test('een partituur gaat over EIGEN werk: het stuk van een ander komt er niet in', async () => {
  const vreemd = await clip('Van de kijker', 15, kijker);
  const r = await api('/api/uitvoering/partituur/onderdeel',
    { id: p1, fragmentId: 'fragment:clip:' + vreemd + '@0-5', rol: 'verdieping' }, maker);
  assert.equal(r.status, 403, 'andermans werk wordt geweigerd');
  assert.match(r.body.error, /eigen werk/i, 'en de reden zegt waarom');
});

test('een onzinnig fragment-id komt er niet in, en een fragment buiten de duur ook niet', async () => {
  assert.equal((await api('/api/uitvoering/partituur/onderdeel', { id: p1, fragmentId: 'clip:' + clipA }, maker)).status, 400);
  assert.equal((await api('/api/uitvoering/partituur/onderdeel', { id: p1, fragmentId: 'fragment:clip:' + clipA + '@10-5' }, maker)).status, 400);
  // een clip duurt hier 20 seconden; een fragment tot 99 bestaat niet
  const r = await api('/api/uitvoering/partituur/onderdeel', { id: p1, fragmentId: 'fragment:clip:' + clipA + '@0-99' }, maker);
  assert.equal(r.status, 400);
  assert.match(r.body.error, /duurt/, 'en het antwoord noemt de werkelijke duur');
});

test('zonder kern gaat een partituur niet open: RTG mag niet bepalen wat het werk is', async () => {
  const leeg = (await api('/api/uitvoering/partituur/maak', { naam: 'Zonder kern' }, maker)).body.partituur.id;
  await api('/api/uitvoering/partituur/onderdeel', { id: leeg, fragmentId: fragA, rol: 'verdieping' }, maker);
  const r = await api('/api/uitvoering/partituur/zet', { id: leeg, klaar: true }, maker);
  assert.equal(r.status, 400);
  assert.match(r.body.error, /kern/i);
});

test('"ik heb 75 seconden" levert een kortere uitvoering, en zegt per stuk waarom', async () => {
  const r = await api('/api/uitvoering/voer', { partituurId: p1, secondenBudget: 75 }, kijker);
  assert.equal(r.status, 200);
  const u = r.body.uitvoering;
  assert.equal(u.length, 2, 'de kern (60s) plus de verdieping die past (10s)');
  assert.equal(r.body.totaalS, 70);
  assert.ok(r.body.totaalS <= 75, 'nooit meer dan er gevraagd is');
  assert.ok(u.every(x => x.waarom), 'elke regel draagt waarom hij er staat');
  assert.equal(r.body.bewijs.weggelaten.length, 1, 'en wat er niet in zit staat er ook');
  assert.match(r.body.bewijs.weggelaten[0].reden, /ruimte/, 'met de reden erbij');
  assert.ok(r.body.bewijs.herleidbaar, 'het bewijsblok staat er');
});

test('een gevraagde diepte houdt de diepere verdieping eruit, geteld en niet stil', async () => {
  const r = await api('/api/uitvoering/voer', { partituurId: p1, diepte: 1 }, kijker);
  assert.equal(r.status, 200);
  assert.equal(r.body.uitvoering.length, 2, 'kern plus alleen de ondiepe verdieping');
  assert.match(r.body.bewijs.weggelaten[0].reden, /dieper/, 'de reden noemt de diepte');
});

test('een budget onder de kern levert een WEIGERING, geen korter werk', async () => {
  const r = await api('/api/uitvoering/voer', { partituurId: p1, secondenBudget: 30 }, kijker);
  assert.equal(r.status, 409, 'dit is een weigering en geen half werk');
  assert.equal(r.body.geweigerd, true);
  assert.match(r.body.reden, /onmisbare deel/i);
  assert.match(r.body.reden, /60/, 'en het noemt hoe lang de kern werkelijk duurt');
  assert.equal(r.body.uitvoering, undefined, 'er komt geen enkele regel mee');
});

test('staat de maker inkorten niet toe, dan bestaat er alleen het hele werk', async () => {
  await api('/api/uitvoering/partituur/zet', { id: p1, toestemming: { inkorten: false } }, maker);
  const r = await api('/api/uitvoering/voer', { partituurId: p1, secondenBudget: 75 }, kijker);
  assert.equal(r.status, 409);
  assert.match(r.body.reden, /inkorten niet toegestaan/i);
  // het hele werk mag wel gewoon
  const heel = await api('/api/uitvoering/voer', { partituurId: p1 }, kijker);
  assert.equal(heel.status, 200);
  assert.equal(heel.body.uitvoering.length, 3, 'alle drie de onderdelen');
  await api('/api/uitvoering/partituur/zet', { id: p1, toestemming: { inkorten: true } }, maker);
});

test('dezelfde vraag geeft dezelfde uitvoering: een montage is na te trekken', async () => {
  const a = await api('/api/uitvoering/voer', { partituurId: p1, secondenBudget: 75 }, kijker);
  const b = await api('/api/uitvoering/voer', { partituurId: p1, secondenBudget: 75 }, kijker);
  assert.deepEqual(a.body.uitvoering, b.body.uitvoering, 'geen toeval in de montage');
  assert.deepEqual(a.body.bewijs.weggelaten, b.body.bewijs.weggelaten);
});

test('zonder aanspraak komt er geen uitvoering, en de maker kan zijn eigen werk wel nakijken', async () => {
  await api('/api/uitvoering/partituur/zet', { id: p1, aanspraakNodig: 'masterclass-01' }, maker);
  const r = await api('/api/uitvoering/voer', { partituurId: p1 }, kijker);
  assert.equal(r.status, 403);
  assert.equal(r.body.geweigerd, true);
  assert.match(r.body.reden, /aanspraak/i);
  assert.equal(r.body.uitvoering, undefined, 'wie er niet in mag, hoort niet te zien waar het uit bestaat');
  assert.equal((await api('/api/uitvoering/voer', { partituurId: p1 }, maker)).status, 200, 'de maker zelf wel');
});

test('een aanspraak hangt aan een grond: zonder bron of herkomst komt hij er niet', async () => {
  const zonderBron = await api('/api/uitvoering/aanspraak/verleen',
    { codenaam: kijkerNaam, code: 'masterclass-01', herkomst: 'aankoop' }, maker);
  assert.equal(zonderBron.status, 400);
  assert.match(zonderBron.body.error, /grond|bron/i);
  const zonderHerkomst = await api('/api/uitvoering/aanspraak/verleen',
    { codenaam: kijkerNaam, code: 'masterclass-01', bron: 'betaling-1' }, maker);
  assert.equal(zonderHerkomst.status, 400);
});

test('niemand verleent zichzelf een aanspraak, en niet op de code van een ander', async () => {
  const zelf = await api('/api/uitvoering/aanspraak/verleen',
    { codenaam: makerNaam, code: 'masterclass-01', herkomst: 'maker', bron: 'eigen' }, maker);
  assert.equal(zelf.status, 400, 'aan uzelf verlenen kan niet');
  const vreemdeCode = await api('/api/uitvoering/aanspraak/verleen',
    { codenaam: makerNaam, code: 'masterclass-01', herkomst: 'aankoop', bron: 'x' }, kijker);
  assert.equal(vreemdeCode.status, 403, 'de kijker heeft geen partituur die deze code vraagt');
});

test('met een verleende aanspraak speelt het werk, en na intrekken niet meer', async () => {
  const v = await api('/api/uitvoering/aanspraak/verleen',
    { codenaam: kijkerNaam, code: 'masterclass-01', herkomst: 'aankoop', bron: 'betaling-77' }, maker);
  assert.equal(v.status, 200);
  const aspId = v.body.aanspraak.id;

  const r = await api('/api/uitvoering/voer', { partituurId: p1 }, kijker);
  assert.equal(r.status, 200, 'nu mag het');
  assert.equal(r.body.bewijs.aanspraak.herkomst, 'aankoop', 'en het bewijs draagt waar het recht vandaan komt');

  const mijn = await api('/api/uitvoering/aanspraken', {}, kijker);
  assert.equal(mijn.body.aanspraken[0].bron, 'betaling-77', 'het lid ziet zelf de grond');

  assert.equal((await api('/api/uitvoering/aanspraak/intrek',
    { codenaam: kijkerNaam, code: 'masterclass-01', aanspraakId: aspId }, maker)).status, 200);
  const na = await api('/api/uitvoering/voer', { partituurId: p1 }, kijker);
  assert.equal(na.status, 403, 'ingetrokken is meteen dicht');
  assert.match(na.body.reden, /ingetrokken/i, 'met een andere reden dan "u had er nooit een"');
  await api('/api/uitvoering/partituur/zet', { id: p1, aanspraakNodig: '' }, maker);
});

test('dezelfde bron verleent maar EEN aanspraak: een herhaald verzoek is geen tweede aankoop', async () => {
  await api('/api/uitvoering/partituur/zet', { id: p1, aanspraakNodig: 'les-idem' }, maker);
  const opdracht = { codenaam: kijkerNaam, code: 'les-idem', herkomst: 'aankoop', bron: 'betaling-99' };
  const een = await api('/api/uitvoering/aanspraak/verleen', opdracht, maker);
  const twee = await api('/api/uitvoering/aanspraak/verleen', opdracht, maker);
  assert.equal(een.status, 200);
  assert.equal(twee.status, 200, 'een herhaling is geen fout');
  assert.equal(twee.body.herhaald, true, 'maar hij wordt wel als herhaling herkend');
  assert.equal(twee.body.aanspraak.id, een.body.aanspraak.id, 'en levert dezelfde aanspraak op');
  const alle = (await api('/api/uitvoering/aanspraken', {}, kijker)).body.aanspraken;
  assert.equal(alle.filter(a => a.bron === 'betaling-99').length, 1, 'er staat er precies EEN in de lijst');

  // een ECHTE tweede aankoop draagt een andere bron, en die telt wel
  const derde = await api('/api/uitvoering/aanspraak/verleen',
    { codenaam: kijkerNaam, code: 'les-idem', herkomst: 'aankoop', bron: 'betaling-100' }, maker);
  assert.equal(derde.body.herhaald, undefined, 'een andere bron is een andere gebeurtenis');
  assert.notEqual(derde.body.aanspraak.id, een.body.aanspraak.id);
  await api('/api/uitvoering/partituur/zet', { id: p1, aanspraakNodig: '' }, maker);
});

test('een verdwenen verdieping valt niet stil weg maar staat er als onbeschikbaar', async () => {
  assert.equal((await api('/api/clips/weg', { id: clipA }, maker)).status, 200);
  const r = await api('/api/uitvoering/voer', { partituurId: p1 }, kijker);
  assert.equal(r.status, 200, 'de rest speelt gewoon');
  assert.equal(r.body.bewijs.nietBeschikbaar.length, 1);
  assert.match(r.body.bewijs.nietBeschikbaar[0].reden, /weggehaald|dicht/i);
});

test('een verdwenen KERN weigert: een kortere versie zou een ander werk zijn', async () => {
  const p2 = (await api('/api/uitvoering/partituur/maak', { naam: 'Op los zand' }, maker)).body.partituur.id;
  await api('/api/uitvoering/partituur/onderdeel',
    { id: p2, fragmentId: 'fragment:clip:' + clipC + '@0-20', rol: 'kern' }, maker);
  await api('/api/uitvoering/partituur/onderdeel', { id: p2, fragmentId: fragB, rol: 'verdieping' }, maker);
  await api('/api/uitvoering/partituur/zet', { id: p2, toestemming: { inkorten: true }, klaar: true }, maker);
  assert.equal((await api('/api/uitvoering/voer', { partituurId: p2 }, kijker)).status, 200, 'eerst speelt hij');

  assert.equal((await api('/api/clips/weg', { id: clipC }, maker)).status, 200);
  const r = await api('/api/uitvoering/voer', { partituurId: p2 }, kijker);
  assert.equal(r.status, 409, 'zonder kern geen uitvoering');
  assert.equal(r.body.geweigerd, true);
  assert.match(r.body.reden, /onmisbare|ander werk/i);
});

test('een gast komt er niet in', async () => {
  const r = await fetch(base + '/api/uitvoering/partituren', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.ok(r.status === 401 || r.status === 403, 'zonder token geen toegang (' + r.status + ')');
});
