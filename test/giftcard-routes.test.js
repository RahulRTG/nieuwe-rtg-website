/* De cadeaukaart tegen een ECHTE server (pay.giftcard_value_code): de routes,
   de no-store-kop, de code eenmaal, roteren en intrekken, de zaakscope, en de
   kassabon die met een kaart betaalt en bij een herhaling niet opnieuw afboekt.
   De controls zelf staan in test/giftcard-credential.test.js.

   Draai los: node --test test/giftcard-routes.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');

let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-cadeaukaart-'));
const MINI_PNG = 'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  const tekst = await r.text();
  let json = {}; try { json = JSON.parse(tekst); } catch (e) {}
  return { status: r.status, body: json, tekst, koppen: r.headers };
}
async function versLid() {
  const u = Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  const r = await api('/api/auth/register', { name: 'Kaart Toets', email: 'gc-' + u + '@toets.example',
    password: 'geheim123', geboortedatum: '1985-05-05', tier: 'rtg' });
  assert.equal((await api('/api/verify/upload', { image: MINI_PNG }, r.body.token)).status, 200);
  return r.body.token;
}
async function zaak(code, rol) {
  const roster = (await api('/api/supplier/roster', { code })).body;
  const s = (roster.staff || []).find(x => rol === 'manager' ? x.role === 'manager' : x.role !== 'manager');
  return (await api('/api/supplier/login', { code, staffId: s.id, pin: rol === 'manager' ? '1234' : '5678' })).body.token;
}

test.before(async () => { srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } }); base = srv.base; });
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('lid: kopen toont de code een keer, roteren maakt de oude dood, alleen DEZE zaak wisselt in', async () => {
  const lid = await versLid();
  const kassa = await zaak('KIKUNOI', 'manager');
  const buur = await zaak('SAKURA');
  const koop = await api('/api/giftcard/buy', { supplierCode: 'KIKUNOI', bedrag: 50, idem: 'gc-e2e-1' }, lid);
  assert.equal(koop.status, 200, koop.tekst.slice(0, 200));
  const code = koop.body.kaart.code;
  assert.match(code, /^GC(-[0-9A-F]{4}){8}$/);
  assert.equal(koop.koppen.get('cache-control'), 'no-store');
  const weer = await api('/api/giftcard/buy', { supplierCode: 'KIKUNOI', bedrag: 50, idem: 'gc-e2e-1' }, lid);
  assert.equal(weer.status, 200);
  assert.equal(weer.tekst.includes(code), false, 'een herhaling toont de code niet');
  const mijn = await api('/api/giftcards/mine', {}, lid);
  assert.equal(mijn.body.kaarten.length, 1, 'EEN kaart');
  assert.equal(mijn.tekst.includes(code), false, 'het overzicht toont de code nooit');

  const rot = await api('/api/giftcard/roteer', { id: koop.body.kaart.id, idem: 'rot-e2e-1' }, lid);
  assert.equal(rot.status, 200, rot.tekst.slice(0, 200));
  assert.equal((await api('/api/giftcard/roteer', { id: koop.body.kaart.id, idem: 'rot-e2e-1' }, lid)).status, 409);
  const vreemd = await versLid();
  assert.equal((await api('/api/giftcard/roteer', { id: koop.body.kaart.id, idem: 'x-1' }, vreemd)).status, 404);

  assert.equal((await api('/api/supplier/giftcard/redeem', { code, bedrag: 5 }, kassa)).status, 409, 'de oude code is dood');
  assert.equal((await api('/api/supplier/giftcard/redeem', { code: rot.body.code, bedrag: 5 }, buur)).status, 404);
  const inn = await api('/api/supplier/giftcard/redeem', { code: rot.body.code, bedrag: 5 }, kassa);
  assert.equal(inn.status, 200, inn.tekst.slice(0, 200));
  assert.equal(inn.body.saldo, 45);
  assert.equal(inn.tekst.includes(rot.body.code), false);
});

test('zaak: verkopen, de kassabon met een kaart, een herhaling en intrekken', async () => {
  const kassa = await zaak('KIKUNOI', 'manager');
  const kaart = await api('/api/supplier/giftcard/sell', { bedrag: 100, idem: 'gc-zaak-1' }, kassa);
  assert.equal(kaart.status, 200, kaart.tekst.slice(0, 200));
  assert.equal(kaart.koppen.get('cache-control'), 'no-store');
  const code = kaart.body.kaart.code;
  const bon = { total: 30, method: 'cadeaukaart', giftcardCode: code, idem: 'bon-e2e-1',
    items: [{ name: 'Thee', qty: 1, price: 30 }] };
  const een = await api('/api/supplier/pos/sale', bon, kassa);
  assert.equal(een.status, 200, een.tekst.slice(0, 200));
  assert.equal(een.body.sale.kaartId, kaart.body.kaart.id);
  assert.equal(een.body.sale.gcRest, 70);
  assert.equal(een.tekst.includes(code), false, 'de bon draagt de code niet');
  const twee = await api('/api/supplier/pos/sale', bon, kassa);
  assert.equal(twee.body.sale.id, een.body.sale.id, 'dezelfde bon');
  const intrek = await api('/api/supplier/giftcard/intrek', { id: kaart.body.kaart.id, reden: 'gestolen' }, kassa);
  assert.equal(intrek.status, 200);
  assert.equal(intrek.body.kaart.saldo, 70, 'EEN keer afgeboekt, en het saldo blijft na intrekken');
  assert.equal((await api('/api/supplier/giftcard/redeem', { code, bedrag: 1 }, kassa)).status, 409);
  const vloer = await zaak('KIKUNOI');
  assert.equal((await api('/api/supplier/giftcard/roteer', { id: kaart.body.kaart.id, idem: 'rot-z-0' }, vloer)).status, 403,
    'roteren is werk van de manager');
  const nieuw = await api('/api/supplier/giftcard/roteer', { id: kaart.body.kaart.id, idem: 'rot-z-1' }, kassa);
  assert.equal(nieuw.status, 200);
  assert.equal((await api('/api/supplier/giftcard/redeem', { code: nieuw.body.code, bedrag: 70 }, kassa)).body.saldo, 0);
});
