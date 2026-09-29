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

test('de WorkOS-werkruimtesleutels zijn een gemigreerde deur die elke route van de familie noemt', () => {
  const register = JSON.parse(fs.readFileSync(path.join(ROOT, 'CODECREDENTIALS.json'), 'utf8'));
  const deur = register.deuren.find(x => x.id === 'workos.workspace_access_tokens');
  assert.ok(deur);
  assert.equal(deur.classificatie, 'credential');
  assert.equal(deur.status, 'migrated');
  assert.equal(deur.release_blocker, false);
  for (const route of [
    'POST /api/bedrijf/werkruimte/maak', 'POST /api/bedrijf/lid/aanmeld',
    'POST /api/bedrijf/mijn', 'POST /api/bedrijf/ticket/maak',
    'POST /api/bedrijf/sleutel/roteer', 'POST /api/bedrijf/sleutel/intrek'
  ]) assert.ok(deur.routes.includes(route), route);
  const ontbreekt = bedrijfRoutes().filter(route => !deur.routes.includes(route));
  assert.deepEqual(ontbreekt, [],
    'elk endpoint dat dezelfde sleutel accepteert hoort bij de deur');
  assert.deepEqual(tenantRoutes().filter(route => !deur.routes.includes(route)), [],
    'ook de Tenant Control Plane die deze sleutels hergebruikt');
});

test('productie kent geen werkruimtebearer; elders zijn het hash-only sessies uit een plek', async () => {
  const bron = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const werkruimte = bron('server/bedrijf/werkruimte.js');
  const leden = bron('server/bedrijf/leden.js');
  const deuren = bron('server/bedrijf/deuren.js');
  const mijn = bron('server/bedrijf/mijn.js');
  assert.match(werkruimte, /const beheerToken = PRODUCTIE \? null : sleutels\.geefBeheer\(w\)/);
  assert.match(leden, /const lidToken = PRODUCTIE \? null : sleutels\.geefLid\(w, l\)/);
  assert.match(mijn, /if \(!PRODUCTIE\) rij\.lidToken = sleutels\.geefLid\(w, l\)/);
  assert.match(deuren, /if\s*\(PRODUCTIE\)[\s\S]*?c\.autoritatief[\s\S]*?req\.session\.key\s*===\s*l\.rtgKey/,
    'in productie opent alleen de verse accountgebonden requestcontext de deur');
  /* Geen enkele plek in de werk- en tenantlaag munt nog zelf een kale sleutel
     of vergelijkt er een met ===: dat doet alleen bedrijf/sleutels.js. */
  for (const rel of ['server/bedrijf/werkruimte.js', 'server/bedrijf/leden.js', 'server/bedrijf/mijn.js',
    'server/bedrijf/deuren.js', 'server/bedrijf/beeld-consolidatie.js', 'server/kern/tenant/brug.js',
    'server/kern/tenant/uitgang.js', 'server/kern/tenant/bootstrap.js']) {
    const b = bron(rel);
    assert.doesNotMatch(b, /randomBytes\(24\)/, rel + ' munt geen eigen sleutel meer');
    assert.doesNotMatch(b, /\.token\s*===|===\s*[a-z.]*beheerToken\b|beheerToken\s*!==/, rel + ' vergelijkt geen kale sleutel');
  }
  assert.match(bron('server/kern/eenaccount/starten.js'), /token = process\.env\.NODE_ENV === 'production' \? null : werkSleutels\.geefLid\(wl\.w, wl\.l\)/,
    'ook de accountstart geeft een verse sessie en nooit de oude');
  assert.equal(fs.existsSync(path.join(ROOT, 'server/middleware/workos-legacy-token-productiepoort.js')), false,
    'de tijdelijke grendel is weg; productie-identiteit.js is de deur');
  assert.doesNotMatch(bron('server/opzet/lijfpoort.js'), /workos-legacy-token-productiepoort'\)/);

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
});
