/* ============================================================================
   WAT EEN ZAAK UITGEEFT EN EEN LID INWISSELT -- 6 endpoints.

   Deze zes wees de waargenomen dekkingsmeting aan als nooit aangeroepen:
   giftcard/sell, giftcard/redeem, salon/deal, salon/deal/redeem, salon/poll
   en salon/stats. Ze horen bij elkaar omdat ze allemaal dezelfde vorm hebben:
   de zaak geeft iets uit dat waarde draagt, en iemand komt het later innen.

   WAT ER OP HET SPEL STAAT

   Bij alles wat je uitgeeft en later inwisselt zijn er maar twee manieren om
   geld kwijt te raken, en dit bestand rekent ze allebei af:

   - TWEE KEER INNEN. Een aanbiedingscode die een tweede keer werkt is een
     korting die je twee keer geeft. Een cadeaukaart waarvan je meer afhaalt
     dan erop staat is geld dat er niet was.
   - INNEN BIJ DE BUREN. Een kaart of code van een andere zaak hoort hier niet
     te bestaan. De kassa van het restaurant kent de cadeaukaart van het hotel
     niet, en andersom.

   Draai los: node --experimental-sqlite --test test/uitgeven-inwisselen.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, zaak, kassa, buurzaak, lid, lid2;
let kaartCode = null, postId = null, dealCode = null;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-uitgeven-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
async function inlog(code, rol) {
  const roster = await api('/api/supplier/roster', { code });
  const wie = roster.body.staff.find(x => x.role === rol);
  return (await api('/api/supplier/login', { code, staffId: wie.id, pin: rol === 'manager' ? '1234' : '5678' })).body.token;
}
async function nieuwLid(naam) {
  const u = String(Date.now() + Math.round(performance.now())).slice(-9);
  return (await api('/api/auth/register', { name: naam, email: 'ui' + u + '@voorbeeld.test',
    password: 'inwisselen123', geboortedatum: '1987-07-07', tier: 'rtg', pasApp: 'rtg' })).body.token;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  zaak = await inlog('KIKUNOI', 'manager');
  kassa = await inlog('KIKUNOI', 'staff');
  buurzaak = await inlog('HOSHI', 'manager');
  lid = await nieuwLid('Inwissel Lid');
  lid2 = await nieuwLid('Tweede Lid');
  assert.ok(zaak && kassa && buurzaak && lid, 'twee zaken en twee leden staan klaar');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een cadeaukaart verkopen: binnen de grenzen, met een spoor', async () => {
  assert.equal((await api('/api/supplier/giftcard/sell', { bedrag: 5 }, kassa)).status, 400, 'onder de tien euro');
  assert.equal((await api('/api/supplier/giftcard/sell', { bedrag: 9000 }, kassa)).status, 400, 'boven de vijfduizend');
  assert.equal((await api('/api/supplier/giftcard/sell', { bedrag: 'veel' }, kassa)).status, 400, 'geen bedrag');

  const kk = await api('/api/supplier/giftcard/sell', { bedrag: 100 }, kassa);
  assert.equal(kk.status, 200);
  kaartCode = kk.body.kaart.code;
  assert.equal(kk.body.kaart.saldo, 100, 'het saldo begint op het volle bedrag');
  assert.equal(kk.body.kaart.supplierCode, 'KIKUNOI');
  assert.ok(kk.body.kaart.kocht, 'er staat bij wie hem verkocht');
});

test('2. innen kan tot het saldo op is, en nooit bij de buren', async () => {
  assert.equal((await api('/api/supplier/giftcard/redeem', { code: kaartCode, bedrag: 20 }, buurzaak)).status, 404,
    'de kaart van een andere zaak bestaat hier niet');
  assert.equal((await api('/api/supplier/giftcard/redeem', { code: 'RTG-BESTAATNIET', bedrag: 20 }, kassa)).status, 404);
  assert.equal((await api('/api/supplier/giftcard/redeem', { code: kaartCode, bedrag: 0 }, kassa)).status, 400, 'nul is geen bedrag');
  assert.equal((await api('/api/supplier/giftcard/redeem', { code: kaartCode, bedrag: 150 }, kassa)).status, 409, 'meer dan erop staat');

  const eerste = await api('/api/supplier/giftcard/redeem', { code: kaartCode, bedrag: 40 }, kassa);
  assert.equal(eerste.body.saldo, 60, 'deels innen laat de rest staan');
  const tweede = await api('/api/supplier/giftcard/redeem', { code: kaartCode.toLowerCase(), bedrag: 60 }, kassa);
  assert.equal(tweede.body.saldo, 0, 'de code mag ook in kleine letters worden ingetikt');
  assert.equal((await api('/api/supplier/giftcard/redeem', { code: kaartCode, bedrag: 1 }, kassa)).status, 409,
    'een lege kaart geeft niets meer');
});

test('3. een aanbieding op De Salon: van het management, met titel en tekst', async () => {
  assert.equal((await api('/api/supplier/salon/deal', { titel: 'Zomerproeverij', text: 'Twee gangen met wijn.' }, kassa)).status, 403,
    'de kassa zet geen aanbiedingen op De Salon');
  assert.equal((await api('/api/supplier/salon/deal', { titel: '', text: 'Zonder titel.' }, zaak)).status, 400);

  const d = await api('/api/supplier/salon/deal',
    { titel: 'Zomerproeverij', text: 'Twee gangen met een glas wijn, de hele maand juli.', geldigTot: '2027-07-31' }, zaak);
  assert.equal(d.status, 200);
  postId = d.body.postId;

  const st = await api('/api/supplier/salon/stats', {}, zaak);
  assert.equal(st.status, 200);
  assert.ok(st.body.deals.some(x => x.titel === 'Zomerproeverij'), 'de aanbieding staat in het eigen overzicht');
  assert.equal((await api('/api/supplier/salon/stats', {}, kassa)).status, 403, 'de cijfers zijn voor het management');
});

test('4. een aanbiedingscode werkt een keer, en alleen bij de eigen zaak', async () => {
  const claim = await api('/api/salon/deal/claim', { postId }, lid);
  assert.equal(claim.status, 200);
  dealCode = claim.body.code;
  assert.match(dealCode, /^RTG-D-/);

  // twee keer claimen geeft dezelfde code terug, geen tweede korting
  const nogmaals = await api('/api/salon/deal/claim', { postId }, lid);
  assert.equal(nogmaals.body.code, dealCode, 'hetzelfde lid krijgt dezelfde code');
  assert.equal(nogmaals.body.alGeclaimd, true);

  assert.equal((await api('/api/supplier/salon/deal/redeem', { code: dealCode }, buurzaak)).status, 404,
    'een code van een andere zaak kennen we hier niet');
  assert.equal((await api('/api/supplier/salon/deal/redeem', { code: 'RTG-D-BESTAAT' }, zaak)).status, 404);

  const in1 = await api('/api/supplier/salon/deal/redeem', { code: dealCode }, kassa);
  assert.equal(in1.status, 200, 'de kassa mag wel verzilveren: dat gebeurt aan de balie');
  assert.equal(in1.body.titel, 'Zomerproeverij');
  assert.ok(in1.body.codename, 'er staat bij welk lid het was');

  assert.equal((await api('/api/supplier/salon/deal/redeem', { code: dealCode }, kassa)).status, 409,
    'dezelfde code een tweede keer is een korting die je twee keer geeft');

  // een ander lid heeft zijn eigen code, en die werkt gewoon nog
  const claim2 = await api('/api/salon/deal/claim', { postId }, lid2);
  assert.notEqual(claim2.body.code, dealCode, 'elk lid krijgt zijn eigen code');
  assert.equal((await api('/api/supplier/salon/deal/redeem', { code: claim2.body.code }, kassa)).status, 200);
});

test('5. een poll heeft een vraag en minstens twee opties', async () => {
  assert.equal((await api('/api/supplier/salon/poll', { vraag: 'Welk gerecht terug op de kaart?', opties: ['Pulpo'] }, zaak)).status, 400,
    'met een optie valt er niets te kiezen');
  assert.equal((await api('/api/supplier/salon/poll', { vraag: '', opties: ['A', 'B'] }, zaak)).status, 400);
  assert.equal((await api('/api/supplier/salon/poll', { vraag: 'Iets?', opties: ['A', 'B'] }, kassa)).status, 403);

  const p = await api('/api/supplier/salon/poll',
    { vraag: 'Welk gerecht terug op de kaart?', opties: ['Pulpo a la brasa', 'Flao', 'Gazpacho', 'Lamsrack', 'Te veel'] }, zaak);
  assert.equal(p.status, 200);

  const st = await api('/api/supplier/salon/stats', {}, zaak);
  assert.ok(st.body.posts >= 2, 'de aanbieding en de poll staan allebei op het eigen profiel');
});
