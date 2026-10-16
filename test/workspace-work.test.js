'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

function definition() {
  const listeners = {};
  const window = { RTGWorkView() {}, RTGWorkEdge() { return { sync() {}, clear() {} }; },
    addEventListener(type, fn) { listeners[type] = fn; }, removeEventListener() {} };
  const sandbox = { window, document: {}, console, AbortController, Promise, Number, Object, Array, String, Error, TypeError };
  vm.createContext(sandbox);
  vm.runInContext(read('public/shared/interface/module-sdk.js'), sandbox);
  vm.runInContext(read('public/shared/interface/modules/work.js'), sandbox);
  return { def: window.RTGModuleSDK.catalog().find(x => x.manifest.id === 'work'), listeners };
}

function context(request, same) {
  const published = [], statuses = [], opened = [];
  const ctx = {
    request, session: { unchanged: same || (() => true) },
    setStatus(text, tone) { statuses.push({ text, tone }); },
    events: { publish(type, payload) { published.push({ type, payload }); } },
    actions: { run() { return Promise.resolve(); } },
    open(url, title) { opened.push({ url, title }); return true; }
  };
  return { ctx, published, statuses, opened };
}

test('WorkOS is een alleen-lezen Living Module boven op de bestaande bedrijfslaag', () => {
  const { def } = definition(), manifest = def.manifest;
  assert.equal(manifest.maturity, 'L3');
  assert.deepEqual(Array.from(manifest.permissions), ['work.read']);
  assert.deepEqual(Array.from(manifest.services), ['bedrijf']);
  assert.equal(manifest.state.persistence, 'none');
  assert.ok(manifest.actions.includes('work.connect'));
  assert.ok(manifest.actions.includes('work.open'));
  assert.deepEqual(Array.from(manifest.assistant.actions, x => [x.id, x.kind]),
    [['work.open', 'open'], ['work.refresh', 'search']]);
  const source = read('public/shared/interface/modules/work.js');
  assert.doesNotMatch(source, /\bfetch\s*\(|localStorage|sessionStorage/);
  assert.match(source, /request\('\/api\/bedrijf\/mijn'/);
  assert.match(source, /request\('\/api\/bedrijf\/start'/);
});

test('WorkOS vraagt niets op voor expliciete activatie en houdt de verse sessie buiten state en DOM', async () => {
  const calls = [], secret = 'eenmalige-werkos-sessie';
  const c = context(async (url, body) => {
    calls.push({ url, body });
    if (url === '/api/bedrijf/mijn') return { werkruimtes: [{ werkruimte: 'W123', naam: 'Atlas BV',
      rollen: ['medewerker'], lidToken: secret }] };
    return { werkruimte: { code: 'W123', naam: 'Atlas BV' }, wie: { naam: 'Ada' },
      blokken: { taken: [1, 2], waarschuwingen: [] }, nietGemeten: [] };
  });
  const instance = definition().def.create(c.ctx);
  assert.deepEqual(calls, [], 'module-create is geen verborgen bootstrap');
  assert.equal(await instance.actions['work.connect'].run({}), true);
  assert.equal(calls.length, 2);
  assert.equal(JSON.stringify(calls[0]), JSON.stringify({ url: '/api/bedrijf/mijn', body: {} }));
  assert.equal(JSON.stringify(calls[1]), JSON.stringify({ url: '/api/bedrijf/start', body: { werkruimte: 'W123', lidToken: secret } }));
  assert.equal(JSON.stringify(c.published[0]), JSON.stringify({ type: 'work.loaded', payload: { workspace: 'W123', warnings: 0 } }));
  assert.doesNotMatch(JSON.stringify(c.published), new RegExp(secret));
  assert.equal(Object.prototype.hasOwnProperty.call(c.ctx, 'state'), false, 'geen tweede workspace-opslag');
  instance.actions['work.open'].run({});
  assert.equal(c.opened[0].url, '/apps/werk.html?werkruimte=W123');
  assert.equal(c.opened[0].url.includes(secret), false, 'handoff bevat alleen de opnieuw te controleren werkruimtecode');
});

test('een accountwissel tijdens de WerkOS-bootstrap lekt niets en start geen werkruimte', async () => {
  let resolve, current = true;
  const calls = [], wait = new Promise(r => { resolve = r; });
  const c = context((url, body) => { calls.push({ url, body }); return wait; }, () => current);
  const instance = definition().def.create(c.ctx);
  const pending = instance.actions['work.connect'].run({});
  current = false;
  resolve({ werkruimtes: [{ werkruimte: 'WGEHEIM', naam: 'Andere organisatie', lidToken: 'geheim' }] });
  assert.equal(await pending, false);
  assert.equal(calls.length, 1, 'na de sessiewissel volgt geen WorkOS-startverzoek');
  assert.deepEqual(c.published, []);
});

test('een expliciete Regiekeuze wordt met de afgeschermde WorkOS-sessie read-only gebonden', async () => {
  const calls = [], secret = 'tijdelijke-werkos-sessie';
  const c = context(async (url, body) => {
    calls.push({ url, body });
    if (url === '/api/bedrijf/mijn') return { werkruimtes: [{ werkruimte: 'W123', naam: 'Atlas BV', lidToken: secret }] };
    if (url === '/api/bedrijf/start') return { werkruimte: { code: 'W123', naam: 'Atlas BV' }, blokken: { waarschuwingen: [] } };
    return { ok: true, regiebeeld: { schemaVersion: 1, id: 'service:service-case:SUP-1',
      readOnly: true, ownsSourceData: false,
      source: { domain: 'service', type: 'service-case', id: 'SUP-1', version: 'v1' },
      context: { status: 'bekend', readOnly: true, grantsAuthority: false,
        context: { workspace: { id: 'W123' }, tenant: { id: 'ORG-A' }, legalEntity: null } } } };
  });
  const instance = definition().def.create(c.ctx);
  assert.equal(await instance.actions['work.connect'].run({}), true);
  assert.equal(await instance.onEvent({ event: 'coordination.selected', payload: { schemaVersion: 1,
    case: { domain: 'service', type: 'service-case', id: 'SUP-1', observedVersion: 'v1' } } }), true);
  assert.equal(JSON.stringify(calls[2]), JSON.stringify({ url: '/api/bedrijf/zaakregie',
    body: { werkruimte: 'W123', domain: 'service', id: 'SUP-1', lidToken: secret } }));
  const event = c.published.at(-1);
  assert.equal(event.type, 'work.coordination.bound');
  assert.equal(event.payload.workspace.id, 'W123');
  assert.equal(event.payload.tenant.id, 'ORG-A');
  assert.equal(event.payload.case.type, 'service-case');
  assert.equal(event.payload.case.observedVersion, 'v1');
  assert.equal(event.payload.readOnly, true);
  assert.equal(event.payload.grantsAuthority, false);
  assert.doesNotMatch(JSON.stringify(c.published), new RegExp(secret));
  assert.doesNotMatch(JSON.stringify(c.published), /lidToken|authorization|sessie/i);
});

test('een afwijkende of ingetrokken zaakprojectie komt fail-closed terug in Regie', async () => {
  const c = context(async (url) => {
    if (url === '/api/bedrijf/mijn') return { werkruimtes: [{ werkruimte: 'W123', naam: 'Atlas BV', lidToken: 'verborgen' }] };
    if (url === '/api/bedrijf/start') return { werkruimte: { code: 'W123' }, blokken: { waarschuwingen: [] } };
    return { ok: true, regiebeeld: { schemaVersion: 1, id: 'service:service-case:SUP-ANDER',
      readOnly: true, ownsSourceData: false,
      source: { domain: 'service', type: 'service-case', id: 'SUP-ANDER', version: 'v2' },
      context: { status: 'bekend', readOnly: true, grantsAuthority: false,
        context: { workspace: { id: 'W999' }, tenant: { id: 'ORG-B' } } } } };
  });
  const instance = definition().def.create(c.ctx); await instance.actions['work.connect'].run({});
  assert.equal(await instance.onEvent({ event: 'coordination.selected', payload: { schemaVersion: 1,
    case: { domain: 'service', type: 'service-case', id: 'SUP-1', observedVersion: 'v1' } } }), false);
  const event = c.published.at(-1);
  assert.equal(JSON.stringify(event), JSON.stringify({ type: 'work.coordination.unavailable', payload: { schemaVersion: 1,
    case: { domain: 'service', type: 'service-case', id: 'SUP-1', observedVersion: 'v1' },
    reason: 'projection-mismatch' } }));
  assert.doesNotMatch(JSON.stringify(event), /W999|ORG-B|SUP-ANDER|verborgen/);
});

test('WorkOS weigert onbekende zaaktypen en een verouderde bronprojectie', async () => {
  let bindings = 0;
  const c = context(async (url) => {
    if (url === '/api/bedrijf/mijn') return { werkruimtes: [{ werkruimte: 'W123', naam: 'Atlas BV', lidToken: 'verborgen' }] };
    if (url === '/api/bedrijf/start') return { werkruimte: { code: 'W123' }, blokken: { waarschuwingen: [] } };
    bindings++;
    return { ok: true, regiebeeld: { schemaVersion: 1, id: 'service:service-case:SUP-1', readOnly: true,
      ownsSourceData: false, source: { domain: 'service', type: 'service-case', id: 'SUP-1', version: 'v2' },
      context: { status: 'bekend', readOnly: true, grantsAuthority: false,
        context: { workspace: { id: 'W123' }, tenant: { id: 'ORG-A' } } } } };
  });
  const instance = definition().def.create(c.ctx); await instance.actions['work.connect'].run({});
  assert.equal(await instance.onEvent({ event: 'coordination.selected', payload: { schemaVersion: 1,
    case: { domain: 'service', type: 'supplier-case', id: 'SUP-1', observedVersion: 'v1' } } }), false);
  assert.equal(bindings, 0, 'een onbekend type bereikt de zaakregieroute niet');
  assert.equal(await instance.onEvent({ event: 'coordination.selected', payload: { schemaVersion: 1,
    case: { domain: 'service', type: 'service-case', id: 'SUP-1', observedVersion: 'v1' } } }), false);
  assert.equal(bindings, 1);
  assert.equal(c.published.at(-1).type, 'work.coordination.unavailable');
  assert.equal(c.published.at(-1).payload.reason, 'projection-mismatch');
  assert.doesNotMatch(JSON.stringify(c.published.at(-1)), /v2|W123|ORG-A|verborgen/);
});

test('WorkOS-bestanden laden in runtimevolgorde, zijn offline beschikbaar en gebruiken Heritage-geometrie', () => {
  const html = read('public/apps/app.html'), sw = read('public/sw.js'), css = read('public/shared/interface/workspace-components.css');
  const view = html.indexOf('/modules/work-view.js'), edge = html.indexOf('/modules/work-edge.js');
  const module = html.indexOf('/modules/work.js');
  assert.ok(view > 0 && edge > view && module > edge);
  for (const file of ['work-view.js', 'work-edge.js', 'work.js']) assert.ok(sw.includes('/modules/' + file), file);
  assert.match(css, /\.rtg-module-work/);
  assert.match(css, /min-height:\s*(44|56)px/);
  assert.doesNotMatch(css, /\.rtg-work[^\n{]*\{[^}]*border-radius:\s*[1-9]/s);
});

test('WorkOS Edge verklaart alleen openen en verversen zonder sessiegegevens', async () => {
  const declared = [], contexts = [], cleared = [], runs = [];
  const sandbox = { window: { RTGAdaptief: { declareer(spec) { declared.push(spec); },
    context(value) { contexts.push(value); }, wisContext(id) { cleared.push(id); } } }, Promise };
  vm.createContext(sandbox); vm.runInContext(read('public/shared/interface/modules/work-edge.js'), sandbox);
  const edge = sandbox.window.RTGWorkEdge({ run(id, payload) { runs.push({ id, payload }); return Promise.resolve(); } });
  edge.sync(true, 'panel', { phase: 'ready', code: 'W1', name: 'Atlas BV' });
  assert.deepEqual(Array.from(contexts[0].acties), ['work.open', 'work.refresh']);
  assert.equal(declared.length, 2);
  declared[0].doe(); await Promise.resolve();
  assert.equal(JSON.stringify(runs[0]), JSON.stringify({ id: 'work.open', payload: {} }));
  assert.doesNotMatch(JSON.stringify(contexts), /token|secret|sessie/i);
  edge.sync(false, 'panel', { phase: 'ready' });
  assert.equal(cleared.at(-1), 'workspace.work');
});
