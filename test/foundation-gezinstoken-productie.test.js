/* De niet-gemigreerde gezinsdragers zijn in productie DICHT, ook met een
   geslaagd extern Foundation-dossier; de lesfamilie is sinds 29 september 2026
   gemigreerd (B17) en gaat met dat dossier gewoon open; en de gedeelde Zaakdoos-sleutel opent in
   productie niets meer (B12): de kloon is dan 503 en de meting 403. Alleen de
   eigen sleutel van een doos komt door (test/zaakdoos-productie.test.js).
   CODECREDENTIALS.json:
   foundation.family_profile_token_buiten_harde_poort, devices.zaakdoos_sleutel
   (en foundation.onderwijs_les_tokens, nu migrated).

   De lijst wordt BRONAFGELEID nagelopen: elke route in een bestand dat het
   profieltoken leest, hoort dicht te zijn of een verklaarde
   uitzondering te dragen. Een nieuwe consumer buiten de lijst laat dit zakken. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const poort = require('../server/middleware/foundation-productiepoort');
const { maakGetekendeVrijgave } = require('./foundation-vrijgave-fixture');
const { startServer, stop } = require('./helper');

const ROOT = path.join(__dirname, '..');
/* Wat in zo'n bestand staat maar het token NIET leest, met de reden. */
const GEEN_DRAGER = new Map([
  ['/api/rtf/vacatures', 'openbare vacaturelijst zonder inlog (member/werk/rtf.js)'],
  ['/api/foundation/bespaartip', 'algemene tip, geen sessie (buddy.js)'],
  ['/api/foundation/impact', 'openbaar impactgetal (buddy.js)'],
  ['/api/foundation/gesprekskaart', 'openbare gesprekskaart (buddy.js)'],
  ['/api/foundation/health', 'gezondheidsprik (foundation.js)']
]);
/* Zonder docentCheck, leerlingVan en lesVan sinds B17: de lesdrager is gemigreerd
   (foundation/onderwijs/toegang.js) en leest tokenUit niet meer. */
const DRAGER = /verifieerProfiel|rtfSociaal|gezinsPoort|familieVan|sessieVan|beheerderVan|profielVan|tokenUit/;

function bestanden(map) {
  const uit = [];
  for (const d of fs.readdirSync(map, { withFileTypes: true })) {
    const vol = path.join(map, d.name);
    if (d.isDirectory()) uit.push(...bestanden(vol)); else if (d.name.endsWith('.js')) uit.push(vol);
  }
  return uit;
}
function dragerRoutes() {
  const routes = new Map();
  const zoek = (bron, re, voor) => {
    if (!DRAGER.test(bron.tekst)) return;
    for (const m of bron.tekst.matchAll(re)) routes.set(voor + m[1].replace(/\/:.*$/, ''), bron.rel);
  };
  for (const vol of bestanden(path.join(ROOT, 'server'))) {
    const rel = path.relative(ROOT, vol), tekst = fs.readFileSync(vol, 'utf8');
    if (rel.startsWith('server/routes/')) zoek({ rel, tekst }, /app\.(?:get|post)\(\s*'(\/api\/rtf\/[^']*)'/g, '');
    if (rel.startsWith('server/foundation')) zoek({ rel, tekst }, /router\.(?:get|post)\(\s*'(\/[^']*)'/g, '/api/foundation');
  }
  return routes;
}

test('elke route in een bestand dat het gezinstoken leest is in productie hard dicht', () => {
  const routes = dragerRoutes();
  assert.ok(routes.size > 150, 'de bronafleiding vond ' + routes.size + ' routes; te weinig om iets te bewijzen');
  const open = [];
  for (const [pad, rel] of routes) {
    if (GEEN_DRAGER.has(pad)) continue;
    if (poort.isNogGeslotenCredentialroute('POST', pad, {}) || poort.VEILIGE_UITGANGEN.includes('POST ' + pad)) continue;
    open.push(pad + ' (' + rel + ')');
  }
  assert.deepEqual(open, [], 'deze consumers lezen een niet-gemigreerd token maar staan niet in NOG_GESLOTEN');
  for (const pad of GEEN_DRAGER.keys()) assert.ok(routes.has(pad), pad + ' bestaat niet meer; haal de uitzondering weg');
});

test('uitgifte en raw teruggave van het profieltoken blijven dicht met een PASS-dossier; de lesfamilie gaat open', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gezinstoken-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  maakGetekendeVrijgave(root);
  const mw = poort({ productie: true, env: { [poort.ENV_NAAM]: '1' }, root });
  const roep = (pad) => new Promise(resolve => {
    const res = { set() { return res; }, status(s) { res.s = s; return res; }, json() { resolve(res.s); } };
    mw({ method: 'POST', path: pad, body: {} }, res, () => resolve(200));
  });
  for (const pad of ['/api/rtf/uitnodiging/accepteer', '/api/rtf/kanaal', '/api/rtf/toegang',
    '/api/rtf/knelpunt', '/api/rtf/beroepen/mijn', '/api/rtf/bieb', '/api/rtf/geloof/lees',
    '/api/rtf/connect/dossier', '/api/rtf/labfonds/doneer', '/api/foundation/kosten'])
    assert.equal(await roep(pad), 503, pad);
  /* De gemigreerde lesfamilie (B17): met het dossier open, zonder het dossier dicht. */
  for (const pad of ['/api/foundation/les/join', '/api/foundation/les/maak', '/api/foundation/ai',
    '/api/foundation/bord/stroke', '/api/foundation/les/code/roteer', '/api/foundation/schrift/opslaan'])
    assert.equal(await roep(pad), 200, pad + ' hoort met een PASS-dossier open te gaan');
  const zonder = poort({ productie: true, env: {}, root });
  const dicht = await new Promise(resolve => {
    const res = { set() { return res; }, status(s) { res.s = s; return res; }, json() { resolve(res.s); } };
    zonder({ method: 'POST', path: '/api/foundation/les/join', body: {} }, res, () => resolve(200));
  });
  assert.equal(dicht, 503, 'zonder vrijgaveverzoek blijft de lesfamilie onder de gewone Foundation-poort dicht');
  /* Geen gezinsdrager: het dossier opent ze gewoon (niet alles dichtgetimmerd). */
  for (const pad of ['/api/rtf/bericht', '/api/rtf/overzicht', '/api/rtf/vacatures', '/api/rtf/bieb/weg'])
    assert.equal(await roep(pad), 200, pad);
});

