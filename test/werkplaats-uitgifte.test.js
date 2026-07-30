/* RTG Werkplaats geeft rechtstreeks uit: een opdracht wordt na het uitwerken
   als echt onderdeel in de winkel gezet (App Store of Bibliotheek). De overlay
   leeft in db.data.appbiebExtra en verschijnt bij de leden in de App-Bibliotheek;
   intrekken haalt het er weer uit. Alles omkeerbaar.
   Draai los: node --experimental-sqlite --test test/werkplaats-uitgifte.test.js */
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

let srv, base, office, lid;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wp-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  office = (await api(base, '/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  assert.ok(office, 'office-inlog geeft een token');
  const reg = await api(base, '/api/auth/register', { name: 'Winkel Lid', email: 'wp@x.nl', phone: '0612345678',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  lid = reg.body.token;
  assert.ok(lid, 'lid-registratie geeft een token');
});
test.after(() => stop(srv && srv.child));

test('1. een uitgewerkte App Store-opdracht wordt live gezet en is bij leden zichtbaar', async () => {
  const maak = await api(base, '/api/office/werkplaats/maak',
    { soort: 'nieuw', naam: 'RTG Reisdagboek Live', brief: 'Een app die je reis tot een dagboek maakt.' }, office);
  const id = maak.body.item.id;
  assert.ok(id, 'opdracht aangemaakt');
  await api(base, '/api/office/werkplaats/uitwerken', { id }, office);       // sjabloon-terugval zet het plan
  // voor publiceren moet het lid dit nog nergens zien
  const voor = await api(base, '/api/mall/apps/catalogus', { categorie: 'werkplaats' }, lid);
  assert.equal(voor.body.totaal, 0, 'nog niets in de Werkplaats-plank');

  const pub = await api(base, '/api/office/werkplaats/publiceer', { id }, office);
  assert.equal(pub.status, 200);
  assert.ok(pub.body.item.uitgifte, 'de opdracht heeft nu een uitgifte');
  assert.equal(pub.body.item.uitgifte.plank, 'winkel', 'een nieuwe app gaat naar de App Store');
  assert.equal(pub.body.item.status, 'klaar');

  const na = await api(base, '/api/mall/apps/catalogus', { categorie: 'werkplaats' }, lid);
  assert.equal(na.body.totaal, 1, 'nu staat het onderdeel in de winkel');
  assert.equal(na.body.items[0].naam, 'RTG Reisdagboek Live');
  assert.equal(na.body.items[0].ledenprijsCenten, 0, 'voor leden inbegrepen');
  // en het telt mee in het overzicht als eigen categorie
  const { APPS } = require('../server/kern/appbieb');
  const ov = await api(base, '/api/mall/apps', {}, lid);
  assert.equal(ov.body.totaal, APPS.length + 1, 'de echte catalogus plus de gepubliceerde app');
  assert.ok(ov.body.categorieen.find(c => c.id === 'werkplaats'), 'de Werkplaats-plank staat in het overzicht');
});

test('2. een lid kan een Werkplaats-app installeren; intrekken haalt hem overal weg', async () => {
  const app = (await api(base, '/api/mall/apps/catalogus', { categorie: 'werkplaats' }, lid)).body.items[0];
  const inst = await api(base, '/api/mall/apps/installeer', { id: app.id }, lid);
  assert.equal(inst.status, 200);
  const mijn = await api(base, '/api/mall/apps/mijn', {}, lid);
  assert.ok(mijn.body.apps.find(a => a.id === app.id), 'de geïnstalleerde Werkplaats-app staat bij mijn apps');

  // de opdracht opnieuw vinden en intrekken
  const overzicht = await api(base, '/api/office/werkplaats', {}, office);
  const opdracht = overzicht.body.items.find(o => o.uitgifte && o.uitgifte.ref === app.id);
  assert.ok(opdracht, 'de bijbehorende opdracht is te vinden');
  const introk = await api(base, '/api/office/werkplaats/introk', { id: opdracht.id }, office);
  assert.equal(introk.status, 200);
  assert.equal(introk.body.item.uitgifte, null, 'de uitgifte is weg');

  const na = await api(base, '/api/mall/apps/catalogus', { categorie: 'werkplaats' }, lid);
  assert.equal(na.body.totaal, 0, 'uit de winkel gehaald');
  const mijnNa = await api(base, '/api/mall/apps/mijn', {}, lid);
  assert.ok(!mijnNa.body.apps.find(a => a.id === app.id), 'de ingetrokken app valt ook bij het lid weg');
});

test('3. een Bibliotheek-opdracht gaat naar de plank Bibliotheek', async () => {
  const maak = await api(base, '/api/office/werkplaats/maak',
    { soort: 'verbeter', doelSoort: 'bieb', doel: 'Reisgids', naam: 'Reisgids-materiaal', brief: 'Extra materiaal bij de reisgids.' }, office);
  const id = maak.body.item.id;
  await api(base, '/api/office/werkplaats/uitwerken', { id }, office);
  const pub = await api(base, '/api/office/werkplaats/publiceer', { id }, office);
  assert.equal(pub.body.item.uitgifte.plank, 'bieb', 'de Bibliotheek-plank');
  assert.equal(pub.body.item.uitgifte.plankLabel, 'Bibliotheek');
  const na = await api(base, '/api/mall/apps/catalogus', { categorie: 'werkplaats' }, lid);
  assert.ok(na.body.items.find(a => a.plank === 'bieb'), 'het materiaal staat op de Bibliotheek-plank');
});

test('4. publiceren zonder uitgewerkt plan wordt geweigerd', async () => {
  const maak = await api(base, '/api/office/werkplaats/maak', { soort: 'nieuw', naam: 'Nog niet klaar' }, office);
  const pub = await api(base, '/api/office/werkplaats/publiceer', { id: maak.body.item.id }, office);
  assert.equal(pub.status, 400, 'eerst uitwerken');
});

test('5. uitgeven is voor het kantoor; een gewoon lid komt er niet bij', async () => {
  assert.equal((await api(base, '/api/office/werkplaats/publiceer', { id: 'wp1' }, lid)).status, 401);
  assert.equal((await api(base, '/api/office/werkplaats/publiceer', { id: 'wp1' })).status, 401);
});
