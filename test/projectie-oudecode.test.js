/* De oude schermcode van de projectiekamer over de echte deur.

   test/spelprojectie.test.js beproeft de koppeling in het proces; de oude
   GET /api/projectie/:code (routes/spellen.js) riep niemand over HTTP aan.
   Die route bestaat alleen nog als EINDSTATUS voor oude tv's: een 32-bits code
   wordt nooit meer omgezet in werkende toegang. Wat hier moet kunnen zakken:
     - elke oude code, ook een die ooit geldig was van vorm, krijgt 410 Gone
       met een uitleg, en nooit een stand van een potje;
     - het antwoord gaat geen cache in (no-store), zodat een proxy een oude
       code niet alsnog serveert;
     - de nieuwe koppeldeur weigert een verzonnen code ook (en dus is 410 hier
       geen toevalligheid van een route die alles weigert).

   Draai los: node --test test/projectie-oudecode.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
const OUD = '/api/projectie/:code';

test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-projectie-oud-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
});
test.after(() => stop(srv && srv.child));

test('een oude schermcode is gesloten: 410, uitleg, en niets in de cache', async () => {
  for (const code of ['DEADBEEF', '0000ABCD', 'zomaarwat']) {
    const r = await fetch(base + OUD.replace(':code', code));
    assert.equal(r.status, 410, code + ' hoort 410 Gone te geven');
    assert.match(r.headers.get('cache-control') || '', /no-store/, 'geen cache voor ' + code);
    const body = await r.json();
    assert.match(String(body.error || ''), /gesloten/, 'het antwoord zegt dat de code gesloten is');
    assert.equal(body.staat, undefined, 'en geeft geen stand van een potje prijs');
  }
});

test('de nieuwe koppeldeur weigert een verzonnen code ook', async () => {
  const r = await fetch(base + '/api/projectie/koppel', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'DEADBEEF' }) });
  assert.ok(r.status >= 400 && r.status < 500, 'een verzonnen code koppelt niet (' + r.status + ')');
  const body = await r.json().catch(() => ({}));
  assert.equal(body.token, undefined, 'en er komt geen schermsessie terug');
  assert.equal((body.sessie || {}).token, undefined);
});
