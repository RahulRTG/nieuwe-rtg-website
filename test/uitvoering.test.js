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
   - het boeking-id NIET als bron maar een verzonnen sleutel (aanbod.js)
     -> "kopen laat de aanspraak ontstaan" ZAKT (RAAK)
   - de al-gekocht-controle uit aanbod.js gehaald
     -> "de HELE keten is idempotent" ZAKT (RAAK)
   - een prijs zonder aanspraak toestaan (partituur.js)
     -> "een prijs zonder aanspraak bestaat niet" ZAKT (RAAK)

   Draai los: node --experimental-sqlite --test test/uitvoering.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, maker, kijker, koper, makerNaam, kijkerNaam;
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
  /* De KOPER is het eigenaarsaccount: dat is geverifieerd, en RTG Pay vraagt
     van een gewoon vers account eerst het paspoort (onboarding payGate). Een
     toets die dat omzeilt, toetst een deur die in productie dicht zit. */
  koper = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(koper, 'het eigenaarsaccount is ingelogd als koper');

  // het eigen werk van de maker: een uitgegeven stuk en drie korte video's
  const trackId = (await api('/api/muziek/maak', {}, maker)).body.track.id;
  /* Tempo en maten expliciet: sinds een uitgave een GEREKENDE duur draagt
     (maten x 16 stappen x 60/bpm/4) valt een fragment buiten die duur er
     terecht uit. 32 maten op 60 slagen is 128 seconden, dus de kern van 60
     hieronder past. Dat de toets hierop eerst zakte, is de controle die werkt. */
  await api('/api/muziek/bewaar', { id: trackId, naam: 'Middernacht', klaar: true, bpm: 60, maten: 32 }, maker);
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

/* ---- de keten: aanbod -> aankoop -> aanspraak -> uitvoering ---- */

test('een prijs zonder aanspraak bestaat niet: dan betaalt iemand voor een open deur', async () => {
  const los = (await api('/api/uitvoering/partituur/maak', { naam: 'Gratis maar duur' }, maker)).body.partituur.id;
  const r = await api('/api/uitvoering/partituur/zet', { id: los, prijsCenten: 500 }, maker);
  assert.equal(r.status, 400);
  assert.match(r.body.error, /aanspraak/i);
});

test('de bon zegt wat je betaalt, aan wie, en wat RTG NIET doet', async () => {
  await api('/api/uitvoering/partituur/zet', { id: p1, aanspraakNodig: 'masterclass-koop', prijsCenten: 250 }, maker);
  const r = await api('/api/uitvoering/bon', { partituurId: p1 }, koper);
  assert.equal(r.status, 200);
  assert.equal(r.body.centen, 250);
  assert.equal(r.body.maker, makerNaam, 'het geld gaat naar de maker en niet naar RTG');
  assert.equal(r.body.alGekocht, false);
  assert.match(r.body.nietGebouwd, /btw|retour/i, 'de bon noemt wat er niet bij zit');
  // en de maker koopt zijn eigen werk niet
  const eigen = await api('/api/uitvoering/bon', { partituurId: p1 }, maker);
  assert.equal(eigen.status, 400);
  assert.match(eigen.body.error, /eigen werk/i);
});

test('kopen laat de aanspraak ontstaan, en daarmee gaat het werk open', async () => {
  const dicht = await api('/api/uitvoering/voer', { partituurId: p1 }, koper);
  assert.equal(dicht.status, 403, 'voor de aankoop staat het dicht');

  const k = await api('/api/uitvoering/koop', { partituurId: p1, idem: 'koop-a' }, koper);
  assert.equal(k.status, 200, JSON.stringify(k.body).slice(0, 200));
  assert.ok(k.body.boeking, 'er is echt een boeking gemaakt');
  assert.equal(k.body.aanspraak.herkomst, 'aankoop');
  assert.equal(k.body.aanspraak.bron, String(k.body.boeking), 'de BOEKING is de grond onder de aanspraak');

  const open = await api('/api/uitvoering/voer', { partituurId: p1 }, koper);
  assert.equal(open.status, 200, 'na de aankoop speelt het werk');
  assert.equal(open.body.bewijs.aanspraak.herkomst, 'aankoop');
});

