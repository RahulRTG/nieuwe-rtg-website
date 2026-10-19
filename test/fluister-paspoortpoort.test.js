/* Een "ja" tegen Rahul op een geldvoorstel vraagt dezelfde paspoortpoort als de
   app-knop (server/kern/fluister/acties.js voerUit).

   Eigenaarsbesluit van 19 oktober 2026: elk geldmoment van een account vraagt
   eenmalig het paspoort (kern/onboarding payGate). Rahul doet zijn handelingen
   met dezelfde functies als de app-knoppen, maar komt NIET langs de routes --
   en daar staat de poort. Een ongekeurd lid kon dus via "stuur 5 euro naar ..."
   en "ja" een Tik doen die /api/pay/stuur hem weigert. Gemeld door Toegang. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const bank = require('../server/betaal/synthetisch');
const { startServer, stop, keurLidGoed } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-fluister-poort-'));
let srv;
const api = (pad, body, token) => fetch(srv.base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {}) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
let teller = 0;
async function lid() {
  const u = String(Date.now()).slice(-7) + (teller++);
  const r = await api('/api/auth/register', { name: 'Fluisteraar', email: 'fluisterpoort' + u + '@voorbeeld.nl', phone: '06' + u.padStart(8, '0').slice(-8),
    password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return { token: r.body.token, codenaam: r.body.state.user.codename };
}
function betaaldeIdem(codenaam, merk) {
  const b = bank({ crypto, env: { RTG_SIMULATIEBANK: '1' } });
  for (let i = 0; i < 2000; i++) {
    const idem = merk + i;
    const id = 'BW-' + crypto.createHash('sha256').update('pay:' + codenaam + '|' + 'pay-oplaad:' + codenaam + ':' + idem).digest('hex').slice(0, 20).toUpperCase();
    if (b.scenarioVan({ idempotentieSleutel: 'waarheid:' + id }) === 'betaald') return idem;
  }
  throw new Error('geen sleutel');
}
const saldo = async (l) => (await api('/api/pay/overzicht', {}, l.token)).body.saldo;
const zeg = async (l, q) => ((await api('/api/fluister', { q }, l.token)).body || {}).antwoord || '';

test.before(async () => { srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_SIMULATIEBANK: '1', RTG_AI_UIT: '1' } }); });
test.after(async () => { await stop(srv); });

test('een ongekeurd lid doet via Rahul geen Tik en hoort dat het paspoort nodig is; gekeurd wel', async () => {
  const B = await lid();
  await keurLidGoed(srv.base, B.token, B.codenaam);
  assert.equal((await api('/api/pay/oplaad', { centen: 3000, idem: betaaldeIdem(B.codenaam, 'f-') }, B.token)).status, 200);
  const A = await lid();
  await saldo(A);   // het overzicht opent A's wallet, zodat B hem kan vinden
  const st = await api('/api/pay/stuur', { aan: A.codenaam, centen: 1000, oms: 'proef', idem: 'fp-1' }, B.token);
  assert.equal(st.status, 200, JSON.stringify(st.body));
  assert.equal(await saldo(A), 1000, 'A heeft geld, maar geen paspoort');

  assert.match(await zeg(A, 'stuur 5 euro naar ' + B.codenaam), /Even checken/);
  const ja = await zeg(A, 'ja');
  assert.match(ja, /paspoort/i, 'Rahul zegt waarom het niet doorgaat: ' + ja);
  assert.equal(await saldo(A), 1000, 'er ging niets af');

  await keurLidGoed(srv.base, A.token, A.codenaam);
  assert.match(await zeg(A, 'stuur 5 euro naar ' + B.codenaam), /Even checken/);
  const nu = await zeg(A, 'ja');
  assert.match(nu, /Gedaan/, nu);
  assert.equal(await saldo(A), 500, 'na de keuring gaat de Tik door');
});