const PROXY = { 'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https' };
const SLEUTEL = 'd'.repeat(40);

test('echte productieserver: gezinstoken-, les- en klooneindpunten weigeren vóór de handler', async t => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gezinstoken-prod-'));
  const { child, base } = await startServer({ env: {
    NODE_ENV: 'production', RTG_DEMO: '0', RTG_DATA_DIR: tmp, APP_URL: 'https://rtg.voorbeeld.test/',
    SMTP_URL: 'smtp://rtg:test@mail.voorbeeld.test:587', ERR_WEBHOOK_URL: 'https://alarm.voorbeeld.test/rtg',
    RTG_ENC_KEY: 'k'.repeat(64), RTG_VAULT_KEY: 'v'.repeat(64), RTG_SECRET_KEY: 's'.repeat(64),
    RTG_OWNER_EMAIL: 'eigenaar@echtdomein.nl', OFFICE_CODE: 'GEHEIME-CODE-123',
    OFFICE_TOTP_SECRET: 'JBSWY3DPEHPK3PXP', RTG_ISOLATIE_AFDWINGEN: '1', RTG_BETALEN_UIT: '1',
    RTG_AI_UIT: '1', RTG_HERSTEL_SMS_UIT_BEWUST: '1', RTG_DOOS_SLEUTEL: SLEUTEL
  } });
  t.after(() => { stop(child); fs.rmSync(tmp, { recursive: true, force: true }); });
  const post = (pad, body) => fetch(base + pad, { method: 'POST', headers: PROXY,
    body: JSON.stringify(body || { code: 'GEZIN', token: 'x'.repeat(32) }) });
  for (const pad of ['/api/rtf/toegang', '/api/rtf/knelpunt', '/api/rtf/kanaal',
    '/api/rtf/uitnodiging/accepteer']) {
    const r = await post(pad);
    assert.equal(r.status, 503, pad);
    assert.equal((await r.json()).code, 'functie-niet-beschikbaar', pad);
  }
  assert.notEqual((await post('/api/rtf/vacatures', {})).status, 503, 'een route zonder gezinsdrager blijft open');
  /* De lesfamilie is gemigreerd (B17): op deze server zonder vrijgavedossier is
     hij dicht door de GEWONE Foundation-poort, en niet meer door NOG_GESLOTEN. */
  const les = await post('/api/foundation/les/join', { lescode: 'LES.' + '0'.repeat(32), naam: 'x' });
  assert.equal(les.status, 503);
  assert.equal(poort.isNogGeslotenCredentialroute('POST', '/api/foundation/les/join', {}), false);
  assert.equal(poort.isBeschermdeRoute('POST', '/api/foundation/les/join', {}), true);
  const kloon = await fetch(base + '/api/doos/kloon', { headers: { ...PROXY, 'x-doos-sleutel': SLEUTEL } });
  assert.equal(kloon.status, 503);
  const lijf = await kloon.json();
  assert.equal(lijf.code, 'doos-kloon-productie-dicht');
  assert.equal(lijf.data, undefined, 'geen databasekloon in het antwoord');
  const meting = await fetch(base + '/api/doos/meting', { method: 'POST', headers: { ...PROXY, 'x-doos-sleutel': SLEUTEL },
    body: JSON.stringify({ doos: 'x', rtt: 1 }) });
  assert.equal(meting.status, 403, 'de gedeelde sleutel opent in productie niets, ook met de juiste waarde');
});

test('buiten productie werken kloon en de gezinsdeur zoals voorheen', async t => {
  const { child, base } = await startServer({ env: { RTG_DOOS_SLEUTEL: SLEUTEL } });
  t.after(() => stop(child));
  const kloon = await fetch(base + '/api/doos/kloon', { headers: { 'x-doos-sleutel': SLEUTEL } });
  assert.equal(kloon.status, 200);
  const lijf = await kloon.json();
  assert.ok(lijf.data && typeof lijf.data === 'object' && Object.keys(lijf.data).length > 0);
  assert.equal((await fetch(base + '/api/doos/kloon')).status, 403, 'zonder sleutel blijft hij dicht');
  for (const pad of ['/api/rtf/knelpunt', '/api/rtf/toegang']) {
    const r = await fetch(base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'GEEN', token: 'fout' }) });
    assert.equal(r.status, 403, pad + ' bereikt zijn handler (de gezinscontrole), niet de productiepoort');
  }
});