test('de HELE keten is idempotent: dezelfde idem geeft een betaling en een aanspraak', async () => {
  const eerste = await api('/api/uitvoering/koop', { partituurId: p1, idem: 'koop-b' }, koper);
  const tweede = await api('/api/uitvoering/koop', { partituurId: p1, idem: 'koop-b' }, koper);
  assert.equal(tweede.status, 200);
  /* De tweede oproep komt niet eens bij de betaling: hij ziet dat de koper de
     aanspraak al heeft. Dat is de bovenste van twee vangnetten -- het onderste
     (dezelfde idem geeft dezelfde boeking, en dezelfde boeking dezelfde
     aanspraak) staat in de toets hieronder. */
  assert.equal(tweede.body.al, true, 'de tweede oproep schrijft niets af');

  const mijn = (await api('/api/uitvoering/aanspraken', {}, koper)).body.aanspraken;
  assert.equal(mijn.filter(a => a.code === 'masterclass-koop').length, 1,
    'er staat precies EEN aanspraak, hoe vaak er ook op de knop is getikt');
});

test('en het onderste vangnet ook: dezelfde boeking verleent maar EEN keer', async () => {
  /* Zonder het bovenste vangnet (de al-gekocht-controle) moet de idempotentie
     van pay.stuur plus die van verleen het werk doen. Dat is precies wat er
     gebeurt als twee verzoeken elkaar kruisen voordat de eerste klaar is. */
  const asp = (await api('/api/uitvoering/aanspraken', {}, koper)).body.aanspraken
    .find(a => a.code === 'masterclass-koop');
  assert.ok(asp, 'de aanspraak van de aankoop staat er');
  assert.match(asp.bron, /^[a-z0-9]/i, 'en zijn bron is het boeking-id, geen verzonnen sleutel');
  assert.equal(asp.herkomstNaam, 'gekocht', 'het lid leest een woord, geen code');

  /* p1 weer vrijgeven voor de toetsen hieronder. Prijs en aanspraak moeten in
     EEN opdracht weg: de aanspraak losweken terwijl er een prijs op staat wordt
     geweigerd, en dat is precies de bedoeling van die grens. */
  const vrij = await api('/api/uitvoering/partituur/zet', { id: p1, prijsCenten: 0, aanspraakNodig: '' }, maker);
  assert.equal(vrij.status, 200, 'prijs en aanspraak gaan er samen af');
  assert.equal(vrij.body.partituur.prijsCenten, 0);
});

