/* /api/wallet/munt/koop en het id van een ander (server/kern/wallet.js muntKoop).

   De centrale IDOR-proef (scripts/idorproef.js) meldde een doorbraak: B kreeg
   200 met A's munt-id en -code, maar 409 met een verzonnen id. Deze toets loopt
   dat precies na. muntKoop leest `id` en `code` niet: B koopt munten voor zijn
   EIGEN wallet, bij een zaak die hij zelf noemt, betaald uit zijn EIGEN saldo.
   De 409 van de tegenpoging komt van de idem-laag van RTG Pay: de proef stuurt
   hetzelfde lijf met dezelfde sleutel en alleen een ander id, en een sleutel die
   al bij een ander verzoek hoort, wordt geweigerd. Dat is de toestand die B's
   eerste poging zette, en geen eigendom van A dat de deur opende -- dezelfde
   vorm als de achttien nagekeken routes in scripts/idorproef.js (NAGEKEKEN).

   Wat deze toets vastlegt, en wat bij een echte doorbraak zou zakken: A's munt,
   A's saldo en A's wallet veranderen niet; B's munten landen bij B; en met een
   verse sleutel geeft een verzonnen id hetzelfde antwoord als A's id. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const bank = require('../server/betaal/synthetisch');
const { startServer, stop, keurLidGoed } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-muntkoop-idor-'));
let srv;
const api = (pad, body, token) => fetch(srv.base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {}) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

let teller = 0;
async function gekeurd() {
  const u = String(Date.now()).slice(-7) + (teller++);
  const r = await api('/api/auth/register', { name: 'Proef', email: 'munt' + u + '@voorbeeld.nl', phone: '06' + u.padStart(8, '0').slice(-8),
    password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'guest' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  await keurLidGoed(srv.base, r.body.token, r.body.state.user.codename);
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
const munten = async (lid) => ((await api('/api/wallet', {}, lid.token)).body.items || []).filter((x) => x.soort === 'munt');
const saldo = async (lid) => (await api('/api/pay/overzicht', {}, lid.token)).body.saldo;

test.before(async () => { srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_SIMULATIEBANK: '1' } }); });
test.after(async () => { await stop(srv); });

test('B koopt munten met A\'s munt-id en -code: A blijft onaangeroerd, de munten zijn van B, en de 409 is B\'s eigen sleutel', async () => {
  const A = await gekeurd();
  const B = await gekeurd();
  assert.equal((await api('/api/pay/oplaad', { centen: 5000, idem: betaaldeIdem(A.codenaam, 'a') }, A.token)).status, 200);
  assert.equal((await api('/api/pay/oplaad', { centen: 5000, idem: betaaldeIdem(B.codenaam, 'b') }, B.token)).status, 200);
  assert.equal((await api('/api/wallet/munt/koop', { zaak: 'Feest A', aantal: 2, idem: 'a-munt' }, A.token)).status, 200);
  const [mA] = await munten(A);
  assert.ok(mA && mA.id && mA.code, 'A heeft een munt met id en code');
  const voorA = { saldo: await saldo(A), munt: JSON.stringify(mA) };

  /* zoals de proef: B noemt A's id en code */
  const r = await api('/api/wallet/munt/koop', { id: mA.id, code: mA.code, zaak: 'Feest A', aantal: 1, idem: 'b-munt' }, B.token);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.notEqual(r.body.item.id, mA.id, 'B kreeg een EIGEN munt, niet die van A');
  assert.equal(await saldo(A), voorA.saldo, 'A betaalde niets');
  assert.equal(JSON.stringify((await munten(A))[0]), voorA.munt, 'A\'s munt is onveranderd');
  assert.equal((await munten(B)).length, 1);
  assert.equal(await saldo(B), 5000 - 350, 'B betaalde zijn eigen munt');

  /* de tegenpoging van de proef: hetzelfde lijf, dezelfde sleutel, een verzonnen id */
  const tegen = await api('/api/wallet/munt/koop', { id: 'ZZ-verzonnen', code: 'ZZ-verzonnen', zaak: 'Feest A', aantal: 1, idem: 'b-munt' }, B.token);
  assert.equal(tegen.status, 409, 'dezelfde sleutel bij een ander verzoek: ' + JSON.stringify(tegen.body));
  assert.equal(tegen.body.code, 'IDEM_ANDER_VERZOEK', 'de idem-laag van RTG Pay, niet een eigendomscontrole');
  /* met een verse sleutel maakt het id niets uit: hetzelfde antwoord als met A's id */
  const vers = await api('/api/wallet/munt/koop', { id: 'ZZ-verzonnen', code: 'ZZ-verzonnen', zaak: 'Feest A', aantal: 1, idem: 'b-munt-2' }, B.token);
  assert.equal(vers.status, 200, JSON.stringify(vers.body));
  assert.equal(await saldo(A), voorA.saldo, 'en A betaalde nog steeds niets');
});

test('/voeg, /weg en /munt/wissel met A\'s id raken A niet', async () => {
  const A = await gekeurd();
  const B = await gekeurd();
  assert.equal((await api('/api/pay/oplaad', { centen: 2000, idem: betaaldeIdem(A.codenaam, 'c') }, A.token)).status, 200);
  assert.equal((await api('/api/wallet/munt/koop', { zaak: 'Feest C', aantal: 3, idem: 'c-munt' }, A.token)).status, 200);
  assert.equal((await api('/api/wallet/voeg', { soort: 'klantenkaart', titel: 'Kaart van A', code: 'A-123' }, A.token)).status, 200);
  const voor = JSON.stringify((await api('/api/wallet', {}, A.token)).body.items);
  const [mA] = await munten(A);
  const kaartA = (await api('/api/wallet', {}, A.token)).body.items.find((x) => x.titel === 'Kaart van A');

  assert.equal((await api('/api/wallet/munt/wissel', { id: mA.id, aantal: 1 }, B.token)).status, 404, 'wissel: niet van B');
  assert.equal((await api('/api/wallet/weg', { id: kaartA.id }, B.token)).status, 404, 'weg: niet van B');
  const v = await api('/api/wallet/voeg', { id: kaartA.id, soort: 'klantenkaart', titel: 'Kaart van B', code: 'B-1' }, B.token);
  assert.equal(v.status, 200, 'B voegt een EIGEN kaart toe');
  assert.equal(JSON.stringify((await api('/api/wallet', {}, A.token)).body.items), voor, 'A\'s wallet is onveranderd');
  assert.ok(!JSON.stringify((await api('/api/wallet', {}, B.token)).body).includes('Kaart van A'), 'B ziet niets van A');
});
