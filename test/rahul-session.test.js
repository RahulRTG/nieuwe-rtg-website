'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const session = require('../public/shared/rahul-tab/session');
const approval = require('../public/shared/rahul-tab/approval');

function storage() {
  const data = new Map();
  return { getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) };
}
function window() { return { crypto: webcrypto, localStorage: storage(), sessionStorage: storage() }; }

test('Rahul-geschiedenis blijft bij dezelfde sessie en nooit bij het volgende account', async () => {
  const win = window(); win.localStorage.setItem('rtg_member_token', 'lid-a');
  const store = session.create(win), first = await store.read();
  assert.match(first.owner, /^[a-f0-9]{64}$/);
  assert.equal(await store.write(first.owner, [{ rol: 'user', tekst: 'Privé vraag van A' }]), true);
  assert.equal((await store.read()).history[0].tekst, 'Privé vraag van A');

  win.localStorage.setItem('rtg_member_token', 'lid-b');
  const second = await store.read();
  assert.notEqual(second.owner, first.owner);
  assert.deepEqual(second.history, []);
  assert.doesNotMatch(win.sessionStorage.getItem(session.key), /Privé vraag van A|lid-a|lid-b/);
  assert.equal(await store.write(first.owner, [{ rol: 'rahul', tekst: 'te laat antwoord' }]), false,
    'een antwoord uit de vorige sessie mocht niet na de accountwissel worden bewaard');
});

test('legacy ongebonden opslag en bevestigingscontext worden niet gemigreerd', async () => {
  const win = window(); win.localStorage.setItem('rtg_sup_token', 'zaak-a');
  win.sessionStorage.setItem(session.legacyKey, JSON.stringify([{ rol: 'user', tekst: 'oude vraag' }]));
  const current = await session.create(win).read();
  assert.deepEqual(current.history, []);
  assert.equal(win.sessionStorage.getItem(session.legacyKey), null);
});

test('een Rahul-goedkeuring kan niet onder een ander account worden uitgevoerd', async () => {
  const controls = { '[data-approval]': {}, '[data-approve]': { hidden: true, disabled: false } };
  let owner = 'account-a', requests = 0;
  const win = { confirm: () => true, fetch: async () => { requests += 1; return { ok: true, json: async () => ({ ok: true }) }; } };
  const controller = approval.create({ win, page: { querySelector: selector => controls[selector] },
    sync: async () => {}, owner: () => owner, add: () => {} });
  controller.show({ goedkeuringen: [{ id: 'g-1', samenvatting: 'Boek' }] }, 'token-a', true, owner);
  owner = 'account-b';
  assert.equal(await controller.confirm(), false);
  assert.equal(requests, 0, 'de oude bevestiging mag de uitvoeringsroute niet bereiken');
});