test('de aanspraak losweken terwijl er een prijs op staat, wordt geweigerd', async () => {
  await api('/api/uitvoering/partituur/zet', { id: p1, aanspraakNodig: 'tijdelijk', prijsCenten: 300 }, maker);
  const r = await api('/api/uitvoering/partituur/zet', { id: p1, aanspraakNodig: '' }, maker);
  assert.equal(r.status, 400, 'een betaald werk zonder deur zou voor iedereen opengaan');
  assert.match(r.body.error, /prijs/i);
  await api('/api/uitvoering/partituur/zet', { id: p1, prijsCenten: 0, aanspraakNodig: '' }, maker);
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

test('een maker ziet zijn eigen werk met de duur erbij, en live valt erbuiten', async () => {
  const r = await api('/api/uitvoering/eigenwerk', {}, maker);
  assert.equal(r.status, 200);
  const eigen = r.body.stukken || [];
  assert.ok(eigen.length, 'de maker heeft werk om uit te kiezen');
  assert.ok(eigen.every(s => s.vorm !== 'live'),
    'een uitzending heeft geen lengte om een bereik in te kiezen');
  const track = eigen.find(s => s.vorm === 'track');
  assert.ok(track, 'het uitgegeven stuk staat erbij');
  assert.equal(track.duurS, 128, '32 maten op 60 slagen is 128 seconden, gerekend en niet geraden');
  /* Wat GEEN duur heeft, valt niet weg maar draagt de reden -- een maker die
     zijn werk mist gaat zoeken, een maker die leest waarom weet wat hij kan doen. */
  assert.ok(eigen.every(s => s.duurS || s.reden), 'zonder duur staat er een reden');
  // en het werk van een ander komt er niet in
  const vanKijker = await api('/api/uitvoering/eigenwerk', {}, kijker);
  const mijnIds = new Set(eigen.map(s => s.stukId));
  assert.ok((vanKijker.body.stukken || []).every(s => !mijnIds.has(s.stukId)),
    'de kijker ziet het werk van de maker hier niet');
});

/* ---- de vierde kolom: wat een stuk kan DOEN ---- */

test('een handeling wordt KLAARGEZET en nooit uitgevoerd', async () => {
  // een tweede partituur van dezelfde maker, met een prijs erop
  const t2 = (await api('/api/muziek/maak', {}, maker)).body.track.id;
  await api('/api/muziek/bewaar', { id: t2, naam: 'De masterclass', klaar: true, bpm: 60, maten: 32 }, maker);
  const u2 = (await api('/api/muziek/uitgeven', { id: t2 }, maker)).body.uitgave;
  const les = (await api('/api/uitvoering/partituur/maak', { naam: 'De masterclass' }, maker)).body.partituur.id;
  await api('/api/uitvoering/partituur/onderdeel',
    { id: les, fragmentId: 'fragment:track:' + u2.id + '@0-40', rol: 'kern' }, maker);
  await api('/api/uitvoering/partituur/zet',
    { id: les, aanspraakNodig: 'masterclass-h', prijsCenten: 900, klaar: true }, maker);

  // en een fragment in p1 dat daarnaar verwijst
  const nieuwFrag = 'fragment:clip:' + clipB + '@0-15';
  const r = await api('/api/uitvoering/partituur/onderdeel',
    { id: p1, fragmentId: nieuwFrag, rol: 'verdieping', naam: 'Meer hierover',
      handeling: { soort: 'aanbod', doel: les, label: 'De hele masterclass' } }, maker);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));

  const uit = await api('/api/uitvoering/voer', { partituurId: p1 }, kijker);
  assert.equal(uit.status, 200);
  const regel = uit.body.uitvoering.find(x => x.fragmentId === nieuwFrag);
  assert.ok(regel, 'het fragment speelt mee');
  assert.ok(regel.handeling, 'en draagt de handeling');
  assert.equal(regel.handeling.open, true);
  assert.equal(regel.handeling.wat, 'klaarzetten', 'het werkwoord staat in de kaart, niet op het scherm');
  assert.equal(regel.handeling.centen, 900, 'met wat het kost, voordat er iets gebeurt');
  assert.match(regel.handeling.let, /bon|zelf/i, 'en de belofte dat de mens bevestigt');

  /* HET SCHERPSTE: er is niets afgeschreven. Een uitvoering die geld beweegt,
     zou GELD.md par. 3 breken -- alles wat een ander raakt is klaarzetten. */
  const aanspraken = (await api('/api/uitvoering/aanspraken', {}, kijker)).body.aanspraken;
  assert.ok(!aanspraken.some(a => a.code === 'masterclass-h'),
    'het uitvoeren van een werk verleent geen aanspraak op wat erin wordt aangeboden');
  await api('/api/uitvoering/partituur/onderdeel', { id: p1, fragmentId: nieuwFrag, aan: false }, maker);
});

test('een handeling naar iets wat de kijker niet mag zien, is geen dode knop', async () => {
  // een clip van de KIJKER: voor de maker bestaat die niet als eigen werk
  const vreemdeClip = (await api('/api/clips/maak', { titel: 'Van de kijker', duurS: 12, mbGeschat: 1 }, kijker)).body.id;
  const frag = 'fragment:clip:' + clipB + '@0-12';
  await api('/api/uitvoering/partituur/onderdeel',
    { id: p1, fragmentId: frag, rol: 'verdieping', naam: 'Verwijzing',
      handeling: { soort: 'stuk', doel: 'clip:bestaatniet' } }, maker);
  const uit = await api('/api/uitvoering/voer', { partituurId: p1 }, kijker);
  const regel = uit.body.uitvoering.find(x => x.fragmentId === frag);
  assert.ok(regel.handeling, 'de kaart komt er wel');
  assert.equal(regel.handeling.open, false);
  assert.match(regel.handeling.reden, /weggehaald|dicht/i, 'met de reden erbij');
  assert.equal(vreemdeClip && true, true);
  await api('/api/uitvoering/partituur/onderdeel', { id: p1, fragmentId: frag, aan: false }, maker);
});

