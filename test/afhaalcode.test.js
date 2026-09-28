/* De afhaalcode van een bestelling (pay.order_pickup_code), control voor control.

   Het register CODECREDENTIALS.json noemt deze deur pas `migrated` als elke
   control in code staat EN door een toets wordt bewezen. Deze toetsen gaan
   per control: entropie en kale code eenmaal, hash-only opslag, issuer/doel/
   scope, vervaltijd, max_gebruik, intrekken en roteren, constant-time zoeken,
   en de atomaire claim samen met het afrekenbesluit. De tweede helft draait
   tegen een ECHTE server: de routes, de deur, de dubbeltik en het bonnummer
   dat niets meer opent. De raceproef over twee instances staat in
   test/afhaalcode.pg.test.js.

   Draai los: node --test test/afhaalcode.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop, keurLidGoed } = require('./helper');

const T0 = Date.parse('2026-09-27T12:00:00.000Z');

function wereld() {
  let klok = T0, saves = 0, sleutels = [];
  const db = { data: {}, writable: true };
  const basis = require('../server/db/collectie-bewerken')({ store: 'json', db, save() { saves++; } });
  const bewerkCollectie = (sleutel, werk) => { sleutels.push(sleutel); return basis(sleutel, werk); };
  const kern = require('../server/kern/afhaalcode')({ db, bewerkCollectie, crypto,
    nu: () => new Date(klok).toISOString() });
  const orders = new Map();
  const order = (ref, extra) => {
    const o = Object.assign({ ref, supplierCode: 'ZAAK', customerKey: 'lid:' + ref, customerTier: 'rtg',
      status: 'nieuw', paid: false, aanBalie: true, total: 12, pickup: 'AB12',
      items: [{ name: 'Lunch', qty: 1, price: 12 }], supplierName: 'De Zaak', customerCodename: 'Kobalt' }, extra);
    orders.set(ref, o); return o;
  };
  return { db, kern, order, orderVan: ref => orders.get(ref), schuif: ms => { klok += ms; },
    saves: () => saves, sleutels };
}

test('1. entropie en de kale code eenmaal: 128 bits, en op schijf alleen de hash', () => {
  const w = wereld();
  const o = w.order('R1');
  const r = w.kern.uitgeven({ order: o, key: 'lid:R1' });
  assert.equal(r.status, 200);
  assert.equal(r.eenmalig, true);
  assert.match(r.code, /^AH\.[0-9A-F]{32}$/, '32 hexcijfers = 128 bits uit randomBytes(16)');
  const opslag = JSON.stringify(w.db.data.afhaalToegang);
  assert.equal(opslag.includes(r.code), false, 'de kale code staat nergens in de collectie');
  assert.equal(opslag.includes(r.code.slice(3)), false, 'ook het geheime deel niet');
  const rij = w.db.data.afhaalToegang.R1;
  assert.match(rij.toegang.code_hash, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(r.afhaal).includes(rij.toegang.code_hash), false,
    'het publieke deel draagt ook de hash niet');
  // een tweede uitgifte geeft een ANDERE code: de eerste wordt nooit opnieuw getoond
  const r2 = w.kern.uitgeven({ order: o, key: 'lid:R1' });
  assert.notEqual(r2.code, r.code);
});

test('2. issuer, doel en scope: de code geldt bij EEN zaak voor EEN handeling', () => {
  const w = wereld();
  const o = w.order('R2');
  const { code } = w.kern.uitgeven({ order: o, key: 'lid:R2' });
  const t = w.db.data.afhaalToegang.R2.toegang;
  assert.equal(t.issuer, 'rtg.lid.bestelling');
  assert.equal(t.doel, 'order-afhaal');
  assert.deepEqual(t.scope, ['kassa.order.uitgeven']);
  assert.deepEqual(t.onderwerp, { soort: 'order', ref: 'R2', supplierCode: 'ZAAK', lid_hash: w.db.data.afhaalToegang.R2.lid_hash });
  const ander = w.kern.claim({ code, supplierCode: 'ANDERE', actor: 'x', orderVan: w.orderVan });
  assert.equal(ander.status, 404, 'een andere zaak kent deze code niet');
  // een rij waarvan het doel is omgezet, opent niets meer
  t.doel = 'iets-anders';
  assert.equal(w.kern.claim({ code, supplierCode: 'ZAAK', actor: 'x', orderVan: w.orderVan }).status, 409);
  t.doel = 'order-afhaal';
  // en een vreemde mag voor deze bestelling geen code maken
  assert.equal(w.kern.uitgeven({ order: o, key: 'lid:iemand-anders' }).status, 404);
  // de code verwijst naar het onderwerp: een order die van zaak wisselde, geeft niets uit
  o.supplierCode = 'VERHUISD';
  assert.equal(w.kern.claim({ code, supplierCode: 'ZAAK', actor: 'x', orderVan: w.orderVan }).status, 404);
});

test('3. issued_at en expires_at: na zes uur is de code verlopen', () => {
  const w = wereld();
  const o = w.order('R3');
  const { code } = w.kern.uitgeven({ order: o, key: 'lid:R3' });
  const t = w.db.data.afhaalToegang.R3.toegang;
  assert.equal(Date.parse(t.expires_at) - Date.parse(t.issued_at), 6 * 3600000);
  w.schuif(6 * 3600000 + 1);
  const r = w.kern.claim({ code, supplierCode: 'ZAAK', actor: 'x', orderVan: w.orderVan });
  assert.equal(r.status, 410);
  assert.equal(w.db.data.afhaalToegang.R3.uitgifte, null, 'een verlopen code geeft niets uit');
});

test('4. max_gebruik 1, atomair met het afrekenbesluit, en een herhaling rekent niet twee keer af', () => {
  const w = wereld();
  const o = w.order('R4');
  const { code } = w.kern.uitgeven({ order: o, key: 'lid:R4' });
  const eerst = w.kern.claim({ code, supplierCode: 'ZAAK', actor: 'kassier', idempotentieSleutel: 'kassa-poging-1', orderVan: w.orderVan });
  assert.deepEqual(eerst, { status: 200, ok: true, ref: 'R4', afgerekend: true });
  const rij = w.db.data.afhaalToegang.R4;
  assert.equal(rij.toegang.gebruik, 1);
  assert.equal(rij.toegang.max_gebruik, 1);
  assert.equal(rij.uitgifte.afgerekend, true, 'uitgifte en afrekenbesluit liggen in DEZELFDE rij');
  assert.deepEqual(rij.betaling && rij.betaling.weg, 'kassa');
  assert.equal(w.sleutels.every(s => s === 'afhaalToegang'), true, 'elke mutatie loopt door de collectietransactie');
  const tweede = w.kern.claim({ code, supplierCode: 'ZAAK', actor: 'kassier', orderVan: w.orderVan });
  assert.equal(tweede.status, 409, 'een tweede scan geeft niets meer uit');
  const zelfde = w.kern.claim({ code, supplierCode: 'ZAAK', actor: 'kassier', idempotentieSleutel: 'kassa-poging-1', orderVan: w.orderVan });
  assert.deepEqual(zelfde, { status: 200, ok: true, herhaald: true, ref: 'R4', afgerekend: true },
    'dezelfde kassapoging krijgt het vastgelegde besluit terug');
  assert.equal(w.db.data.afhaalToegang.R4.toegang.gebruik, 1, 'en telt niet nog eens');
  // een andere zaak kan die idem-sleutel niet lenen
  assert.equal(w.kern.claim({ code, supplierCode: 'ANDERE', actor: 'x', idempotentieSleutel: 'kassa-poging-1', orderVan: w.orderVan }).status, 404);
  // na uitgifte valt er niets meer te roteren
  assert.equal(w.kern.uitgeven({ order: o, key: 'lid:R4' }).status, 409);
});

test('5. een al betaalde bon wordt uitgegeven zonder afrekenen', () => {
  const w = wereld();
  const o = w.order('R5', { paid: true, aanBalie: false });
  const { code } = w.kern.uitgeven({ order: o, key: 'lid:R5' });
  // ook als het RAM van deze instance hem (nog) als onbetaald ziet: de uitgifte zag hem betaald
  o.paid = false;
  const r = w.kern.claim({ code, supplierCode: 'ZAAK', actor: 'k', orderVan: w.orderVan });
  assert.equal(r.status, 200);
  assert.equal(r.afgerekend, false);
});

test('6. server-side intrekken en roteren: de oude code opent niets meer', () => {
  const w = wereld();
  const o = w.order('R6');
  const eerste = w.kern.uitgeven({ order: o, key: 'lid:R6' }).code;
  const tweede = w.kern.uitgeven({ order: o, key: 'lid:R6' }).code;
  const rij = w.db.data.afhaalToegang.R6;
  assert.equal(rij.historie.length, 1);
  assert.ok(rij.historie[0].ingetrokken_at, 'de vorige code staat ingetrokken in de historie');
  assert.equal(rij.toegang.rotatie, 2);
  assert.equal(w.kern.claim({ code: eerste, supplierCode: 'ZAAK', actor: 'k', orderVan: w.orderVan }).status, 409);
  // het lid trekt de huidige in
  assert.equal(w.kern.sluit({ order: o, key: 'lid:R6', reden: 'kwijt' }).status, 200);
  assert.ok(w.db.data.afhaalToegang.R6.toegang.ingetrokken_at);
  assert.equal(w.kern.claim({ code: tweede, supplierCode: 'ZAAK', actor: 'k', orderVan: w.orderVan }).status, 409);
  // de zaak trekt in bij afsluiten; een vreemde kan niet namens het lid intrekken
  const derde = w.kern.uitgeven({ order: o, key: 'lid:R6' }).code;
  assert.equal(w.kern.sluit({ order: o, key: 'lid:vreemd' }).status, 404);
  w.kern.sluit({ order: o, actor: 'zaak:ZAAK', reden: 'bestelling geweigerd' });
  assert.equal(w.kern.claim({ code: derde, supplierCode: 'ZAAK', actor: 'k', orderVan: w.orderVan }).status, 409);
  // zonder rij valt er niets in te trekken, en er wordt ook niets geschreven
  const voor = w.saves();
  w.kern.sluit({ order: w.order('LEEG'), actor: 'zaak:ZAAK' });
  assert.equal(w.saves(), voor);
});

test('7. een gesloten of onbetaalde bestelling krijgt geen code en geeft niets uit', () => {
  const w = wereld();
  const tafel = w.order('R7', { aanBalie: false, paid: false });
  assert.equal(w.kern.uitgeven({ order: tafel, key: 'lid:R7' }).status, 409, 'eerst afrekenen');
  const bezorg = w.order('R8', { levering: 'bezorgen', paid: true, aanBalie: false });
  assert.equal(w.kern.uitgeven({ order: bezorg, key: 'lid:R8' }).status, 409, 'bezorging gaat met de bezorger mee');
  const intern = w.order('R9', { intern: true, paid: true });
  assert.equal(w.kern.uitgeven({ order: intern, key: 'lid:R9' }).status, 409, 'een spoedbon heeft geen klant');
  const o = w.order('R10');
  const { code } = w.kern.uitgeven({ order: o, key: 'lid:R10' });
  o.refunded = true; o.status = 'terugbetaald';
  const r = w.kern.claim({ code, supplierCode: 'ZAAK', actor: 'k', orderVan: w.orderVan });
  assert.equal(r.status, 409);
  assert.equal(w.db.data.afhaalToegang.R10.uitgifte, null);
});

test('8. app en kassa rekenen een balie-bon nooit allebei af', () => {
  const w = wereld();
  const o = w.order('R11');
  const { code } = w.kern.uitgeven({ order: o, key: 'lid:R11' });
  assert.deepEqual(w.kern.betaalBegin(o), { ok: true });
  const tijdens = w.kern.claim({ code, supplierCode: 'ZAAK', actor: 'k', orderVan: w.orderVan });
  assert.equal(tijdens.status, 409, 'terwijl de app afrekent wacht de kassa');
  w.kern.betaalEinde(o, true);
  const na = w.kern.claim({ code, supplierCode: 'ZAAK', actor: 'k', orderVan: w.orderVan });
  assert.equal(na.status, 200);
  assert.equal(na.afgerekend, false, 'de app heeft betaald, de kassa rekent niet nog eens af');

  const w2 = wereld();
  const o2 = w2.order('R12');
  const c2 = w2.kern.uitgeven({ order: o2, key: 'lid:R12' }).code;
  assert.equal(w2.kern.claim({ code: c2, supplierCode: 'ZAAK', actor: 'k', orderVan: w2.orderVan }).afgerekend, true);
  assert.equal(w2.kern.betaalBegin(o2).status, 409, 'na de kassa weigert de app');

  const w3 = wereld();
  const o3 = w3.order('R13');
  const c3 = w3.kern.uitgeven({ order: o3, key: 'lid:R13' }).code;
  w3.kern.betaalBegin(o3);
  w3.kern.betaalEinde(o3, false);
  assert.equal(w3.kern.claim({ code: c3, supplierCode: 'ZAAK', actor: 'k', orderVan: w3.orderVan }).afgerekend, true,
    'een mislukte app-betaling laat de kassa gewoon afrekenen');
});

test('9. constant-time: elke hash wordt vergeleken, ook na een treffer', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'afhaalcode.js'), 'utf8');
  const lus = bron.slice(bron.indexOf('for (const x of Object.values(bron))'), bron.indexOf('if (!r && oud'));
  assert.ok(lus.length > 40, 'de zoeklus staat er');
  assert.match(lus, /bearer\.zelfdeHash\(/);
  assert.doesNotMatch(lus, /\b(return|break)\b/, 'geen vroege uitgang: de positie mag niet verraden welke rij raak was');
  assert.doesNotMatch(lus, /===\s*gezocht|gezocht\s*===/, 'geen gewone stringvergelijking op de hash');
  // en het werkt ook met een collectie vol andere rijen
  const w = wereld();
  for (let i = 0; i < 50; i++) w.kern.uitgeven({ order: w.order('V' + i), key: 'lid:V' + i });
  const doel = w.order('RX');
  const { code } = w.kern.uitgeven({ order: doel, key: 'lid:RX' });
  assert.equal(w.kern.claim({ code, supplierCode: 'ZAAK', actor: 'k', orderVan: w.orderVan }).ref, 'RX');
});

test('10. een oud bonnummer van voor de migratie is geen credential', () => {
  const w = wereld();
  w.order('OUD', { pickup: 'TBS9' });
  const r = w.kern.claim({ code: 'TBS9', supplierCode: 'ZAAK', actor: 'k', orderVan: w.orderVan });
  assert.equal(r.status, 404, 'een order zonder afhaalrij geeft op zijn vierteken-label niets uit');
  assert.equal(w.kern.claim({ code: '', supplierCode: 'ZAAK', actor: 'k', orderVan: w.orderVan }).status, 400);
});

test('13. de app-betaling legt haar betaalweg vast VOOR het geld beweegt', async () => {
  /* Het venster waar het om gaat: het lid rekent een balie-bon in de app af, en
     terwijl het geld onderweg is scant de kassa de afhaal-QR. Zonder de
     betaalweg zag de kassa een onbetaalde bon en rekende hij nog eens af. */
  const w = wereld();
  const o = w.order('R14');
  const { code } = w.kern.uitgeven({ order: o, key: 'lid:R14' });
  let kassaTijdens = null;
  const ctx = {
    save() {}, findSupplier: () => ({ code: 'ZAAK', name: 'De Zaak' }), fooiUit: () => 0,
    pasTegoedToe: () => 0, herstelTegoed() {}, verdienPunten() {}, ledenvoordeelVoor: () => 0,
    keuken: { boekVerkoopAf() {} }, notifySupplier() {}, sseToSupplier() {}, sseToOffice() {},
    orderMetRef: ref => w.orderVan(ref), factuurVoorLid() {}, liveCodename: () => 'Kobalt',
    afhaalcode: w.kern,
    pay: { async betaalZaak() {
      kassaTijdens = w.kern.claim({ code, supplierCode: 'ZAAK', actor: 'k', orderVan: w.orderVan });
      return { ok: true, betaaldCenten: 1200, bijgelegdCenten: 0 };
    } }
  };
  const { betaalOrderVoor } = require('../server/kern/lidacties/betalen')(ctx);
  const uit = await betaalOrderVoor({ key: 'lid:R14', tier: 'rtg' }, { ref: 'R14' });
  assert.equal(uit.ok, true);
  assert.equal(kassaTijdens.status, 409, 'de kassa wacht zolang de app afrekent');
  const na = w.kern.claim({ code, supplierCode: 'ZAAK', actor: 'k', orderVan: w.orderVan });
  assert.equal(na.status, 200);
  assert.equal(na.afgerekend, false, 'en rekent daarna niet nog eens af');
  // andersom: heeft de kassa al afgerekend, dan weigert de app voordat er geld beweegt
  const o2 = w.order('R15');
  const c2 = w.kern.uitgeven({ order: o2, key: 'lid:R15' }).code;
  assert.equal(w.kern.claim({ code: c2, supplierCode: 'ZAAK', actor: 'k', orderVan: w.orderVan }).afgerekend, true);
  let bewogen = false;
  ctx.pay.betaalZaak = async () => { bewogen = true; return { ok: true }; };
  const nee = await require('../server/kern/lidacties/betalen')(ctx).betaalOrderVoor({ key: 'lid:R15', tier: 'rtg' }, { ref: 'R15' });
  assert.equal(nee.status, 409);
  assert.equal(bewogen, false, 'er is geen geld bewogen');
});

