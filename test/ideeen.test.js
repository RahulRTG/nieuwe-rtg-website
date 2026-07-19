/* De Ideeenkamer (kern/ideeen.js): de gedeelde werkbank van de vier
   ontwerpbureaus. Een idee met bureau-tags, reacties, AI-uitwerking per bureau
   en een spin-off die echt een concept in het gekozen bureau aanmaakt.
   Draai los: node --experimental-sqlite --test test/ideeen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, office;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ideeen-'));
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

test('1. de ideeenkamer kent de vier bureaus en heeft een gezaaid idee', async () => {
  const r = await api('/api/office/ideeen', {}, office);
  assert.equal(r.status, 200);
  for (const id of ['atelier', 'studio', 'hardware', 'architect']) {
    assert.ok(r.body.bureaus.some(b => b.id === id), id + ' is een bureau');
  }
  assert.ok(r.body.ideeen.length >= 1, 'er staat al een idee');
  assert.equal((await api('/api/office/ideeen', {}, null)).status, 401);
});

test('2. een idee maken met gekozen bureaus', async () => {
  const mk = await api('/api/office/ideeen/maak', { titel: 'Zeezijde-collectie', brief: 'Alles voor aan zee: kleding, boot en paviljoen in dezelfde taal.', bureaus: ['atelier', 'studio', 'architect'] }, office);
  assert.equal(mk.status, 200);
  assert.equal(mk.body.idee.bureaus.length, 3);
  assert.ok(mk.body.idee.bureaus.some(b => b.id === 'studio'));
  assert.equal((await api('/api/office/ideeen/maak', { titel: '' }, office)).status, 400);
});

test('3. reageren en de AI werkt het idee uit tot een brief per bureau', async () => {
  const mk = await api('/api/office/ideeen/maak', { titel: 'Bergresidentie', brief: 'Chalet met bijpassende wagen en wearables voor de piste.', bureaus: ['architect', 'studio', 'hardware'] }, office);
  const iid = mk.body.idee.id;
  const re = await api('/api/office/ideeen/reactie', { id: iid, tekst: 'Mooi, ik pak de wearables.', door: 'Hardwarelab' }, office);
  assert.equal(re.status, 200);
  assert.ok(re.body.idee.reacties.some(r => r.tekst.includes('wearables')), 'de reactie staat erbij');
  const uit = await api('/api/office/ideeen/uitwerken', { id: iid }, office);
  assert.equal(uit.status, 200);
  const u = uit.body.idee.uitwerking;
  assert.ok(u && u.architect && u.studio && u.hardware, 'een brief per betrokken bureau');
});

test('4. spin-off: het idee gaat als echt concept naar een bureau', async () => {
  const mk = await api('/api/office/ideeen/maak', { titel: 'Duinvilla', brief: 'Lichte villa aan het duin, zwevend dak.', bureaus: ['architect'] }, office);
  const iid = mk.body.idee.id;
  const voor = (await api('/api/office/architect', {}, office)).body.ontwerpen.length;
  const spin = await api('/api/office/ideeen/spinoff', { id: iid, bureau: 'architect' }, office);
  assert.equal(spin.status, 200);
  assert.ok(spin.body.spinoff && spin.body.spinoff.ontwerpId, 'er is een concept aangemaakt');
  assert.equal(spin.body.idee.status, 'uitgewerkt');
  const na = await api('/api/office/architect', {}, office);
  assert.equal(na.body.ontwerpen.length, voor + 1, 'het architectenbureau heeft er een concept bij');
  assert.ok(na.body.ontwerpen.some(o => o.naam === 'Duinvilla'), 'met de titel van het idee');
  assert.equal((await api('/api/office/ideeen/spinoff', { id: iid, bureau: 'onzin' }, office)).status, 400);
});
