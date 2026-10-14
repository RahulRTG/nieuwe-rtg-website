/* DE PRODUCTIEPOORTEN -- een gesloten deur is onder elke spelling dicht.

   Vier grendels in server/middleware/ houden in productie routes dicht tot hun
   eigen bewijs rond is: de simulatiebrug, het legacy-codeportaal, een nog niet
   vrijgegeven travel-bewijs en een geld-dragende code. De twee laatste staan
   nu leeg (alles is gemigreerd); de grendel blijft als plek waar een volgende
   dicht gaat. Deze toets zet er tijdelijk een route in en kijkt of hij dicht
   is onder elke vorm die dezelfde handler bereikt.

   Wat hier niet mag sneuvelen:
   1. Hoofdletters, een afsluitende slash, procentcodering en een query maken
      van een gesloten pad geen open pad; een kapotte escape laat de poort niet
      vallen en het pad niet stilletjes open.
   2. Buiten productie zijn de poorten open; een expliciete `productie: false`
      wint van NODE_ENV.
   3. De travel- en geldpoort sluiten alleen POST, en elk antwoord is no-store
      met de vaste code.
   4. Een Foundation-route die volwassenen en minderjarigen deelt, blijft in
      productie dicht -- ook met een groen vrijgavedossier, zonder req.path en
      met een afsluitende slash.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - legacy-codeportaal: `pad = pad.toLowerCase();` weg -> toets 1 zakt.
   - travel-bearer: de POST-controle omgekeerd (`=== 'POST'`) -> toets 3 zakt.
   - money-credential: `if (!productie(env)) return next();` -> `if (false)` -> toets 2 zakt.
   - foundation: de regel `if (isGemengdeRoute(...)) return stuurDicht(res);` weg -> toets 4 zakt.

   Draai los: node --test test/productiepoorten-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const simulatie = require('../server/middleware/simulatiebrug-productiepoort');
const legacy = require('../server/middleware/legacy-codeportaal-productiepoort');
const travel = require('../server/middleware/travel-bearer-productiepoort');
const geld = require('../server/middleware/money-credential-productiepoort');
const foundation = require('../server/middleware/foundation-productiepoort');

function roep(mw, req) {
  const res = { code: 200, body: null, kop: {}, door: false,
    status(c) { this.code = c; return this; }, set(k, v) { this.kop[k] = v; return this; }, json(b) { this.body = b; return this; } };
  mw(Object.assign({ method: 'POST' }, req), res, () => { res.door = true; });
  return res;
}
const dicht = (r) => !r.door && r.code === 503 && r.kop['Cache-Control'] === 'no-store';

test('1. een gesloten pad is onder elke spelling dicht', () => {
  const sim = simulatie({ productie: true });
  for (const p of ['/api/supplier/horeca/simulatie/maak', '/API/Supplier/Horeca/Simulatie/Maak/', '/api/supplier/horeca/simulatie/%6Daak',
    '/api/rtf/spel/hospitality-delen//']) {
    assert.ok(dicht(roep(sim, { path: p })), p);
  }
  assert.ok(dicht(roep(sim, { url: '/api/member/spel/hospitality-koppel?x=1' })), 'zonder req.path telt req.url, zonder query');
  assert.equal(roep(sim, { path: '/api/supplier/horeca/simulatie/maak%zz' }).door, true, 'kapotte escape: geen ander pad, geen crash');
  const leg = legacy({ productie: true });
  for (const p of ['/api/rtf/club', '/API/RTF/CLUB/portaal', '/api/rtf/%63lub/x', '/api/rtf/club/%zz', '/api/rtfos/portaal/gemeente/']) {
    assert.ok(dicht(roep(leg, { path: p })), p);
  }
  assert.equal(roep(leg, { path: '/api/rtf/clubhuis' }).door, true, 'een familie is een padgrens, geen voorvoegsel');
  assert.equal(legacy.normaliseerPad(''), '/');
  assert.equal(simulatie.normaliseerPad(undefined), '/');
});

test('2. buiten productie open; productie:false wint van NODE_ENV', () => {
  const oud = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    assert.ok(dicht(roep(simulatie(), { path: '/api/rtf/spel/hospitality-koppel' })), 'NODE_ENV=production sluit');
    assert.equal(roep(simulatie({ productie: false }), { path: '/api/rtf/spel/hospitality-koppel' }).door, true);
    assert.equal(roep(legacy({ productie: false }), { path: '/api/rtf/club' }).door, true);
    assert.equal(roep(travel({ productie: false }), { path: '/x' }).door, true);
  } finally { if (oud === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oud; }
  assert.equal(roep(legacy({ env: { NODE_ENV: 'test' } }), { path: '/api/rtf/club' }).door, true);
  geld.EXACT.set('/api/proef/kascode', 'proef.kascode');
  try {
    assert.equal(roep(geld({ env: { NODE_ENV: 'development' } }), { path: '/api/proef/kascode' }).door, true);
    assert.equal(geld.blokkade('x', { NODE_ENV: 'test' }), null);
    assert.deepEqual(geld.blokkade(null, { NODE_ENV: 'production' }).feature, 'money_credential');
  } finally { geld.EXACT.delete('/api/proef/kascode'); }
});

test('3. travel en geld sluiten alleen POST, met de vaste code', () => {
  travel.PER_ROUTE.set('/api/proef/pas', 'proef.pas');
  geld.EXACT.set('/api/proef/kascode', 'proef.kascode');
  try {
    const t = travel({ productie: true });
    for (const p of ['/api/proef/pas', '/API/PROEF/PAS/', '/api/proef/%70as', '/api/proef/pas?x=%zz']) {
      const r = roep(t, { path: p });
      assert.ok(dicht(r), p);
      assert.deepEqual([r.body.code, r.body.feature], [travel.CODE, 'proef.pas']);
    }
    assert.equal(roep(t, { method: 'GET', path: '/api/proef/pas' }).door, true, 'lezen raakt niets');
    assert.equal(roep(t, { path: '/api/proef/pas%zz' }).door, true);
    assert.equal(travel.featureVoor(null), null);
    const g = geld({ env: { NODE_ENV: 'production' } });
    for (const p of ['/api/proef/kascode', '/Api/Proef/KASCODE//', '/api/proef/%6Bascode']) {
      const r = roep(g, { path: p });
      assert.equal(r.code, 503, p);
      assert.deepEqual(r.body, { error: geld.BERICHT, code: geld.CODE, feature: 'proef.kascode' });
    }
    assert.equal(roep(g, { url: '/api/proef/kascode' }).code, 503, 'zonder req.path telt req.url');
    assert.equal(roep(g, { method: 'PUT', path: '/api/proef/kascode' }).door, true);
    assert.equal(roep(g, { path: '/api/proef/kascode%zz' }).door, true);
    assert.equal(geld.featureVoor({ method: 'post' }), null);
  } finally { travel.PER_ROUTE.delete('/api/proef/pas'); geld.EXACT.delete('/api/proef/kascode'); }
});

test('4. een gedeelde Foundation-route blijft in productie dicht', () => {
  const f = foundation({ productie: true, env: {} });
  for (const req of [{ path: '/api/foundation/registratie/aanvragen' }, { url: '/api/rtfos/activiteit/inschrijven/?x=1' }]) {
    const r = roep(f, req);
    assert.ok(dicht(r), JSON.stringify(req));
    assert.deepEqual(r.body, foundation.ANTWOORD);
  }
  assert.equal(foundation.isBeschermdeRoute('POST', '/api/rtfos/activiteit/inschrijven'), true, 'gemengd is ook beschermd');
  assert.equal(foundation.isGemengdeRoute(undefined, '/api/rtfos/activiteit/inschrijven'), false, 'zonder methode geen POST');
  assert.equal(foundation.normaliseerPad(''), '/');
  assert.equal(roep(foundation({ productie: false }), { path: '/api/foundation/registratie/aanvragen' }).door, true);

  /* Ook een GROEN vrijgavedossier maakt van clientinvoer geen geverifieerde
     leeftijd: de gedeelde routes blijven dicht, de rest gaat open. */
  const vrijgave = require('../server/config/foundation-vrijgave');
  const echt = vrijgave.beoordeel;
  vrijgave.beoordeel = () => ({ vrijgegeven: true, reden: 'proef' });
  try {
    const groen = foundation({ productie: true, env: {} });
    assert.ok(dicht(roep(groen, { path: '/api/foundation/registratie/aanvragen/' })));
    assert.equal(roep(groen, { path: '/api/foundation/agenda/week' }).door, true, 'vrijgegeven: beschermd gaat open');
    assert.ok(dicht(roep(groen, { path: '/api/foundation/school/les' })), 'een onvolwassen credentialroute blijft dicht');
  } finally { vrijgave.beoordeel = echt; }
  assert.ok(dicht(roep(foundation({ productie: true, env: {} }), { path: '/api/foundation/agenda/week' })), 'niet vrijgegeven: dicht');
});