/* ---------- tegen een echte server ---------- */

function verseDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-afhaal-')); }
async function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  const tekst = await r.text();
  let json = {}; try { json = JSON.parse(tekst); } catch (e) { json = { tekst }; }
  return { status: r.status, body: json, tekst, koppen: r.headers };
}
async function registreer(base) {
  const u = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const r = (await api(base, '/api/auth/register', {
    name: 'Afhaal Lid', email: u + '@x.nl', phone: '06' + u.replace(/\D/g, '').padEnd(8, '1').slice(0, 8),
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business'
  })).body;
  await keurLidGoed(base, r.token, r.state.user.codename, '1990-01-01');
  return r.token;
}
async function zaak(base, code) {
  const roster = (await api(base, '/api/supplier/roster', { code })).body;
  const staff = roster.staff.find(x => x.role !== 'manager') || roster.staff[0];
  return (await api(base, '/api/supplier/login', { code, staffId: staff.id, pin: '5678' })).body.token;
}
async function eersteItem(base, token, code) {
  const kaart = (await api(base, '/api/supplier/menu/get', { code }, token)).body;
  const m = (kaart.menu || []).find(x => !x.uitverkocht && x.station !== 'bar') || (kaart.menu || [])[0];
  return m.id;
}

test('11. echte server: bestellen geeft geen geheim, tonen wel, en alleen die code geeft uit', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const lid = await registreer(base);
    const ander = await registreer(base);
    const sup = await zaak(base, 'KIKUNOI');
    const item = await eersteItem(base, lid, 'KIKUNOI');
    const plaats = await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: item, qty: 1 }], naarKassa: true }, lid);
    assert.equal(plaats.status, 200);
    const o = plaats.body.order;
    assert.doesNotMatch(plaats.tekst, /AH\.[0-9A-F]{32}/, 'het bestelantwoord draagt geen afhaalcode');

    assert.equal((await api(base, '/api/order/afhaalcode', { ref: o.ref }, ander)).status, 404,
      'een ander lid maakt geen code voor mijn bestelling');
    const eerste = await api(base, '/api/order/afhaalcode', { ref: o.ref }, lid);
    assert.equal(eerste.status, 200);
    assert.match(eerste.body.code, /^AH\.[0-9A-F]{32}$/);
    assert.equal(eerste.koppen.get('cache-control'), 'no-store', 'de browser bewaart het geheim niet');
    const tweede = await api(base, '/api/order/afhaalcode', { ref: o.ref }, lid);
    assert.notEqual(tweede.body.code, eerste.body.code, 'opnieuw tonen is roteren');

    const mijn = await api(base, '/api/orders/mine', {}, lid);
    assert.equal(mijn.tekst.includes(tweede.body.code), false, 'het overzicht herhaalt de code nooit');
    const volg = await api(base, '/api/supplier/state', {}, sup);
    assert.equal(volg.tekst.includes(tweede.body.code), false, 'de zaak ziet de code nergens');

    assert.equal((await api(base, '/api/supplier/pos/redeem', { code: o.pickup }, sup)).status, 404,
      'het bonnummer opent niets');
    assert.equal((await api(base, '/api/supplier/pos/redeem', { code: eerste.body.code }, sup)).status, 409,
      'de geroteerde code opent niets');
    const andereZaak = await zaak(base, 'SAKURA');
    assert.ok(andereZaak, 'de tweede zaak logt in');
    assert.equal((await api(base, '/api/supplier/pos/redeem', { code: tweede.body.code }, andereZaak)).status, 404,
      'een andere zaak kent de code niet');
    const inn = await api(base, '/api/supplier/pos/redeem', { code: tweede.body.code, idem: 'kassa-e2e-0001' }, sup);
    assert.equal(inn.status, 200, inn.tekst.slice(0, 200));
    assert.equal(inn.body.order.ref, o.ref);
    assert.equal(inn.body.order.wasPaid, false, 'aan de balie afgerekend');
    assert.equal(inn.tekst.includes(tweede.body.code), false, 'het kassa-antwoord herhaalt de code niet');
    assert.equal((await api(base, '/api/supplier/pos/redeem', { code: tweede.body.code }, sup)).status, 409,
      'geen tweede uitgifte');
    assert.equal((await api(base, '/api/order/afhaalcode', { ref: o.ref }, lid)).status, 409,
      'na de uitgifte valt er niets meer te tonen');
    const bon = (await api(base, '/api/orders/mine', {}, lid)).body.orders.find(x => x.ref === o.ref);
    assert.equal(bon.status, 'geserveerd');
    assert.equal(bon.paid, true);
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('12. echte server: intrekken door het lid en door de zaak sluit de code', async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const lid = await registreer(base);
    const sup = await zaak(base, 'KIKUNOI');
    const item = await eersteItem(base, lid, 'KIKUNOI');
    const a = (await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: item, qty: 1 }], naarKassa: true }, lid)).body.order;
    const codeA = (await api(base, '/api/order/afhaalcode', { ref: a.ref }, lid)).body.code;
    const intrek = await api(base, '/api/order/afhaalcode/intrek', { ref: a.ref }, lid);
    assert.equal(intrek.status, 200);
    assert.equal(intrek.body.afhaal.stand, 'ingetrokken');
    assert.equal((await api(base, '/api/supplier/pos/redeem', { code: codeA }, sup)).status, 409);

    const b = (await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [{ id: item, qty: 1 }], naarKassa: true }, lid)).body.order;
    const codeB = (await api(base, '/api/order/afhaalcode', { ref: b.ref }, lid)).body.code;
    assert.equal((await api(base, '/api/supplier/order/status', { ref: b.ref, status: 'geweigerd' }, sup)).status, 200);
    assert.equal((await api(base, '/api/supplier/pos/redeem', { code: codeB }, sup)).status, 409,
      'een geweigerde bestelling geeft niets uit, ook niet met een code van daarvoor');
    assert.equal((await api(base, '/api/order/afhaalcode', { ref: b.ref }, lid)).status, 409);
    /* De intrekking is een eigen feit in de afhaalrij, niet alleen een gevolg van
       de orderstand: zet de zaak de bon terug op "nieuw", dan blijft de code van
       voor de weigering dicht. */
    assert.equal((await api(base, '/api/supplier/order/status', { ref: b.ref, status: 'nieuw' }, sup)).status, 200);
    assert.equal((await api(base, '/api/supplier/pos/redeem', { code: codeB }, sup)).status, 409,
      'de weigering trok de code in; terugzetten maakt hem niet weer geldig');
  } finally {
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
