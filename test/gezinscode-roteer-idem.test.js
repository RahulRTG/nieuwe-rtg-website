/* De herhaalde rotatie van de gezinscode op een ECHTE server (7 oktober 2026,
   besluit van de eigenaar na de volle idemronde).

   Tot deze reparatie roteerde POST /api/foundation/gezin/code/roteer bij een
   herhaling met DEZELFDE idempotentiesleutel gewoon nog een keer: de code die de
   beheerder net had gedeeld opende daarna niets meer. Nu bindt
   foundation/gezinscode.js de sleutel als hash aan de rotatie, in dezelfde
   collectietransactie. Dezelfde sleutel: 409 met `herhaald`, geen tweede rotatie
   en geen kale code (die bestaat alleen als hash, en een herhaling heronthult hem
   niet -- lib/eenmalig-geheim-routes.js). Een verse sleutel roteert wel, en dan
   opent de vorige code niets meer.

   Draai los: node --test test/gezinscode-roteer-idem.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gezinscode-idem-'));
let child, base;
test.before(async () => { ({ child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } })); });
test.after(() => { stop(child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

async function post(pad, body, extra) {
  const r = await fetch(base + pad, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, extra || {}),
    body: JSON.stringify(body || {}) });
  const tekst = await r.text();
  let lijf = {}; try { lijf = JSON.parse(tekst); } catch (e) {}
  return { status: r.status, body: lijf, tekst };
}
const kop = token => ({ Authorization: 'Bearer ' + token });
const GC = /^GC\.[0-9A-F]{32}$/;
const ROTEER = '/api/foundation/gezin/code/roteer';
const inloggen = gezinscode => post('/api/foundation/gezin/inloggen', { gezinscode, pin: '2468' }).then(r => r.status);
const stand = (g) => fetch(base + '/api/foundation/gezin/' + g.code + '/gezinscode', { headers: kop(g.token) })
  .then(r => r.json()).then(j => j.status);

async function gezin(naam) {
  const g = await post('/api/foundation/gezin/maak', { gezinsnaam: naam, naam: 'Beheerder', pin: '2468',
    bevoegdGezin: true, privacyAkkoord: true });
  assert.equal(g.status, 200, g.tekst);
  assert.match(g.body.gezinscode, GC);
  return g.body;
}

test('dezelfde sleutel roteert een keer, een verse sleutel opnieuw, en de oude code opent niets', async () => {
  const g = await gezin('Gezin Herhaling');
  const voor = await stand(g);

  /* 1. Twee keer met dezelfde sleutel: een rotatie, en de code blijft die van de eerste. */
  const sleutel = 'gezinscode-roteer-' + Date.now() + '-a';
  const een = await post(ROTEER, { code: g.code, idem: sleutel }, kop(g.token));
  assert.equal(een.status, 200, een.tekst);
  assert.match(een.body.gezinscode, GC);
  const twee = await post(ROTEER, { code: g.code, idem: sleutel }, kop(g.token));
  assert.equal(twee.status, 409, 'dezelfde sleutel is een herhaling: ' + twee.tekst);
  assert.equal(twee.body.herhaald, true);
  assert.equal(twee.tekst.includes('GC.'), false, 'een herhaling heronthult geen kale gezinscode');
  assert.equal(twee.body.gezinscode, undefined);
  const na = await stand(g);
  assert.equal(na.rotatie, een.body.status.rotatie, 'de herhaling roteerde niet nog eens');
  assert.notEqual(na.rotatie, voor.rotatie, 'de eerste oproep roteerde wel');
  assert.equal(na.uitgegeven, een.body.status.uitgegeven, 'dezelfde uitgifte staat er nog');
  assert.equal(await inloggen(een.body.gezinscode), 200, 'de code uit de eerste oproep blijft gelden');
  /* ook via de standaardkop is het dezelfde sleutel */
  const kopje = await post(ROTEER, { code: g.code }, Object.assign({ 'Idempotency-Key': sleutel }, kop(g.token)));
  assert.equal(kopje.status, 409, kopje.tekst);
  assert.equal(await inloggen(een.body.gezinscode), 200);

  /* 2. Een verse sleutel roteert wel, en geeft een nieuwe code. */
  const vers = await post(ROTEER, { code: g.code, idem: 'gezinscode-roteer-' + Date.now() + '-b' }, kop(g.token));
  assert.equal(vers.status, 200, vers.tekst);
  assert.match(vers.body.gezinscode, GC);
  assert.notEqual(vers.body.gezinscode, een.body.gezinscode, 'een verse sleutel geeft een nieuwe code');
  assert.notEqual((await stand(g)).rotatie, na.rotatie, 'en dat is een echte tweede rotatie');
  assert.equal(await inloggen(vers.body.gezinscode), 200);

  /* 3. De oude codes openen niets meer. */
  assert.equal(await inloggen(een.body.gezinscode), 403, 'de vervangen code opent niets');
  assert.equal(await inloggen(g.gezinscode), 403, 'de oorspronkelijke code ook niet');
});
