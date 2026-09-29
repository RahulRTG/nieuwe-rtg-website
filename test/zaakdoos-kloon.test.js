/* DE KLOON PER ZAAK (devices.zaakdoos_sleutel, besluit B12).

   1. De kloon is een POSITIEVE lijst: een collectie die er morgen bij komt --
      hier een verzonnen gevoelige -- blijft buiten, net als elk veld van de zaak
      dat niet in ZAAK_VELDEN staat, en elke rij van een andere zaak.
   2. De doos neemt alleen de collecties uit de lijst over en laat de rest van
      zichzelf staan; een antwoord in een ander formaat verandert niets.
   3. End-to-end: een doos met ALLEEN een eigen sleutel (geen gedeelde) haalt de
      kloon van haar zaak op, geeft een buurmelding door (de cloud keurt de sleutel
      van de buur), de lijn valt weg, en de zaak werkt lokaal door op gegevens die
      aantoonbaar uit die kloon komen.

   Draai los: node --test test/zaakdoos-kloon.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, stopHard, kantoorAlsPersoon } = require('./helper');
const { KLOON, ZAAK_VELDEN, FORMAAT, kloonVoorZaak, pasToe } = require('../server/kern/zaakdoos/kloon');
const { doosKoppen } = require('../server/kern/zaakdoos/koppen');

const _fetch = globalThis.fetch;
const fetch = (u, o) => _fetch(u, Object.assign({ signal: AbortSignal.timeout(15000) }, o));

function wereld() {
  return {
    suppliers: [
      { code: 'ZAAKA', name: 'A', menu: [{ id: 'm1' }], salon: { bio: 'x' }, apiSleutelVanDeZaak: 'geheim-veld' },
      { code: 'ZAAKB', name: 'B', menu: [{ id: 'm2' }] }
    ],
    supplierTypes: { horeca: { label: 'Horeca' } },
    orders: [{ ref: 'o1', supplierCode: 'ZAAKA' }, { ref: 'o2', supplierCode: 'ZAAKB' }],
    reserveringen: [{ id: 'r1', supplierCode: 'ZAAKB' }],
    posSales: { ZAAKA: [{ id: 'p1' }], ZAAKB: [{ id: 'p2' }] },
    tickets: { ZAAKB: [{ id: 't2' }] },
    sessions: { tok: { key: 'lid-1' } },
    live: { 'lid-1': { lat: 1, lng: 2 } },
    geheimeCollectie: { wachtwoord: 'nooit-in-een-kloon' }
  };
}

test('1. de kloon draagt alleen de positieve lijst en alleen de eigen zaak', () => {
  const k = kloonVoorZaak(wereld(), 'ZAAKA');
  assert.equal(k.formaat, FORMAAT);
  assert.equal(k.zaak, 'ZAAKA');
  assert.deepEqual(Object.keys(k.data).sort(), Object.keys(KLOON).sort());
  const plat = JSON.stringify(k);
  for (const weg of ['geheimeCollectie', 'nooit-in-een-kloon', 'sessions', 'lid-1', 'ZAAKB', 'geheim-veld', 'apiSleutelVanDeZaak', 'salon'])
    assert.ok(!plat.includes(weg), weg + ' hoort niet in de kloon');
  assert.deepEqual(k.data.suppliers, [{ code: 'ZAAKA', name: 'A', menu: [{ id: 'm1' }] }]);
  for (const v of Object.keys(k.data.suppliers[0])) assert.ok(ZAAK_VELDEN.includes(v));
  assert.deepEqual(k.data.orders.map(o => o.ref), ['o1']);
  assert.deepEqual(k.data.reserveringen, []);
  assert.deepEqual(k.data.posSales, { ZAAKA: [{ id: 'p1' }] });
  assert.deepEqual(k.data.tickets, {});
  assert.equal(kloonVoorZaak(wereld(), 'ONBEKEND'), null, 'geen zaak, geen kloon');
  assert.equal(kloonVoorZaak(wereld(), ''), null);
  // een kopie: de kloon deelt geen objecten met de bron
  k.data.suppliers[0].menu.push({ id: 'x' });
  assert.equal(wereld().suppliers[0].menu.length, 1);
});

test('2. de doos neemt alleen de lijst over en laat de rest van zichzelf staan', () => {
  const db = { data: { doosJournaal: [{ seq: 1 }], suppliers: [{ code: 'OUD' }], vapid: { pub: 'doos-eigen' } } };
  const k = kloonVoorZaak(wereld(), 'ZAAKA');
  k.data.geheimeCollectie = { lek: 1 }; // een cloud die meer stuurt dan de lijst
  assert.equal(pasToe(db, k), Object.keys(KLOON).length);
  assert.deepEqual(db.data.suppliers.map(s => s.code), ['ZAAKA']);
  assert.equal(db.data.geheimeCollectie, undefined, 'buiten de lijst neemt de doos niets over');
  assert.deepEqual(db.data.doosJournaal, [{ seq: 1 }], 'het journaal is van de doos');
  assert.deepEqual(db.data.vapid, { pub: 'doos-eigen' });
  assert.equal(pasToe(db, { data: wereld() }), null, 'een ander formaat verandert niets');
});

test('2b. de koppen gaan mee als de doos een eigen sleutel heeft', () => {
  const oud = { id: process.env.RTG_DOOS_ID, s: process.env.RTG_DOOS_EIGEN_SLEUTEL };
  delete process.env.RTG_DOOS_ID; delete process.env.RTG_DOOS_EIGEN_SLEUTEL;
  try {
    assert.deepEqual(doosKoppen({ a: 1 }, 'g'), { a: 1, 'x-doos-sleutel': 'g' }, 'zonder eigen sleutel niets nieuws');
    process.env.RTG_DOOS_ID = 'doos-x'; process.env.RTG_DOOS_EIGEN_SLEUTEL = 'ZD.' + 'A'.repeat(32);
    assert.deepEqual(doosKoppen({}, ''), { 'x-doos-id': 'doos-x', 'x-doos-eigen-sleutel': 'ZD.' + 'A'.repeat(32) });
  } finally {
    if (oud.id) process.env.RTG_DOOS_ID = oud.id; else delete process.env.RTG_DOOS_ID;
    if (oud.s) process.env.RTG_DOOS_EIGEN_SLEUTEL = oud.s; else delete process.env.RTG_DOOS_EIGEN_SLEUTEL;
  }
});

test('3. een doos met alleen een eigen sleutel werkt lokaal door op de kloon van haar zaak', { timeout: 240000 }, async () => {
  const mapC = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kloon-cloud-'));
  const mapD = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kloon-doos-'));
  const vorig = process.env.RTG_DOOS_SLEUTEL;
  delete process.env.RTG_DOOS_SLEUTEL; // geen gedeelde sleutel, aan geen van beide kanten
  let cloud, doos;
  const api = (base, pad, body, token) => fetch(base + pad, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  async function wacht(base, pad, keur) {
    for (let i = 0; i < 300; i++) {
      try { const r = await fetch(base + pad); if (r.ok) { const d = await r.json(); if (keur(d)) return d; } } catch (e) {}
      await new Promise(r => setTimeout(r, 200));
    }
    throw new Error('kwam niet: ' + base + pad);
  }
  try {
    cloud = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: mapC } });
    const eig = await kantoorAlsPersoon(cloud.base);
    const sl = await api(cloud.base, '/api/office/doos/sleutel', { doos: 'strandbox', zaak: 'KIKUNOI' }, eig);
    assert.equal(sl.status, 200, JSON.stringify(sl.body));
    // een merkteken in de cloud dat de doos alleen via de kloon kan kennen
    const zaak = (await api(cloud.base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
    const st = (await api(cloud.base, '/api/supplier/state', {}, zaak)).body.state;
    const itemId = st.menu[0].id;
    assert.equal((await api(cloud.base, '/api/supplier/overschot', { op: 'erbij', itemId, qty: 7 }, zaak)).status, 200);

    doos = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: mapD, RTG_DOOS_CLOUD: cloud.base,
      RTG_DOOS_ID: 'strandbox', RTG_DOOS_EIGEN_SLEUTEL: sl.body.sleutel, RTG_DOOS_USER: 'rahul', RTG_DOOS_WACHTWOORD: 'Imran',
      RTG_DOOS_NAAM: 'strandbox' } });
    await wacht(doos.base, '/api/doos/status', d => d.modus === 'cloud' && d.laatsteKloon > 0);

    // de buurtfailover met een eigen sleutel: deze doos keurt hem niet, de cloud wel (scope buurmelding)
    const buur = (sleutel) => fetch(doos.base + '/api/doos/buurmelding', { method: 'POST', body: JSON.stringify({ doos: 'x', rtt: 0 }),
      headers: { 'Content-Type': 'application/json', 'x-doos-id': 'strandbox', 'x-doos-eigen-sleutel': sleutel } });
    const goed = await buur(sl.body.sleutel);
    assert.equal(goed.status, 200);
    assert.equal((await goed.json()).doorgegeven, true);
    assert.equal((await buur('ZD.' + '0'.repeat(32))).status, 403, 'een verkeerde sleutel weigert de cloud, en dus ook de doos');
    for (let i = 0; i < 3; i++) await buur('ZD.' + '0'.repeat(32));
    assert.equal((await buur('ZD.' + '0'.repeat(32))).status, 429, 'na vier weigeringen remt de doos zelf, onder de IP-rem van de cloud');
    const nogIn = await fetch(cloud.base + '/api/doos/meting', { method: 'POST', body: JSON.stringify({ doos: 'x', rtt: 1 }),
      headers: { 'Content-Type': 'application/json', 'x-doos-id': 'strandbox', 'x-doos-eigen-sleutel': sl.body.sleutel } });
    assert.equal(nogIn.status, 200, 'en de cloud heeft dit adres niet buitengesloten');
    await stopHard(cloud.child);
    let login;
    for (let i = 0; i < 20; i++) {
      login = await api(doos.base, '/api/supplier/login', { username: 'rahul', password: 'Imran' });
      if (login.status === 200) break;
      await new Promise(r => setTimeout(r, 500));
    }
    assert.equal(login.status, 200, 'de zaak logt lokaal in');
    const lokaal = (await api(doos.base, '/api/supplier/state', {}, login.body.token)).body.state;
    assert.equal(lokaal.supplier.code, 'KIKUNOI');
    assert.ok((lokaal.overschot || []).some(o => o.itemId === itemId && o.qty === 7),
      'het overschot uit de cloud staat op de doos: de gegevens komen uit de kloon van de zaak');
  } finally {
    if (vorig === undefined) delete process.env.RTG_DOOS_SLEUTEL; else process.env.RTG_DOOS_SLEUTEL = vorig;
    if (doos) stop(doos.child);
    if (cloud) stop(cloud.child);
    for (const m of [mapC, mapD]) try { fs.rmSync(m, { recursive: true, force: true }); } catch (e) {}
  }
});
