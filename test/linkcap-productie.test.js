/* DE RTG LINK-DRAGER OP EEN ECHTE SERVER (link.capability_aanvaarden, B15).

   1. Twee kassa's (twee zaken) scannen dezelfde geld.kassa-code tegelijk: er
      wordt precies een keer geind, en de ander krijgt 404 -- de claim in
      kern/link/cap-bak.js, niet de kassacode eronder, beslist dat.
   2. In PRODUCTIE is de grendel eraf: /api/link/cap/maak met geld.kassa geeft
      een token in plaats van 503 MONEY_CREDENTIAL_NOT_RELEASED, en het
      supplier-loket staat achter zijn eigen poort (401) in plaats van achter de
      grendel (503).

   Draai los: node --test test/linkcap-productie.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop, stopNet, wachtOpWaarde } = require('./helper');

const KYC_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const KEYS = { RTG_ENC_KEY: 'k'.repeat(64), RTG_VAULT_KEY: 'v'.repeat(64), RTG_SECRET_KEY: 's'.repeat(64) };
const PROXY = { 'X-Forwarded-Proto': 'https' };
const json = r => r.json();
const api = (base, pad, body, token, extra) => fetch(base + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(extra || {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {}) });
async function nieuwLid(base, naam) {
  const reg = await json(await api(base, '/api/auth/register', { name: naam,
    email: naam.replace(/\s/g, '') + Date.now() + '@voorbeeld.test', phone: '0611122233',
    password: 'geheim123', geboortedatum: '1990-05-05', tier: 'rtg' }));
  await api(base, '/api/verify/upload', { image: KYC_PNG }, reg.token);
  return reg.token;
}
async function kassa(base, code) {
  const roster = await json(await api(base, '/api/supplier/roster', { code }));
  const man = roster.staff.find(m => m.role === 'manager');
  return (await json(await api(base, '/api/supplier/login', { code, staffId: man.id, pin: '1234' }))).token;
}

test('twee kassa\'s tegelijk op een code: precies een inning', async t => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-capkas-'));
  const { child, base } = await startServer({ env: { RTG_DATA_DIR: tmp, SMTP_URL: '' } });
  t.after(() => { stop(child); fs.rmSync(tmp, { recursive: true, force: true }); });
  const lid = await nieuwLid(base, 'Race Lid');
  await api(base, '/api/pay/oplaad', { centen: 50000, idem: 'race-op-' + Date.now() }, lid);
  const [k1, k2] = [await kassa(base, 'LUCHT'), await kassa(base, 'KIKUNOI')];
  assert.ok(k1 && k2, 'twee kassa\'s ingelogd');
  const saldo = async () => (await json(await api(base, '/api/pay/overzicht', {}, lid))).saldo;
  const voor = await saldo();
  const cap = await json(await api(base, '/api/link/cap/maak', { handeling: 'geld.kassa', maxCenten: 5000 }, lid));
  assert.match(cap.token, /^RTG1\./);
  /* De kale code bestaat alleen in DIT antwoord: een herhaling met dezelfde
     sleutel krijgt geen kopie uit een antwoordcache (eenmalig-geheim-route). */
  const sleutel = { 'Idempotency-Key': 'capmaak-' + Date.now() };
  const [h1, h2] = [await json(await api(base, '/api/link/cap/maak', { handeling: 'geld.kassa', maxCenten: 5000, idem: 'x1' }, lid, sleutel)),
    await json(await api(base, '/api/link/cap/maak', { handeling: 'geld.kassa', maxCenten: 5000, idem: 'x1' }, lid, sleutel))];
  assert.ok(h1.token && h2.token && h1.token !== h2.token, 'geen herhaald geheim: ' + JSON.stringify([h1.error, h2.error]));
  const nieuw = await json(await api(base, '/api/link/cap/maak', { handeling: 'geld.kassa', maxCenten: 5000 }, lid));
  cap.token = nieuw.token;
  const uit = await Promise.all([k1, k2].map(k =>
    api(base, '/api/supplier/link/cap/aanvaard', { capcode: cap.token, centen: 1200 }, k)));
  assert.deepEqual(uit.map(r => r.status).sort(), [200, 404]);
  assert.equal(await saldo(), voor - 1200, 'een keer afgeschreven');
  // en de derde poging, na afloop, opent niets meer
  assert.equal((await api(base, '/api/supplier/link/cap/aanvaard', { capcode: cap.token, centen: 1 }, k1)).status, 404);
  // de kale code staat nergens in de opslag
  /* Wacht op de TOESTAND (de rij met de hash staat in de opslag), niet op een tijd. */
  const leesOpslag = () => fs.readdirSync(tmp).filter(f => /\.(json|db)(-wal)?$/.test(f))
    .map(f => fs.readFileSync(path.join(tmp, f)).toString('latin1')).join('\n');
  const opslag = await wachtOpWaarde(() => { const o = leesOpslag(); return o.includes('linkCapToegang') && o.includes('code_hash') && o; },
    { ms: 8000, wat: 'de linkCapToegang-rij met code_hash in de opslag' });
  assert.ok(opslag.includes('linkCapToegang') && opslag.includes('code_hash'), 'de proef leest de echte opslag');
  const code = Buffer.from(cap.token.split('.')[1], 'base64url').toString().split('|')[1];
  assert.match(code, /^[0-9A-F]{32}$/);
  assert.ok(!opslag.includes(code), 'geen kale drager in de opslag');
});

