/* De paspoortpoort op de ledenroutes die de eigen wallet belasten.

   Eigenaarsbesluit van 19 oktober 2026: elk geldmoment van een account vraagt
   eenmalig het paspoort (kern/onboarding payGate); de Lifestyle- en Business
   Pass zijn vrij. Toegang mat ongeveer twintig ledenroutes die geld uit de
   wallet halen zonder die poort (de bezitspoort op dezelfde routes is van
   Toegang, kern/identiteit/bezitspaden.js). Hier per route: een ongekeurd lid
   krijgt 403 met kyc:true voordat er iets gebeurt, en een gekeurd lid komt
   langs de poort (wat de route daarna van zijn lijf vindt, is zijn eigen zaak).
   /api/vonk/betaal staat er niet in: Vonk vraagt al een geverifieerd paspoort
   voor elke stap, strenger dan deze poort. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, keurLidGoed } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ledengeld-poort-'));
let srv;
const api = (pad, body, token) => fetch(srv.base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {}) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

const ROUTES = [
  '/api/betaal/direct', '/api/betaal/verzoek/pay',
  '/api/order/pay', '/api/rekening/betaal', '/api/ride/pay', '/api/giftcard/buy',
  '/api/ov/uit', '/api/pakket/koop', '/api/mob/kaart/koop', '/api/mob/abo/koop',
  '/api/podium/cadeau', '/api/podium/abonneer', '/api/podium/kaartje', '/api/podium/koop',
  '/api/rtfos/winkel/koop', '/api/rtfos/gift/bevestig'
];

let teller = 0;
async function lid() {
  const u = String(Date.now()).slice(-7) + (teller++);
  const r = await api('/api/auth/register', { name: 'Betaler', email: 'ledengeld' + u + '@voorbeeld.nl', phone: '06' + u.padStart(8, '0').slice(-8),
    password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg', pasApp: 'rtg' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return { token: r.body.token, codenaam: r.body.state.user.codename };
}

test.before(async () => { srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_SIMULATIEBANK: '1', OFFICE_CODE: 'RTG-OFFICE' } }); });
test.after(async () => { await stop(srv); });

test('een ongekeurd lid betaalt op geen van deze routes en krijgt de paspoortweg', async () => {
  const A = await lid();
  const fout = [];
  for (const pad of ROUTES) {
    const r = await api(pad, { idem: 'p-' + pad }, A.token);
    if (r.status !== 403 || !r.body || r.body.kyc !== true) fout.push(pad + ' -> ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 90));
  }
  assert.deepEqual(fout, [], 'zonder paspoortpoort');
});

test('een gekeurd lid komt op elke route langs de poort', async () => {
  const A = await lid();
  await keurLidGoed(srv.base, A.token, A.codenaam);
  for (const pad of ROUTES) {
    const r = await api(pad, { idem: 'g-' + pad }, A.token);
    assert.ok(!(r.body && r.body.kyc === true), pad + ' vraagt na de keuring nog het paspoort');
  }
});
