'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');

const OWNER = 'incident-owner@x.nl';
let srv, token;
function post(pad, body, tok) {
  const headers = { 'Content-Type': 'application/json' };
  if (tok) headers.Authorization = 'Bearer ' + tok;
  return fetch(srv.base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_OWNER_EMAIL: OWNER } });
  token = (await post('/api/techniek/inloggen', { login: OWNER, wachtwoord: 'Imran' })).body.token;
});
test.after(() => stop(srv && srv.child));

test('de controlelaag is alleen voor de eigenaar en toont code plus routes', async () => {
  assert.equal((await fetch(srv.base + '/api/techniek/controle/status')).status, 401);
  const r = await fetch(srv.base + '/api/techniek/controle/status', { headers: { Authorization: 'Bearer ' + token } });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.incident.modus, 'normaal');
  assert.ok(d.inventaris.routes > 1500);
  assert.ok(d.inventaris.schakelaars > 20);
  const routes = await fetch(srv.base + '/api/techniek/controle/inventaris?soort=routes&zoek=%2Fapi%2Fcharter&limiet=10',
    { headers: { Authorization: 'Bearer ' + token } }).then(x => x.json());
  assert.ok(routes.resultaten.some(x => x.functie === 'charter'));
});

test('gericht dichtzetten blokkeert direct en herstel zet de oude stand terug', async () => {
  const dicht = await post('/api/techniek/controle/incident', {
    actie: 'beperk', id: 'charter', reden: 'Verdachte code in charter aangetroffen'
  }, token);
  assert.equal(dicht.status, 200);
  assert.equal(dicht.body.incident.modus, 'beperkt');
  assert.equal((await post('/api/charter/aanbod', { city: 'Ibiza' })).status, 503);
  assert.equal((await post('/api/techniek/controle/incident', {
    actie: 'herstel', reden: 'Onderzoek afgerond en schone code bevestigd', bevestiging: 'verkeerd'
  }, token)).status, 400);
  const herstel = await post('/api/techniek/controle/incident', {
    actie: 'herstel', reden: 'Onderzoek afgerond en schone code bevestigd', bevestiging: 'HERSTEL RTG'
  }, token);
  assert.equal(herstel.status, 200);
  assert.equal(herstel.body.incident.modus, 'normaal');
  assert.notEqual((await post('/api/charter/aanbod', { city: 'Ibiza' })).status, 503);
  assert.ok(herstel.body.incident.auditAantal >= 2);
});

test('volledige isolatie laat health en de herstelkamer bereikbaar', async () => {
  const iso = await post('/api/techniek/controle/incident', {
    actie: 'isoleer', reden: 'Bevestigde aanval vereist volledige isolatie', bevestiging: 'ISOLEER RTG'
  }, token);
  assert.equal(iso.status, 200);
  assert.equal(iso.body.incident.modus, 'isolatie');
  assert.equal((await fetch(srv.base + '/api/health')).status, 200);
  assert.equal((await fetch(srv.base + '/api/techniek/controle/status', {
    headers: { Authorization: 'Bearer ' + token } })).status, 200);
  assert.equal((await post('/api/foundation/gezin/maak', { gezinsnaam: 'X' })).status, 503);
  const terug = await post('/api/techniek/controle/incident', {
    actie: 'herstel', reden: 'Schone release hersteld en volledig gecontroleerd', bevestiging: 'HERSTEL RTG'
  }, token);
  assert.equal(terug.status, 200);
  assert.equal(terug.body.incident.modus, 'normaal');
});
