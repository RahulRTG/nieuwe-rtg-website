/* DE ANKERDIENST OP EEN ECHTE SERVER.

   test/ankerdienst.test.js toetst de regels; dit toetst dat de dienst ook
   werkelijk aan de journalen hangt die er in productie zijn. Dat verschil is
   niet academisch: de dienst leest db.data rechtstreeks, en een journaal dat
   onder een andere naam wordt bewaard dan hij verwacht, levert stil een leeg
   punt op -- en een blok met lege punten ankert niets.

   Draai los: node --experimental-sqlite --test test/ankerdienst-echt.test.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs'), os = require('os'), path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-anker-'));
let srv, base, tok;

const api = (pad, body, t) => fetch(base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, t ? { Authorization: 'Bearer ' + t } : {}),
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  tok = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(tok, 'ingelogd');
  // wat verkeer, zodat er echte journaalregels zijn om te ankeren
  for (let i = 0; i < 3; i++) await api('/api/concern/nieuw', { naam: 'Ankerconcern ' + i }, tok);
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('de dienst staat op NIET IN BEDRIJF tot er een blok naar buiten is', async () => {
  const r = await api('/api/office/anker', {}, tok);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.inBedrijf, false,
    'zolang niemand het blok wegzet, bewijst deze laag niets over kopafknipping -- en dat hoort hij te zeggen');
  assert.match(r.body.uitleg, /gescheiden/i);
});

test('het blok draagt echte koppen van de echte journalen', async () => {
  const r = await api('/api/office/anker', {}, tok);
  const b = r.body.blok;
  assert.ok(b && b.zegel, 'een zegel over het geheel');
  for (const naam of ['inzageLog', 'securityLog', 'handelingLog', 'livingLabAudit', 'ledenBoardLog']) {
    assert.ok(naam in b.punten, naam + ' hoort in het blok te staan');
  }
  /* HARD: er MOET verkeer geweest zijn, anders toetst de rest hol. Het
     handelingsspoor heeft zojuist drie concerns zien langskomen. */
  assert.ok(b.punten.handelingLog && b.punten.handelingLog.nr > 0,
    'het handelingsspoor hoort een echte kop te hebben, kreeg ' + JSON.stringify(b.punten.handelingLog));
  assert.ok(b.punten.securityLog && b.punten.securityLog.nr > 0, 'en het inlog-auditlog ook');
});

test('een teruggevoerd blok rekent af, en doorgroeien is geen afknipping', async () => {
  const buiten = (await api('/api/office/anker', {}, tok)).body.blok;
  await api('/api/concern/nieuw', { naam: 'Na het anker' }, tok);   // journaal groeit door

  const r = await api('/api/office/anker/reken', { blok: buiten }, tok);
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true, 'doorgroeien is normaal en geen bevinding');
  assert.equal(r.body.ingekort.length, 0);

  const s = await api('/api/office/anker', { blok: buiten }, tok);
  assert.equal(s.body.inBedrijf, true, 'met een blok erbij staat de dienst wel in bedrijf');
});

test('zonder blok weigert de rekenroute netjes', async () => {
  const r = await api('/api/office/anker/reken', {}, tok);
  assert.equal(r.status, 400);
});

test('het anker is niet publiek', async () => {
  const r = await api('/api/office/anker', {}, null);
  assert.equal(r.status, 401, 'de koppen van alle auditjournalen zijn geen publiek gegeven');
});
