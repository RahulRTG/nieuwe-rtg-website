/* De paspoortpoort van RTG Pay geldt voor elk account (kern/onboarding/lid.js,
   payGate).

   payGate vroeg het paspoort alleen bij tier 'rtg': een gratis account (tier
   'guest') viel onder `if (tier !== 'rtg') return { ok: true }` en kon zonder
   paspoort opladen tot het walletplafond, terwijl routes/pay.js al beloofde
   "Een gratis lid dat RTG Pay gebruikt, laat eenmalig zijn paspoort zien".
   Eigenaarsbesluit van 19 oktober 2026 (derde reeks): de poort geldt voor elk
   account. Een betaalde Lifestyle- of Business Pass deed dat al bij de
   onboarding en blijft vrij. Hier met de simulatiebank als rail. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const bank = require('../server/betaal/synthetisch');
const { startServer, stop, keurLidGoed } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-paspoort-gratis-'));
let srv;
const api = (pad, body, token) => fetch(srv.base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {}) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

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

test('een ongekeurd gratis account laadt niet op en krijgt de paspoortweg; gekeurd wel', async () => {
  const u = String(Date.now()).slice(-8);
  const reg = await api('/api/auth/register', { name: 'Gratis', email: 'paspoort' + u + '@voorbeeld.nl', phone: '06' + u,
    password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'guest' });
  assert.equal(reg.status, 200, JSON.stringify(reg.body));
  const { token } = reg.body;
  const codenaam = reg.body.state.user.codename;

  const zonder = await api('/api/pay/oplaad', { centen: 2500, idem: betaaldeIdem(codenaam, 'z') }, token);
  assert.equal(zonder.status, 403, JSON.stringify(zonder.body));
  assert.equal(zonder.body.kyc, true, 'de app gaat naar de paspoortstap');
  assert.equal((await api('/api/pay/overzicht', {}, token)).body.saldo, 0, 'er is niets opgeladen');

  await keurLidGoed(srv.base, token, codenaam);
  const met = await api('/api/pay/oplaad', { centen: 2500, idem: betaaldeIdem(codenaam, 'm') }, token);
  assert.equal(met.status, 200, JSON.stringify(met.body));
  assert.equal((await api('/api/pay/overzicht', {}, token)).body.saldo, 2500);
});
