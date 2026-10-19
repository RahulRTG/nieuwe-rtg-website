/* Het tegoed en de terugstorting staan open voor elk account, ook een gratis
   account (server/routes/pay-tegoed.js, server/routes/pay-terug.js).

   Eigenaarsbesluit van 19 oktober 2026 (vierde reeks): wie geld kan inleggen,
   moet het ook terug kunnen halen. Tot dit besluit waren het tegoed en de
   terugstorting naar het eigen IBAN "voor leden" (geenGast), terwijl een gratis
   account wel mocht opladen. Nu vragen ze een account, met dezelfde
   paspoortpoort als elk ander geldmoment. Terugstorten gaat alleen naar de
   eigen, gekeurde rekening, en de bestaande regels daarvoor blijven: de
   rekening hangt aan de sessie, een wijziging wacht, alleen het beschikbare
   deel, en de vrijgavepoort (B3) staat hier als vastgelegd besluit open, zoals
   in test/payterug.test.js. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const bank = require('../server/betaal/synthetisch');
const { startServer, stop, keurLidGoed } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tegoedterug-gratis-'));
const IBAN_A = 'NL91ABNA0417164300';
const IBAN_B = 'DE89370400440532013000';
let srv;
const api = (pad, body, token) => fetch(srv.base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {}) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

let teller = 0;
async function gratisAccount(gekeurd) {
  const u = String(Date.now()).slice(-7) + (teller++);
  const r = await api('/api/auth/register', { name: 'Gratis', email: 'tegoed' + u + '@voorbeeld.nl', phone: '06' + u.padStart(8, '0').slice(-8),
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
/* een terugstortsleutel waarmee de simulatieve uitbetaalrail betaalt (test/simulatie-uitbetaling.test.js) */
function uitbetaaldeIdem(codenaam, merk) {
  const b = bank({ crypto, env: { RTG_SIMULATIEBANK: '1' } });
  for (let i = 0; i < 2000; i++) {
    const idem = merk + i;
    if (b.scenarioVan({ idempotentieSleutel: 'uit:pay-terug:' + codenaam + ':' + idem }) === 'betaald') return idem;
  }
  throw new Error('geen sleutel');
}
const saldo = async (lid) => (await api('/api/pay/overzicht', {}, lid.token)).body.saldo;

test.before(async () => {
  require('../scripts/lib/proefvrijgave').standMetBesluiten(TMP, ['emoney.b3']);
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_SIMULATIEBANK: '1' } });
});
test.after(async () => { await stop(srv); });

test('een gekeurd gratis account ziet zijn tegoed en stort terug naar zijn eigen rekening', async () => {
  const A = await gratisAccount();
  assert.equal((await api('/api/pay/oplaad', { centen: 3000, idem: betaaldeIdem(A.codenaam, 'a') }, A.token)).status, 200);
  const tegoed = await api('/api/pay/tegoed', {}, A.token);
  assert.equal(tegoed.status, 200, JSON.stringify(tegoed.body));

  const rek = await api('/api/pay/rekening', { iban: IBAN_A, naam: 'A. Gratis' }, A.token);
  assert.equal(rek.status, 200, JSON.stringify(rek.body));
  const stand = await api('/api/pay/terugstand', {}, A.token);
  assert.equal(stand.status, 200, JSON.stringify(stand.body));
  assert.equal(stand.body.kan, true, JSON.stringify(stand.body));

  const idem = uitbetaaldeIdem(A.codenaam, 'ta');
  const t = await api('/api/pay/terug', { centen: 1000, idem }, A.token);
  assert.equal(t.status, 200, JSON.stringify(t.body));
  assert.equal(t.body.teruggestort, 1000);
  assert.equal(await saldo(A), 2000, 'precies een keer af');
  assert.equal((await api('/api/pay/terug', { centen: 1000, idem }, A.token)).body.herhaald, true);
  assert.equal(await saldo(A), 2000);
});

test('een ongekeurd gratis account krijgt de paspoortweg, voor het tegoed en voor terugstorten', async () => {
  const A = await gratisAccount(false);
  for (const pad of ['/api/pay/tegoed/koop', '/api/pay/rekening', '/api/pay/terugstand', '/api/pay/terug']) {
    const r = await api(pad, { centen: 100, iban: IBAN_A, naam: 'A', idem: 'u' }, A.token);
    assert.equal(r.status, 403, pad + ': ' + JSON.stringify(r.body));
    assert.equal(r.body.kyc, true, pad);
  }
  const gast = await api('/api/login', { tier: 'guest' });
  for (const pad of ['/api/pay/tegoed', '/api/pay/terug']) {
    const r = await api(pad, { centen: 100, idem: 'g' }, gast.body.token);
    assert.equal(r.status, 403, 'zonder account: ' + pad);
  }
});

test('A stort niet terug van de rekening van B, en ziet de rekening van B niet', async () => {
  const A = await gratisAccount();
  const B = await gratisAccount();
  assert.equal((await api('/api/pay/oplaad', { centen: 2500, idem: betaaldeIdem(B.codenaam, 'b') }, B.token)).status, 200);
  assert.equal((await api('/api/pay/rekening', { iban: IBAN_B, naam: 'B. Gratis' }, B.token)).status, 200);
  assert.equal((await api('/api/pay/rekening', { iban: IBAN_A, naam: 'A. Gratis' }, A.token)).status, 200);

  /* een meegegeven codenaam of gebruiker verandert niets: A stort van A, en A heeft niets */
  const r = await api('/api/pay/terug', { centen: 1000, idem: 'ab1', codenaam: B.codenaam, userId: 1 }, A.token);
  assert.notEqual(r.status, 200, JSON.stringify(r.body));
  assert.equal(await saldo(B), 2500, 'het saldo van B is onaangeroerd');
  const standA = JSON.stringify((await api('/api/pay/terugstand', { codenaam: B.codenaam }, A.token)).body);
  assert.ok(!standA.includes('DE •') && !standA.includes('3000'), 'A ziet de rekening van B niet: ' + standA);
  assert.ok(standA.includes('NL •'), 'A ziet zijn eigen, gemaskeerde rekening');
});
