/* RTG School golf 1: de officiële ladder, het leerpaspoort dat een leven
   lang meegaat, de doorstroomkaart die rare sprongen tegenhoudt, en de
   eerlijkheid (geen accreditatieclaims, geen echte namen in het dossier).
   Draai los: node --test test/onderwijs.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, token;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-onderwijs-'));

function api(pad, body, tok) {
  return fetch(base + '/api/onderwijs' + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (tok || token) },
    body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const r = await fetch(base + '/api/auth/register', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Leerling Levenslang', email: 'ow' + u + '@x.nl', phone: '06' + u,
      password: 'geheim123', geboortedatum: '1990-01-15', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' }) });
  token = (await r.json()).token;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de ladder staat compleet en is eerlijk over wat wij niet zijn', async () => {
  const l = await api('/ladder');
  assert.equal(l.status, 200);
  assert.equal(l.body.fasen.length, 25, 'van groep 1 tot een leven lang leren');
  assert.ok(l.body.fasen.some(f => f.id === 'po-g1') && l.body.fasen.some(f => f.id === 'wo-phd'));
  assert.ok(l.body.referentie['1F'] && l.body.referentie['4F'], 'de referentieniveaus zijn het meetlint');
  assert.match(l.body.eerlijk, /geen\s+school of examenbureau/i, 'wij claimen geen accreditatie');
  assert.match(l.body.eerlijk, /officiële instellingen/i);
});

test('2. een leven op de ladder: van groep 1 via het schooladvies naar de universiteit', async () => {
  assert.equal((await api('/inschrijf', { fase: 'po-g1' })).status, 200);
  // de basisschool door, trede voor trede
  for (const g of ['po-g2', 'po-g3', 'po-g4', 'po-g5', 'po-g6', 'po-g7', 'po-g8']) {
    assert.equal((await api('/inschrijf', { fase: g })).status, 200, 'over naar ' + g);
  }
  // vanuit groep 8 mag het schooladvies alle kanten op; wij kiezen vwo
  const vwo = await api('/inschrijf', { fase: 'vwo', reden: 'schooladvies' });
  assert.equal(vwo.status, 200);
  assert.equal(vwo.body.fase.id, 'vwo');
  // leerjaren stapelen binnen de fase
  assert.equal((await api('/jaar-over')).body.jaar, 2);
  // en door naar de universiteit, tot het leren nooit meer stopt
  for (const f of ['wo-b', 'wo-m', 'wo-phd', 'leven']) {
    assert.equal((await api('/inschrijf', { fase: f })).status, 200, 'over naar ' + f);
  }
  const mijn = await api('/mijn');
  assert.equal(mijn.body.fase.id, 'leven');
  assert.ok(mijn.body.historie.length >= 11, 'het paspoort onthoudt de hele levensloop');
});

test('3. de doorstroomkaart houdt rare sprongen tegen en het paspoort kent geen namen', async () => {
  // vanuit 'leven' bestaat geen route terug naar groep 3
  assert.equal((await api('/inschrijf', { fase: 'po-g3' })).status, 400);
  assert.equal((await api('/inschrijf', { fase: 'bestaat-niet' })).status, 400);
  // leerdoelen: alleen nette ids, en het antwoord bevat nooit de echte naam
  assert.equal((await api('/doel', { doel: 'rekenen.g3.optellen-tot-20' })).status, 200);
  assert.equal((await api('/doel', { doel: '<script>' })).status, 400);
  const alles = JSON.stringify((await api('/mijn')).body);
  assert.doesNotMatch(alles, /Leerling Levenslang|Levenslang/, 'het leerpaspoort draait op de codenaam');
  // en dicht zonder token
  assert.equal((await api('/mijn', {}, 'nep')).status, 401);
});
