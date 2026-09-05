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

test('productie bewaart of heronthult geen werkruimtebearer en blijft hard gesloten', async () => {
  const werkruimte = fs.readFileSync(path.join(ROOT, 'server/bedrijf/werkruimte.js'), 'utf8');
  const leden = fs.readFileSync(path.join(ROOT, 'server/bedrijf/leden.js'), 'utf8');
  const deuren = fs.readFileSync(path.join(ROOT, 'server/bedrijf/deuren.js'), 'utf8');
  const mijn = fs.readFileSync(path.join(ROOT, 'server/bedrijf/mijn.js'), 'utf8');
  assert.match(werkruimte,
    /beheerToken:\s*PRODUCTIE\s*\?\s*null\s*:\s*crypto\.randomBytes\(24\)\.toString\('hex'\)/);
  assert.match(leden,
    /token:\s*PRODUCTIE\s*\?\s*null\s*:\s*crypto\.randomBytes\(24\)\.toString\('hex'\)/);
  assert.match(werkruimte, /if\s*\(!PRODUCTIE\)\s*{\s*antwoord\.beheerToken\s*=\s*w\.beheerToken/);
  assert.match(leden, /if\s*\(!PRODUCTIE\)\s*antwoord\.lidToken\s*=\s*l\.token/);
  assert.match(mijn, /if\s*\(!PRODUCTIE\)\s*rij\.lidToken\s*=\s*l\.token/);
  assert.match(deuren, /if\s*\(PRODUCTIE\)[\s\S]*?c\.autoritatief[\s\S]*?req\.session\.key\s*===\s*l\.rtgKey/,
    'in productie opent alleen de verse accountgebonden requestcontext de deur');
  assert.match(leden, /l\.status\s*=\s*'uit dienst';\s*l\.token\s*=\s*null/,
    'bestaande intrekking blijft expliciet als reeds aanwezige sterke kant zichtbaar');

  const werkruimtes = { W1: { beheerToken: 'oud-beheer', leden: {
    L1: { token: 'oud-lid' }, L2: { token: null }
  } } };
  const maakProductieIdentiteit = require('../server/bedrijf/productie-identiteit');
  const migratie = maakProductieIdentiteit({
    productie: true,
    bewerkCollectie(naam, bewerk) {
      assert.equal(naam, 'werkruimtes');
      return bewerk(werkruimtes);
    }
  });
  assert.deepEqual(await migratie.migreerLegacyTokens(), {
    ok: true, overgeslagen: false, werkruimtes: 1, leden: 1
  });
  assert.equal(werkruimtes.W1.beheerToken, null);
  assert.equal(werkruimtes.W1.leden.L1.token, null);
  assert.throws(() => maakProductieIdentiteit({
    productie: true
  }).migreerLegacyTokens(), /autoritatieve collectietransactie/,
  'productie wist oude bearers nooit via een lokale of half-bedrade schrijfweg');

  const uit = { status: 200, body: null, next: 0 };
  const res = {
    set() { return this; },
    status(status) { uit.status = status; return this; },
    json(body) { uit.body = body; return this; }
  };
  require('../server/middleware/workos-legacy-token-productiepoort')({ productie: true })(
    { method: 'POST', path: '/api/bedrijf/werkruimte/maak' }, res, () => { uit.next++; }
  );
  assert.equal(uit.status, 503);
  assert.equal(uit.body.code, 'WORKOS_IDENTITY_NOT_RELEASED');
  assert.equal(uit.next, 0, 'de checkpoint opent de productieroute nog niet');
});
