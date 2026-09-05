'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function bedrijfRoutes() {
  const map = path.join(ROOT, 'server', 'bedrijf');
  const routes = new Set();
  for (const naam of fs.readdirSync(map).filter(x => x.endsWith('.js'))) {
    const bron = fs.readFileSync(path.join(map, naam), 'utf8');
    for (const m of bron.matchAll(/app\.post\('([^']+)'/g)) {
      if (m[1].startsWith('/api/bedrijf/')) routes.add('POST ' + m[1]);
    }
  }
  return [...routes].sort();
}

function tenantRoutes() {
  const bestanden = [
    path.join(ROOT, 'server', 'routes', 'tenant.js'),
    path.join(ROOT, 'server', 'routes', 'tenant', 'bijstand.js')
  ];
  const routes = new Set();
  for (const bestand of bestanden) {
    const bron = fs.readFileSync(bestand, 'utf8');
    for (const m of bron.matchAll(/app\.post\('([^']+)'/g)) {
      if (m[1].startsWith('/api/tenant/')) routes.add('POST ' + m[1]);
    }
  }
  return [...routes].sort();
}

test('de oude WorkOS-werkruimtetokens blijven een zichtbare P1-releaseblokkade', () => {
  const register = JSON.parse(fs.readFileSync(path.join(ROOT, 'CODECREDENTIALS.json'), 'utf8'));
  const deur = register.deuren.find(x => x.id === 'workos.workspace_access_tokens');
  assert.ok(deur);
  assert.equal(deur.classificatie, 'credential');
  assert.equal(deur.status, 'remaining');
  assert.equal(deur.release_blocker, true);
  for (const route of [
    'POST /api/bedrijf/werkruimte/maak', 'POST /api/bedrijf/lid/aanmeld',
    'POST /api/bedrijf/mijn', 'POST /api/bedrijf/ticket/maak'
  ]) assert.ok(deur.routes.includes(route), route);
  const ontbreekt = bedrijfRoutes().filter(route => !deur.routes.includes(route));
  assert.deepEqual(ontbreekt, [],
    'elk endpoint dat dezelfde bearer accepteert hoort bij de zichtbare blokkade');
  assert.deepEqual(tenantRoutes().filter(route => !deur.routes.includes(route)), [],
    'ook de Tenant Control Plane die deze bearers hergebruikt blijft zichtbaar');
});

test('de bron bewijst sterke entropie maar nog raw opslag, vergelijking en redisclosure', () => {
  const index = fs.readFileSync(path.join(ROOT, 'server/bedrijf/index.js'), 'utf8');
  const leden = fs.readFileSync(path.join(ROOT, 'server/bedrijf/leden.js'), 'utf8');
  const deuren = fs.readFileSync(path.join(ROOT, 'server/bedrijf/deuren.js'), 'utf8');
  const mijn = fs.readFileSync(path.join(ROOT, 'server/bedrijf/mijn.js'), 'utf8');
  assert.match(index, /beheerToken:\s*crypto\.randomBytes\(24\)\.toString\('hex'\)/);
  assert.match(leden, /token:\s*crypto\.randomBytes\(24\)\.toString\('hex'\)/);
  assert.match(deuren, /w\.beheerToken\s*!==\s*String\(req\.body\.beheerToken/);
  assert.match(deuren, /find\(x\s*=>\s*x\.token\s*===\s*tok\)/);
  assert.match(mijn, /lidToken:\s*l\.token/);
  assert.match(leden, /l\.status\s*=\s*'uit dienst';\s*l\.token\s*=\s*null/,
    'bestaande intrekking blijft expliciet als reeds aanwezige sterke kant zichtbaar');
});
