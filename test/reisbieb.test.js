/* De Reis-Bibliotheek: echte, leesbare bestemmingsgidsen van eigen redactie.
   Geen miljoen lege titels meer; wat hier staat kun je openen en lezen. En het
   toegangsmodel op beide bibliotheken: bladeren is voor iedereen, installeren
   uit de App-Bibliotheek blijft een voordeel van betalende leden.
   Draai los: node --experimental-sqlite --test test/reisbieb.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { GIDSEN, TOTAAL, REGIOS } = require('../server/kern/reisbieb');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, lid, gast;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reisbieb-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const reg = await api(base, '/api/auth/register', { name: 'Wereld Reiziger', email: 'reis@x.nl', phone: '0612345678',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  lid = reg.body.token;
  assert.ok(lid, 'lid-registratie geeft een token');
  const g = await api(base, '/api/login', { tier: 'guest', pasApp: 'rtg' });
  gast = g.body.token;
  assert.ok(gast, 'de gratis gast-app geeft ook een token');
});
test.after(() => stop(srv && srv.child));

test('1. de bibliotheek toont precies de echte gidsen, gratis en leesbaar', async () => {
  const r = await api(base, '/api/mall/reis', {}, lid);
  assert.equal(r.status, 200);
  assert.equal(r.body.totaal, TOTAAL);
  assert.equal(r.body.totaal, GIDSEN.length);
  assert.equal(r.body.gratis, true);
  assert.equal(r.body.leesbaar, true, 'elke gids is echt te lezen');
  assert.equal(r.body.regios.length, REGIOS.length);
  assert.equal(r.body.regios.reduce((s, x) => s + x.aantal, 0), TOTAAL, 'elke gids hoort bij een regio');
  assert.ok(r.body.bestemmingen.includes('Londen'), 'Londen staat in de bibliotheek');
});

test('2. elke gids is inbegrepen en heeft een echte aankondiging', async () => {
  const cat = await api(base, '/api/mall/reis/catalogus', { per: 48 }, lid);
  assert.equal(cat.body.items.length, Math.min(48, TOTAAL));
  for (const a of cat.body.items) {
    assert.equal(a.prijsCenten, 0, a.naam + ' is inbegrepen');
    assert.equal(a.ledenprijsCenten, 0);
    assert.ok(a.uitleg && a.uitleg.length > 40, a.naam + ' heeft een aankondiging');
    assert.ok(a.woorden > 80, a.naam + ' is een echte tekst (' + a.woorden + ' woorden)');
    assert.ok(a.bestemming && a.regio, a.naam + ' heeft een bestemming en een regio');
  }
});

test('3. lezen geeft de volledige tekst; een onbekende gids bestaat niet', async () => {
  const eerste = (await api(base, '/api/mall/reis/catalogus', {}, lid)).body.items[0];
  const r = await api(base, '/api/mall/reis/lees', { id: eerste.id }, lid);
  assert.equal(r.status, 200);
  assert.equal(r.body.gids.id, eerste.id);
  assert.ok(r.body.gids.tekst.length > 200, 'de gids is echt geschreven, geen lege huls');
  assert.ok(r.body.gids.tekst.includes('\n'), 'de tekst heeft meerdere alineas');
  assert.equal((await api(base, '/api/mall/reis/lees', { id: 'reis-nergens' }, lid)).status, 404);
});

test('4. filteren op regio en bestemming, en zoeken in de tekst', async () => {
  const regio = REGIOS[0];
  const r = await api(base, '/api/mall/reis/catalogus', { regio, per: 48 }, lid);
  assert.ok(r.body.totaal > 0);
  for (const a of r.body.items) assert.equal(a.regio, regio);
  const londen = await api(base, '/api/mall/reis/catalogus', { bestemming: 'Londen' }, lid);
  assert.equal(londen.body.totaal, 1);
  assert.equal(londen.body.items[0].bestemming, 'Londen');
  const zoek = await api(base, '/api/mall/reis/catalogus', { zoek: 'londen' }, lid);
  assert.ok(zoek.body.totaal >= 1, 'zoeken vindt Londen');
  assert.equal((await api(base, '/api/mall/reis/catalogus', { zoek: 'qqqxyz' }, lid)).body.totaal, 0);
});

test('5. installeren en verwijderen: idempotent, bewaard per lid, buiten de bieb bestaat niets', async () => {
  const eerste = (await api(base, '/api/mall/reis/catalogus', { bestemming: 'Londen' }, lid)).body.items[0];
  const r1 = await api(base, '/api/mall/reis/installeer', { id: eerste.id }, lid);
  assert.equal(r1.status, 200);
  assert.equal(r1.body.aantal, 1);
  const r2 = await api(base, '/api/mall/reis/installeer', { id: eerste.id }, lid);
  assert.ok(r2.body.alGeinstalleerd, 'twee keer drukken installeert niet dubbel');
  const mijn = await api(base, '/api/mall/reis/mijn', {}, lid);
  assert.equal(mijn.body.apps.length, 1);
  assert.equal(mijn.body.apps[0].id, eerste.id);
  const weg = await api(base, '/api/mall/reis/weg', { id: eerste.id }, lid);
  assert.equal(weg.body.aantal, 0);
  assert.equal((await api(base, '/api/mall/reis/installeer', { id: 'reis-atlantis' }, lid)).status, 404);
});

test('6. het toegangsmodel: bladeren voor iedereen; de gast installeert reis wel, apps niet', async () => {
  // de hele bibliotheek is voor iedereen ZICHTBAAR, ook voor de gast
  for (const pad of ['/api/mall/apps', '/api/mall/apps/catalogus', '/api/mall/reis', '/api/mall/reis/catalogus']) {
    assert.equal((await api(base, pad, {}, gast)).status, 200, pad + ' is zichtbaar voor de gast');
  }
  // installeren uit de App-Bibliotheek blijft het voordeel van betalende leden
  const dicht = await api(base, '/api/mall/apps/installeer', { id: 'app-1' }, gast);
  assert.equal(dicht.status, 403);
  assert.match(dicht.body.error, /betalende leden/);
  // het Reis-gedeelte is voor de aangemelde gast volledig open: bladeren, lezen en installeren
  const gids = (await api(base, '/api/mall/reis/catalogus', {}, gast)).body.items[0];
  assert.ok((await api(base, '/api/mall/reis/lees', { id: gids.id }, gast)).body.gids.tekst.length > 200);
  const reis = await api(base, '/api/mall/reis/installeer', { id: gids.id }, gast);
  assert.equal(reis.status, 200);
  assert.equal((await api(base, '/api/mall/reis/mijn', {}, gast)).body.apps.length, 1);
  assert.equal((await api(base, '/api/mall/reis/weg', { id: gids.id }, gast)).status, 200);
  // zonder aanmelding uberhaupt geen toegang; het betalende lid kan overal in
  assert.equal((await api(base, '/api/mall/reis')).status, 401);
  assert.equal((await api(base, '/api/mall/apps', {}, lid)).status, 200);
});
