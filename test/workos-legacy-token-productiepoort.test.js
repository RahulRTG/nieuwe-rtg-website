'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const maakPoort = require('../server/middleware/workos-legacy-token-productiepoort');
const maakProductieIdentiteit = require('../server/bedrijf/productie-identiteit');

function voer({ productie = true, method = 'POST', pad }) {
  const req = { method, path: pad, url: pad };
  const uit = { next: 0, status: 200, koppen: {}, body: null };
  const res = {
    set(k, v) { uit.koppen[String(k).toLowerCase()] = v; return this; },
    status(code) { uit.status = code; return this; },
    json(body) { uit.body = body; return this; }
  };
  maakPoort({ productie })(req, res, () => { uit.next++; });
  return uit;
}

function routesUit(bronPad, voorvoegsel) {
  const stat = fs.statSync(bronPad);
  const bestanden = stat.isDirectory()
    ? fs.readdirSync(bronPad).filter(x => x.endsWith('.js')).map(x => path.join(bronPad, x))
    : [bronPad];
  const routes = new Set();
  for (const bestand of bestanden) {
    const bron = fs.readFileSync(bestand, 'utf8');
    for (const m of bron.matchAll(/app\.post\('([^']+)'/g)) {
      if (m[1].startsWith(voorvoegsel)) routes.add(m[1]);
    }
  }
  return [...routes];
}

test('productie sluit iedere huidige WerkOS- en Tenant-bearerroute', () => {
  const routes = [
    ...routesUit(path.join(ROOT, 'server', 'bedrijf'), '/api/bedrijf/'),
    ...routesUit(path.join(ROOT, 'server', 'routes', 'tenant.js'), '/api/tenant/'),
    ...routesUit(path.join(ROOT, 'server', 'routes', 'tenant', 'bijstand.js'), '/api/tenant/')
  ];
  assert.ok(routes.length >= 120, 'de hele huidige familie wordt uit de bron geteld');
  for (const pad of routes) {
    const r = voer({ pad });
    assert.equal(r.status, 503, pad);
    assert.equal(r.body.code, maakPoort.CODE, pad);
    assert.equal(r.body.feature, 'workos.workspace_access_tokens', pad);
    assert.equal(r.next, 0, pad);
    assert.equal(r.koppen['cache-control'], 'no-store', pad);
  }
});

test('router-equivalente hoofdletters, escapes en slashes omzeilen de grendel niet', () => {
  for (const pad of [
    '/API/BEDRIJF/START/', '/api/bedr%69jf/start',
    '/API/TENANT/STATUS/', '/api/ten%61nt/bootstrap/mijn?x=1'
  ]) assert.equal(voer({ pad }).status, 503, pad);
});

test('ontwikkeling, veilige buren en niet-schrijvende verzoeken blijven ongemoeid', () => {
  assert.equal(voer({ productie: false, pad: '/api/bedrijf/start' }).next, 1);
  assert.equal(voer({ pad: '/api/techniek/tenant' }).next, 1);
  assert.equal(voer({ pad: '/api/tenanten/status' }).next, 1);
  assert.equal(voer({ method: 'GET', pad: '/api/bedrijf/start' }).next, 1);
});

test('de kandidaat achter de grendel faalt gesloten zonder verse authority-hook', async () => {
  for (const db of [{ data: {} }, {
    data: {},
    async verversVerzoekCollectie() { throw new Error('PostgreSQL niet bereikbaar'); }
  }]) {
    const uit = { status: 200, koppen: {}, body: null, next: 0 };
    const res = {
      set(k, v) { uit.koppen[String(k).toLowerCase()] = v; return this; },
      status(code) { uit.status = code; return this; },
      json(body) { uit.body = body; return this; }
    };
    await maakProductieIdentiteit({ productie: true, db }).laadContext({
      body: { werkruimte: 'W1' },
      session: { key: 'user-1', account: { actief: 1 } }
    }, res, () => { uit.next++; });
    assert.equal(uit.status, 503);
    assert.equal(uit.body.code, maakProductieIdentiteit.CODE_OPSLAG);
    assert.equal(uit.koppen['cache-control'], 'no-store');
    assert.equal(uit.next, 0);
  }
});

test('de poort staat vóór idemopslag en blijft een expliciete releaseblokkade', () => {
  const lijf = fs.readFileSync(path.join(ROOT, 'server', 'opzet', 'lijfpoort.js'), 'utf8');
  assert.ok(lijf.indexOf("require('../middleware/workos-legacy-token-productiepoort')") > -1);
  assert.ok(lijf.indexOf("require('../middleware/workos-legacy-token-productiepoort')") <
    lijf.indexOf("require('../lib/idem-poort')"));
  const register = JSON.parse(fs.readFileSync(path.join(ROOT, 'CODECREDENTIALS.json'), 'utf8'));
  const deur = register.deuren.find(x => x.id === 'workos.workspace_access_tokens');
  assert.equal(deur.status, 'remaining');
  assert.equal(deur.release_blocker, true);
});
