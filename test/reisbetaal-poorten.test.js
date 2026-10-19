/* De poorten op /api/reisbureau/betaal (server/routes/member/winkel.js).

   Eigenaarsbesluit van 19 oktober 2026: een reis laten boeken en betalen via
   het RTG-reisbureau mag elk account, mits gekeurd met de paspoortpoort, net als
   opladen. Dat vervangt "Alleen voor leden" (tier guest). De route verplaatst
   geld (de reissom uit de wallet naar rtg:reisbureau) en had geen paspoortpoort.

   Hier: een ongekeurd gratis account betaalt niets en krijgt de paspoortweg; een
   gekeurd gratis account betaalt de bevestigde reis precies een keer; een
   bezoeker zonder account komt er niet in. De bezitspoort op deze route
   (kern/identiteit/bezitspaden.js) is van Toegang en wordt daar bewezen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const bank = require('../server/betaal/synthetisch');
const { startServer, stop, keurLidGoed, kantoorAlsPersoon } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reisbetaal-poorten-'));
const CODE = 'RTG-OFFICE';
let srv, kantoor;
const api = (pad, body, token) => fetch(srv.base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {}) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

let teller = 0;
async function gratisAccount() {
  const u = String(Date.now()).slice(-7) + (teller++);
  const r = await api('/api/auth/register', { name: 'Reiziger', email: 'reispoort' + u + '@voorbeeld.nl', phone: '06' + u.padStart(8, '0').slice(-8),
    password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'guest' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.state.user.tier, 'guest');
  return { token: r.body.token, codenaam: r.body.state.user.codename };
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
/* een bevestigde reis met samenstelling (ibiza-jetset, 2200 euro: test/reisherkomst.test.js 13) */
async function bevestigdeReis(lid) {
  const a = await api('/api/reisbureau/boek', { tripId: 'ibiza-jetset', personen: 1 }, lid.token);
  assert.equal(a.status, 200, JSON.stringify(a.body));
  const ref = a.body.aanvraag.ref;
  const b = await api('/api/office/reisbureau/besluit', { ref, besluit: 'bevestigd', bericht: 'Bevestigd.' }, kantoor);
  assert.equal(b.body.aanvraag.status, 'bevestigd', JSON.stringify(b.body));
  return ref;
}
const saldo = async (lid) => (await api('/api/pay/overzicht', {}, lid.token)).body.saldo;

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_SIMULATIEBANK: '1', OFFICE_CODE: CODE } });
  kantoor = await kantoorAlsPersoon(srv.base, CODE);
  assert.ok(kantoor);
});
test.after(async () => { await stop(srv); });

test('een ongekeurd gratis account betaalt geen reis en krijgt de paspoortweg', async () => {
  const A = await gratisAccount();
  const ref = await bevestigdeReis(A);
  const r = await api('/api/reisbureau/betaal', { ref }, A.token);
  assert.equal(r.status, 403, JSON.stringify(r.body));
  assert.equal(r.body.kyc, true, 'de app gaat naar de paspoortstap');
  const mijn = (await api('/api/reisbureau/mijn', {}, A.token)).body;
  assert.ok(!JSON.stringify(mijn).includes('"betaald":{'), 'de reis heet niet betaald');
});

test('een gekeurd gratis account betaalt de bevestigde reis precies een keer', async () => {
  const A = await gratisAccount();
  await keurLidGoed(srv.base, A.token, A.codenaam);
  for (let i = 0; i < 5; i++) assert.equal((await api('/api/pay/oplaad', { centen: 50000, idem: betaaldeIdem(A.codenaam, 'r' + i + '-') }, A.token)).status, 200);
  const ref = await bevestigdeReis(A);
  const voor = await saldo(A);
  const r = await api('/api/reisbureau/betaal', { ref }, A.token);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.betaling.centen, 220000);
  assert.equal(await saldo(A), voor - 220000);
  const weer = await api('/api/reisbureau/betaal', { ref }, A.token);
  assert.equal(weer.body.alBetaald, true);
  assert.equal(await saldo(A), voor - 220000, 'een tweede tik boekt niets');
});

test('een bezoeker zonder account komt er niet in', async () => {
  const gast = await api('/api/login', { tier: 'guest' });
  const r = await api('/api/reisbureau/betaal', { ref: 'RTG-R-NIET' }, gast.body.token);
  assert.equal(r.status, 403, JSON.stringify(r.body));
  assert.match(r.body.error, /account/i);
});
