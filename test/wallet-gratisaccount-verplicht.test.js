/* De wallet van een gratis account in de productiestand van de bezitspoort
   (RTG_BEZITSBEWIJS=verplicht), met een gebonden toestel.

   test/wallet-gratisaccount.test.js draait, zoals de meeste toetsen, met de
   bezitspoort op 'aanbevolen' (test/helper.js). In productie staat hij op
   'verplicht': /api/pay/ en /api/wallet/ vragen dan een ondertekend
   bezitsbewijs van een toestel dat aan de sessie gebonden is
   (server/kern/identiteit/bezitspaden.js). Een gratis account kon tot 19
   oktober 2026 geen toestel binden (eisLid op /api/mijn/toestel/*), en dan was
   de wallet voor hem in productie dicht, wat de routes ook zeiden. Toegang
   maakte er eisAccount van; deze toets loopt de weg in die stand na: binden,
   ondertekend opladen, het saldo zien, de RTG Wallet openen en geld sturen --
   en zonder bewijs geen geld. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const bank = require('../server/betaal/synthetisch');
const { startServer, stop, keurLidGoed } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wallet-verplicht-'));
let srv;
const post = (pad, body, token, kop) => fetch(srv.base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}, kop || {}),
  body: JSON.stringify(body || {}) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

let teller = 0;
async function gekeurdGratisAccount() {
  const u = String(Date.now()).slice(-7) + (teller++);
  const r = await post('/api/auth/register', { name: 'Gratis', email: 'verplicht' + u + '@voorbeeld.nl', phone: '06' + u.padStart(8, '0').slice(-8),
    password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'guest' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.state.user.tier, 'guest');
  await keurLidGoed(srv.base, r.body.token, r.body.state.user.codename);
  return { token: r.body.token, codenaam: r.body.state.user.codename };
}

/* een toestel binden zoals de browser het doet (public/shared/toestelsleutel.js):
   een niet-exporteerbare P-256-sleutel, de uitdaging ondertekend */
async function bind(lid) {
  const { webcrypto } = crypto;
  const kp = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const jwk = await webcrypto.subtle.exportKey('jwk', kp.publicKey);
  const teken = async (t) => Buffer.from(await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' },
    kp.privateKey, Buffer.from(t, 'utf8'))).toString('base64url');
  const u = await post('/api/mijn/toestel/uitdaging', {}, lid.token);
  assert.equal(u.status, 200, 'een gratis account krijgt een uitdaging: ' + JSON.stringify(u.body));
  const b = await post('/api/mijn/toestel/bind', { jwk, handtekening: await teken(u.body.nonce), naam: 'Proeftoestel' }, lid.token);
  assert.equal(b.status, 200, 'en bindt zijn toestel: ' + JSON.stringify(b.body));
  return async (pad, body) => {
    const kop = Buffer.from(JSON.stringify({ methode: 'POST', pad, tijd: Date.now(),
      jti: 'w' + crypto.randomBytes(12).toString('base64url').replace(/[^A-Za-z0-9_-]/g, 'x') })).toString('base64url');
    return post(pad, body, lid.token, { 'rtg-bezitsbewijs': kop + '.' + await teken(kop) });
  };
}
function betaaldeIdem(codenaam, merk) {
  const b = bank({ crypto, env: { RTG_SIMULATIEBANK: '1' } });
  for (let i = 0; i < 2000; i++) {
    const idem = merk + i;
    const id = 'BW-' + crypto.createHash('sha256').update('pay:' + codenaam + '|' + 'pay-oplaad:' + codenaam + ':' + idem)
      .digest('hex').slice(0, 20).toUpperCase();
    if (b.scenarioVan({ idempotentieSleutel: 'waarheid:' + id }) === 'betaald') return idem;
  }
  throw new Error('geen sleutel');
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_SIMULATIEBANK: '1', RTG_BEZITSBEWIJS: 'verplicht' } });
});
test.after(async () => { await stop(srv); });

test('verplicht: een gratis account bindt zijn toestel, laadt ondertekend op, ziet zijn saldo en zijn RTG Wallet, en stuurt geld', async () => {
  const A = await gekeurdGratisAccount();
  const B = await gekeurdGratisAccount();

  const ongebonden = await post('/api/pay/oplaad', { centen: 2500, idem: betaaldeIdem(A.codenaam, 'o') }, A.token);
  assert.equal(ongebonden.status, 403, 'zonder gebonden toestel geen geld: ' + JSON.stringify(ongebonden.body));

  const tekenA = await bind(A);
  const op = await tekenA('/api/pay/oplaad', { centen: 2500, idem: betaaldeIdem(A.codenaam, 'a') });
  assert.equal(op.status, 200, JSON.stringify(op.body));
  const o = await tekenA('/api/pay/overzicht', {});
  assert.equal(o.status, 200, JSON.stringify(o.body));
  assert.equal(o.body.saldo, 2500);
  assert.equal((await tekenA('/api/wallet', {})).status, 200, 'de RTG Wallet opent');

  const st = await tekenA('/api/pay/stuur', { aan: B.codenaam, centen: 1000, oms: 'proef', idem: 'v1' });
  assert.equal(st.status, 200, JSON.stringify(st.body));
  const tekenB = await bind(B);
  assert.equal((await tekenB('/api/pay/overzicht', {})).body.saldo, 1000);

  const onbewezen = await post('/api/pay/stuur', { aan: B.codenaam, centen: 100, idem: 'v2' }, A.token);
  /* een gebonden sessie zonder bewijs: 401 ("vraagt een bezitsbewijs"), kern/identiteit/bezitsbewijs.js */
  assert.equal(onbewezen.status, 401, 'ook na het binden: zonder bewijs geen geld (' + JSON.stringify(onbewezen.body) + ')');
  assert.equal((await tekenA('/api/pay/overzicht', {})).body.saldo, 1500, 'er ging niets extra af');
});
