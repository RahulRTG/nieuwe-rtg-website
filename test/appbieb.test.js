/* De App-Bibliotheek: de ECHTE RTG-apps van het ecosysteem (geen verzonnen
   namen meer). Elke tegel opent een bestaande pagina; installeren zet hem op je
   startscherm. Bladeren mag iedereen; installeren is een pas-voordeel.
   Draai los: node --test test/appbieb.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { APPS } = require('../server/kern/appbieb');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, lid;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-appbieb-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const reg = await api(base, '/api/auth/register', { name: 'App Liefhebber', email: 'apps@x.nl', phone: '0612345678',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  lid = reg.body.token;
  assert.ok(lid, 'lid-registratie geeft een token');
});
test.after(() => stop(srv && srv.child));

/* Sinds de werelden zijn samengevoegd (PLATFORM.md par. 0) wijst een
   catalogusrij niet meer naar een eigen pagina maar naar een STAND binnen een
   wereld: /apps/geld.html#metier. De hash hoort dus van het pad af voor je op
   schijf kijkt -- maar hem alleen wegknippen zou deze toets zwakker maken dan
   hij was, want dan verwijst een rij naar een stand die niet bestaat en merkt
   niemand het. De schil valt bij een onbekende hash stil terug op de eerste
   stand; precies zo'n stille terugval als LAT.md regel 5 beschrijft.

   Daarom controleert deze toets nu twee dingen: de pagina bestaat, EN als er
   een anker in staat, is dat een stand die zich echt registreert. De standen
   van een wereld wonen in public/apps/<wereld>/ en melden zich met
   V.standen.push({ id: '...' }); die verzameling is de bron. */
const standenVan = (wereld) => {
  const map = path.join(__dirname, '..', 'public', 'apps', wereld);
  let namen = [];
  try { namen = fs.readdirSync(map).filter((n) => n.endsWith('.js')); } catch (e) { return null; }
  const uit = new Set();
  for (const n of namen) {
    const s = fs.readFileSync(path.join(map, n), 'utf8');
    for (const m of s.matchAll(/standen\.push\(\{\s*(?:\/\*[^]*?\*\/\s*)?id:\s*'([^']+)'/g)) uit.add(m[1]);
  }
  return uit;
};

test('1. elke app in de catalogus verwijst naar een bestaande pagina op schijf', () => {
  assert.ok(APPS.length >= 40, 'een echte, gevulde catalogus');
  for (const a of APPS) {
    const zonderQuery = a.url.split('?')[0];
    const [pad, anker] = zonderQuery.split('#');
    const bestand = path.join(__dirname, '..', 'public', pad);
    assert.ok(fs.existsSync(bestand), a.naam + ' → ' + a.url + ' bestaat als echte pagina');
    if (anker) {
      const wereld = /\/apps\/([^/]+)\.html$/.exec(pad);
      const standen = wereld ? standenVan(wereld[1]) : null;
      /* Geen standenmap betekent een gewone pagina met een gewoon anker; daar
         valt hier niets over te zeggen en dat is eerlijker dan gokken. */
      if (standen && standen.size) {
        assert.ok(standen.has(anker),
          a.naam + ' → ' + a.url + ' wijst naar een stand die zich registreert (gevonden: ' +
          [...standen].sort().join(', ') + ')');
      }
    }
    assert.ok(a.naam && a.uitleg, a.url + ' heeft een naam en uitleg');
    assert.equal(a.ledenprijsCenten, 0, 'voor leden inbegrepen');
  }
});

test('2. het overzicht telt de echte apps, verdeeld over echte categorieën', async () => {
  const r = await api(base, '/api/mall/apps', {}, lid);
  assert.equal(r.status, 200);
  assert.equal(r.body.totaal, APPS.length);
  assert.ok(r.body.categorieen.length >= 6);
  assert.equal(r.body.categorieen.reduce((n, c) => n + c.aantal, 0), APPS.length);
});

test('3. bladeren per categorie en zoeken op naam werkt', async () => {
  const cat = (await api(base, '/api/mall/apps', {}, lid)).body.categorieen[0];
  const r = await api(base, '/api/mall/apps/catalogus', { categorie: cat.id }, lid);
  assert.equal(r.body.totaal, cat.aantal);
  for (const a of r.body.items) { assert.equal(a.categorie, cat.id); assert.ok(a.url, 'een echte app opent een pagina'); }
  const z = await api(base, '/api/mall/apps/catalogus', { zoek: 'spelen' }, lid);
  assert.ok(z.body.items.some(a => /spelen/i.test(a.naam)), 'zoeken vindt Spelen');
});

test('4. op het startscherm zetten en er weer afhalen: idempotent, per lid', async () => {
  const eerste = (await api(base, '/api/mall/apps/catalogus', { pagina: 1 }, lid)).body.items[0];
  const r1 = await api(base, '/api/mall/apps/installeer', { id: eerste.id }, lid);
  assert.equal(r1.status, 200);
  assert.equal(r1.body.aantal, 1);
  const r2 = await api(base, '/api/mall/apps/installeer', { id: eerste.id }, lid);
  assert.ok(r2.body.alGeinstalleerd, 'twee keer drukken zet niet dubbel');
  const mijn = await api(base, '/api/mall/apps/mijn', {}, lid);
  assert.equal(mijn.body.apps.length, 1);
  assert.equal(mijn.body.apps[0].id, eerste.id);
  assert.equal(mijn.body.apps[0].url, eerste.url, 'mijn app onthoudt de echte pagina');
  const weg = await api(base, '/api/mall/apps/weg', { id: eerste.id }, lid);
  assert.equal(weg.body.aantal, 0);
  assert.equal((await api(base, '/api/mall/apps/installeer', { id: 'rtgapp-bestaatniet' }, lid)).status, 404, 'onbekende app bestaat niet');
});

test('5. zonder inlog blijft de bibliotheek dicht', async () => {
  assert.equal((await api(base, '/api/mall/apps', {})).status, 401);
  assert.equal((await api(base, '/api/mall/apps/installeer', { id: APPS[0].id })).status, 401);
});
