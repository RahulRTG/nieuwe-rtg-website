/* De Reis-Bibliotheek: een miljoen reisgidsen van over de hele wereld, van
   Londen tot Gaza, voor betalende leden inbegrepen; en de betaalmuur op
   beide bibliotheken: de gratis gast-app blijft er volledig buiten.
   Draai los: node --experimental-sqlite --test test/reisbieb.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

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

test('1. de bibliotheek telt exact een miljoen reis-apps over 250 bestemmingen', async () => {
  const r = await api(base, '/api/mall/reis', {}, lid);
  assert.equal(r.status, 200);
  assert.equal(r.body.totaal, 1000000);
  assert.equal(r.body.bestemmingen.length, 250);
  assert.equal(r.body.bestemmingen.length * r.body.perBestemming, 1000000);
  assert.ok(r.body.bestemmingen.includes('Londen') && r.body.bestemmingen.includes('Gaza'), 'van Londen tot Gaza');
});

test('2. van Londen tot Gaza: zoeken en filteren vindt elke bestemming', async () => {
  const gaza = await api(base, '/api/mall/reis/catalogus', { zoek: 'gaza' }, lid);
  assert.equal(gaza.body.totaal, 4000, 'elke bestemming heeft 4.000 gidsen');
  for (const a of gaza.body.items) assert.equal(a.bestemming, 'Gaza');
  const londen = await api(base, '/api/mall/reis/catalogus', { bestemming: 'Londen' }, lid);
  assert.equal(londen.body.totaal, 4000);
  for (const a of londen.body.items) assert.equal(a.bestemming, 'Londen');
  // een gidssoort als zoekterm werkt ook, en combineert met een bestemming
  const metro = await api(base, '/api/mall/reis/catalogus', { zoek: 'metrokaart', bestemming: 'Tokio' }, lid);
  assert.equal(metro.body.totaal, 100, 'een soort x bestemming = 100 edities/jaargangen');
  for (const a of metro.body.items) { assert.equal(a.soort, 'Metrokaart'); assert.equal(a.bestemming, 'Tokio'); }
  const niks = await api(base, '/api/mall/reis/catalogus', { zoek: 'qqqxyz' }, lid);
  assert.equal(niks.body.totaal, 0);
  assert.ok(niks.body.hint, 'een misser legt uit hoe je wel zoekt');
});

test('3. dure, exclusieve en educatieve gidsen; voor leden altijd inbegrepen (0)', async () => {
  const p1 = await api(base, '/api/mall/reis/catalogus', { pagina: 1 }, lid);
  const ver = await api(base, '/api/mall/reis/catalogus', { pagina: 41666 }, lid);
  for (const a of [...p1.body.items, ...ver.body.items]) {
    assert.ok(a.winkelwaardeCenten >= 999 && a.winkelwaardeCenten <= 14899, a.naam + ': winkelwaarde 9,99..148,99 (nu ' + a.winkelwaardeCenten + ')');
    assert.equal(a.ledenprijsCenten, 0, 'inbegrepen bij de pas');
    assert.match(a.uitleg, /exclusief en educatief/);
  }
  const o = await api(base, '/api/mall/reis', {}, lid);
  assert.ok(o.body.totaleWinkelwaardeCenten > 1000000 * 999, 'de totale winkelwaarde loopt in de tientallen miljoenen');
});

test('4. de catalogus is deterministisch: dezelfde pagina geeft dezelfde gidsen', async () => {
  const a = await api(base, '/api/mall/reis/catalogus', { bestemming: 'Gaza', soort: 'Stadsgids', pagina: 2 }, lid);
  const b = await api(base, '/api/mall/reis/catalogus', { bestemming: 'Gaza', soort: 'Stadsgids', pagina: 2 }, lid);
  assert.deepEqual(a.body.items.map(x => x.id), b.body.items.map(x => x.id));
  assert.ok(a.body.items.length > 0);
});

test('5. installeren en verwijderen: idempotent, bewaard per lid, buiten de bieb bestaat niets', async () => {
  const eerste = (await api(base, '/api/mall/reis/catalogus', { bestemming: 'Gaza' }, lid)).body.items[0];
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
  assert.equal((await api(base, '/api/mall/reis/installeer', { id: 'reis-1000000' }, lid)).status, 404);
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
  // het Reis-gedeelte is voor de aangemelde gast volledig open, ook installeren
  const reis = await api(base, '/api/mall/reis/installeer', { id: 'reis-7' }, gast);
  assert.equal(reis.status, 200);
  assert.equal((await api(base, '/api/mall/reis/mijn', {}, gast)).body.apps.length, 1);
  assert.equal((await api(base, '/api/mall/reis/weg', { id: 'reis-7' }, gast)).status, 200);
  // zonder aanmelding uberhaupt geen toegang; het betalende lid kan overal in
  assert.equal((await api(base, '/api/mall/reis')).status, 401);
  assert.equal((await api(base, '/api/mall/apps', {}, lid)).status, 200);
});
