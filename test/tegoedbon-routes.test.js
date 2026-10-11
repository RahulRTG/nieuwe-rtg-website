/* DE TEGOEDBON OP EEN ECHTE SERVER: dezelfde controls als in
   tegoedbon-credential.test.js, nu over HTTP, door de echte montage, de echte
   deuren (auth, supplierAuth, managerOnly) en de echte opslag met zijn
   collectietransactie en economische sleutel (LAT.md regel 17: een nagemaakte
   app bewijst het handlergedrag en niet de deur).

   MUTATIES GEZIEN ZAKKEN (LAT.md regel 2):
   - `POST /api/pay/tegoed/koop` uit lib/eenmalig-geheim-routes.js gehaald:
     zakte op "de uitgifte wordt niet gecachet" (geen no-store meer);
   - in routes/pay-zaak.js de `managerOnly`-regel uit /tegoed/roteer gehaald:
     zakte op "een medewerker roteert niet";
   - in routes/pay-tegoed.js `intrekken: req.body.intrekken === true`
     vervangen door `intrekken: false`: zakte op "intrekken over HTTP".
   Alle drie teruggedraaid, daarna groen.

   Draai los: node --test test/tegoedbon-routes.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tegoedbon-'));
let srv, base;
const MINI_PNG = 'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, kop: r.headers, body: await r.json().catch(() => ({})) }));

let teller = 0;
async function lid() {
  const u = Date.now() + '-' + (++teller);
  const r = await api('/api/auth/register', { name: 'Bon Toets ' + teller, email: 'bon-' + u + '@toets.example',
    password: 'geheim123', geboortedatum: '1984-04-04', tier: 'rtg' });
  assert.ok(r.body.token, JSON.stringify(r.body).slice(0, 160));
  assert.equal((await api('/api/verify/upload', { image: MINI_PNG }, r.body.token)).status, 200);
  const o = await api('/api/pay/overzicht', {}, r.body.token);
  return { token: r.body.token, codenaam: o.body.codenaam };
}
const kaal = s => String(s).toUpperCase().replace(/[^0-9A-Z]/g, '');

test.before(async () => { srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } }); base = srv.base; });
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('uitgifte, overzicht, rotatie en verzilveren over HTTP: de code is er een keer', async () => {
  const a = await lid(), b = await lid();
  await api('/api/pay/oplaad', { centen: 10000, idem: 'bon-oplaad' }, a.token);
  const koop = await api('/api/pay/tegoed/koop', { centen: 2500, idem: 'bon-koop' }, a.token);
  assert.equal(koop.status, 200, JSON.stringify(koop.body).slice(0, 200));
  assert.match(koop.body.tegoed.code, /^TG(-[0-9A-F]{4}){8}$/);
  assert.equal(koop.kop.get('cache-control'), 'no-store', 'de uitgifte wordt niet gecachet');

  const nog = await api('/api/pay/tegoed/koop', { centen: 2500, idem: 'bon-koop' }, a.token);
  assert.equal(nog.body.herhaald, true);
  assert.equal(nog.body.tegoed.code, undefined, 'een herhaling toont de code niet');

  const ov = await api('/api/pay/tegoed', {}, a.token);
  assert.equal(ov.status, 200);
  assert.equal(JSON.stringify(ov.body).includes(kaal(koop.body.tegoed.code)), false, 'het overzicht toont de code niet');
  assert.equal(ov.body.gekocht[0].code, undefined);

  assert.equal((await api('/api/pay/tegoed/roteer', { id: koop.body.tegoed.id }, a.token)).status, 400,
    'zonder sleutel geen nieuwe code');
  assert.equal((await api('/api/pay/tegoed/roteer', { id: koop.body.tegoed.id, idem: 'r1' }, b.token)).status, 404,
    'een ander roteert niet');
  const rot = await api('/api/pay/tegoed/roteer', { id: koop.body.tegoed.id, idem: 'r1' }, a.token);
  assert.equal(rot.status, 200, JSON.stringify(rot.body).slice(0, 200));
  assert.equal(rot.kop.get('cache-control'), 'no-store');
  assert.notEqual(rot.body.tegoed.code, koop.body.tegoed.code);
  const weer = await api('/api/pay/tegoed/roteer', { id: koop.body.tegoed.id, idem: 'r1' }, a.token);
  assert.equal(weer.status, 409);
  assert.equal(weer.body.tegoed && weer.body.tegoed.code, undefined);

  assert.equal((await api('/api/pay/tegoed/verzilver', { code: koop.body.tegoed.code, idem: 'o' }, b.token)).status, 404,
    'de oude code is dood');
  const in_ = await api('/api/pay/tegoed/verzilver', { code: rot.body.tegoed.code.toLowerCase(), idem: 'n' }, b.token);
  assert.equal(in_.status, 200, JSON.stringify(in_.body).slice(0, 200));
  assert.equal(in_.body.saldo, 2500);
  const nogmaals = await api('/api/pay/tegoed/verzilver', { code: rot.body.tegoed.code, idem: 'n' }, b.token);
  assert.equal(nogmaals.body.herhaald, true, 'dezelfde sleutel is een herhaling');
  assert.equal((await api('/api/pay/overzicht', {}, b.token)).body.saldo, 2500, 'en boekt niets');
  assert.equal((await api('/api/pay/tegoed/verzilver', { code: rot.body.tegoed.code, idem: 'x' }, b.token)).status, 409);
  assert.equal((await fetch(base + '/api/pay/gezond').then(r => r.json())).klopt, true, 'het grootboek sluit');
});

test('gericht tegoed met het id, en intrekken over HTTP zet het geld terug', async () => {
  const a = await lid(), b = await lid(), c = await lid();
  await api('/api/pay/oplaad', { centen: 5000, idem: 'bon2-oplaad' }, a.token);
  const koop = await api('/api/pay/tegoed/koop', { centen: 1200, aan: b.codenaam, idem: 'bon2-koop' }, a.token);
  assert.equal(koop.status, 200);
  assert.equal((await api('/api/pay/tegoed/verzilver', { id: koop.body.tegoed.id }, c.token)).status, 404);
  const voor = await api('/api/pay/tegoed', {}, b.token);
  assert.equal(voor.body.voorMij.length, 1);
  assert.equal(voor.body.voorMij[0].code, undefined);
  const ok = await api('/api/pay/tegoed/verzilver', { id: koop.body.tegoed.id, idem: 'g' }, b.token);
  assert.equal(ok.status, 200, JSON.stringify(ok.body).slice(0, 200));

  const tweede = await api('/api/pay/tegoed/koop', { centen: 800, idem: 'bon2-koop2' }, a.token);
  assert.equal(tweede.status, 200, JSON.stringify(tweede.body).slice(0, 300));
  const vroeg = await api('/api/pay/tegoed/terug', { id: tweede.body.tegoed.id, idem: 't' }, a.token);
  assert.equal(vroeg.status, 409, 'terugnemen zonder intrekken wacht op de vervaldatum');
  const intrek = await api('/api/pay/tegoed/terug', { id: tweede.body.tegoed.id, intrekken: true, idem: 'i' }, a.token);
  assert.equal(intrek.status, 200, 'intrekken over HTTP: ' + JSON.stringify(intrek.body).slice(0, 200));
  assert.equal(intrek.body.saldo, 5000 - 1200);
  assert.equal((await api('/api/pay/tegoed/verzilver', { code: tweede.body.tegoed.code, idem: 'z' }, c.token)).status, 409,
    'een ingetrokken code werkt niet meer');
});

test('de zaak roteert en trekt in als manager; een medewerker niet', async () => {
  const login = await fetch(base + '/api/supplier/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'rahul', password: 'Imran' }) }).then(r => r.json());
  const tok = login.token, supCode = login.state.supplier.code;
  /* De zaak is de SEED-zaak en geen verse: in json-stand begint elke run met
     een lege map, maar tegen PostgreSQL blijft haar idem-geheugen tussen runs
     staan. Een vaste sleutel als 'bon3-zet' gaf een tweede run dan terecht het
     EERSTE antwoord terug (met een code die al getoond was, dus 409 op het
     roteren). Het gedrag klopt; de toets hoort per run eigen sleutels te
     dragen, zoals lid() dat al doet met een verse codenaam. */
  const run = Date.now().toString(36) + '-' + process.pid;
  const s = k => 'bon3-' + k + '-' + run;
  const klant = await lid();
  await api('/api/pay/oplaad', { centen: 20000, idem: 'bon3-klant' }, klant.token);
  const kas = await api('/api/pay/kascode', { maxCenten: 20000 }, klant.token);
  assert.equal((await api('/api/supplier/pay/in', { code: kas.body.code, centen: 15000, idem: s('in') }, tok)).status, 200);

  const zet = await api('/api/supplier/pay/tegoed/zet', { centen: 3000, idem: s('zet') }, tok);
  assert.equal(zet.status, 200, JSON.stringify(zet.body).slice(0, 200));
  assert.equal(zet.kop.get('cache-control'), 'no-store');
  const ov = await api('/api/supplier/pay/tegoed', {}, tok);
  assert.equal(JSON.stringify(ov.body).includes(kaal(zet.body.tegoed.code)), false, 'de zaak ziet de code niet terug');

  const roster = await api('/api/supplier/roster', { code: supCode });
  const staf = (roster.body.staff || []).find(x => x.role !== 'manager');
  const stafTok = (await api('/api/supplier/login', { code: supCode, staffId: staf.id, pin: '5678' })).body.token;
  assert.equal((await api('/api/supplier/pay/tegoed/roteer', { id: zet.body.tegoed.id, idem: s('staf') }, stafTok)).status, 403,
    'een medewerker roteert niet');
  const rot = await api('/api/supplier/pay/tegoed/roteer', { id: zet.body.tegoed.id, idem: s('m') }, tok);
  assert.equal(rot.status, 200, JSON.stringify(rot.body).slice(0, 200));
  assert.match(rot.body.tegoed.code, /^TG(-[0-9A-F]{4}){8}$/);
  const voor = (await api('/api/supplier/pay/tegoed', {}, tok)).body.openCenten;
  const intrek = await api('/api/supplier/pay/tegoed/terug', { id: zet.body.tegoed.id, intrekken: true, idem: s('mi') }, tok);
  assert.equal(intrek.status, 200, JSON.stringify(intrek.body).slice(0, 200));
  assert.equal((await api('/api/supplier/pay/tegoed', {}, tok)).body.openCenten, voor - 3000);
  assert.equal((await fetch(base + '/api/pay/gezond').then(r => r.json())).klopt, true);
});
