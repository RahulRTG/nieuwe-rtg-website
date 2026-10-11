/* ============================================================================
   HET GAAT MEE (PERSONEEL.md par. 8 en 9, CARRIERE.md: lock-in door kwaliteit
   mag, lock-in door gijzeling zakt).

   Twee dingen op Mijn loopbaan, over HTTP op een echte server:
   1. /api/carriere/ledger/afschrift geeft het HELE eigen ledger -- met de reden
      van elke intrekking, wat het afschrift NIET is, en zonder deelcodes -- en
      nooit dat van een ander; zonder account niets.
   2. /api/concern/mijnwerk geeft een AFGELOPEN dienstverband apart in `eerder`,
      en niet meer in `werkplekken` ("uw werkplek is klaar" zou dan liegen).
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, lid, ander, eigLid;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-loopbaan-mee-'));
const post = (pad, body, tok) => fetch(srv.base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } });
  lid = (await post('/api/auth/register', { name: 'Mee Een', email: 'mee1@x.nl', phone: '0612348101',
    password: 'geheim12345', geboortedatum: '1990-04-04', tier: 'rtg' })).body;
  ander = (await post('/api/auth/register', { name: 'Mee Twee', email: 'mee2@x.nl', phone: '0612348102',
    password: 'geheim12345', geboortedatum: '1991-03-03', tier: 'rtg' })).body;
  eigLid = (await post('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(lid.token && ander.token && eigLid);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. het afschrift: het hele eigen ledger, met de reden van een intrekking, en niets van een ander', async () => {
  assert.equal((await post('/api/carriere/ledger/afschrift', {}, null)).status, 401, 'zonder account niets');

  const een = await post('/api/carriere/ledger/zet', { kapitaal: 'vermogen', wat: 'Kok in opleiding', op: '2024-02-01' }, lid.token);
  const twee = await post('/api/carriere/ledger/zet', { kapitaal: 'netwerk', wat: 'Mentor van twee leerlingen', op: '2025-01-10' }, lid.token);
  assert.equal(een.status, 200); assert.equal(twee.status, 200);
  assert.equal((await post('/api/carriere/ledger/intrek', { id: twee.body.regel.id, reden: 'Het waren er drie' }, lid.token)).status, 200);
  assert.equal((await post('/api/carriere/ledger/zet', { kapitaal: 'vermogen', wat: 'Regel van een ander', op: '2024-03-01' }, ander.token)).status, 200);
  const deel = await post('/api/carriere/ledger/deel', { id: een.body.regel.id, dagen: 30, voor: 'Werkgever' }, lid.token);
  assert.equal(deel.status, 200);

  const a = await post('/api/carriere/ledger/afschrift', { key: 'iemand-anders' }, lid.token);
  assert.equal(a.status, 200, JSON.stringify(a.body).slice(0, 200));
  assert.equal(a.body.vorm, 'rtg-loopbaan-afschrift/1');
  assert.deepEqual(a.body.feiten.map(f => f.wat), ['Kok in opleiding', 'Mentor van twee leerlingen'],
    'het hele eigen ledger op volgorde van wanneer het gebeurde, ook de ingetrokken regel');
  const weg = a.body.feiten.find(f => f.wat.startsWith('Mentor'));
  assert.equal(weg.ingetrokken, true);
  assert.deepEqual({ door: weg.intrekking.door, reden: weg.intrekking.reden }, { door: 'het lid', reden: 'Het waren er drie' },
    'een lezer buiten RTG kan niet doorvragen, dus de reden reist mee');
  assert.equal(a.body.feiten.find(f => f.wat.startsWith('Kok')).intrekking, null);
  assert.ok(a.body.nietZegt.some(z => /niet ondertekend/i.test(z)), 'het afschrift doet zich niet voor als bewijs');
  const tekst = JSON.stringify(a.body);
  assert.equal(tekst.includes('Regel van een ander'), false, 'het lichaam kan geen ander ledger aanwijzen');
  assert.equal(tekst.includes(deel.body.code), false, 'een deelcode is een sleutel en hoort niet in het afschrift');
  assert.equal(/"(totaal|score|niveau)"/.test(tekst), false, 'geen samengesteld getal over een mens (CAR-05)');

  const nogEens = await post('/api/carriere/ledger/afschrift', {}, lid.token);
  assert.equal(JSON.stringify(nogEens.body), JSON.stringify(a.body),
    'een lezing: twee keer vragen geeft byte voor byte hetzelfde (het mutatiecontract noemt hem lezend)');

  const leeg = await post('/api/carriere/ledger/afschrift', {}, (await post('/api/auth/register', { name: 'Mee Drie',
    email: 'mee3@x.nl', phone: '0612348103', password: 'geheim12345', geboortedatum: '1992-02-02', tier: 'rtg' })).body.token);
  assert.equal(leeg.status, 200);
  assert.deepEqual(leeg.body.feiten, [], 'een leeg ledger is een leeg afschrift, geen fout');
});

test('2. Mijn werk: een afgelopen dienstverband staat in `eerder` en niet meer als werkplek', async () => {
  const ent = (await post('/api/concern/entiteit/nieuw', { naam: 'Brisa Horeca BV', land: 'NL' }, eigLid)).body;
  assert.ok(ent.ok, JSON.stringify(ent).slice(0, 200));
  const entId = ent.entiteit.id;
  const uit = (await post('/api/concern/uitnodigen', { entiteit: entId, rol: 'Kok', van: '2025-01-01' }, eigLid)).body;
  assert.ok(uit.code, JSON.stringify(uit).slice(0, 200));
  assert.equal((await post('/api/concern/uitnodiging/accepteer', { code: uit.code }, lid.token)).status, 200);

  const voor = (await post('/api/concern/mijnwerk', {}, lid.token)).body;
  assert.deepEqual(voor.werkplekken.map(w => w.rol), ['Kok']);
  assert.deepEqual(voor.eerder, [], 'wat loopt, staat niet bij eerder');

  const gisteren = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const r = await post('/api/concern/mens/uitdienst', { employment: voor.werkplekken[0].employment, per: gisteren }, eigLid);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));

  const na = (await post('/api/concern/mijnwerk', {}, lid.token)).body;
  assert.deepEqual(na.werkplekken, [], 'een afgelopen dienstverband is geen werkplek meer');
  assert.deepEqual(na.eerder.map(w => [w.rol, w.bedrijf, w.van, w.tot]), [['Kok', 'Brisa Horeca BV', '2025-01-01', gisteren]],
    'maar het blijft een feit van de mens');
  assert.match(na.regel, /nog geen werkplek/);
  assert.deepEqual((await post('/api/concern/mijnwerk', {}, ander.token)).body.eerder, [], 'een ander lid ziet dit niet');
});
