'use strict';
/* A-P1-05: een kritieke handeling gaat pas door als er DUURZAAM een regel
   `toegestaan` is vastgelegd, met de actor uit de sessie. Eerlijke server:
   de regel staat er. Liegende opslag (`schrijf-verloren`): 503 en niets
   uitgevoerd. Een niet-kritiek pad blijft ongemoeid. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop } = require('./helper');
const helper = require('./helper');

const mappen = [];
const verseMap = () => { const m = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ks-')); mappen.push(m); return m; };
const api = (base, pad, body, token) => fetch(base + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
let seq = 0;
async function lid(base) {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api(base, '/api/auth/register', { name: 'Spoor ' + seq, email: 'ks' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  return { token: reg.body.token, key: reg.body.codename || null };
}
let eerlijk, leugen;
test.before(async () => {
  eerlijk = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: verseMap() } });
  leugen = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: verseMap(), RTG_VERRAAD: 'schrijf-verloren' } });
});
test.after(() => { stop(eerlijk); stop(leugen); for (const m of mappen) { try { fs.rmSync(m, { recursive: true, force: true }); } catch (e) {} } });

test('1. een kritieke handeling laat VOOR het antwoord een duurzame regel `toegestaan` achter, op de sleutel van de sessie', async () => {
  const l = await lid(eerlijk.base);
  const r = await api(eerlijk.base, '/api/privacy/inzage', {}, l.token);
  assert.notEqual(r.status, 503, JSON.stringify(r.body));
  const kantoor = await helper.kantoorAlsPersoon(eerlijk.base, 'RTG-OFFICE');
  assert.ok(kantoor, 'kantoor-inlog (RTG_DEMO) nodig');
  const log = await api(eerlijk.base, '/api/office/handelingen', { max: 1000 }, kantoor);
  const regels = (log.body.regels || []).filter(x => x.pad === '/api/privacy/inzage' && x.stand === 'toegestaan');
  assert.equal(regels.length, 1, 'precies een regel vooraf: ' + JSON.stringify(log.body.regels || []).slice(0, 300));
  assert.notEqual(regels[0].wie, 'anoniem', 'de actor komt uit de sessie');
  assert.equal(regels[0].status, 0, 'vooraf kent niemand de uitkomst; `toegestaan` is geen `uitgevoerd`');
});

test('2. onder een liegende opslag gaat een kritieke handeling NIET door', async () => {
  const l = await lid(leugen.base);
  const r = await api(leugen.base, '/api/privacy/inzage', {}, l.token);
  assert.equal(r.status, 503, JSON.stringify(r.body));
  assert.equal(r.body.spoor, 'niet-vastgelegd');
});

test('3. een niet-kritiek pad blijft onder dezelfde liegende opslag gewoon lopen', async () => {
  const l = await lid(leugen.base);
  const r = await api(leugen.base, '/api/notities/mijn', {}, l.token);
  assert.equal(r.status, 200, JSON.stringify(r.body));
});

test('4. de lijst met kritieke paden bevat geld, privacy en de geldrails van kantoor en zaak', () => {
  const { kritiek } = require('../server/opzet/kritiekspoor');
  for (const p of ['/api/pay/x', '/api/privacy/inzage', '/api/office/bank/incasso', '/api/supplier/pay/uit', '/api/office/payroll/run/open']) {
    assert.ok(kritiek(p), p);
  }
  assert.equal(kritiek('/api/notities/mijn'), null);
});
