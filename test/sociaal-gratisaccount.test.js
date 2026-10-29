/* De sociale kant van de wallet staat open voor elk account, ook een gratis
   account (server/routes/pay.js, server/routes/pay-tegoed.js).

   Eigenaarsbesluit van 19 oktober 2026 (derde reeks): geld sturen,
   betaalverzoeken en tikken waren "voor leden" (geenGast). Sinds de
   paspoortpoort voor elk account geldt (test/paspoort-gratisaccount.test.js),
   heeft een account met geld altijd zijn paspoort laten zien, en valt die grond
   weg. De grenzen eronder blijven: plafond, grens per boeking, eigen limieten
   en blokkades, en de paspoortpoort op elk geldmoment.

   En de bevoegdheidskant: de afzender komt uit de sessie, nooit uit de body --
   A stuurt niet namens B en ziet, betaalt of trekt de verzoeken van B niet in.
   Hier met de simulatiebank als rail en gekeurde gratis accounts. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const bank = require('../server/betaal/synthetisch');
const { startServer, stop, keurLidGoed } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sociaal-gratis-'));
let srv;
const api = (pad, body, token) => fetch(srv.base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {}) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

let teller = 0;
async function gratisAccount(gekeurd) {
  const u = String(Date.now()).slice(-7) + (teller++);
  const r = await api('/api/auth/register', { name: 'Gratis', email: 'sociaal' + u + '@voorbeeld.nl', phone: '06' + u.padStart(8, '0').slice(-8),
    password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'guest' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const lid = { token: r.body.token, codenaam: r.body.state.user.codename };
  if (gekeurd !== false) await keurLidGoed(srv.base, lid.token, lid.codenaam);
  return lid;
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
const saldo = async (lid) => (await api('/api/pay/overzicht', {}, lid.token)).body.saldo;

test.before(async () => { srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_SIMULATIEBANK: '1' } }); });
test.after(async () => { await stop(srv); });

test('een gratis account stuurt geld, vraagt een Klompje, betaalt er een en tikt', async () => {
  const A = await gratisAccount();
  const B = await gratisAccount();
  assert.equal((await api('/api/pay/oplaad', { centen: 3000, idem: betaaldeIdem(A.codenaam, 'a') }, A.token)).status, 200);

  const st = await api('/api/pay/stuur', { aan: B.codenaam, centen: 1000, oms: 'lunch', idem: 's1' }, A.token);
  assert.equal(st.status, 200, JSON.stringify(st.body));
  assert.equal(await saldo(A), 2000);
  assert.equal(await saldo(B), 1000);

  const vz = await api('/api/pay/verzoek', { aan: [A.codenaam], totaalCenten: 500, oms: 'koffie', idem: 'v1' }, B.token);
  assert.equal(vz.status, 200, JSON.stringify(vz.body));
  const open = (await api('/api/pay/overzicht', {}, A.token)).body.aanMij;
  assert.equal(open.length, 1);
  const bt = await api('/api/pay/verzoek/betaal', { id: open[0].id, idem: 'vb1' }, A.token);
  assert.equal(bt.status, 200, JSON.stringify(bt.body));
  assert.equal(await saldo(B), 1500);

  const code = await api('/api/pay/tikcode', { idem: 't1' }, B.token);
  assert.equal(code.status, 200, JSON.stringify(code.body));
  assert.equal((await api('/api/pay/tiks', {}, B.token)).status, 200);
  assert.equal((await api('/api/pay/tikcode/intrek', {}, B.token)).status, 200);
});

test('A stuurt niet namens B en ziet, betaalt of trekt de verzoeken van B niet in', async () => {
  const A = await gratisAccount();
  const B = await gratisAccount();
  const C = await gratisAccount();
  assert.equal((await api('/api/pay/oplaad', { centen: 2000, idem: betaaldeIdem(B.codenaam, 'b') }, B.token)).status, 200);

  /* een meegegeven afzender verandert niets: de afzender is de sessie, en A heeft niets */
  const namens = await api('/api/pay/stuur', { van: B.codenaam, aan: A.codenaam, centen: 700, idem: 'n1' }, A.token);
  assert.notEqual(namens.status, 200, 'A kan geen geld van B laten gaan: ' + JSON.stringify(namens.body));
  assert.equal(await saldo(B), 2000, 'het saldo van B is onaangeroerd');

  const vz = await api('/api/pay/verzoek', { aan: [C.codenaam], totaalCenten: 400, oms: 'van B aan C', idem: 'bv1' }, B.token);
  assert.equal(vz.status, 200, JSON.stringify(vz.body));
  const vanB = (await api('/api/pay/overzicht', {}, B.token)).body.vanMij[0];
  const zichtA = JSON.stringify((await api('/api/pay/overzicht', {}, A.token)).body);
  assert.ok(!zichtA.includes(vanB.id) && !zichtA.includes('van B aan C'), 'A ziet het verzoek van B niet');
  assert.equal((await api('/api/pay/verzoek/betaal', { id: vanB.id, idem: 'ab1' }, A.token)).status, 404, 'A betaalt het niet');
  assert.equal((await api('/api/pay/verzoek/intrek', { id: vanB.id }, A.token)).status, 404, 'A trekt het niet in');
  assert.equal((await api('/api/pay/overzicht', {}, B.token)).body.vanMij[0].status, 'open');
});

test('de grenzen blijven: een ongekeurd account stuurt niets, een bezoeker zonder account komt er niet in', async () => {
  const A = await gratisAccount(false);
  const B = await gratisAccount();
  const st = await api('/api/pay/stuur', { aan: B.codenaam, centen: 100, idem: 'u1' }, A.token);
  assert.equal(st.status, 403, JSON.stringify(st.body));
  assert.equal(st.body.kyc, true);
  const gast = await api('/api/login', { tier: 'guest' });
  for (const pad of ['/api/pay/stuur', '/api/pay/verzoek', '/api/pay/tikcode', '/api/pay/tik']) {
    const r = await api(pad, { aan: B.codenaam, centen: 100, idem: 'g' }, gast.body.token);
    assert.equal(r.status, 403, pad + ': ' + JSON.stringify(r.body));
  }
});
