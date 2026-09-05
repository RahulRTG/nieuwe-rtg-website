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

test('ophaalcode komt niet in fout, kassabontekst of activiteitenlog', () => {
  const routes = {}, logs = [], code = 'ABCD';
  const order = { ref: 'ORDER-1', pickup: code, paid: false, refunded: false,
    status: 'klaar', items: [{ name: 'Lunch', qty: 1, price: 12 }], total: 12,
    customerCodename: 'Kobalt', customerKey: 'lid:1', customerTier: 'rtg' };
  const db = { data: { posSales: {} } };
  const kern = {
    app: { post(pad, ...lagen) { routes[pad] = lagen.at(-1); } },
    broadcastSync() {}, crypto: require('node:crypto'), db,
    facturatie: { boekMetCodenaam() { return Promise.resolve({ ok: true }); } },
    logActivity(...delen) { logs.push(JSON.stringify(delen)); }, notify() {},
    pickupCode() { return 'BONX'; }, save() {}, sseToCustomer() {}, sseToOffice() {},
    sseToSupplier() {}, supplierAuth() {}, ordersVanZaak() { return [order]; }
  };
  require('../server/routes/supplier/kassa/innen')(kern);
  const req = { body: { code }, supplier: { code: 'ZAAK', name: 'De Zaak' }, actor: { name: 'Kassier' } };
  const eerste = antwoord();
  routes['/api/supplier/pos/redeem'](req, eerste);
  assert.equal(eerste.statusCode, 200);
  assert.equal(order.status, 'geserveerd');
  assert.ok(!db.data.posSales.ZAAK[0].desc.includes(code));
  assert.ok(!logs.join('\n').includes(code));

  const tweede = antwoord();
  routes['/api/supplier/pos/redeem'](req, tweede);
  assert.equal(tweede.statusCode, 409);
  assert.ok(!JSON.stringify(tweede.body).includes(code));
});
