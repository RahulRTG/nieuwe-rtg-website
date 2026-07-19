/* RTG Atelier: het besloten ontwerpbureau van de kantoren. Ontwerpen voor
   mode en alles wat je aan het lijf draagt, met een AI die het concept
   uittekent (silhouet, materialen, gedempt palet, verhaal), een tech pack
   levert en de blik van de creatief directeur geeft.
   Draai los: node --experimental-sqlite --test test/atelier.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, office;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-atelier-'));
const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. het atelier staat klaar met categorieen en gezaaide signatuurstukken', async () => {
  const r = await api('/api/office/atelier', {}, office);
  assert.equal(r.status, 200);
  assert.ok(r.body.categorieen.some(c => c.id === 'horloges') && r.body.categorieen.some(c => c.id === 'tassen'), 'de wearable-categorieen bestaan');
  assert.ok(r.body.ontwerpen.length >= 2, 'er staan al signatuurstukken in het atelier');
  assert.ok(r.body.statussen.includes('productie'));
  // alleen het kantoor komt binnen
  assert.equal((await api('/api/office/atelier', {}, null)).status, 401);
});

test('2. een ontwerp maken; de AI tekent het concept uit met palet en verhaal', async () => {
  const mk = await api('/api/office/atelier/maak', { categorie: 'schoenen', naam: 'Cognac Oxford No.7', brief: 'Handgemaakte oxford, warme cognac patina, tijdloos', huis: 'RTG Atelier' }, office);
  assert.equal(mk.status, 200);
  const oid = mk.body.ontwerp.id;
  assert.equal(mk.body.ontwerp.categorie, 'schoenen');
  const con = await api('/api/office/atelier/concept', { id: oid }, office);
  assert.equal(con.status, 200);
  const c = con.body.ontwerp.concept;
  assert.ok(c && c.silhouet && c.materialen.length, 'er is een silhouet en materialen');
  assert.ok(Array.isArray(c.kleuren) && c.kleuren.length >= 2, 'een palet van tinten');
  assert.ok(c.kleuren.every(k => /^#[0-9a-fA-F]{6}$/.test(k.hex)), 'elke tint heeft een geldige hex voor het moodboard');
  assert.ok(c.verhaal.length > 30, 'en een verhaal bij het stuk');
});

test('3. het tech pack: onderdelen met materiaal en spec, plus controle', async () => {
  const mk = await api('/api/office/atelier/maak', { categorie: 'tassen', naam: 'Ivoor Bucket', brief: 'Zachte bucket in ivoor nappa' }, office);
  const oid = mk.body.ontwerp.id;
  await api('/api/office/atelier/concept', { id: oid }, office);
  const tp = await api('/api/office/atelier/techpack', { id: oid }, office);
  assert.equal(tp.status, 200);
  const p = tp.body.ontwerp.techpack;
  assert.ok(Array.isArray(p.onderdelen) && p.onderdelen.length >= 4, 'er zijn onderdelen');
  assert.ok(p.onderdelen.every(o => o.naam && o.materiaal), 'elk onderdeel heeft een materiaal');
  assert.ok(Array.isArray(p.controle) && p.controle.length, 'met een controlelijst');
});

test('4. de creatief directeur geeft kritiek met concrete punten', async () => {
  const r = await api('/api/office/atelier', {}, office);
  const oid = r.body.ontwerpen[0].id;
  const k = await api('/api/office/atelier/kritiek', { id: oid, q: 'Waar kan dit scherper?' }, office);
  assert.equal(k.status, 200);
  assert.ok(k.body.kritiek && k.body.kritiek.length > 20, 'er is een leesbare kritiek');
});

test('5. status doorschakelen en een collectie aanmaken', async () => {
  const mk = await api('/api/office/atelier/maak', { categorie: 'hoeden', naam: 'Fedora Antraciet' }, office);
  const oid = mk.body.ontwerp.id;
  const zet = await api('/api/office/atelier/zet', { id: oid, status: 'prototype' }, office);
  assert.equal(zet.body.ontwerp.status, 'prototype');
  assert.equal((await api('/api/office/atelier/zet', { id: oid, status: 'onzin' }, office)).body.ontwerp.status, 'prototype', 'een onbekende status verandert niets');
  const col = await api('/api/office/atelier/collectie', { naam: 'Nocturne', seizoen: 'FW26', huis: 'RTG Atelier' }, office);
  assert.equal(col.status, 200);
  const ov = await api('/api/office/atelier', {}, office);
  assert.ok(ov.body.collecties.some(c => c.naam === 'Nocturne'), 'de collectie staat in het overzicht');
  assert.ok(ov.body.kpi.totaal >= 3);
});
