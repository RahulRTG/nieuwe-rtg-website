'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { log } = require('../server/log');

const antwoord = () => ({ statusCode: 200, body: null,
  status(n) { this.statusCode = n; return this; },
  json(b) { this.body = b; return this; } });

test('een storagefout bij een wervingsbearer lekt de code niet via HTTP of console', async () => {
  const routes = {}, regels = [];
  const code = 'WERKEN.' + 'A'.repeat(32);
  const kern = {
    app: {
      post(pad, ...lagen) { routes[pad] = lagen.at(-1); },
      get(pad, ...lagen) { routes[pad] = lagen.at(-1); }
    },
    accounts: {}, auth() {}, tooManyTries() { return false; }, noteFailedTry() {},
    loginFails: new Map(), crypto, db: { data: { suppliers: [] } },
    bewerkCollectie() { throw new Error('opslag stuk voor ' + code); },
    save() {}, logActivity() {}, notifySupplier() {}
  };
  require('../server/routes/werving')(kern);
  const req = { ip: '127.0.0.1', body: { kassacode: code } };
  const res = antwoord(), oud = console.error;
  console.error = (...delen) => regels.push(delen.join(' '));
  try { await routes['/api/werving/kijk'](req, res); }
  finally { console.error = oud; }
  assert.equal(res.statusCode, 503);
  assert.equal(JSON.stringify(res.body).includes(code), false);
  assert.equal(regels.join('\n').includes(code), false);
});

