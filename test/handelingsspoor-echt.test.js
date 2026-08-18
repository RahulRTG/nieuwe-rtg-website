/* HET HANDELINGSSPOOR OP EEN ECHTE SERVER.

   test/handelingsspoor.test.js toetst de regels; dit toetst dat hij ook echt in
   de keten hangt en dat er niets langs glipt. Dat verschil is niet academisch:
   de middleware wikkelt res.json en leest req.session, en die wordt pas door de
   auth-poortwachter gezet -- zit hij een plek verkeerd in de lijfpoort, dan
   slagen de losse toetsen nog steeds en staat er 'anoniem' in elk spoor.

   Draai los: node --experimental-sqlite --test test/handelingsspoor-echt.test.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs'), os = require('os'), path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-spoor-'));
let srv, base, lid, office;

const api = (pad, body, tok) => fetch(base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  lid = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  office = (await api('/api/account/start', { rol: 'kantoor' }, lid)).body.token || lid;
  assert.ok(lid, 'ingelogd');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('een echte schrijfactie landt in het spoor, met de sessiesleutel erbij', async () => {
  const r = await api('/api/concern/nieuw', { naam: 'Spoorconcern' }, lid);
  assert.ok(r.status >= 200 && r.status < 300, 'de handeling slaagde: ' + JSON.stringify(r.body));

  const uit = await api('/api/office/handelingen', { max: 50 }, office);
  assert.equal(uit.status, 200, JSON.stringify(uit.body));
  const raak = uit.body.regels.find(x => x.pad === '/api/concern/nieuw');
  assert.ok(raak, 'de handeling hoort in het spoor te staan');
  assert.match(raak.wie, /^user-/, 'met de pseudonieme sleutel, niet met een naam');
  assert.ok(raak.hash, 'geketend');
  assert.equal(uit.body.keten.ok, true, 'en de keten klopt');
});

test('DE BODY STAAT ER NIET IN, ook niet op een echte server', async () => {
  const geheim = 'ZeerGeheimeNaamDieNergensMagStaan';
  await api('/api/concern/nieuw', { naam: geheim }, lid);

  const uit = await api('/api/office/handelingen', { max: 200 }, office);
  assert.ok(!JSON.stringify(uit.body).includes(geheim),
    'de inhoud van een aanvraag hoort nooit in het handelingsspoor te belanden');
});

test('een lid ziet zijn eigen handelingen in de AVG-export, en de ketenstand erbij', async () => {
  await api('/api/concern/nieuw', { naam: 'Exportconcern' }, lid);
  const exp = await api('/api/privacy/export', {}, lid);
  assert.equal(exp.status, 200);
  assert.ok(exp.body.handelingen, 'de export draagt het handelingsspoor');
  assert.ok(exp.body.handelingen.totaal > 0, 'met de eigen regels erin');
  assert.ok(exp.body.handelingen.keten, 'en de ketenstand, zodat de betrokkene het kan narekenen');
  for (const r of exp.body.handelingen.regels) {
    assert.match(r.wie, /^user-/, 'alleen eigen regels, allemaal op een sleutel');
  }
});

test('een geweigerde handeling laat geen spoor na', async () => {
  const voor = (await api('/api/office/handelingen', { max: 500 }, office)).body.totaal;
  const weg = await api('/api/concern/nieuw', {}, lid);          // zonder naam: 400
  assert.ok(weg.status >= 400, 'deze hoort te weigeren, kreeg ' + weg.status);
  const na = (await api('/api/office/handelingen', { max: 500 }, office)).body.totaal;
  assert.equal(na, voor, 'een mislukte handeling verandert niets en hoort er dus niet in');
});

test('de bewaartermijn staat in het beleid, niet alleen in een document', () => {
  const { BELEID } = require('../server/bewaarbeleid');
  const tak = BELEID.find(x => x.tak === 'handelingLog');
  assert.ok(tak, 'zonder regel in het bewaarbeleid telt de bewaarwacht deze tak nooit');
  assert.equal(tak.grond, 'audit');
  assert.ok(tak.dagen >= 300 && tak.dagen <= 400, 'ongeveer een jaar, net als het beveiligingslogboek');
});
