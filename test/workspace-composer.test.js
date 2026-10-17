/* WERKRUIMTECOMPOSITIE: de gekozen hoofdtaak blijft gelijk in runtime en
   opgeslagen indeling; een actuele tenantweigering verandert geen van beide.
   De echte blueprintvalidator en composer draaien in een VM met opslag- en
   DOM-doubles. Dit bewijst geen browserlayout of serverautorisatie. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function node() {
  return { dataset: {}, children: [], hidden: false, textContent: '',
    appendChild(x) { this.children.push(x); }, insertBefore(x) { this.children.push(x); },
    setAttribute() {}, toggleAttribute() {}, querySelectorAll() { return []; } };
}
function setup() {
  const ids = ['navigation', 'messages', 'work', 'coordination'];
  const saved = [], applied = [];
  let active = 'messages', allowed = true;
  const initial = { order: ids.slice(), hidden: [], active, density: 'comfortable' };
  const window = { RTGWorkspaceContinuity: () => ({ load: () => structuredClone(initial),
    save: x => { saved.push(structuredClone(x)); return x; }, destroy() {} }) };
  const context = vm.createContext({ window, document: { createElement: node } });
  for (const name of ['workspace-blueprints.js', 'workspace-composer.js'])
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/shared/interface', name), 'utf8'), context);
  const manifests = ids.map(id => ({ id, title: id, pinned: id === 'navigation',
    permissions: [], states: ['panel', 'workspace', 'focus'],
    surfaces: { panel: true, workspace: true, focus: true } }));
  const runtime = { ids: () => ids, manifests: () => manifests,
    active: () => active, setActive: id => { active = id; },
    setState: (state, id) => { active = id; }, mount: (root, order) => order,
    setHidden() {} };
  runtime.blueprints = window.RTGWorkspaceBlueprints({
    manifest: id => manifests.find(m => m.id === id), moduleAllowed: () => allowed,
    apply: plan => applied.push(plan) });
  runtime.applyBlueprint = runtime.blueprints.apply;
  const composer = window.RTGWorkspaceComposer({ runtime, root: node(), bank: node(),
    list: node(), editor: node(), editorList: node(), density: node() });
  return { composer, saved, applied, active: () => active, deny: () => { allowed = false; } };
}

test('een gekozen hoofdtaak blijft actief in de runtime en de opgeslagen indeling', () => {
  const x = setup();
  const result = x.composer.applyBlueprint({ workspace: 'Coordinatie', layout: [
    { module: 'navigation', state: 'panel' }, { module: 'work', state: 'focus' },
    { module: 'coordination', state: 'panel' } ] });
  assert.equal(result.ok, true);
  assert.equal(x.active(), 'work');
  assert.equal(x.saved[0].active, 'work');
  assert.deepEqual(x.saved[0].hidden, ['messages']);
});

test('de actuele tenantweigering verandert geen indeling en bewaart niets', () => {
  const x = setup(); x.deny();
  const result = x.composer.applyBlueprint({ workspace: 'Geweigerd', layout: [
    { module: 'work', state: 'focus' } ] });
  assert.equal(result.ok, false);
  assert.equal(x.active(), 'messages');
  assert.equal(x.saved.length, 0);
  assert.equal(x.applied.length, 0);
});
