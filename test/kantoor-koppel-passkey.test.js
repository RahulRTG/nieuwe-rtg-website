/* B24: EEN KANTOORUITNODIGING VERZILVEREN MET EEN EIGEN VERSE PASSKEY, OP EEN
   ECHTE PRODUCTIESERVER (deur office.gedeelde_kantoorcode). In productie vraagt
   /api/account/koppel geen gedeelde OFFICE_TOTP meer maar de zware poort
   (actie kantoor-koppel, zonder terugval, gebonden aan de lid-sessie van de
   medewerker). Zonder passkey: weigeren met watNu, en de uitnodiging blijft
   geldig; zonder ceremonie 401; de passkey van een ander werkt niet; met de
   eigen passkey gekoppeld zonder TOTP, en daarna opent hij het kantoor op naam.
   Plus de poort zelf zonder passkeylaag: 503, en er wordt niets verbruikt.
   Draai los: node --test test/kantoor-koppel-passkey.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');
const { maakAuthenticator } = require('./webauthn-authenticator');
const { totpCode } = require('../server/kern/totp');

const APP = 'https://rtg.voorbeeld.test';
const HOST = new URL(APP).hostname;
const TOTP = 'JBSWY3DPEHPK3PXP';
const EIGENAAR = 'eigenaar@echtdomein.nl';
const BOOTSTRAP = 'c'.repeat(32);
const KEYS = { RTG_ENC_KEY: 'k'.repeat(64), RTG_VAULT_KEY: 'v'.repeat(64), RTG_SECRET_KEY: 's'.repeat(64) };

const maakApi = base => (pad, body, token) => {
  const h = { 'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
};
const kort = b => JSON.stringify(b).slice(0, 200);
const tel = () => '06' + String(10000000 + Math.floor(Math.random() * 8e7));

async function zetPasskey(api, lid) {
  const sleutel = maakAuthenticator(HOST);
  const ro = await api('/api/webauthn/registreer/opties', {}, lid);
  const rr = await api('/api/webauthn/registreer', { antwoord: sleutel.registratieAntwoord(ro.body.opties.challenge, APP), naam: 'Toestel' }, lid);
  assert.equal(rr.status, 200, kort(rr.body));
  return sleutel;
}
const teken = (b, sleutel, n) => ({ ceremonie: b.ceremonie, antwoord: sleutel.loginAntwoord(b.opties.challenge, APP, n) });

test('B24 productie: de uitnodiging wordt verzilverd met de eigen passkey en niet met de gedeelde TOTP', async t => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kantoor-koppel-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const { child, base } = await startServer({ env: { NODE_ENV: 'production', RTG_DEMO: '0', RTG_DATA_DIR: tmp,
    APP_URL: APP + '/', SMTP_URL: 'smtp://rtg:test@mail.voorbeeld.test:587',
    ERR_WEBHOOK_URL: 'https://alarm.voorbeeld.test/rtg', ...KEYS, RTG_OWNER_EMAIL: EIGENAAR,
    RTG_OWNER_BOOTSTRAP: BOOTSTRAP, OFFICE_CODE: 'GEHEIME-CODE-123', OFFICE_TOTP_SECRET: TOTP,
    RTG_ISOLATIE_AFDWINGEN: '1', RTG_BETALEN_UIT: '1', RTG_AI_UIT: '1', RTG_HERSTEL_SMS_UIT_BEWUST: '1' } });
  t.after(() => stop(child));
  const api = maakApi(base);
  const reg = (naam, email, extra) => api('/api/auth/register', { name: naam, email, phone: tel(),
    password: 'Geheim123!', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg', ...(extra || {}) });

  // de eigenaar opent het kantoor op naam en maakt een uitnodiging (B23)
  const eigLid = (await reg('Eigenaar', EIGENAAR, { eigenaarSleutel: BOOTSTRAP })).body.token;
  assert.ok(eigLid);
  const eigSleutel = await zetPasskey(api, eigLid);
  const st = await api('/api/account/start', { rol: 'kantoor' }, eigLid);
  const eigKantoor = (await api('/api/account/start', { rol: 'kantoor', ...teken(st.body.bevestiging, eigSleutel, 1) }, eigLid)).body.token;
  assert.ok(eigKantoor, 'eigenaar binnen');
  const mwLid = (await reg('Nieuwe Medewerker', 'mw' + Date.now().toString(36) + '@voorbeeld.test')).body.token;
  const mwCodenaam = (await api('/api/auth/me', {}, mwLid)).body.user.codename;
  const op = await api('/api/office/boardroom/bevestig/opties', { actie: 'eigenaar-kantooruitnodiging' }, eigKantoor);
  const uitn = await api('/api/office/kantoor/uitnodiging', { codenaam: mwCodenaam, ...teken(op.body, eigSleutel, 2) }, eigKantoor);
  assert.equal(uitn.status, 200, kort(uitn.body));
  const KOP = { soort: 'kantoor', uitnodiging: uitn.body.code };
  const heeftKantoor = async () => ((await api('/api/account/rollen', {}, mwLid)).body.rollen || []).some(r => r.rol === 'kantoor');

  // 1. zonder passkey: geweigerd met de weg, ook met een GELDIGE gedeelde TOTP
  const zonder = await api('/api/account/koppel', { ...KOP, totp: totpCode(TOTP, Date.now(), 30) }, mwLid);
  assert.equal(zonder.status, 403, kort(zonder.body));
  assert.equal(zonder.body.watNu, 'passkey-zetten');
  assert.equal(await heeftKantoor(), false, 'niets geschreven');

  // 2. met passkey maar zonder ceremonie: 401 met de ceremonie erbij
  const mwSleutel = await zetPasskey(api, mwLid);
  const vraag = await api('/api/account/koppel', KOP, mwLid);
  assert.equal(vraag.status, 401, kort(vraag.body));
  assert.equal(vraag.body.bevestigingNodig, true);
  assert.equal(vraag.body.actie, 'kantoor-koppel');
  assert.ok(vraag.body.bevestiging && vraag.body.bevestiging.ceremonie, kort(vraag.body));
  assert.equal(await heeftKantoor(), false);

  // 3. de passkey van een ander (de eigenaar) tekent de ceremonie van de medewerker niet
  const vreemd = await api('/api/account/koppel', { ...KOP, ...teken(vraag.body.bevestiging, eigSleutel, 3) }, mwLid);
  assert.equal(vreemd.status, 401, kort(vreemd.body));
  assert.equal(vreemd.body.bevestigingNodig, undefined);
  assert.equal(await heeftKantoor(), false);

  // 4. de eigen passkey, zonder TOTP: gekoppeld -- de uitnodiging was dus nog geldig
  const v2 = await api('/api/account/koppel', KOP, mwLid);
  const kop = await api('/api/account/koppel', { ...KOP, ...teken(v2.body.bevestiging, mwSleutel, 1) }, mwLid);
  assert.equal(kop.status, 200, kort(kop.body));
  assert.equal(await heeftKantoor(), true);
  // en een keer: de uitnodiging is nu op
  const nogEens = await api('/api/account/koppel', KOP, mwLid);
  assert.equal(nogEens.status, 401, kort(nogEens.body));
  assert.equal(nogEens.body.bevestigingNodig, undefined, 'een verbruikte uitnodiging vraagt geen ceremonie meer');

  // 5. daarna opent hij het kantoor op naam met zijn passkey
  const s1 = await api('/api/account/start', { rol: 'kantoor' }, mwLid);
  const binnen = await api('/api/account/start', { rol: 'kantoor', ...teken(s1.body.bevestiging, mwSleutel, 2) }, mwLid);
  assert.equal(binnen.status, 200, kort(binnen.body));
  assert.equal((await api('/api/office/securitylog', {}, binnen.body.token)).status, 200);
});

test('B24 zonder passkeylaag in productie: 503 en de uitnodiging wordt niet verbruikt', async () => {
  const oud = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    let verbruikt = 0;
    const kantoorUitnodiging = { telWeg() {}, verzilver: (k, c, o) => (o && o.proef ? { ok: true } : (verbruikt++, { ok: true })) };
    const slot = { dicht: () => false, fout() {}, goed() {}, personeel: () => 'x' };
    const { bewijs } = require('../server/kern/eenaccount/koppelen')({ accounts: { getUserById: () => ({ id: 7 }) },
      logInlog() {}, pinSlot: slot, nu: () => 'nu', kantoorUitnodiging, zwaarVan: () => null, totpOk: () => true });
    const r = await bewijs('user-7', { soort: 'kantoor', uitnodiging: 'KU.' + '0'.repeat(32) }, { body: {}, get: () => '' });
    assert.equal(r.status, 503, kort(r));
    assert.equal(r.rol, undefined);
    assert.equal(verbruikt, 0);
  } finally { process.env.NODE_ENV = oud; }
});