test('reis- en personeelsbearerroutes loggen geen ruwe foutobjecten', () => {
  const root = path.join(__dirname, '..');
  for (const rel of ['server/routes/reis.js', 'server/routes/kantoren/reisbureau.js',
    'server/routes/werving.js', 'server/routes/supplier/werving/personeel.js',
    'server/routes/supplier/werving/sollicitaties.js']) {
    const bron = fs.readFileSync(path.join(root, rel), 'utf8');
    assert.doesNotMatch(bron, /console\.error\(\s*['"]\[(?:reisuitnodiging|reisbureau-uitnodiging|werving-[^\]]+|staff-[^\]]+)\]['"]\s*,/,
      rel + ' mag bij een credentialfout geen Error met mogelijk de requestwaarde loggen');
  }
});

test('de centrale logger redigeert credentials uit fouten, context en fouttracker', () => {
  const raw = 'REIS.0123456789ABCDEF0123456789ABCDEF';
  const regels = [];
  const echt = process.stderr.write;
  let doorgestuurd = null;
  process.stderr.write = s => { regels.push(String(s)); return true; };
  log.onError((err, context) => { doorgestuurd = { err, context }; });
  try {
    log.uitzondering(new Error('opslag weigerde code=' + raw), {
      p: '/werken/AB12CD', detail: 'kassacode=' + raw
    });
  } finally {
    log.onError(null);
    process.stderr.write = echt;
  }
  const alles = regels.join('') + JSON.stringify({
    bericht: doorgestuurd && doorgestuurd.err && doorgestuurd.err.message,
    stack: doorgestuurd && doorgestuurd.err && doorgestuurd.err.stack,
    context: doorgestuurd && doorgestuurd.context,
    bord: log.foutenSamenvatting()
  });
  assert.equal(alles.includes(raw), false);
  assert.equal(alles.includes('AB12CD'), false);
  assert.match(alles, /\[GEHEIM\]/);
  log.foutenReset();
});

test('PIN- en tokenuitgiftes zijn uitgesloten van antwoordreplay en browsercache', () => {
  const geheim = require('../server/lib/eenmalig-geheim-routes');
  for (const route of ['/api/auth/register', '/api/werving/verbind',
    '/api/supplier/staff/add', '/api/supplier/staff/reset-pin'])
    assert.equal(geheim.isEenmalig('POST', route), true, route);

  let laag;
  require('../server/opzet/koppen')({ app: { use(fn) { laag = fn; } } });
  for (const route of ['/api/auth/register', '/api/werving/verbind',
    '/api/supplier/staff/reset-pin']) {
    const koppen = {};
    const res = { set(k, v) { koppen[k] = v; }, removeHeader() {} };
    laag({ method: 'POST', path: route }, res, () => {});
    assert.equal(koppen['Cache-Control'], 'no-store', route);
    assert.equal(koppen.Pragma, 'no-cache', route);
  }
});

test('cadeaukaartcodes komen bij verkoop en afboeking niet in activiteitenlogs', async () => {
  const routes = {}, logs = [], kaartCode = 'RTG-GC-A1B2C3';
  const db = { data: { giftcards: [] } };
  const kern = {
    app: { post(pad, ...lagen) { routes[pad] = lagen.at(-1); } }, db,
    gcCode() { return kaartCode; }, supplierAuth() {}, save() {},
    logActivity(...delen) { logs.push(JSON.stringify(delen)); }
  };
  const herhaling = { metEigenAfdruk: async (_id, _vinger, werk) => werk() };
  require('../server/routes/supplier/kassa/cadeaukaart')(kern, herhaling);
  const basis = { supplier: { code: 'ZAAK', name: 'De Zaak' }, actor: { name: 'Kassier' } };
  const verkocht = antwoord();
  await routes['/api/supplier/giftcard/sell'](
    Object.assign({ body: { bedrag: 100, idem: 'kaart-1' } }, basis), verkocht);
  assert.equal(verkocht.statusCode, 200);
  assert.equal(verkocht.body.kaart.code, kaartCode);

  const verzilverd = antwoord();
  routes['/api/supplier/giftcard/redeem'](
    Object.assign({ body: { code: kaartCode, bedrag: 10 } }, basis), verzilverd);
  assert.equal(verzilverd.statusCode, 200);
  assert.ok(!logs.join('\n').includes(kaartCode));
});

test('afhaalcode komt niet in fout, kassabontekst, activiteitenlog of antwoord', async () => {
  const routes = {}, logs = [], code = 'AH.' + 'C'.repeat(32);
  const order = { ref: 'ORDER-1', pickup: 'AB12', paid: false, refunded: false, aanBalie: true,
    status: 'klaar', items: [{ name: 'Lunch', qty: 1, price: 12 }], total: 12, supplierCode: 'ZAAK',
    customerCodename: 'Kobalt', customerKey: 'lid:1', customerTier: 'rtg' };
  const db = { data: { posSales: {} }, writable: true };
  const bewerkCollectie = require('../server/db/collectie-bewerken')({ store: 'json', db, save() {} });
  const afhaalcode = require('../server/kern/afhaalcode')({ db, bewerkCollectie, crypto });
  const echt = afhaalcode.uitgeven({ order, key: 'lid:1' }).code;
  const kern = {
    app: { post(pad, ...lagen) { routes[pad] = lagen.at(-1); } },
    broadcastSync() {}, crypto, db,
    facturatie: { boekMetCodenaam() { return Promise.resolve({ ok: true }); } },
    logActivity(...delen) { logs.push(JSON.stringify(delen)); }, notify() {},
    pickupCode() { return 'BONX'; }, save() {}, sseToCustomer() {}, sseToOffice() {},
    sseToSupplier() {}, supplierAuth() {}, orderMetRef: ref => (ref === order.ref ? order : null), afhaalcode
  };
  require('../server/routes/supplier/kassa/innen')(kern);
  const basis = { supplier: { code: 'ZAAK', name: 'De Zaak' }, actor: { name: 'Kassier' } };
  const fout = antwoord();
  await routes['/api/supplier/pos/redeem'](Object.assign({ body: { code } }, basis), fout);
  assert.equal(fout.statusCode, 404);
  assert.ok(!JSON.stringify(fout.body).includes(code), 'een onbekende code komt niet terug in de fout');
  const eerste = antwoord();
  await routes['/api/supplier/pos/redeem'](Object.assign({ body: { code: echt } }, basis), eerste);
  assert.equal(eerste.statusCode, 200);
  assert.equal(order.status, 'geserveerd');
  assert.ok(!JSON.stringify(eerste.body).includes(echt));
  assert.ok(!db.data.posSales.ZAAK[0].desc.includes(echt));
  assert.ok(!JSON.stringify(db.data.afhaalToegang).includes(echt), 'alleen de hash staat in de collectie');
  assert.ok(!logs.join('\n').includes(echt));

  const tweede = antwoord();
  await routes['/api/supplier/pos/redeem'](Object.assign({ body: { code: echt } }, basis), tweede);
  assert.equal(tweede.statusCode, 409);
  assert.ok(!JSON.stringify(tweede.body).includes(echt));
});

test('de kassaprojectie rekent alleen af als de claim dat besliste', async () => {
  /* De claim (kern/afhaalcode.js) is de waarheid over "hier afrekenen". Ziet
     het RAM van deze instance de bon nog als onbetaald terwijl de claim zegt
     dat er al betaald is, dan hoort er GEEN kassabon en geen factuur te komen. */
  const routes = {}, facturen = [];
  const order = { ref: 'ORDER-2', pickup: 'CD34', paid: false, status: 'klaar', supplierCode: 'ZAAK',
    items: [{ name: 'Lunch', qty: 1, price: 12 }], total: 12, customerCodename: 'Kobalt', customerTier: 'rtg' };
  const db = { data: { posSales: {} } };
  const kern = {
    app: { post(pad, ...lagen) { routes[pad] = lagen.at(-1); } },
    broadcastSync() {}, crypto, db,
    facturatie: { boekMetCodenaam(x) { facturen.push(x); return Promise.resolve({ ok: true }); } },
    logActivity() {}, notify() {}, pickupCode() { return 'BONX'; }, save() {}, sseToCustomer() {},
    sseToOffice() {}, sseToSupplier() {}, supplierAuth() {}, orderMetRef: () => order,
    afhaalcode: { claim: async () => ({ status: 200, ok: true, ref: 'ORDER-2', afgerekend: false }) }
  };
  require('../server/routes/supplier/kassa/innen')(kern);
  const res = antwoord();
  await routes['/api/supplier/pos/redeem']({ body: { code: 'AH.' + 'D'.repeat(32) },
    supplier: { code: 'ZAAK', name: 'De Zaak' }, actor: { name: 'Kassier' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.sale, null, 'geen kassabon');
  assert.equal(res.body.order.wasPaid, true);
  assert.equal((db.data.posSales.ZAAK || []).length, 0);
  assert.equal(facturen.length, 0, 'en geen tweede factuur');
});
