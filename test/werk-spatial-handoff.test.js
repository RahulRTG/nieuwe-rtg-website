'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'public/apps/werk/kern.js'), 'utf8');

function runtime(search, initial, workspaces) {
  const values = new Map(Object.entries(initial || {})), requests = [];
  const localStorage = { getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
  const window = { localStorage, setTimeout, clearTimeout };
  const sandbox = { window, localStorage, location: { search }, URLSearchParams, JSON, Object, String,
    Promise, fetch: async (url, options) => { requests.push({ url, options }); return { json: async () => ({ werkruimtes: workspaces }) }; },
    document: { getElementById: () => null }, setTimeout, clearTimeout };
  vm.createContext(sandbox); vm.runInContext(source, sandbox);
  return { K: window.RTGWerk, values, requests };
}

test('Spatial-handoff kiest alleen de door hetzelfde account bevestigde WorkOS-werkruimte', async () => {
  const token = 'member-account-token', old = JSON.stringify({ werkruimte: 'W111', lidToken: 'oude-sessie' });
  const r = runtime('?werkruimte=W222', { rtg_member_token: token, rtg_werk_sessie: old }, [
    { werkruimte: 'W111', naam: 'Een', lidToken: 'nieuw-een' },
    { werkruimte: 'W222', naam: 'Twee', lidToken: 'nieuw-twee' }
  ]);
  assert.equal(r.K.wisselNodig(), true);
  assert.equal(await r.K.viaLid(), true);
  assert.deepEqual(JSON.parse(r.values.get('rtg_werk_sessie')), { werkruimte: 'W222', lidToken: 'nieuw-twee' });
  assert.equal(r.K.wisselNodig(), false);
  assert.equal(r.requests.length, 1);
  assert.equal(r.requests[0].url, '/api/bedrijf/mijn');
  assert.equal(r.requests[0].options.headers.Authorization, 'Bearer ' + token);
});

test('een onbekende of ongeldige werkruimtecode wordt nooit als accountcontext overgenomen', async () => {
  const known = { werkruimte: 'W111', naam: 'Een', lidToken: 'nieuw-een' };
  const missing = runtime('?werkruimte=W999', { rtg_member_token: 'lid',
    rtg_werk_sessie: JSON.stringify({ werkruimte: 'W111', lidToken: 'oud' }) }, [known]);
  assert.equal(await missing.K.viaLid(), false);
  assert.equal(missing.values.has('rtg_werk_sessie'), false, 'expliciete maar onbevoegde handoff valt niet terug op een andere organisatie');

  const injected = runtime('?werkruimte=W111%26lidToken%3Dgestolen', { rtg_member_token: 'lid' }, [known]);
  assert.equal(injected.K.gewensteWerkruimte(), '');
  assert.equal(await injected.K.viaLid(), true, 'zonder geldige keuze blijft de bestaande accountbootstrap werken');
  assert.deepEqual(JSON.parse(injected.values.get('rtg_werk_sessie')), { werkruimte: 'W111', lidToken: 'nieuw-een' });
});
