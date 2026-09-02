/* De platformgrenzen onder de Dynamic Layer: versiecontract, Event Fabric,
   Action Broker, centrale state, orchestration en declaratieve blueprints. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', 'public', 'shared', 'interface');

function platform(...namen) {
  const window = { navigator: { onLine: true }, matchMedia: () => ({ matches: false }), confirm: () => true };
  const sandbox = { window, document: { documentElement: { dataset: {}, lang: 'nl' } }, console, Date,
    JSON, Object, Array, String, Number, Promise, TypeError, Error, setTimeout, clearTimeout };
  vm.createContext(sandbox);
  for (const naam of namen) vm.runInContext(fs.readFileSync(path.join(ROOT, naam), 'utf8'), sandbox, { filename: naam });
  return window;
}
function spec(id, extra = {}) {
  return Object.assign({ id, name: id, version: '1.0.0', states: ['peek', 'panel', 'workspace', 'focus'],
    capabilities: [], permissions: [], actions: [], invokes: [], events: { publishes: [], subscribes: [] },
    state: { persistence: 'none' } }, extra);
}

test('Module SDK verklaart semver, surfaces, isolatie, state en migratieniveau vooraf', () => {
  const w = platform('module-sdk.js'), S = w.RTGModuleSDK;
  const m = S.validate(spec('travel', { version: '3.2.0', maturity: 'L4', runtime: { minVersion: '0.1.0' },
    surfaces: { peek: true, panel: true, workspace: true, focus: true }, performance: { peekBudgetKb: 40 } }));
  assert.equal(S.version, '0.1.0'); assert.equal(m.canonicalId, 'rtg.travel'); assert.equal(m.version, '3.2.0');
  assert.equal(m.maturity, 'L4'); assert.equal(m.isolation.globalMutation, false); assert.equal(m.surfaces.focus, true);
  assert.throws(() => S.add(S.define(spec('oud', { runtime: { minVersion: '2.0.0' } }), () => ({}))), /nieuwere/i);
});

test('Module Registry kent LivingOS, WorkOS en iedere canonieke functie zonder tweede handlijst', () => {
  const w = platform('workspace-world-catalog.js', 'workspace-registries.js'), r = w.RTGWorkspaceRegistries();
  r.registerWorldCatalog(w.RTGWorkspaceWorldCatalog);
  const worlds = r.worldCatalog(), functies = worlds.flatMap(x => x.items);
  // Vergeleken met MAPPEN (via de generator) en niet met een getal hier -- anders
  // is deze toets de tweede handlijst die hij zegt te weren.
  const bron = require('../scripts/workspace-worlds').gegevens(), tel = n => bron.find(x => x.name === n).items.length;
  assert.equal(worlds.filter(x => x.kind === 'world').length, 4); assert.equal(functies.length, bron.reduce((n, x) => n + x.items.length, 0));
  assert.ok(functies.length >= 82);
  assert.equal(worlds.find(x => x.name === 'LivingOS').items.length, tel('LivingOS'));
  assert.equal(worlds.find(x => x.name === 'WorkOS').items.length, tel('WorkOS'));
  assert.equal(functies.find(x => x.id === 'link:berichten').module, 'messages');
  assert.equal(functies.find(x => x.id === 'link:veilig').module, 'safety');
});

test('Event Fabric levert een versieerbare envelop en Action Broker dwingt declarations en policy af', async () => {
  const w = platform('module-sdk.js', 'workspace-registries.js', 'workspace-policy.js', 'workspace-broker.js');
  const S = w.RTGModuleSDK, defs = {};
  defs.messages = S.define(spec('messages', { actions: [], invokes: ['travel.driver.attach'],
    events: { publishes: ['messages.driver-details.detected'], subscribes: [] } }), () => ({}));
  defs.travel = S.define(spec('travel', { actions: ['travel.driver.attach'], permissions: ['travel.manage'],
    events: { publishes: ['travel.driver.attached'], subscribes: ['messages.driver-details.detected'] } }), () => ({}));
  const registries = w.RTGWorkspaceRegistries(); Object.values(defs).forEach(x => registries.registerManifest(x.manifest));
  const policy = w.RTGWorkspacePolicy({ actor: { id: 'lid-1' }, permission: p => p === 'travel.manage' });
  const gezien = [], audit = [];
  const broker = w.RTGWorkspaceBroker({ definition: id => defs[id], registries, policy, workspaceId: 'dubai', audit: x => audit.push(x) });
  broker.subscribe('travel', 'messages.driver-details.detected', e => gezien.push(e), false);
  broker.publish('messages.driver-details.detected', { conversationId: 'c-1' }, 'messages', false);
  assert.equal(gezien[0].event, 'messages.driver-details.detected'); assert.equal(gezien[0].version, 1);
  assert.equal(gezien[0].workspaceId, 'dubai'); assert.equal(gezien[0].actorId, 'lid-1');
  broker.registerAction('travel', 'travel.driver.attach', { permission: 'travel.manage', audit: true,
    validate: p => !!p.conversationId, run: p => ({ ok: true, id: p.conversationId }) });
  const resultaat = await broker.run('messages', 'travel.driver.attach', { conversationId: 'c-1' });
  assert.equal(resultaat.ok, true); assert.deepEqual(audit.map(x => x.phase), ['requested', 'completed']);
  assert.throws(() => broker.publish('travel.driver.attached', {}, 'messages', false), /declareert publicatie/);
});

test('State Engine geeft een module alleen haar eigen vak en blokkeert geheimen', () => {
  const w = platform('workspace-state.js'), state = w.RTGWorkspaceState({ workspaceId: 'w-1' });
  state.registerModule({ id: 'travel', state: { persistence: 'session' } }, x => typeof x.step === 'number');
  assert.equal(state.module('travel').set({ step: 2 }).step, 2);
  assert.equal(state.view('travel').workspace.id, 'w-1');
  assert.throws(() => state.module('travel').set({ token: 'verboden' }), /geheimen/);
  assert.throws(() => state.hostSet('module', {}), /ongeldig/);
});

test('Orchestrator behandelt critical safety als policybesluit en blueprintvalidator weigert vrije UI', () => {
  const w = platform('workspace-orchestrator.js', 'workspace-blueprints.js'), toegepast = [];
  const orch = w.RTGWorkspaceOrchestrator({ apply: (layout, changes) => toegepast.push({ layout, changes }) });
  ['messages', 'travel', 'safety'].forEach(id => orch.register({ id, priority: 10, defaultHidden: false }));
  orch.handle({ event: 'safety.incident.started', payload: { severity: 'critical' } });
  assert.equal(orch.layout().safety.surface, 'focus'); assert.equal(orch.layout().messages.surface, 'suspended');
  const manifests = { travel: spec('travel', { permissions: ['travel.read'], surfaces: { peek: true, panel: true, workspace: true, focus: true } }) };
  const bp = w.RTGWorkspaceBlueprints({ manifest: id => manifests[id], permission: () => true,
    moduleAllowed: id => id === 'travel', deviceAllows: state => state !== 'focus' });
  assert.equal(bp.validate({ workspace: 'Dubai', layout: [{ module: 'travel', state: 'workspace' }] }).ok, true);
  assert.equal(bp.validate({ workspace: 'Vrij', layout: [{ module: 'travel', state: 'focus' }] }).ok, false);
  assert.equal(bp.validate({ workspace: 'Fout', layout: [{ module: 'onbekend', state: 'panel' }] }).ok, false);
  assert.equal(toegepast.length, 1);
});
