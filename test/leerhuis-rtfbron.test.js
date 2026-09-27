/* ============================================================================
   HET LEERHUIS VAN EEN RTF-STAD: de relatie komt uit de zetels en uit een
   koppeling die de vrijwilliger ZELF legt (ACADEMY.md besluit B2, stap B2b).

   Tegen een echte server, want de vraag loopt over twee domeinen: het leerhuis
   vraagt aan kern/rtfos of een account bij een stad hoort, en rtfos wordt pas
   NA het leerhuis opgehangen.

     1. het stadsbestuur (een zetel) opent het leerhuis van zijn stad;
     2. een vrijwilliger zonder koppeling kan niet als relatie worden opgenomen;
     3. koppelen vraagt een eigen account EN de code; twee keer is een herhaling,
        en een ander account met dezelfde code krijgt 409;
     4. daarna kan de stad hem opnemen, en leest hij mee;
     5. de coordinator maakt los (met een reden), en dan leest hij niet meer mee;
     6. een koppeling telt alleen zolang hij ACTIEF is; loskoppelen kan hij ook
        zelf, zonder code.

   MUTATIES (LAT.md regel 2), elk op zijn eigen bewering:
     - de 409 voor een dossier aan een ander account weghalen      -> toets 3
     - in inStad de status-eis weghalen, of de zetels niet tellen  -> toets 6 (status), 1 (zetels)
     - de reden-eis in kantoorLos weghalen                         -> toets 5

   Draai los: node --test test/leerhuis-rtfbron.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, kantoorAlsPersoon } = require('./helper');

let BASE, child, office, E, V, W, eId, vId, STAD, VRIJW, VCODE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-leerhuis-rtf-'));
const ORG = 'RTF-ZAANDAM';

const post = (pad, body, tok) => fetch(BASE + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const rtf = (pad, body) => post('/api/rtfos/' + pad, body, office);
const doe = (tok, actie, invoer, sleutel) => post('/api/leerhuis/doe', { org: ORG, actie, invoer, sleutel }, tok);
const idVan = async (tok) => (await post('/api/state', {}, tok)).body.state.user.id;

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const lid = async (naam, mail, tel) => (await post('/api/auth/register', { name: naam, email: mail,
    phone: tel, password: 'geheim12345', geboortedatum: '1985-03-03', tier: 'rtg' })).body.token;
  E = await lid('Stadsbestuur Zaandam', 'lhr-e@x.nl', '0612349001');
  V = await lid('Vrijwilliger Zaandam', 'lhr-v@x.nl', '0612349002');
  W = await lid('Meelezer Balie', 'lhr-w@x.nl', '0612349003');
  eId = await idVan(E);
  vId = await idVan(V);
  office = await kantoorAlsPersoon(BASE, 'RTG-OFFICE');

  const login = (await post('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).body;
  const vz = (await post('/api/techniek/functie', { id: 'leerhuis', aan: true }, login.token)).body;
  if (vz.status === 'wacht') await post('/api/techniek/functie/besluit', { verzoekId: vz.verzoekId }, login.token);

  STAD = (await rtf('stad/maak', { naam: 'Zaandam' })).body.stad.id;
  await rtf('stad/status', { id: STAD, status: 'actief' });
  await rtf('stad/module', { id: STAD, vlag: 'volunteer_management', aan: true });
  const jaar = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  VRIJW = (await rtf('vrijwilliger/maak', { stad: STAD, naam: 'Jamal K.' })).body.vrijwilliger.id;
  await rtf('vrijwilliger/zet', { id: VRIJW, status: 'actief', gedragscode: true, vogGeldigTot: jaar });
  VCODE = (await rtf('vrijwilliger/code', { id: VRIJW })).body.code;
  assert.ok(VCODE, 'geen vrijwilligerscode');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

const open = () => post('/api/office/leerhuis/open', { id: ORG, soort: 'RTF', naam: 'Zaandam',
  eigenaar: 'user-' + eId, bron: { soort: 'rtf-stad', id: STAD } }, office);

test('1. het leerhuis van een stad opent alleen met een eigenaar die in die stad een zetel heeft', async () => {
  assert.equal((await open()).status, 409, 'zonder zetel staat de eigenaar niet in de bron');
  const z = await rtf('zetel', { stad: STAD, key: 'user-' + eId, naam: 'Stadsbestuur', rol: 'stadsbestuur' });
  assert.equal(z.status, 200, JSON.stringify(z.body));
  const o = await open();
  assert.equal(o.status, 200, JSON.stringify(o.body));
});

test('2. een vrijwilliger die zich niet koppelde, kan de stad niet als relatie verklaren', async () => {
  const r = await doe(E, 'relatieZet', { persoon: 'lid:' + vId, soort: 'VOLUNTEER' }, 'rel-v-0');
  assert.equal(r.status, 409, JSON.stringify(r.body));
});

test('3. koppelen vraagt een eigen account EN de code; een tweede account krijgt 409', async () => {
  assert.equal((await post('/api/rtfos/portaal/vrijwilliger/koppel', { code: VCODE })).status, 401, 'zonder account geen koppeling');
  const k = await post('/api/rtfos/portaal/vrijwilliger/koppel', { code: VCODE }, V);
  assert.equal(k.status, 200, JSON.stringify(k.body));
  const nog = await post('/api/rtfos/portaal/vrijwilliger/koppel', { code: VCODE }, V);
  assert.equal(nog.body.al, true, 'twee keer koppelen is een herhaling');
  const ander = await post('/api/rtfos/portaal/vrijwilliger/koppel', { code: VCODE }, W);
  assert.equal(ander.status, 409, 'een meegelezen code haalt het dossier niet naar een ander account');
  const p = await post('/api/rtfos/portaal/vrijwilliger', { code: VCODE });
  assert.equal(p.body.vrijwilliger.gekoppeld, true, 'het portaal laat zien dat er een koppeling is');
});

test('4. gekoppeld en actief: de stad neemt hem op, en hij leest mee', async () => {
  const r = await doe(E, 'relatieZet', { persoon: 'lid:' + vId, soort: 'VOLUNTEER' }, 'rel-v-1');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const m = await post('/api/leerhuis/lees', { org: ORG, vraag: 'mijn' }, V);
  assert.equal(m.status, 200, JSON.stringify(m.body));
});

test('5. de coordinator maakt los met een reden, en dan leest hij niet meer mee', async () => {
  assert.equal((await post('/api/rtfos/vrijwilliger/account-los', { id: VRIJW }, office)).status, 400, 'zonder reden niet');
  const los = await post('/api/rtfos/vrijwilliger/account-los', { id: VRIJW, reden: 'code gedeeld op de balie' }, office);
  assert.equal(los.status, 200, JSON.stringify(los.body));
  assert.equal(los.body.losgemaakt, true);
  assert.equal((await post('/api/leerhuis/lees', { org: ORG, vraag: 'mijn' }, V)).status, 403);
});

test('6. loskoppelen kan hij ook zelf, zonder code', async () => {
  assert.equal((await post('/api/rtfos/portaal/vrijwilliger/koppel', { code: VCODE }, V)).status, 200);
  assert.equal((await post('/api/leerhuis/lees', { org: ORG, vraag: 'mijn' }, V)).status, 200);
  await rtf('vrijwilliger/zet', { id: VRIJW, status: 'inactief' });
  assert.equal((await post('/api/leerhuis/lees', { org: ORG, vraag: 'mijn' }, V)).status, 403, 'een koppeling telt alleen zolang hij actief is');
  await rtf('vrijwilliger/zet', { id: VRIJW, status: 'actief' });
  assert.equal((await post('/api/leerhuis/lees', { org: ORG, vraag: 'mijn' }, V)).status, 200);
  const z = await post('/api/rtfos/portaal/vrijwilliger/ontkoppel', {}, V);
  assert.equal(z.status, 200, JSON.stringify(z.body));
  assert.equal(z.body.losgemaakt, 1);
  assert.equal((await post('/api/leerhuis/lees', { org: ORG, vraag: 'mijn' }, V)).status, 403);
});
