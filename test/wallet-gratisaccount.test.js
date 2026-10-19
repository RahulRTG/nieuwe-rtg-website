/* De wallet staat open voor elk account, ook een gratis account
   (server/routes/pay.js, server/routes/zorgwallet.js).

   Eigenaarsbesluit van 19 oktober 2026: gebruiken vraagt minimaal een gratis
   account, en de wallet hoort daarbij -- opladen, het overzicht en betalen.
   Voor dit besluit kon een gratis account wel opladen en bij een zaak betalen
   (de kassacode), maar zijn eigen saldo niet zien: /api/pay/overzicht en
   /api/wallet zeiden "voor leden". Geld dat je hebt maar niet kunt zien, is
   het slechtste van twee werelden.

   Wat blijft: een bezoeker zonder account heeft geen wallet, en elk account
   ziet alleen zijn eigen wallet. De grenzen eronder (het plafond per wallet,
   de betaalwaarheid, de bezitspoort, de paspoortpoort) zijn niet aangeraakt;
   de accounts hier zijn daarom gekeurd. Hier met de simulatiebank als rail. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const bank = require('../server/betaal/synthetisch');
const { startServer, stop, keurLidGoed } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wallet-gratis-'));
let srv;
const api = (pad, body, token) => fetch(srv.base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {}) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

let teller = 0;
async function gratisAccount() {
  const u = String(Date.now()).slice(-7) + (teller++);
  const r = await api('/api/auth/register', { name: 'Gratis', email: 'gratis' + u + '@voorbeeld.nl', phone: '06' + u.padStart(8, '0').slice(-8),
    password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'guest' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.state.user.tier, 'guest', 'een gratis account, zonder pas');
  /* gekeurd: RTG Pay vraagt elk account eenmalig het paspoort
     (test/paspoort-gratisaccount.test.js, besluit 19 oktober 2026) */
  await keurLidGoed(srv.base, r.body.token, r.body.state.user.codename);
  return { token: r.body.token, codenaam: r.body.state.user.codename };
}
/* een idem-sleutel waarmee de simulatiebank betaalt (zie test/simulatiebank.test.js toets 7) */
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

test.before(async () => { srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_SIMULATIEBANK: '1' } }); });
test.after(async () => { await stop(srv); });

test('een gratis account laadt op met de simulatiebank en ziet zijn saldo', async () => {
  const A = await gratisAccount();
  const op = await api('/api/pay/oplaad', { centen: 2500, idem: betaaldeIdem(A.codenaam, 'g') }, A.token);
  assert.equal(op.status, 200, JSON.stringify(op.body));
  const o = await api('/api/pay/overzicht', {}, A.token);
  assert.equal(o.status, 200, JSON.stringify(o.body));
  assert.equal(o.body.codenaam, A.codenaam);
  assert.equal(o.body.saldo, 2500);
});

test('een gratis account ziet zijn eigen RTG Wallet (passen en munten)', async () => {
  const A = await gratisAccount();
  const r = await api('/api/wallet', {}, A.token);
  assert.equal(r.status, 200, JSON.stringify(r.body));
});

test('een gratis account ziet nooit de wallet van een ander', async () => {
  const A = await gratisAccount();
  const B = await gratisAccount();
  await api('/api/pay/oplaad', { centen: 4100, idem: betaaldeIdem(A.codenaam, 'a') }, A.token);
  await api('/api/wallet/voeg', { soort: 'lidkaart', naam: 'Kaart van A ' + A.codenaam, nummer: '123' }, A.token);
  const o = await api('/api/pay/overzicht', { codenaam: A.codenaam }, B.token);
  assert.equal(o.status, 200);
  assert.equal(o.body.codenaam, B.codenaam, 'een meegegeven codenaam verandert niets: B ziet B');
  assert.equal(o.body.saldo, 0);
  const lijf = JSON.stringify(o.body) + JSON.stringify((await api('/api/wallet', { codenaam: A.codenaam }, B.token)).body);
  assert.ok(!lijf.includes(A.codenaam), 'niets van A in wat B ziet');
  assert.ok(!lijf.includes('4100') && !lijf.includes('41,00'), 'ook het bedrag van A niet');
});

test('een bezoeker zonder account heeft geen wallet', async () => {
  const gast = await api('/api/login', { tier: 'guest' });
  assert.equal(gast.status, 200, JSON.stringify(gast.body));
  for (const pad of ['/api/pay/overzicht', '/api/wallet', '/api/pay/oplaad']) {
    const r = await api(pad, { centen: 100, idem: 'x' }, gast.body.token);
    assert.equal(r.status, 403, pad + ': ' + JSON.stringify(r.body));
    assert.match(r.body.error, /account/i, pad);
  }
  assert.equal((await api('/api/pay/overzicht', {}, null)).status, 401, 'zonder inlog niets');
});
