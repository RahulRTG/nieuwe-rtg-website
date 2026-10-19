'use strict';
/* EEN STORING IN DE KLUIS IS GEEN UITLOG (X1, integrator 19 oktober 2026).

   Kon de intreklijst of de kluis niet gelezen worden, dan werd een geldig,
   ondertekend en niet verlopen token `null`, en antwoordde `auth` met 401 "Niet
   ingelogd". Dicht was dat wel, maar de client las het als uitgelogd: hij wiste
   het token en stuurde het lid naar de inlog, terwijl er niets mis was met zijn
   sessie. Nu:
     - verifyToken blijft null geven (fail-closed, test/intreklijst-failclosed);
     - identiteitOnbepaald(token) zegt of een GELDIG ondertekend token alleen
       door een opslagstoring niet te controleren was;
     - auth antwoordt dan 503 IDENTITEIT_ONBEPAALD, en een rommeltoken blijft 401. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const S = require('../server/accounts/state');
const { startServer, stop } = require('./helper');

test('identiteitOnbepaald onderscheidt een opslagstoring van een ongeldig token', () => {
  const oudeZin = S.zin, oudeSecret = S.SECRET, oudeDb = S.db;
  S.SECRET = Buffer.alloc(32, 7);
  // een gezonde intreklijst: een lege, gemigreerde database (zoals test/intreklijst-failclosed)
  const db = new (require('node:sqlite').DatabaseSync)(':memory:');
  require('../server/migraties').draai(db); S.db = db;
  try {
    const tokens = require('../server/accounts/tokens').maakTokens(() => ({ id: 7, actief: 1 }));
    const echt = tokens.issueToken(7);
    assert.equal(tokens.identiteitOnbepaald(echt), false, 'gezonde opslag: niets onbepaald');
    S.zin = () => { throw new Error('intreklijst niet leesbaar'); };
    assert.equal(tokens.verifyToken(echt), null, 'fail-closed blijft');
    assert.equal(tokens.identiteitOnbepaald(echt), true, 'een geldig token dat alleen door de storing niet te controleren was');
    assert.equal(tokens.identiteitOnbepaald('rommel.token'), false, 'een rommeltoken is ongeldig, niet onbepaald');
    assert.equal(tokens.identiteitOnbepaald(echt.slice(0, -2) + 'xx'), false, 'een vervalste handtekening is ongeldig');
  } finally { S.zin = oudeZin; S.SECRET = oudeSecret; S.db = oudeDb; db.close(); }
});

test('een lid krijgt bij een onleesbare intreklijst 503, geen 401', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-idstoring-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_VERRAAD: 'intreklijst-onleesbaar' } });
  try {
    const post = (pad, body, tok) => fetch(srv.base + pad, { method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
      body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
    const u = Date.now().toString(36);
    const reg = await post('/api/auth/register', { name: 'Storing ' + u, email: u + '@x.nl', password: 'geheim123',
      geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
    assert.ok(reg.body.token, 'registreren schrijft het token uit zonder de intreklijst te lezen');
    const r = await post('/api/ik', {}, reg.body.token);
    assert.equal(r.status, 503, 'storing, geen uitlog: ' + JSON.stringify(r.body).slice(0, 160));
    assert.equal(r.body.code, 'IDENTITEIT_ONBEPAALD');
    assert.equal((await post('/api/ik', {}, 'rommel.token')).status, 401, 'een rommeltoken blijft 401');
  } finally { stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} }
});
