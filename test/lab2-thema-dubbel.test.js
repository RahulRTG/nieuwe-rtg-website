/* Een vraag uit de buurt staat er EEN keer, ook na een dubbele tik.

   Gevonden door de voltooiproef (scripts/lib/voltooi/klimaat.js): een dubbele
   tik op Stuur in het Klimaatfonds, of opnieuw na een afgebroken verzoek, zette
   dezelfde vraag twee keer in het Living Lab -- met de steun verdeeld over twee
   kopieen. Een eigen bestand en niet in test/lab2-bewoner.test.js: die toets
   telt de schrijfrem van de bewonersdeur tot op de laatste poging.

   Draai los: node --test test/lab2-thema-dubbel.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-lab2-dubbel-'));
let srv, base, kantoor;
const post = (pad, body, tok) => fetch(base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'LAB2-DUBBEL-1' } });
  base = srv.base;
  kantoor = (await post('/api/office/login', { code: 'LAB2-DUBBEL-1' })).body.token;
  assert.ok(kantoor, 'het kantoor logt in');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('een dubbele tik zet een vraag een keer in het lab, en een andere vraag gewoon ernaast', async () => {
  const lab = (await post('/api/lab2/lab/maak', { stad: 'Dubbelstad', naam: 'Living Lab Dubbelstad' }, kantoor)).body.lab.id;
  const lijf = { labId: lab, vraag: 'Kan er een bankje bij de bushalte aan de Lindelaan?', soort: 'duurzaam' };
  const [a, b] = await Promise.all([post('/api/lab2/bewoner/thema', lijf), post('/api/lab2/bewoner/thema', lijf)]);
  assert.equal(a.status, 200); assert.equal(b.status, 200);
  assert.equal(a.body.thema.id, b.body.thema.id, 'een dubbele tik gaf twee vragen');
  const ander = await post('/api/lab2/bewoner/thema', Object.assign({}, lijf, { vraag: 'Kan er een fietsenrek bij de bushalte?' }));
  assert.notEqual(ander.body.thema.id, a.body.thema.id);
  const lijst = (await post('/api/lab2/bewoner/themas', { labId: lab })).body;
  assert.equal(lijst.totaal, 2, 'de dubbele tik zette de vraag twee keer in het lab');
});
