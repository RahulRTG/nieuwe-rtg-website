/* De Rijks-Bibliotheek (10.000 werk-apps per overheidsafdeling) en de
   Lesmaker (AI-lesstof + de interactieve klas-PDA).
   Draai los: node --experimental-sqlite --test test/rijksles.test.js */
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

let srv, base, rijk, partner;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rijksles-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const roster = await api(base, '/api/supplier/roster', { code: 'RIJK' });
  const man = roster.body.staff.find(m => m.role === 'manager');
  rijk = (await api(base, '/api/supplier/login', { code: 'RIJK', staffId: man.id, pin: '1234' })).body.token;
  assert.ok(rijk, 'de rijksambtenaar is ingelogd');
  partner = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
});
test.after(() => stop(srv && srv.child));

test('1. elke overheidsafdeling heeft precies 10.000 werk-apps (12 x 10.000 = 120.000)', async () => {
  const r = await api(base, '/api/overheid/bieb', {}, rijk);
  assert.equal(r.status, 200);
  assert.equal(r.body.totaal, 120000);
  assert.equal(r.body.afdelingen.length, 12);
  for (const a of r.body.afdelingen) assert.equal(a.aantal, 10000, a.label + ' heeft 10.000 apps');
  const rdw = await api(base, '/api/overheid/bieb/catalogus', { afdeling: 'rdw' }, rijk);
  assert.equal(rdw.body.totaal, 10000);
  for (const a of rdw.body.items) assert.equal(a.afdeling, 'rdw');
});

test('2. zoeken, installeren en verwijderen; buiten het rijk blijft de bieb dicht', async () => {
  const z = await api(base, '/api/overheid/bieb/catalogus', { zoek: 'dossierscan' }, rijk);
  assert.ok(z.body.totaal > 0);
  for (const a of z.body.items) assert.equal(a.taak, 'Dossierscan');
  const eerste = z.body.items[0];
  assert.equal(eerste.ambtenaarprijsCenten, 0, 'voor ambtenaren inbegrepen');
  const i1 = await api(base, '/api/overheid/bieb/installeer', { id: eerste.id }, rijk);
  assert.equal(i1.body.aantal, 1);
  assert.ok((await api(base, '/api/overheid/bieb/installeer', { id: eerste.id }, rijk)).body.alGeinstalleerd);
  const mijn = await api(base, '/api/overheid/bieb/mijn', {}, rijk);
  assert.equal(mijn.body.apps.length, 1);
  assert.equal((await api(base, '/api/overheid/bieb/weg', { id: eerste.id }, rijk)).body.aantal, 0);
  // een gewone partner en een anonieme bezoeker komen er niet in
  assert.equal((await api(base, '/api/overheid/bieb', {}, partner)).status, 403);
  assert.equal((await api(base, '/api/overheid/bieb', {})).status, 401);
});

test('3. de Lesmaker: een leraar maakt een les en vindt apps uit de bibliotheken', async () => {
  const apps = await api(base, '/api/les/apps', { zoek: 'tafels', niveau: 'kind' });
  assert.ok(apps.body.apps.length > 0, 'de app-zoeker vindt bibliotheek-apps');
  assert.ok(apps.body.apps.some(a => a.bieb === 'School-Bibliotheek'));
  const les = await api(base, '/api/les/maak', { onderwerp: 'de tafels van 7', niveau: 'kind', app: apps.body.apps[0].naam });
  assert.equal(les.status, 200);
  assert.ok(les.body.code && les.body.leraarToken);
  assert.ok(les.body.les.vragen.length >= 3, 'de les heeft een quiz');
  assert.ok(les.body.les.uitleg.length > 50, 'de les heeft echte uitleg');
  assert.equal((await api(base, '/api/les/leraar', { code: les.body.code, leraarToken: 'fout' })).status, 403);
});

test('4. de klas-PDA: kinderen doen mee, antwoorden en zien het podium', async () => {
  const les = (await api(base, '/api/les/maak', { onderwerp: 'veilig internet', niveau: 'kind' })).body;
  const kim = (await api(base, '/api/les/mee', { code: les.code, naam: 'Kim' })).body;
  const bo = (await api(base, '/api/les/mee', { code: les.code, naam: 'Bo' })).body;
  assert.ok(kim.deelnemerToken && bo.deelnemerToken);
  assert.equal(kim.les.fase, 'lobby');
  assert.ok(kim.les.uitleg, 'in de lobby leest het kind de uitleg');
  // dezelfde naam nog eens: netjes geweigerd
  assert.equal((await api(base, '/api/les/mee', { code: les.code, naam: 'Kim' })).status, 400);
  // de leraar start vraag 1; het kind ziet de vraag ZONDER het juiste antwoord
  const v1 = await api(base, '/api/les/volgende', { code: les.code, leraarToken: les.leraarToken });
  assert.equal(v1.body.les.fase, 'vraag');
  const kijk = await api(base, '/api/les/kijk', { code: les.code, naam: 'Kim', deelnemerToken: kim.deelnemerToken });
  assert.ok(kijk.body.les.vraag.opties.length === 4);
  assert.equal(kijk.body.les.vraag.juist, undefined, 'het juiste antwoord lekt nooit naar het kind');
  // Kim antwoordt goed (demo-les: optie 0), Bo fout; dubbel antwoorden mag niet
  const ak = await api(base, '/api/les/antwoord', { code: les.code, naam: 'Kim', deelnemerToken: kim.deelnemerToken, keuze: 0 });
  assert.equal(ak.body.goed, true);
  assert.ok(ak.body.score >= 100);
  const ab = await api(base, '/api/les/antwoord', { code: les.code, naam: 'Bo', deelnemerToken: bo.deelnemerToken, keuze: 2 });
  assert.equal(ab.body.goed, false);
  assert.equal((await api(base, '/api/les/antwoord', { code: les.code, naam: 'Kim', deelnemerToken: kim.deelnemerToken, keuze: 1 })).status, 400);
  // de leraar ziet de keuzes en de tussenstand; daarna sluit hij de les
  const lb = await api(base, '/api/les/leraar', { code: les.code, leraarToken: les.leraarToken });
  assert.deepEqual(lb.body.les.keuzes.reduce((a, b) => a + b, 0), 2, 'twee kinderen hebben gekozen');
  assert.equal(lb.body.les.stand[0].naam, 'Kim');
  const einde = await api(base, '/api/les/sluit', { code: les.code, leraarToken: les.leraarToken });
  assert.equal(einde.body.les.fase, 'klaar');
  const podium = await api(base, '/api/les/kijk', { code: les.code, naam: 'Bo', deelnemerToken: bo.deelnemerToken });
  assert.equal(podium.body.les.fase, 'klaar');
  assert.equal(podium.body.les.stand[0].naam, 'Kim', 'het podium staat op de klas-PDA');
});
