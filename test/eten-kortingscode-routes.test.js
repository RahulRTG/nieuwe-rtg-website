/* De promotiecode van RTG Eten tegen een ECHTE server (eten.kortingscode):
   de zaak slaat hem op met een vervaldatum, een maximum en een grens per lid;
   de controlesheet toont waarom een code niet geldt; bestellen telt het gebruik
   atomair; en wie codes raadt, loopt tegen de huisbrede rem. De grenzen zelf
   staan in test/eten-kortingscode.test.js.

   Draai los: node --test test/eten-kortingscode-routes.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');

let srv, base, ZAAK, ITEM;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-etenkorting-'));
async function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  const tekst = await r.text();
  let json = {}; try { json = JSON.parse(tekst); } catch (e) {}
  return { status: r.status, body: json, tekst };
}
async function lid() {
  const u = String(Date.now()) + Math.floor(Math.random() * 1000);
  const reg = await api('/api/auth/register', { name: 'Korting', email: 'k' + u + '@voorbeeld.nl', phone: '06' + u.slice(-8),
    password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(reg.body.token, reg.tekst.slice(0, 200));
  return reg.body.token;
}
const bestel = (token, code, idem) => api('/api/gast/afhaal/bestel', { zaak: 'KIKUNOI', kanaal: 'afhaal', idem,
  items: [{ itemId: ITEM.id, aantal: 2 }], kortingscode: code }, token);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } }); base = srv.base;
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const mgr = roster.staff.find(x => x.role === 'manager');
  ZAAK = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
  const kaart = (await api('/api/gast/bezorg/kaart', { zaak: 'KIKUNOI' }, await lid())).body.kaart;
  ITEM = kaart.filter(x => !x.alcohol && !x.uitverkocht).sort((a, b) => b.centen - a.centen)[0];
  assert.ok(ITEM, 'de zaak heeft een gerecht');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('de zaak slaat een promotiecode op met grenzen, en een datum in het verleden niet', async () => {
  const r = await api('/api/supplier/eten/instellingen', { actie: 'bewaar-korting', code: 'zomer5', procent: 5 }, ZAAK);
  assert.equal(r.status, 200, r.tekst.slice(0, 200));
  const k = r.body.kortingscodes.find(x => x.code === 'ZOMER5');
  assert.ok(k.geldigTot && k.maxGebruik === 100 && k.perLid === 1, 'nooit zonder grenzen: ' + JSON.stringify(k));
  assert.equal(k.gebruik, 0);
  const oud = await api('/api/supplier/eten/instellingen', { actie: 'bewaar-korting', code: 'OUD5', procent: 5, geldigTot: '2020-01-01' }, ZAAK);
  assert.equal(oud.status, 400);
});

test('het laatste gebruik gaat naar een lid, en een lid gebruikt hem een keer', async () => {
  const zet = await api('/api/supplier/eten/instellingen', { actie: 'bewaar-korting', code: 'LAATSTE', procent: 10, maxGebruik: 2, perLid: 1 }, ZAAK);
  assert.equal(zet.status, 200);
  const a = await lid(), b = await lid(), c = await lid();
  const check = await api('/api/gast/bezorg/checkout', { zaak: 'KIKUNOI', kanaal: 'afhaal', items: [{ itemId: ITEM.id, aantal: 2 }],
    kortingscode: 'laatste' }, a);
  assert.equal(check.status, 200, check.tekst.slice(0, 200)); assert.ok(check.body.kortingCenten > 0);
  assert.equal('_korting' in check.body, false);
  const ba = await bestel(a, 'LAATSTE', 'k-a');
  assert.equal(ba.status, 200, ba.tekst.slice(0, 300));
  assert.equal((await bestel(a, 'LAATSTE', 'k-a2')).status, 200, 'dezelfde lopende rekening telt niet opnieuw');
  assert.equal((await bestel(b, 'LAATSTE', 'k-b')).status, 200);
  const cc = await bestel(c, 'LAATSTE', 'k-c');
  assert.equal(cc.status, 409); assert.equal(cc.body.code, 'kortingscode');
  const stand = await api('/api/supplier/eten/instellingen', { actie: 'bewaar-korting', code: 'LAATSTE', procent: 10, maxGebruik: 2, perLid: 1 }, ZAAK);
  assert.equal(stand.body.kortingscodes.find(x => x.code === 'LAATSTE').gebruik, 2);
});

test('wie codes raadt, loopt tegen de rem', async () => {
  const d = await lid();
  let laatste;
  for (let i = 0; i < 11; i++)
    laatste = await api('/api/gast/bezorg/checkout', { zaak: 'KIKUNOI', kanaal: 'afhaal', items: [{ itemId: ITEM.id, aantal: 1 }],
      kortingscode: 'GOK' + i }, d);
  assert.equal(laatste.status, 429, 'na tien mislukte codes gaat de deur voor dit lid dicht');
  const zonder = await api('/api/gast/bezorg/checkout', { zaak: 'KIKUNOI', kanaal: 'afhaal', items: [{ itemId: ITEM.id, aantal: 1 }] }, d);
  assert.equal(zonder.status, 200, 'zonder code blijft bestellen gewoon open');
});
