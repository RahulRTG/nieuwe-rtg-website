/* Echte People-actie; alleen de sessiegrens en het transport zijn bestuurbaar. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const voorkeur = require('../server/kern/workspace-voorkeur');
const bron = fs.readFileSync(path.join(__dirname, '../public/shared/interface/world-desktop-people.js'), 'utf8');

const opdracht = { order: ['agenda', 'notities'], idem: 'desktop-layout-0123456789abcdef0123456789abcdef' };
function antwoord(extra = {}) {
  return { ok: true, workspace: voorkeur.normaliseer({ order: opdracht.order, hidden: [], active: null,
    density: 'comfortable' }, '2026-10-30T12:00:00.000Z'), ...extra };
}
function fixture(world = 'living') {
  let zelfde = true;
  const calls = [], window = { RTGDesktopUI: { value: key => key },
    RTGModuleSDK: { define: (manifest, create) => ({ manifest, create }) } };
  const document = { addEventListener() {}, removeEventListener() {} };
  vm.runInNewContext(bron, { window, document, AbortController });
  const ctx = {
    session: { unchanged: () => zelfde },
    request(url, body) { return new Promise((resolve, reject) => calls.push({ url, body, resolve, reject })); }
  };
  const instance = window.RTGDesktopPeople(world).create(ctx);
  return { calls, wissel: () => { zelfde = false; },
    save: () => instance.actions['desktop.layout.save'].run(opdracht),
    reply: data => calls.at(-1).resolve(data) };
}

test('queued keuze van account A wordt na accountwisseling niet verzonden', async () => {
  const f = fixture();
  let vrij;
  const wachtrij = new Promise(resolve => { vrij = resolve; }).then(() => f.save());
  f.wissel(); vrij();
  await Promise.resolve();
  if (f.calls.length) f.reply(antwoord());
  await assert.rejects(wachtrij);
  assert.equal(f.calls.length, 0, 'de nieuwe actor krijgt geen oude opdracht');
});

test('antwoord voor account A geeft na accountwisseling geen opslagsucces', async () => {
  const f = fixture(), pending = f.save();
  assert.equal(f.calls.length, 1);
  f.wissel(); f.reply(antwoord());
  await assert.rejects(pending);
  assert.equal(f.calls.length, 1, 'de actorwisseling maakt geen tweede verzoek');
});

test('HTTP 200 met ok:false wordt geen geslaagde opslag', async () => {
  const f = fixture(), pending = f.save();
  f.reply(antwoord({ ok: false, error: 'Niet bewaard' }));
  await assert.rejects(pending);
});

test('ontbrekende of ongeldige workspace in het antwoord wordt geweigerd', async () => {
  for (const data of [null, {}, { ok: true }, { ok: true, workspace: null }, { ok: true, workspace: { order: 'agenda' } }]) {
    const f = fixture(), pending = f.save();
    f.reply(data);
    await assert.rejects(pending, 'ongeldig antwoord: ' + JSON.stringify(data));
  }
});

for (const [world, herhaald] of [['living', false], ['work', true]]) {
  test((herhaald ? 'idemherhaling' : 'normale opslag') + ' behoudt scope, opdracht en serverantwoord', async () => {
    const f = fixture(world), pending = f.save(), data = antwoord(herhaald ? { herhaald: true } : {});
    assert.equal(f.calls.length, 1);
    const call = f.calls[0];
    assert.equal(call.url, '/api/ik/workspace/zet');
    assert.deepEqual(JSON.parse(JSON.stringify(call.body)), { scope: world, idem: opdracht.idem,
      workspace: { order: opdracht.order, hidden: [], active: null, density: 'comfortable' } });
    f.reply(data);
    assert.deepEqual(await pending, data);
  });
}
