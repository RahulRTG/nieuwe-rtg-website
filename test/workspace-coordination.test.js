'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('Universele Regie is een Living Module boven op bestaande brondomeinen', () => {
  const sandbox = { window: {}, document: {} }; vm.createContext(sandbox);
  vm.runInContext(read('public/shared/interface/module-sdk.js'), sandbox);
  sandbox.window.RTGCoordinationView = function () {};
  sandbox.window.RTGCoordinationEdge = function () { return { sync() {}, clear() {} }; };
  vm.runInContext(read('public/shared/interface/modules/coordination.js'), sandbox);
  const manifest = sandbox.window.RTGModuleSDK.catalog().find(x => x.manifest.id === 'coordination').manifest;
  assert.equal(manifest.source, 'native');
  assert.deepEqual(Array.from(manifest.services), ['service', 'member']);
  assert.deepEqual(Array.from(manifest.permissions), ['coordination.read']);
  assert.ok(manifest.actions.includes('coordination.ask-human'));
  assert.ok(manifest.actions.includes('coordination.open-source'));
  assert.deepEqual(Array.from(manifest.assistant.actions, x => [x.id, x.kind]),
    [['coordination.open-source', 'open'], ['coordination.refresh', 'search'], ['coordination.ask-human', 'propose']]);
  assert.equal(manifest.state.persistence, 'none', 'zaakdata krijgt geen tweede workspace-opslag');
  assert.deepEqual(Array.from(manifest.events.subscribes),
    ['work.coordination.bound', 'work.coordination.unavailable']);
  const source = read('public/shared/interface/modules/coordination.js');
  assert.doesNotMatch(source, /\bfetch\s*\(|localStorage|sessionStorage/);
  assert.match(source, /ctx\.request\('\/api\/service\/zaak'/);
  assert.match(source, /ctx\.request\('\/api\/member\/bureau\/zaken'/);
  assert.match(source, /ctx\.request\('\/api\/service\/mens'/);
  assert.doesNotMatch(source, /lidToken|localStorage|sessionStorage/);
});

test('de Adaptieve Edge krijgt alleen gedeclareerde acties van de geselecteerde bronzaak', async () => {
  const declared = [], contexts = [], cleared = [], runs = [];
  const sandbox = { window: { RTGAdaptief: {
    declareer(spec) { declared.push(spec); }, context(value) { contexts.push(value); }, wisContext(id) { cleared.push(id); }
  } } };
  vm.createContext(sandbox); vm.runInContext(read('public/shared/interface/modules/coordination-edge.js'), sandbox);
  let item = { kind: 'service', title: 'Betaling controleren', source: { id: 'SUP-1' }, phase: { id: 'execute', terminal: false } };
  const edge = sandbox.window.RTGCoordinationEdge({ selected: () => item,
    payload: () => ({ id: item.source.id, kind: item.kind }),
    run: (id, data) => { runs.push({ id, data }); return Promise.resolve(); } });
  edge.sync(true, 'panel');
  assert.deepEqual(Array.from(contexts[0].acties), ['coordination.open-source', 'coordination.ask-human', 'coordination.refresh']);
  assert.equal(declared.length, 3);
  declared.find(x => x.id === 'coordination.ask-human').doe();
  await Promise.resolve();
  assert.deepEqual(runs[0], { id: 'coordination.ask-human', data: { id: 'SUP-1', kind: 'service' } });
  item = { kind: 'concierge', title: 'Diner', source: { id: 'C-1' }, phase: { id: 'agreement', terminal: false } };
  edge.sync(true, 'workspace');
  assert.deepEqual(Array.from(contexts[1].acties), ['coordination.open-source', 'coordination.refresh']);
  edge.sync(false, 'panel'); assert.equal(cleared.at(-1), 'workspace.coordination');
});

test('Regie vraagt alleen na een expliciete zaakselectie om een getypeerde WorkOS-binding', async () => {
  const models = [], published = [];
  const document = { createElement() { return { className: '', appendChild() {}, contains() { return true; } }; } };
  const window = { RTGCoordinationView(root, model) { models.push(model); },
    RTGCoordinationEdge() { return { sync() {}, clear() {} }; } };
  const sandbox = { window, document, console, AbortController, Promise, Object, Array, String, Number, Error, TypeError };
  vm.createContext(sandbox); vm.runInContext(read('public/shared/interface/module-sdk.js'), sandbox);
  vm.runInContext(read('public/shared/interface/modules/coordination.js'), sandbox);
  const def = window.RTGModuleSDK.catalog().find(x => x.manifest.id === 'coordination');
  const ctx = { request(url) {
    if (url === '/api/service/mijn') return Promise.resolve({ zaken: [{ id: 'SUP-1', stand: 'nieuw' }] });
    if (url === '/api/service/zaak') return Promise.resolve({ zaak: { regiebeeld: { readOnly: true,
      ownsSourceData: false, kind: 'service', title: 'Transfer', source: { domain: 'service', id: 'SUP-1' },
      phase: { id: 'request', terminal: false }, responsibilities: [], relations: [], actions: [], attention: {} } } });
    return Promise.resolve({ regiebeelden: [] });
  }, setStatus() {}, events: { publish(type, payload) { published.push({ type, payload }); } },
  actions: { run() { return Promise.resolve(); } }, open() { return true; } };
  const instance = def.create(ctx); instance.mount({ appendChild() {} }); instance.render('panel', { active: true });
  await new Promise(resolve => setImmediate(resolve));
  const button = { dataset: { rtgCoordinationAction: 'select', rtgCoordinationId: 'SUP-1' },
    closest() { return this; } };
  assert.equal(instance.handle(button), true);
  assert.equal(JSON.stringify(published.at(-1)), JSON.stringify({ type: 'coordination.selected',
    payload: { id: 'SUP-1', domain: 'service' } }));
  assert.equal(models.at(-1).binding.phase, 'checking');

  assert.equal(instance.onEvent({ event: 'work.coordination.bound', payload: { case: { domain: 'service', id: 'SUP-1' },
    workspace: { id: 'W123' }, tenant: { id: 'ORG-A' }, readOnly: true, grantsAuthority: false } }), true);
  assert.equal(models.at(-1).binding.phase, 'bound');
  assert.equal(models.at(-1).binding.workspace.id, 'W123');
  assert.equal(instance.onEvent({ event: 'work.coordination.unavailable', payload: {
    case: { domain: 'service', id: 'SUP-1' }, reason: 'session-changed' } }), true);
  assert.equal(models.at(-1).binding.phase, 'unavailable');
  assert.equal(models.at(-1).binding.reason, 'session-changed');
  assert.doesNotMatch(JSON.stringify(models), /lidToken|authorization|sessie/i);
});

test('de modulebestanden staan in runtimevolgorde en gebruiken de gedeelde Heritage-laag', () => {
  const html = read('public/apps/app.html'), css = read('public/shared/interface/workspace-components.css');
  const view = html.indexOf('/modules/coordination-view.js');
  const edge = html.indexOf('/modules/coordination-edge.js');
  const module = html.indexOf('/modules/coordination.js');
  assert.ok(view > 0 && edge > view && module > edge);
  assert.match(css, /\.rtg-module-coordination/);
  assert.match(css, /min-height: 44px/);
  assert.match(read('public/shared/interface/modules/coordination-view.js'), /Deze zaak kan niet veilig/);
  assert.doesNotMatch(css, /border-radius:\s*[1-9]/, 'de nieuwe module introduceert geen afwijkende geometrie');
});
