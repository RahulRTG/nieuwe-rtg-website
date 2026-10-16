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
