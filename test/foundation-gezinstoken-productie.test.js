/* Het gezinsprofieltoken is GEMIGREERD (B17, 29 september 2026,
   foundation/gezinstoken.js): zijn consumers staan niet meer in NOG_GESLOTEN en
   werken in productie op het nieuwe token, en een oud kaal token opent niets.
   Sinds 4 oktober 2026 is ook de gezinsdeur zelf gemigreerd (B18,
   foundation.family_profile_access: een 128-bit gezinscode, hash-only, en de
   social-stream met een eenmalig stroomticket in plaats van het token in de
   URL); zij staat niet meer in NOG_GESLOTEN en valt alleen nog onder de
   beschermde-functiepoort (extern dossier, B8). De lesfamilie is ook gemigreerd (B17,
   foundation/onderwijs/toegang.js) en gaat met een geslaagd extern dossier gewoon
   open; en de gedeelde Zaakdoos-sleutel opent in productie niets meer (B12): de kloon is dan
   503 en de meting 403. Alleen de eigen sleutel van een doos komt door
   (test/zaakdoos-productie.test.js). CODECREDENTIALS.json:
   foundation.family_profile_token_buiten_harde_poort,
   foundation.onderwijs_les_tokens (beide migrated) en devices.zaakdoos_sleutel.

   De lijst wordt BRONAFGELEID nagelopen: elke route in een bestand dat het
   profieltoken leest hoort OPEN te zijn (ook de gezinsdeur), en er is precies EEN plek die een
   gezinstoken vergelijkt. Een nieuwe consumer of een tweede vergelijking laat
   dit zakken. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const poort = require('../server/middleware/foundation-productiepoort');
const { maakGetekendeVrijgave } = require('./foundation-vrijgave-fixture');
const { startServer, stop, stopHard, stopNet, keurLidGoed } = require('./helper');
const { registreerGratis } = require('../scripts/lib/gratisaccount');

const ROOT = path.join(__dirname, '..');
/* Wat in zo'n bestand staat maar het token NIET leest, met de reden. */
const GEEN_DRAGER = new Map([
  ['/api/rtf/vacatures', 'openbare vacaturelijst zonder inlog (member/werk/rtf.js)'],
  ['/api/foundation/bespaartip', 'algemene tip, geen sessie (buddy.js)'],
  ['/api/foundation/impact', 'openbaar impactgetal (buddy.js)'],
  ['/api/foundation/gesprekskaart', 'openbare gesprekskaart (buddy.js)'],
  ['/api/foundation/health', 'gezondheidsprik (foundation.js)']
]);
const GEZIN = /verifieerProfiel|rtfSociaal|gezinsPoort|familieVan|sessieVan|beheerderVan|profielVan/;
/* De gezinsdeur zelf (foundation.family_profile_access, migrated sinds B18): de
   128-bit gezinscode plus PIN, en de stream met een eenmalig stroomticket. Ook zij
   hoort niet meer in NOG_GESLOTEN. */
const GEZINSDEUR = ['/api/foundation/gezin', '/api/rtf/social/stream'];

