/* De dealvinder: de voorspeller herkent combinatiegedrag (twee zaken
   binnen een dagdeel door dezelfde leden) en zet er een kant-en-klaar
   Synergie-voorstel van klaar; de aandelen tellen exact op tot de prijs.
   Draai los: node --experimental-sqlite --test test/dealkans.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { combinatiesUit } = require('../server/kern/voorspel.js');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-dealkans-'));
let srv, base, kikunoi, sakura, lid;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test('het pure combineren: binnen een dagdeel telt, erbuiten niet', () => {
  const rij = (lid, code, uur, centen) => ({ van: 'lid:' + lid, naar: 'partner:' + code,
    at: '2026-07-10T' + String(uur).padStart(2, '0') + ':00:00.000Z', centen });
  const samen = combinatiesUit([
    rij('X', 'AAA', 19, 8000), rij('X', 'BBB', 21, 12000),
    rij('Y', 'AAA', 18, 6000), rij('Y', 'BBB', 20, 10000)
  ]);
  assert.equal(samen.length, 1);
  assert.equal(samen[0].n, 2);
  assert.deepEqual([samen[0].a, samen[0].b], ['AAA', 'BBB']);
  assert.equal(samen[0].gemA, 7000);
  assert.equal(samen[0].gemB, 11000);
  // meer dan zes uur ertussen: geen combinatie
  const los = combinatiesUit([rij('X', 'AAA', 8, 8000), rij('X', 'BBB', 20, 12000)]);
  assert.equal(los.length, 0);
  // dezelfde zaak twee keer is geen paar
  assert.equal(combinatiesUit([rij('X', 'AAA', 19, 80), rij('X', 'AAA', 20, 90)]).length, 0);
});

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_ENC_KEY: 'test-encryptiesleutel-1234567890' } });
  base = srv.base;
  kikunoi = (await api('/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  const rooster = await api('/api/supplier/roster', { code: 'SAKURA' });
  const manager = (rooster.body.staff || []).find(s => s.role === 'manager');
  sakura = (await api('/api/supplier/login', { code: 'SAKURA', staffId: manager.id, pin: '1234' })).body.token;
  const reg = await api('/api/auth/register', { name: 'Combi Lid', email: 'combi@x.nl', phone: '0655544433',
    password: 'geheim123', geboortedatum: '1986-06-06', geslacht: 'm', tier: 'rtg', pasApp: 'rtg' });
  lid = reg.body.token;
  assert.ok(kikunoi && sakura && lid);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('combinatiegedrag wordt een dealkans met een kloppend voorstel', async () => {
  await api('/api/pay/oplaad', { centen: 100000, idem: 'dk-op' }, lid);
  for (let i = 0; i < 3; i++) {
    const k1 = await api('/api/pay/kascode', {}, lid);
    await api('/api/supplier/pay/in', { code: k1.body.code, centen: 8000, oms: 'diner', idem: 'dk-a' + i }, kikunoi);
    const k2 = await api('/api/pay/kascode', {}, lid);
    await api('/api/supplier/pay/in', { code: k2.body.code, centen: 12000, oms: 'nacht', idem: 'dk-b' + i }, sakura);
  }
  const r = await api('/api/supplier/voorspel', {}, kikunoi);
  const kans = (r.body.dealkansen || []).find(k => k.partnerCode === 'SAKURA');
  assert.ok(kans, 'dealkans met SAKURA gevonden: ' + JSON.stringify(r.body.dealkansen));
  assert.ok(kans.n >= 3);
  const v = kans.voorstel;
  assert.equal(v.aandelen.reduce((s, a) => s + a.centen, 0), v.prijsCenten, 'aandelen tellen exact op');
  assert.equal(v.prijsCenten, Math.round((8000 + 12000) * 0.9), 'tien procent pakketvoordeel');
  // het voorstel is direct bruikbaar voor een echte Synergie-deal
  const d = await api('/api/supplier/synergie/maak', { naam: v.naam, prijsCenten: v.prijsCenten, aandelen: v.aandelen }, kikunoi);
  assert.equal(d.status, 200, JSON.stringify(d.body));
  assert.equal(d.body.deal.status, 'voorstel');
});
