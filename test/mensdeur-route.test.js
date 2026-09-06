/* ============================================================================
   DE SCHADUWMETING OVER DE ROUTE -- met een echte server en echt inloggen.

   WAAROM NAAST test/mensdeur.test.js. Dat bestand toetst de teller rechtstreeks
   en geeft de boolean met de hand mee -- precies zoals een kapotte bedrading dat
   ook zou doen. Het kan per constructie niet zien of `officeAuth` de juiste kant
   kiest, en dat is nu juist de hele bewering: de gedeelde code telt als anoniem,
   een kantoorsessie op naam telt als een mens.

   Dat verschil is hier langs de ECHTE weg te maken, en dat was bij het bouwen
   niet meteen duidelijk: een kantoorsessie op naam ontstaat niet uit
   /api/office/login maar uit /api/auth/login gevolgd door /api/account/start
   met rol 'kantoor' (kern/eenaccount/starten.js zet dan lidKey op de sessie).
   Zonder die tweede weg lijkt het alsof alles anoniem is.

   Draai los: node --test test/mensdeur-route.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mensdeur-'));
const CODE = 'KANTOOR-MENSDEUR-1';
let srv, base, gedeeld, opNaam;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  base = srv.base;
  gedeeld = (await api('/api/office/login', { code: CODE })).body.token;
  assert.ok(gedeeld, 'de gedeelde kantoorcode werkt');

  const eig = (await api('/api/auth/login',
    { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  opNaam = (await api('/api/account/start', { rol: 'kantoor' }, eig)).body.token;
  assert.ok(opNaam, 'de eigenaar komt op zijn eigen account de backoffice in');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* DE KAART VAN DE GATEN IS NIET LEESBAAR VOOR DE SESSIE DIE HET GAT IS. Dit is
   geen ceremonie: /api/office/mensdeur noemt precies de routes die vandaag
   anoniem gebruikt worden, en dat is bruikbare kennis voor wie er misbruik van
   wil maken. Vandaar boardroomAuth en niet officeAuth. */
test('1. de gedeelde kantoorcode mag de schaduwmeting niet lezen', async () => {
  const r = await api('/api/office/mensdeur', {}, gedeeld);
  assert.equal(r.status, 403,
    'de gedeelde code komt bij de kaart van de gaten -- dat is precies de sessie die het gat is');
});

test('2. een kantoorsessie op naam leest hem wel', async () => {
  const r = await api('/api/office/mensdeur', {}, opNaam);
  assert.equal(r.status, 200);
  assert.equal(typeof r.body.verzoeken, 'number', 'de uitslag draagt een telling');
  assert.ok(Array.isArray(r.body.werklijst), 'de werklijst is de lijst met wat er nog anoniem gebeurt');
});

/* DE KERNBEWERING: officeAuth kiest de goede kant. Twee verzoeken op DEZELFDE
   route, een met de gedeelde code en een op naam, horen in twee verschillende
   tellers te landen. Zou de bedrading altijd dezelfde boolean doorgeven, dan
   staat hier 2-0 of 0-2 en zakt deze toets. */
test('3. dezelfde route telt anoniem en op naam apart', async () => {
  await api('/api/office/state', {}, gedeeld);
  await api('/api/office/state', {}, opNaam);

  const s = (await api('/api/office/mensdeur', {}, opNaam)).body;
  const alle = s.werklijst.concat(s.kanNuAlDicht);
  const staat = alle.find(r => r.pad === '/api/office/state');
  /* /api/office/state zag beide soorten, dus hij staat op GEEN van beide
     werklijsten -- dat is de bak `beide`, en die telling controleren we los. */
  assert.equal(staat, undefined,
    'een route die beide soorten zag hoort op geen van beide werklijsten te staan');
  assert.ok(s.beide >= 1,
    'geen enkele route zag beide soorten -- dan geeft officeAuth altijd dezelfde boolean door ' +
    'en meet de schaduwmeting niets');
});

/* Een geweigerd verzoek is een deur die zijn werk deed en geen handeling. Deze
   toets bestaat omdat de eerste versie bij BINNENKOMST telde: /api/office/
   mensdeur belandde daardoor zelf op de werklijst "wordt anoniem gebruikt",
   terwijl hij juist als enige al dicht zit. */
test('4. een geweigerd verzoek komt niet op de werklijst', async () => {
  await api('/api/office/mensdeur', {}, gedeeld);   // 403
  const s = (await api('/api/office/mensdeur', {}, opNaam)).body;
  const opWerklijst = s.werklijst.some(r => r.pad === '/api/office/mensdeur');
  assert.equal(opWerklijst, false,
    'een 403 is geteld als anoniem uitgevoerde handeling -- dan vult de werklijst zich met ' +
    'routes die juist al dicht zitten');
});
