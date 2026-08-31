#!/usr/bin/env node
/* Genereert het Workspace Platform-catalogus uit MAPPEN, de enige bron van
   werelden en functies. Dit is een bouwartefact, geen tweede handmatige lijst. */
'use strict';
const fs = require('fs');
const path = require('path');
const reg = require('./lib/wereldregister');
const DOEL = path.join(reg.PUB, 'shared', 'interface', 'workspace-world-catalog.js');

function slug(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function niveau(item) {
  const map = {
    'link:berichten': ['L4', 'messages'], 'tab:reizen': ['L4', 'travel'],
    'link:reizen': ['L4', 'travel'], 'link:veilig': ['L4', 'safety'], 'link:ik': ['L3', 'profile']
  };
  return map[item] || ['L0', null];
}
function regel(item) {
  const los = reg.los(item), nm = niveau(item);
  let url = los && los.url && String(los.url).startsWith('/') ? String(los.url) : null;
  if (los && los.soort === 'tab') url = '/apps/app.html#' + los.sleutel;
  return { id: item, name: los && los.naam || item, url, maturity: nm[0], module: nm[1] };
}
function gegevens() {
  const contexts = reg.MAPPEN.filter(m => m.wereld).map(m => ({
    id: slug(m.naam), name: m.naam, home: m.wereld, kind: 'world', items: m.items.map(regel)
  }));
  const instellingen = reg.MAPPEN.find(m => m.sleutel === 'map-instellingen');
  contexts.push({ id: 'core', name: 'RTG Core', home: '/apps/app.html', kind: 'core',
    items: (instellingen ? instellingen.items : []).concat(['tab:home', 'tab:ai']).map(regel) });
  return contexts;
}
function bouw() {
  return '/* Gegenereerd uit MAPPEN door scripts/workspace-worlds.js. */\n' +
    '(function(w){\'use strict\';w.RTGWorkspaceWorldCatalog=' + JSON.stringify(gegevens()) + ';})(window);\n';
}
function controleer() {
  let bestaand = ''; try { bestaand = fs.readFileSync(DOEL, 'utf8'); } catch (e) {}
  return { ok: bestaand === bouw(), expected: bouw(), actual: bestaand, contexts: gegevens() };
}
function schrijf() { const code = bouw(); if (!fs.existsSync(DOEL) || fs.readFileSync(DOEL, 'utf8') !== code) fs.writeFileSync(DOEL, code); return gegevens(); }

if (require.main === module) {
  if (process.argv.includes('--controle')) {
    const r = controleer(); if (!r.ok) { console.error('Workspace-wereldcatalogus loopt achter; draai npm run workspace:worlds.'); process.exit(1); }
    console.log('Workspace-wereldcatalogus is bij: ' + r.contexts.reduce((n, x) => n + x.items.length, 0) + ' functies.');
  } else {
    const r = schrijf(); console.log('Workspace-wereldcatalogus geschreven: ' + r.length + ' contexten, ' + r.reduce((n, x) => n + x.items.length, 0) + ' functies.');
  }
}
module.exports = { DOEL, bouw, gegevens, controleer, schrijf };