test('echte productieserver: de grendel link.capability_aanvaarden is eraf', async t => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-capprod-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const proef = await startServer({ env: { RTG_DATA_DIR: tmp, SMTP_URL: '', ...KEYS } });
  const lid = await nieuwLid(proef.base, 'Productie Lid');
  await stopNet(proef.child);
  const { child, base } = await startServer({ env: { NODE_ENV: 'production', RTG_DEMO: '0', RTG_DATA_DIR: tmp,
    APP_URL: 'https://rtg.voorbeeld.test/', SMTP_URL: 'smtp://rtg:test@mail.voorbeeld.test:587',
    TURN_URL: 'turns:turn.rtg.voorbeeld.test:5349', TURN_SECRET: 't'.repeat(48),
    ERR_WEBHOOK_URL: 'https://alarm.voorbeeld.test/rtg', ...KEYS, RTG_OWNER_EMAIL: 'eigenaar@echtdomein.nl',
    OFFICE_CODE: 'GEHEIME-CODE-123', OFFICE_TOTP_SECRET: 'JBSWY3DPEHPK3PXP', RTG_ISOLATIE_AFDWINGEN: '1',
    RTG_BETALEN_UIT: '1', RTG_AI_UIT: '1', RTG_HERSTEL_SMS_UIT_BEWUST: '1' } });
  t.after(() => stop(child));
  const r = await api(base, '/api/link/cap/maak', { handeling: 'geld.kassa', maxCenten: 2000 }, lid, PROXY);
  const lijf = await json(r);
  assert.notEqual(lijf.code, 'MONEY_CREDENTIAL_NOT_RELEASED', JSON.stringify(lijf));
  assert.equal(r.status, 200, JSON.stringify(lijf));
  assert.match(lijf.token, /^RTG1\./);
  assert.match(lijf.eigen.code, /^KC(-[0-9A-F]{4}){8}$/);
  const loket = await api(base, '/api/supplier/link/cap/aanvaard', { capcode: lijf.token, centen: 100 }, null, PROXY);
  assert.equal(loket.status, 401, 'de eigen poort van de zaak, niet de grendel');
  assert.notEqual((await json(loket)).code, 'MONEY_CREDENTIAL_NOT_RELEASED');
  const trek = await api(base, '/api/link/cap/trek', { capcode: lijf.token }, lid, PROXY);
  assert.equal(trek.status, 200, 'intrekken werkt in productie');
});