function bestanden(map) {
  const uit = [];
  for (const d of fs.readdirSync(map, { withFileTypes: true })) {
    const vol = path.join(map, d.name);
    if (d.isDirectory()) uit.push(...bestanden(vol)); else if (d.name.endsWith('.js')) uit.push(vol);
  }
  return uit;
}
function dragerRoutes(DRAGER) {
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

test('de consumers van het gezinstoken en de gezinsdeur zelf staan niet meer in NOG_GESLOTEN', () => {
  const routes = dragerRoutes(GEZIN);
  assert.ok(routes.size > 150, 'de bronafleiding vond ' + routes.size + ' routes; te weinig om iets te bewijzen');
  const dicht = [];
  let deuren = 0;
  for (const [pad, rel] of routes) {
    if (GEEN_DRAGER.has(pad)) continue;
    if (GEZINSDEUR.some(f => pad === f || pad.startsWith(f + '/'))) deuren++;
    if (poort.isNogGeslotenCredentialroute('POST', pad, {})) dicht.push(pad + ' (' + rel + ')');
  }
  assert.ok(deuren > 30, 'de bronafleiding vond de gezinsdeur zelf (' + deuren + ' routes)');
  assert.deepEqual(dicht, [], 'gezinstoken en gezinsdeur zijn gemigreerd; geen van beide hoort nog in NOG_GESLOTEN');
  for (const pad of ['/api/foundation/gezin/inloggen', '/api/foundation/gezin/maak', '/api/foundation/gezin/code/roteer',
    '/api/foundation/gezin/stroom/ticket', '/api/foundation/gezin/sessie/verleng'])
    assert.equal(poort.isBeschermdeRoute('POST', pad, {}), true, pad + ' blijft onder de beschermde-functiepoort (B8)');
  assert.equal(poort.isNogGeslotenCredentialroute('GET', '/api/rtf/social/stream', {}), false);
  assert.equal(poort.isBeschermdeRoute('GET', '/api/rtf/social/stream', {}), true);
  for (const pad of GEEN_DRAGER.keys()) assert.ok(routes.has(pad), pad + ' bestaat niet meer; haal de uitzondering weg');
});

test('er is precies een plek die een gezinstoken vergelijkt, en niemand maakt nog een kaal token', () => {
  const vergelijk = /\.token\s*===|===\s*[\w.]*\.token\b/;
  const maak = /token\s*:\s*rid\(\s*24\s*\)/;
  const fout = [];
  for (const vol of bestanden(path.join(ROOT, 'server'))) {
    const rel = path.relative(ROOT, vol), tekst = fs.readFileSync(vol, 'utf8');
    if (rel === 'server/foundation/gezinstoken.js') continue;
    for (const regel of tekst.split('\n'))
      if (/profielen/.test(regel) && vergelijk.test(regel)) fout.push(rel + ': ' + regel.trim());
    if (/^server\/foundation\/(gezin|gasten)/.test(rel) && maak.test(tekst)) fout.push(rel + ': maakt een kaal rid(24)-token');
  }
  assert.deepEqual(fout, [], 'een tweede vergelijking of een kaal token naast foundation/gezinstoken.js');
  const hulp = fs.readFileSync(path.join(ROOT, 'server/foundation/gezinshulp.js'), 'utf8');
  assert.match(hulp, /function profielVan\(g, token\) \{[\s\S]{0,200}gezinstoken\.vind\(g, token\)/,
    'profielVan vraagt het aan gezinstoken.vind');
});

test('met een PASS-dossier: het gezinstoken, de gezinsdeur en de lesfamilie open', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gezinstoken-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  maakGetekendeVrijgave(root);
  const mw = poort({ productie: true, env: { [poort.ENV_NAAM]: '1' }, root });
  const roep = (pad, methode) => new Promise(resolve => {
    const res = { set() { return res; }, status(s) { res.s = s; return res; }, json() { resolve(res.s); } };
    mw({ method: methode || 'POST', path: pad, body: {} }, res, () => resolve(200));
  });
  for (const pad of ['/api/rtf/uitnodiging/accepteer', '/api/rtf/kanaal', '/api/rtf/toegang',
    '/api/rtf/knelpunt', '/api/rtf/beroepen/mijn', '/api/rtf/bieb', '/api/rtf/geloof/lees',
    '/api/rtf/connect/dossier', '/api/rtf/labfonds/doneer', '/api/foundation/kosten',
    '/api/rtf/samen/mee', '/api/rtf/leerling/paspoort', '/api/foundation/markt/chat',
    '/api/foundation/gezin/sessie/intrek'])
    assert.equal(await roep(pad), 200, pad + ' draagt het gemigreerde token en gaat open met het dossier');
  /* De gezinsdeur zelf (B18): met het dossier geeft productie weer gezinstokens uit. */
  for (const pad of ['/api/foundation/gezin/inloggen', '/api/foundation/gezin/maak',
    '/api/foundation/gezin/profiel/kies', '/api/foundation/gezin/sessie/roteer', '/api/foundation/gezin/sessie/verleng',
    '/api/foundation/gezin/code/roteer', '/api/foundation/gezin/stroom/ticket', '/api/rtf/gezin/passkey'])
    assert.equal(await roep(pad), 200, pad + ' is gemigreerd en gaat open met het dossier');
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
  assert.equal(await roep('/api/rtf/social/stream', 'GET'), 200, 'de stream opent met een stroomticket en gaat met het dossier open');
  assert.equal(await roep('/api/foundation/gezin/ABC234/kanaal', 'GET'), 200);
  /* Zonder dossier is de hele gezinsfamilie dicht door de GEWONE poort (B8). */
  for (const pad of ['/api/foundation/gezin/inloggen', '/api/foundation/gezin/stroom/ticket']) {
    const dichtZonder = await new Promise(resolve => {
      const res = { set() { return res; }, status(st) { res.s = st; return res; }, json() { resolve(res.s); } };
      zonder({ method: 'POST', path: pad, body: {} }, res, () => resolve(200));
    });
    assert.equal(dichtZonder, 503, pad + ' zonder dossier');
  }
  /* Geen gezinsdrager: het dossier opent ze gewoon (niet alles dichtgetimmerd). */
  for (const pad of ['/api/rtf/bericht', '/api/rtf/overzicht', '/api/rtf/vacatures', '/api/rtf/bieb/weg'])
    assert.equal(await roep(pad), 200, pad);
});

const PROXY = { 'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https' };
const SLEUTEL = 'd'.repeat(40);

const PROD = { NODE_ENV: 'production', RTG_DEMO: '0', APP_URL: 'https://rtg.voorbeeld.test/',
  SMTP_URL: 'smtp://rtg:test@mail.voorbeeld.test:587', ERR_WEBHOOK_URL: 'https://alarm.voorbeeld.test/rtg',
  RTG_OWNER_EMAIL: 'eigenaar@echtdomein.nl', OFFICE_CODE: 'GEHEIME-CODE-123',
  OFFICE_TOTP_SECRET: 'JBSWY3DPEHPK3PXP', RTG_ISOLATIE_AFDWINGEN: '1', RTG_BETALEN_UIT: '1',
  RTG_AI_UIT: '1', RTG_HERSTEL_SMS_UIT_BEWUST: '1', RTG_DOOS_SLEUTEL: SLEUTEL };
const SLEUTELS = { RTG_ENC_KEY: 'k'.repeat(64), RTG_VAULT_KEY: 'v'.repeat(64), RTG_SECRET_KEY: 's'.repeat(64) };

/* Een ECHTE productieserver op data die er al stond. Zonder extern dossier (B8)
   maakt in productie niemand een gezin (de beschermde-functiepoort), dus
   het gezin en zijn sessie ontstaan eerst op een testserver op DEZELFDE datamap
   en met DEZELFDE sleutels; daarna start de productieserver op die map. Zo bewijst
   dit dat een consumer in productie het nieuwe, hash-only token herkent -- niet
   dat een handler in een nagemaakte app dat doet. */
test('echte productieserver: de consumers werken op het nieuwe token, een oud kaal token opent niets', async t => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gezinstoken-prod-'));
  /* Sinds 5 oktober 2026 komt een kind in productie alleen binnen via het
     account van een ouder met een gecontroleerd paspoort (gezinseigenaar.js,
     gezinshulp.js profielVan). Het gezin ontstaat daarom langs die weg; het
     anonieme gezin ernaast bewijst dat code + PIN daar niets meer opent. */
  const eerst = await startServer({ env: { ...SLEUTELS, RTG_DATA_DIR: tmp, SMTP_URL: '', RTG_DEMO: '1' } });
  let g, kind, anoniem;
  try {
    const f = (pad, body) => fetch(eerst.base + '/api/foundation' + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
    const lid = (pad, body, tok) => fetch(eerst.base + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify(body) }).then(r => r.json());
    const ouder = await registreerGratis(eerst.base);
    assert.ok(ouder, 'een gratis account');
    await keurLidGoed(eerst.base, ouder.token, ouder.codenaam);
    g = await lid('/api/rtf/eigen-gezin/maak', { gezinsnaam: 'Gezin Productie', naam: 'Beheerder', bevoegdGezin: true, privacyAkkoord: true }, ouder.token);
    const k = await lid('/api/rtf/eigen-gezin/kind', { naam: 'Noor', geboortedatum: '2016-04-12' }, ouder.token);
    kind = await lid('/api/rtf/eigen-gezin/sessie', { profielId: k.profiel.id }, ouder.token);
    anoniem = await f('/gezin/maak', { gezinsnaam: 'Gezin Anoniem', naam: 'Beheerder', pin: '2468' });
    assert.match(g.token, /^GZ\.[0-9A-F]{32}$/);
    assert.match(kind.token, /^GZ\.[0-9A-F]{32}$/);
    assert.match(anoniem.token, /^GZ\.[0-9A-F]{32}$/);
  } finally { await stopNet(eerst.child); }

  const { child, base } = await startServer({ env: { ...PROD, ...SLEUTELS, RTG_DATA_DIR: tmp } });
  t.after(() => stopHard(child));   // eerst het proces echt weg, dan pas de map
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  const post = (pad, body) => fetch(base + pad, { method: 'POST', headers: PROXY,
    body: JSON.stringify(body || { code: 'GEZIN', token: 'x'.repeat(32) }) });
  // de consumers buiten de beschermde-functiepoort: open, en op het nieuwe token
  for (const [pad, token] of [['/api/rtf/toegang', g.token], ['/api/rtf/toegang', kind.token],
    ['/api/rtf/bieb', kind.token], ['/api/rtf/beroepen/mijn', g.token], ['/api/rtf/geloof/mijn', g.token]]) {
    const r = await post(pad, { code: g.code, token });
    assert.equal(r.status, 200, pad + ' opent in productie met de gezinssessie: ' + await r.text());
  }
  assert.equal((await post('/api/rtf/toegang', { code: anoniem.code, token: anoniem.token })).status, 403,
    'een anoniem gezin (code + PIN, geen eigenaar) opent in productie niets');
  for (const token of ['a'.repeat(48), 'GZ.' + '0'.repeat(32), g.token.slice(3)]) {
    const r = await post('/api/rtf/toegang', { code: g.code, token });
    assert.equal(r.status, 403, 'een kaal token van de oude vorm, een verzonnen of een half token opent niets');
  }
  /* zonder dossier: de beschermde functies dicht, ook de gezinsdeur -- maar door
     de GEWONE poort (B8) en niet meer door NOG_GESLOTEN (B18) */
  assert.equal(poort.isNogGeslotenCredentialroute('POST', '/api/foundation/gezin/inloggen', {}), false);
  for (const [pad, code] of [['/api/foundation/gezin/inloggen', 'functie-niet-beschikbaar'],
    ['/api/foundation/gezin/sessie/roteer', 'functie-niet-beschikbaar'],
    ['/api/rtf/kanaal', 'functie-niet-beschikbaar'], ['/api/rtf/uitnodiging/accepteer', 'functie-niet-beschikbaar']]) {
    const r = await post(pad, { code: g.code, token: g.token });
    assert.equal(r.status, 503, pad);
    assert.equal((await r.json()).code, code, pad);
  }
  /* De lesfamilie is gemigreerd (B17): op deze server zonder vrijgavedossier is
     hij dicht door de GEWONE Foundation-poort, en niet meer door NOG_GESLOTEN. */
  const les = await post('/api/foundation/les/join', { lescode: 'LES.' + '0'.repeat(32), naam: 'x' });
  assert.equal(les.status, 503);
  assert.equal(poort.isNogGeslotenCredentialroute('POST', '/api/foundation/les/join', {}), false);
  assert.equal(poort.isBeschermdeRoute('POST', '/api/foundation/les/join', {}), true);
  // intrekken is een veilige uitgang: ook in productie kan een gezin zijn sessies sluiten
  const af = await post('/api/foundation/gezin/sessie/intrek', { code: g.code, token: g.token, profielId: kind.profielId || kind.profiel.id });
  assert.equal(af.status, 200, await af.text());
  assert.equal((await post('/api/rtf/toegang', { code: g.code, token: kind.token })).status, 403, 'en dan is de sessie van het kind weg');
  assert.notEqual((await post('/api/rtf/vacatures', {})).status, 503, 'een route zonder gezinsdrager blijft open');
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
