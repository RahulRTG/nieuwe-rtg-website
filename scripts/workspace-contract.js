#!/usr/bin/env node
/* De codepoort van RTG Workspace Runtime. Een manifest in documentatie is een
   belofte; deze controle laadt dezelfde modulecatalogus als de browser en laat
   een nieuwe module alleen door als zij de uniforme hostgrens respecteert. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'public', 'apps', 'app.html');

function controleer(wortel = ROOT) {
  const fouten = [], appPad = path.join(wortel, 'public', 'apps', 'app.html');
  const html = fs.readFileSync(appPad, 'utf8');
  const vereist = ['module-sdk.js', 'workspace-world-catalog.js', 'workspace-continuity.js', 'workspace-composer.js', 'workspace-registries.js',
    'workspace-session.js', 'workspace-policy.js', 'workspace-context.js', 'workspace-navigation.js',
    'workspace-state.js', 'workspace-orchestrator.js', 'workspace-blueprints.js',
    'workspace-broker.js', 'workspace-module-host.js', 'workspace-runtime.js', 'workspace-legacy.js',
    'second-screen-modules.js', 'workspace-experience.js', 'second-screen.js'];
  let vorige = -1;
  for (const naam of vereist) {
    const i = html.indexOf('/shared/interface/' + naam);
    if (i < 0) fouten.push('app.html mist ' + naam);
    else if (i <= vorige) fouten.push(naam + ' staat niet in runtimevolgorde');
    vorige = Math.max(vorige, i);
  }
  if (/second-screen\.css\?v=/.test(html) || /workspace-components\.css\?v=/.test(html))
    fouten.push('workspace-CSS draagt een losse versieparameter en valt daardoor buiten de stijlbundel');
  const begin = html.indexOf('RTG_WORKSPACE_MODULES_START'), einde = html.indexOf('RTG_WORKSPACE_MODULES_END');
  if (begin < 0 || einde <= begin) fouten.push('de modulecatalogus heeft geen vaste invoegmarkeringen');
  const blok = begin >= 0 && einde > begin ? html.slice(begin, einde) : '';
  const bronnen = [...blok.matchAll(/src="(\/shared\/interface\/[^"?]+\.js)/g)].map(m => m[1]);
  if (!bronnen.length) fouten.push('de modulecatalogus is leeg');

  const sandbox = { window: {}, document: {}, console };
  vm.createContext(sandbox);
  function draai(rel) {
    const p = path.join(wortel, 'public', rel.replace(/^\//, ''));
    if (!fs.existsSync(p)) { fouten.push('modulebron bestaat niet: ' + rel); return; }
    const code = fs.readFileSync(p, 'utf8');
    if (/rtg-ss-module-head|className\s*=\s*['"]rtg-ss-module|querySelector\(['"]#rtgCommand/.test(code))
      fouten.push(rel + ' tekent of doorzoekt hostchrome; modules leveren alleen hun surface');
    if (/localStorage|sessionStorage/.test(code))
      fouten.push(rel + ' bewaart zelf interface-state; gebruik Workspace Continuity');
    try { vm.runInContext(code, sandbox, { filename: rel }); }
    catch (e) { fouten.push(rel + ' laadt niet als modulecatalogus: ' + e.message); }
  }
  draai('/shared/interface/module-sdk.js');
  draai('/shared/interface/workspace-legacy.js');
  bronnen.forEach(draai);
  const SDK = sandbox.window.RTGModuleSDK, catalogus = SDK && SDK.catalog ? SDK.catalog() : [];
  const ids = new Set();
  for (const def of catalogus) {
    const m = def.manifest;
    if (ids.has(m.id)) fouten.push('dubbel module-id: ' + m.id); ids.add(m.id);
    for (const s of ['peek', 'panel', 'workspace', 'focus'])
      if (!m.states.includes(s)) fouten.push(m.id + ' mist state ' + s);
    if (!Array.isArray(m.capabilities) || !Array.isArray(m.services) || !Array.isArray(m.permissions) || !Array.isArray(m.actions))
      fouten.push(m.id + ' mist capability-, service-, permission- of actiecontract');
    if (!m.events || !Array.isArray(m.events.publishes) || !Array.isArray(m.events.subscribes))
      fouten.push(m.id + ' mist eventcontract');
    if (!/^\d+\.\d+\.\d+/.test(m.version) || !m.runtime || !m.runtime.minVersion)
      fouten.push(m.id + ' mist semver- of runtimecontract');
    if (!m.state || !m.performance || !m.isolation || !/^L[0-4]$/.test(m.maturity))
      fouten.push(m.id + ' mist state-, performance-, isolatie- of volwassenheidscontract');
  }
  for (const id of ['profile', 'context', 'messages', 'navigation', 'travel', 'safety'])
    if (!ids.has(id)) fouten.push('kernmodule ontbreekt: ' + id);
  let worlds = [];
  if (wortel === ROOT) {
    const worldBuild = require('./workspace-worlds');
    const worldCheck = worldBuild.controleer(); worlds = worldBuild.gegevens();
    if (!worldCheck.ok) fouten.push('workspace-world-catalog.js loopt achter op canonieke MAPPEN');
    const aantal = worlds.reduce((n, x) => n + x.items.length, 0);
    if (worlds.filter(x => x.kind === 'world').length !== 4 || !worlds.some(x => x.name === 'LivingOS') ||
        !worlds.some(x => x.name === 'WorkOS') || !worlds.some(x => x.id === 'core') || aantal !== 82)
      fouten.push('wereldcatalogus dekt niet exact vier werelden, RTG Core en 82 functies');
    worlds.flatMap(x => x.items).filter(x => x.module).forEach(x => {
      if (!ids.has(x.module)) fouten.push('wereldfunctie ' + x.id + ' wijst naar ontbrekende module ' + x.module);
    });
  }
  const manifests = catalogus.map(d => d.manifest);
  const coverage = wortel === ROOT ? require('../server/kern/workspace-platform').coverage(manifests, worlds) : null;
  if (coverage && coverage.unknownClaims.length) fouten.push('modules claimen onbekende serverfuncties: ' + coverage.unknownClaims.join(', '));
  return { fouten, modules: manifests, worlds, coverage };
}

if (require.main === module) {
  const r = controleer();
  if (r.fouten.length) { r.fouten.forEach(x => console.error('  x ' + x)); process.exit(1); }
  const functies = r.worlds.reduce((n, x) => n + x.items.length, 0);
  console.log('  ' + r.modules.length + ' Living Modules, ' + functies + ' UX-functies en ' +
    r.coverage.serviceCapabilities + ' servercapabilities volgen het uniforme runtimecontract.');
}

module.exports = { controleer, APP };
