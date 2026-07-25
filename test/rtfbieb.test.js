/* De RTF App-Bibliotheek: de ECHTE apps van de RTFoundation, altijd gratis
   (cadeau van de stichting), met de leeftijdspoort van het profiel: een kind
   ziet en installeert nooit iets boven zijn groep. Elke tegel opent een
   bestaande pagina. Draai los:
   node --experimental-sqlite --test test/rtfbieb.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { APPS, CATEGORIEEN, TOTAAL } = require('../server/kern/rtfbieb');

let srv, base;
function fnd(pad, body) {
  return fetch(base + '/api/foundation' + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
function bieb(pad, body, sess) {
  return fetch(base + '/api/rtf/bieb' + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ code: sess.code, token: sess.token }, body || {})) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let ouder, kind;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtfbieb-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const t = Date.now().toString().slice(-6);
  const g = (await fnd('/gezin/maak', { gezinsnaam: 'Bieb ' + t, naam: 'Ouder ' + t, pin: '1234' })).body;
  ouder = { code: g.code, token: g.token };
  const kp = (await fnd('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Kind ' + t, rol: 'kind', groep: 'kind' })).body;
  const kies = (await fnd('/gezin/profiel/kies', { code: g.code, profielId: kp.profiel.id })).body;
  kind = { code: g.code, token: kies.token };
});
test.after(() => stop(srv && srv.child));

test('1. de bibliotheek toont de echte apps van de stichting en is ALTIJD gratis', async () => {
  const r = await bieb('', {}, ouder);
  assert.equal(r.status, 200);
  assert.equal(r.body.totaal, TOTAAL);
  assert.equal(r.body.totaal, APPS.length);
  assert.equal(r.body.gratis, true);
  assert.equal(r.body.echt, true, 'geen verzonnen namen meer');
  assert.match(r.body.huisregel, /Geen aankopen, geen reclame/, 'de huisregel staat boven de bibliotheek');
  assert.ok(r.body.categorieen.length > 1);
  assert.equal(r.body.categorieen.reduce((s, c) => s + c.aantal, 0), TOTAAL, 'elke app hoort bij een categorie');
  const cat = await bieb('/catalogus', { per: 48 }, ouder);
  for (const a of cat.body.items) {
    assert.equal(a.prijsCenten, 0, a.naam + ' is gratis');
    assert.ok(a.uitleg && a.uitleg.length > 20, a.naam + ' legt uit wat het is');
    assert.match(a.huisregel, /Geen aankopen, geen reclame/);
  }
});

test('2. elke app opent een pagina die echt bestaat', () => {
  const root = path.join(__dirname, '..', 'public');
  for (const a of APPS) {
    assert.ok(a.url && a.url.startsWith('/apps/'), a.naam + ' heeft een adres');
    assert.ok(fs.existsSync(path.join(root, a.url.replace(/^\//, ''))), a.naam + ' wijst naar een bestaand bestand (' + a.url + ')');
    assert.ok(CATEGORIEEN.some(c => c.id === a.categorie), a.naam + ' hoort bij een bestaande categorie');
  }
});

test('3. de leeftijdspoort: een kind ziet nooit tiener-apps, een ouder wel', async () => {
  const k = await bieb('/catalogus', { per: 48 }, kind);
  assert.ok(k.body.totaal > 0);
  for (const a of k.body.items) assert.ok(['mini', 'kind', 'gezin'].includes(a.doelgroep), a.naam + ' past bij een kind (' + a.doelgroep + ')');
  const o = await bieb('/catalogus', { categorie: 'geld', per: 48 }, ouder);
  assert.ok(o.body.items.some(a => a.doelgroep === 'tiener'), 'de ouder ziet ook tiener-apps');
  assert.ok(o.body.totaal > (await bieb('/catalogus', { categorie: 'geld', per: 48 }, kind)).body.totaal, 'het kind ziet er minder');
});

test('4. installeren binnen de eigen groep werkt; boven de groep wordt geweigerd', async () => {
  const cat = await bieb('/catalogus', { categorie: 'geld', per: 48 }, kind);
  const app = cat.body.items[0];
  const r = await bieb('/installeer', { id: app.id }, kind);
  assert.equal(r.status, 200);
  assert.equal(r.body.aantal, 1);
  // zoek via de ouder een tiener-app en probeer die als kind te installeren
  const oc = await bieb('/catalogus', { categorie: 'geld', per: 48 }, ouder);
  const tienerApp = oc.body.items.find(a => a.doelgroep === 'tiener');
  assert.ok(tienerApp, 'er bestaat een tiener-app');
  assert.equal((await bieb('/installeer', { id: tienerApp.id }, kind)).status, 403, 'boven de groep: dicht');
  assert.equal((await bieb('/installeer', { id: 'rtf-bestaatniet' }, kind)).status, 404);
  const mijn = await bieb('/mijn', {}, kind);
  assert.equal(mijn.body.apps.length, 1);
  assert.equal(mijn.body.apps[0].id, app.id);
  assert.ok(mijn.body.apps[0].url, 'ook op het startscherm blijft het adres bekend');
});

test('5. verwijderen en idempotent installeren', async () => {
  const mijn = (await bieb('/mijn', {}, kind)).body.apps;
  const r2 = await bieb('/installeer', { id: mijn[0].id }, kind);
  assert.ok(r2.body.alGeinstalleerd, 'twee keer drukken installeert niet dubbel');
  const weg = await bieb('/weg', { id: mijn[0].id }, kind);
  assert.equal(weg.body.aantal, 0);
});

test('6. zoeken werkt op naam en uitleg', async () => {
  const a = await bieb('/catalogus', { zoek: 'overhoren' }, ouder);
  assert.ok(a.body.totaal > 0);
  for (const x of a.body.items) assert.match((x.naam + ' ' + x.uitleg).toLowerCase(), /overhoren/);
  assert.equal((await bieb('/catalogus', { zoek: 'qqqxyz' }, ouder)).body.totaal, 0);
});

test('7. zonder geldig gezin blijft de bibliotheek dicht', async () => {
  const r = await bieb('', {}, { code: 'NEPPERT', token: 'nep' });
  assert.equal(r.status, 403);
});