test('een onzinnige handeling levert GEEN handeling op, geen halve', async () => {
  const frag = 'fragment:clip:' + clipB + '@0-8';
  await api('/api/uitvoering/partituur/onderdeel',
    { id: p1, fragmentId: frag, rol: 'verdieping', handeling: { soort: 'raket', doel: 'x' } }, maker);
  const mijn = (await api('/api/uitvoering/partituren', {}, maker)).body.partituren.find(x => x.id === p1);
  const o = mijn.onderdelen.find(x => x.fragmentId === frag);
  assert.equal(o.handeling, null, 'een knop waarvan de helft ontbreekt is erger dan geen knop');
  await api('/api/uitvoering/partituur/onderdeel', { id: p1, fragmentId: frag, aan: false }, maker);
});

/* ---- ontdekken: een partituur is een vorm in de MEDIAWERELD ---- */

test('een klaargezette partituur verschijnt in de mediawereld, met een eigen stand', async () => {
  const w = await api('/api/mediaos/wereld', { modus: 'uitvoering' }, kijker);
  assert.equal(w.status, 200);
  assert.equal(w.body.modusNaam, 'Uitvoeringen');
  const mijne = (w.body.stukken || []).find(x => x.id === 'partituur:' + p1);
  assert.ok(mijne, 'de partituur van de maker staat er voor een ander lid in');
  assert.equal(mijne.vormNaam, 'Uitvoering');
  assert.equal(mijne.maker.codenaam, makerNaam, 'op codenaam, zoals alles hier');

  /* Hij SPEELT niet hier: een uitvoering begint met de vraag hoeveel tijd u
     heeft, en een speelknop zonder die vraag is een gok. */
  assert.equal(mijne.spelen.soort, 'elders');
  assert.match(mijne.spelen.reden, /uitgevoerd|tijd/i);
  assert.ok(mijne.meta.indexOf('kern') >= 0, 'de kaart zegt hoe kort het kan: ' + mijne.meta);
});

test('een partituur die NIET klaarstaat, staat niet in de wereld', async () => {
  const dicht = (await api('/api/uitvoering/partituur/maak', { naam: 'Nog niet af' }, maker)).body.partituur.id;
  await api('/api/uitvoering/partituur/onderdeel',
    { id: dicht, fragmentId: 'fragment:clip:' + clipB + '@0-5', rol: 'kern' }, maker);
  const w = await api('/api/mediaos/wereld', { modus: 'uitvoering' }, kijker);
  assert.ok(!(w.body.stukken || []).some(x => x.id === 'partituur:' + dicht),
    'werk in wording hoort niet in de etalage');
});

test('de wereld verraadt niet WAARUIT een partituur bestaat', async () => {
  /* Wie er niet in mag, hoort niet te zien welke fragmenten erin zitten -- dat
     zou een inhoudsopgave zijn van werk dat achter een deur staat. Wat er wel
     bij staat is de duur en de prijs: dat heeft iemand nodig om te kiezen. */
  const w = await api('/api/mediaos/wereld', { modus: 'uitvoering' }, kijker);
  const kaart = (w.body.stukken || []).find(x => x.id === 'partituur:' + p1);
  assert.equal(kaart.onderdelen, undefined, 'geen inhoudsopgave in de etalage');
  assert.ok(typeof kaart.kernS === 'number', 'wel hoe kort het kan');
});

test('een gast komt er niet in', async () => {
  const r = await fetch(base + '/api/uitvoering/partituren', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.ok(r.status === 401 || r.status === 403, 'zonder token geen toegang (' + r.status + ')');
});
