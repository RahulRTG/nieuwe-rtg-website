/* Contracttests: leggen de VORM (velden + types) van de belangrijkste API-
   antwoorden vast, los van de flow-tests. Zo kan een refactor of herindeling
   niet stilletjes een veld weglaten waar een van de apps op leunt (bijv. de
   codenaam-kaart, de reis-kaart, de leverancier-orders of het kantooroverzicht).

   Geen externe libraries: Node's testrunner + global fetch, echte server op een
   vrije poort in een tijdelijke datamap. Draai los: node --test test/api-contract.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-contract-'));

function api(pad, body, token) {
  return fetch(BASE + pad, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {})
  }).then(r => r.json());
}
// Eist dat elk pad in `velden` bestaat en van het juiste type is.
function heeftVelden(obj, velden, waar) {
  for (const [pad, type] of Object.entries(velden)) {
    const waarde = pad.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
    assert.notEqual(waarde, undefined, waar + ': veld "' + pad + '" ontbreekt');
    if (type === 'array') assert.ok(Array.isArray(waarde), waar + ': "' + pad + '" moet een array zijn');
    else assert.equal(typeof waarde, type, waar + ': "' + pad + '" moet ' + type + ' zijn');
  }
}

test.before(async () => { ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } })); });
test.after(() => { stop(child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('contract /api/login en /api/auth/register geven een token', async () => {
  const demo = await api('/api/login', { tier: 'business' });
  assert.equal(typeof demo.token, 'string', 'demo-login geeft een token-string');
  const reg = await api('/api/auth/register', { name: 'Contract Lid', email: 'contract@x.nl', phone: '0612340000',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
  assert.equal(typeof reg.token, 'string', 'registratie geeft een token-string');
});

test('contract /api/state (lid): user-, trip-, invoices- en posts-vorm ligt vast', async () => {
  const { token } = await api('/api/login', { tier: 'business' });
  const { state } = await api('/api/state', {}, token);
  assert.ok(state, 'er is een state');
  // de codenaam-kaart en begroeting leunen op deze user-velden
  heeftVelden(state, {
    'user.tier': 'string', 'user.name': 'string', 'user.full': 'string',
    'user.codename': 'string', 'user.number': 'string', 'user.since': 'string'
  }, '/api/state user');
  // de reis-kaart leunt op dest/dates/days
  heeftVelden(state, { 'trip.dest': 'string', 'trip.dates': 'string', 'trip.days': 'number' }, '/api/state trip');
  // facturen + De Salon
  assert.ok(Array.isArray(state.invoices), 'invoices is een array');
  assert.ok(Array.isArray(state.posts), 'posts is een array');
  assert.ok(Array.isArray(state.myApplications), 'myApplications is een array');
  if (state.invoices.length) {
    heeftVelden(state.invoices[0], { desc: 'string', status: 'string', netto: 'number', bijdrage: 'number',
      btw: 'number', afboekcode: 'string', afboeklabel: 'string' }, 'invoice[0]');
  }
  if (state.posts.length) {
    const p = state.posts[0];
    heeftVelden(p, { id: 'number', author: 'string', tier: 'string', text: 'string',
      likes: 'number', liked: 'boolean', canEngage: 'boolean', comments: 'array' }, 'post[0]');
  }
});

test('contract /api/supplier/state: supplier-, orders-, menu- en settings-vorm ligt vast', async () => {
  const roster = await api('/api/supplier/roster', { code: 'KIKUNOI' });
  assert.ok(Array.isArray(roster.staff) && roster.staff.length, 'roster geeft personeel');
  const man = roster.staff.find(x => x.role === 'manager');
  const login = await api('/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' });
  assert.equal(typeof login.token, 'string', 'manager-login geeft een token');
  const { state } = await api('/api/supplier/state', {}, login.token);
  assert.ok(state, 'er is een supplier-state');
  heeftVelden(state, {
    'supplier.code': 'string', 'supplier.name': 'string', 'supplier.type': 'string',
    'supplier.caps': 'array'
  }, '/api/supplier/state supplier');
  assert.ok(Array.isArray(state.orders), 'orders is een array');
  assert.ok(Array.isArray(state.menu), 'menu is een array');
  assert.equal(typeof state.settings, 'object', 'settings is een object');
});

test('contract /api/office/state: kern-overzichten en totals-vorm ligt vast', async () => {
  const login = await api('/api/office/login', { code: 'RTG-OFFICE' });
  assert.equal(typeof login.token, 'string', 'kantoor-login geeft een token');
  const { state } = await api('/api/office/state', {}, login.token);
  assert.ok(state, 'er is een office-state');
  heeftVelden(state, {
    orders: 'array', rides: 'array', live: 'array', applications: 'array', suppliers: 'array',
    week: 'array', alerts: 'array',
    'totals.orders': 'number', 'totals.rides': 'number', 'totals.leden': 'number', 'totals.partners': 'number'
  }, '/api/office/state');
});

test('contract /api/health antwoordt 200', async () => {
  const r = await fetch(BASE + '/api/health');
  assert.equal(r.status, 200, 'health is 200');
});
