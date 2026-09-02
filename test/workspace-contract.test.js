const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { controleer } = require('../scripts/workspace-contract');
const { FUNCTIES } = require('../server/functies/register');

test('alle huidige Living Modules volgen een contract en runtimevolgorde', () => {
  const r = controleer();
  assert.deepEqual(r.fouten, []);
  assert.ok(r.modules.length >= 8, 'kernmodules plus legacy-adapters staan in de catalogus');
  assert.ok(r.modules.every(m => m.states.length === 4 && /^\d+\.\d+\.\d+/.test(m.version)));
  assert.equal(r.worlds.filter(x => x.kind === 'world').length, 4);
  // Het getal komt uit MAPPEN zelf en niet uit een kopie hier: een wereld die
  // een onderdeel erbij krijgt, mag deze toets niet laten zakken.
  const verwacht = require('../scripts/workspace-worlds').gegevens().reduce((n, x) => n + x.items.length, 0);
  assert.ok(verwacht >= 82, 'de catalogus is nooit kleiner geworden dan de 82 van de eerste stand');
  assert.equal(r.worlds.reduce((n, x) => n + x.items.length, 0), verwacht, 'alle wereld-, instellingen- en Core-functies zijn bekend');
  assert.equal(r.coverage.serviceCapabilities, FUNCTIES.length, 'alle serverfuncties blijven onder de bestaande policygrens');
  assert.ok(r.coverage.serviceCapabilities >= 204);
  assert.deepEqual(r.coverage.unknownClaims, []);
});

test('Module SDK weigert dubbelingen, vrije ids en onverklaarde events', () => {
  const sandbox = { window: {} }; vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'shared', 'interface', 'module-sdk.js'), 'utf8'), sandbox);
  const S = sandbox.window.RTGModuleSDK;
  assert.throws(() => S.define({ id: 'Niet Goed', title: 'Fout' }, () => ({})), /module-id/i);
  assert.throws(() => S.define({ id: 'goed', title: 'Goed', events: { publishes: ['loswoord'] } }, () => ({})), /publicatie/i);
  const d = S.define({ id: 'goed', title: 'Goed', states: S.states, capabilities: [], permissions: [],
    actions: [], events: { publishes: [], subscribes: [] } }, () => ({}));
  S.add(d); assert.throws(() => S.add(d), /Dubbele RTG-module/);
});
