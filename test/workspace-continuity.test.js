'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const code = fs.readFileSync(path.join(__dirname, '../public/shared/interface/workspace-continuity.js'), 'utf8');
const KEY = 'rtg.interface.workspace.v2';
const tick = () => new Promise(resolve => setImmediate(resolve));
const clone = x => JSON.parse(JSON.stringify(x));
const layout = (active, updatedAt = '2026-01-01T00:00:00.000Z') => ({ order: ['work', 'travel'],
  hidden: [], active, density: 'compact', updatedAt });

function setup() {
  const data = new Map([['rtg_member_token', 'session-a']]), timers = new Map(), listeners = new Map();
  const requests = [], changes = []; let serial = 0;
  const window = { localStorage: { getItem: k => data.get(k) || null,
    setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) },
    crypto: { subtle: { digest: async (algorithm, bytes) => createHash('sha256').update(bytes).digest() } },
    fetch: (url, options) => new Promise(resolve => requests.push({ url, options,
      answer: workspace => resolve({ ok: true, json: async () => ({ workspace }) }) })),
    addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  vm.runInNewContext(code, { window, TextEncoder, Uint8Array, setTimeout: fn => { timers.set(++serial, fn); return serial; },
    clearTimeout: id => timers.delete(id) });
  function make() {
    const instance = window.RTGWorkspaceContinuity({ onChange: x => changes.push(clone(x)) });
    instance.load(['work', 'travel']); return instance;
  }
  return { data, requests, changes, listeners, make,
    runTimers() { for (const [id, fn] of [...timers]) { timers.delete(id); fn(); } } };
}

async function synced(x, store) {
  const promise = store.sync(); await tick();
  x.requests.at(-1).answer(layout('work')); await promise;
}

test('een indeling herstelt alleen bij dezelfde sessie en bewaart geen credential of brondata', async () => {
  const x = setup(), a = x.make(); await synced(x, a);
  a.save({ ...layout('travel'), token: 'secret', note: 'private' }, true);
  const raw = x.data.get(KEY), box = JSON.parse(raw);
  assert.match(box.owner, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(raw, /session-a|secret|private/);
  a.destroy(); const same = x.make(); await tick();
  assert.equal(same.current().active, 'travel'); same.destroy();
  x.data.set('rtg_member_token', 'session-b'); const b = x.make(); await tick();
  assert.equal(b.current().active, null);
  assert.equal(b.current().updatedAt, null);
});

test('een uitgestelde opslag van A wordt nooit met het token van B verzonden', async () => {
  const x = setup(), store = x.make(); await synced(x, store);
  store.save(layout('travel'));
  x.data.set('rtg_member_token', 'session-b'); x.runTimers(); await tick();
  assert.equal(x.requests.length, 1, 'alleen de eerdere leesaanvraag mag bestaan');
  assert.equal(store.current().active, null);
});

test('een laat leesantwoord na uitloggen wordt niet toegepast of lokaal bewaard', async () => {
  const x = setup(), store = x.make(), p = store.sync(); await tick();
  const before = x.changes.length;
  x.data.delete('rtg_member_token'); x.requests[0].answer(layout('travel'));
  const result = await p;
  assert.equal(result.active, null);
  assert.equal(x.changes.length, before);
  assert.equal(x.data.has(KEY), false);
});

test('een ouder opslagantwoord overschrijft geen nieuwere gebruikerskeuze', async () => {
  const x = setup(), store = x.make(); await synced(x, store);
  store.save(layout('travel')); x.runTimers();
  store.save(layout('work'));
  x.requests[1].answer(layout('travel', '2030-01-01T00:00:00.000Z')); await tick();
  assert.equal(store.current().active, 'work');
  assert.equal(JSON.parse(x.data.get(KEY)).workspace.active, 'work');
});

test('de lokale keuze tijdens een lopende herstelvraag blijft bewaard', async () => {
  const x = setup(), store = x.make(), p = store.sync(); await tick();
  store.save(layout('travel'));
  x.requests[0].answer(layout('work', '2030-01-01T00:00:00.000Z')); await p;
  assert.equal(store.current().active, 'travel');
});

test('ongebonden legacydata wordt niet geadopteerd en destroy sluit lopende antwoorden', async () => {
  const x = setup(); x.data.set(KEY, JSON.stringify(layout('travel')));
  x.data.set('rtg.interface.second-screen.v1', JSON.stringify(layout('travel')));
  const store = x.make(); await tick();
  assert.equal(store.current().active, null);
  assert.equal(x.data.has('rtg.interface.second-screen.v1'), false);
  const p = store.sync(); await tick(); const before = x.changes.length;
  store.destroy(); x.requests[0].answer(layout('travel')); await p;
  assert.equal(x.changes.length, before);
  assert.equal(x.listeners.size, 0);
});
