/* HET EERSTE KANTOORACCOUNT OP NAAM, OP EEN VERSE PRODUCTIESERVER (besluit B23,
   deur office.gedeelde_kantoorcode). In productie opent de gedeelde code niets
   (B10); de EIGENAAR machtigt het eerste kantooraccount met zijn eigen passkey,
   zonder startcode. De server BEGINT in productie (geen dev-ronde, geen zaaiing):
   eigenaar alleen via RTG_OWNER_BOOTSTRAP -> geen kantoor zonder passkey ->
   met passkey een kantoorsessie en een uitnodiging na een verse ceremonie ->
   een ander account opent het kantoor op naam -> een niet-eigenaar machtigt
   niemand -> het spoor noemt de sessiesleutel -> zonder passkey geen terugval.
   Draai los: node --test test/kantoor-eerste-account.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stopHard } = require('./helper');
const { maakAuthenticator } = require('./webauthn-authenticator');

const APP = 'https://rtg.voorbeeld.test';
const HOST = new URL(APP).hostname;
const CODE = 'GEHEIME-CODE-123';
const TOTP = 'JBSWY3DPEHPK3PXP';
const EIGENAAR = 'eigenaar@echtdomein.nl';
const BOOTSTRAP = 'b'.repeat(32);
const KEYS = { RTG_ENC_KEY: 'k'.repeat(64), RTG_VAULT_KEY: 'v'.repeat(64), RTG_SECRET_KEY: 's'.repeat(64) };

function maakApi(base) {
  return (pad, body, token) => {
    const h = { 'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https' };
    if (token) h.Authorization = 'Bearer ' + token;
    return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
      .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  };
}
const kort = b => JSON.stringify(b).slice(0, 200);
const tel = () => '06' + String(10000000 + Math.floor(Math.random() * 8e7));

async function zetPasskey(api, lid, naam) {
  const sleutel = maakAuthenticator(HOST);
  const ro = await api('/api/webauthn/registreer/opties', {}, lid);
  assert.equal(ro.status, 200, kort(ro.body));
  const rr = await api('/api/webauthn/registreer', { antwoord: sleutel.registratieAntwoord(ro.body.opties.challenge, APP), naam }, lid);
  assert.equal(rr.status, 200, kort(rr.body));
  return sleutel;
}
async function metPasskey(api, pad, body, lid, sleutel, n) {
  const vraag = await api(pad, body, lid);
  assert.equal(vraag.status, 401, kort(vraag.body));
  const b = vraag.body.bevestiging;
  const r = await api(pad, { ...body, ceremonie: b.ceremonie,
    antwoord: sleutel.loginAntwoord(b.opties.challenge, APP, n) }, lid);
  assert.equal(r.status, 200, kort(r.body));
  return r.body;
}
const kantoorOpen = (api, lid, s, n = 1) => metPasskey(api, '/api/account/start', { rol: 'kantoor' }, lid, s, n).then(b => b.token);

test('verse productie: de eigenaar machtigt met zijn passkey het eerste kantooraccount op naam', async t => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kantoor-eerste-'));
  const { child, base } = await startServer({ env: { NODE_ENV: 'production', RTG_DEMO: '0', RTG_DATA_DIR: tmp,
    // Productie start alleen met een geldige STUN- en TURN-configuratie (#444).
    STUN_PUBLIC_HOST: 'stun.rahultravelgroup.com', STUN_URL: 'stun:stun.rahultravelgroup.com:3478',
    TURN_URL: 'turns:turn.rahultravelgroup.com:5349', TURN_SECRET: 'T9!relay-A7#tijdelijk-B4$geheim-C8%2026',
    APP_URL: APP + '/', SMTP_URL: 'smtp://rtg:test@mail.voorbeeld.test:587',
    ERR_WEBHOOK_URL: 'https://alarm.voorbeeld.test/rtg', ...KEYS, RTG_OWNER_EMAIL: EIGENAAR,
    RTG_OWNER_BOOTSTRAP: BOOTSTRAP, OFFICE_CODE: CODE, OFFICE_TOTP_SECRET: TOTP, RTG_ISOLATIE_AFDWINGEN: '1',
    RTG_BETALEN_UIT: '1', RTG_AI_UIT: '1', RTG_HERSTEL_SMS_UIT_BEWUST: '1' } });
  t.after(() => stopHard(child));   // eerst het proces echt weg, dan pas de map
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  const api = maakApi(base);
  const reg = (naam, email, extra) => api('/api/auth/register', { name: naam, email, phone: tel(),
    password: 'Geheim123!', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg', ...(extra || {}) });

  // 1. het eigenaarsadres is niet zonder de bestaande bootstrapsleutel te claimen
  const kaper = await reg('Kaper', EIGENAAR, { eigenaarSleutel: 'x'.repeat(32) });
  assert.equal(kaper.status, 409, 'zonder sleutel geen eigenaar: ' + kort(kaper.body));
  const eig = await reg('Eigenaar Prod', EIGENAAR, { eigenaarSleutel: BOOTSTRAP });
  assert.ok(eig.body.token, 'eigenaar geregistreerd: ' + kort(eig.body));
  const eigLid = eig.body.token;

  // de gedeelde code is dicht, ook op een verse installatie
  const code = await api('/api/office/login', { code: CODE });
  assert.equal(code.status, 403, kort(code.body));
  assert.equal(code.body.code, 'KANTOORCODE_NIET_IN_PRODUCTIE');

  // 2. het kale lid-token opent niets, en zonder passkey opent start niets
  const kaal = await api('/api/office/kantoor/uitnodiging', { codenaam: 'iemand' }, eigLid);
  assert.equal(kaal.status, 401, kort(kaal.body));
  const zonder = await api('/api/account/start', { rol: 'kantoor' }, eigLid);
  assert.equal(zonder.status, 403, kort(zonder.body));
  assert.equal(zonder.body.watNu, 'passkey-zetten');

  // 3. passkey, kantoor op naam, en een uitnodiging alleen na een verse ceremonie
  const eigSleutel = await zetPasskey(api, eigLid, 'Toestel eigenaar');
  const eigKantoor = await kantoorOpen(api, eigLid, eigSleutel);

  const mw = await reg('Eerste Medewerker', 'mw' + Date.now().toString(36) + '@voorbeeld.test');
  assert.ok(mw.body.token);
  const mwLid = mw.body.token;
  const mwCodenaam = (await api('/api/auth/me', {}, mwLid)).body.user.codename;

  // een niet-eigenaar zonder kantoorrol: geen kantoor, geen uitnodiging
  const mwSleutel = await zetPasskey(api, mwLid, 'Toestel medewerker');
  const mwStart = await api('/api/account/start', { rol: 'kantoor' }, mwLid);
  assert.equal(mwStart.status, 404, kort(mwStart.body));
  const mwKaal = await api('/api/office/kantoor/uitnodiging', { codenaam: mwCodenaam }, mwLid);
  assert.equal(mwKaal.status, 401, kort(mwKaal.body));

  const zonderBewijs = await api('/api/office/kantoor/uitnodiging', { codenaam: mwCodenaam }, eigKantoor);
  assert.equal(zonderBewijs.status, 401, kort(zonderBewijs.body));
  assert.equal(zonderBewijs.body.bevestigingNodig, true);
  assert.equal(zonderBewijs.body.code, undefined);
  const zwaar = async (pad, actie, body, sleutel, n) => {
    const op = await api('/api/office/boardroom/bevestig/opties', { actie }, eigKantoor);
    assert.equal(op.status, 200, kort(op.body));
    return api(pad, { ...body, ceremonie: op.body.ceremonie,
      antwoord: sleutel.loginAntwoord(op.body.opties.challenge, APP, n) }, eigKantoor);
  };
  const U = ['/api/office/kantoor/uitnodiging', 'eigenaar-kantooruitnodiging', { codenaam: mwCodenaam }];
  const vals = await zwaar(...U, maakAuthenticator(HOST), 1);
  assert.notEqual(vals.status, 200, 'een vreemde sleutel machtigt niets');
  assert.equal(vals.body.code, undefined);
  const uitn = await zwaar(...U, eigSleutel, 2);
  assert.equal(uitn.status, 200, kort(uitn.body));
  assert.match(uitn.body.code, /^KU\.[0-9A-F]{32}$/i);

  // 4. de medewerker verzilvert met zijn eigen passkey (B24), en opent het kantoor op naam
  await metPasskey(api, '/api/account/koppel', { soort: 'kantoor', uitnodiging: uitn.body.code }, mwLid, mwSleutel, 1);
  const mwKantoor = await kantoorOpen(api, mwLid, mwSleutel, 2);
  const log = await api('/api/office/securitylog', {}, mwKantoor);
  assert.equal(log.status, 200, kort(log.body));

  // 5. met de kantoorrol is hij nog steeds geen eigenaar: hij machtigt niemand
  const doorgeven = await api('/api/office/kantoor/uitnodiging', { codenaam: mwCodenaam }, mwKantoor);
  assert.equal(doorgeven.status, 403, kort(doorgeven.body));
  // ook niet met boardroomtoegang van de eigenaar: machtigen blijft van de eigenaar zelf
  const geef = await zwaar('/api/office/boardroom/toegang/geef', 'eigenaar-boardroomtoegang', { codenaam: mwCodenaam }, eigSleutel, 3);
  assert.equal(geef.status, 200, kort(geef.body));
  const viaBoardroom = await api('/api/office/kantoor/uitnodiging', { codenaam: mwCodenaam }, mwKantoor);
  assert.equal(viaBoardroom.status, 403, kort(viaBoardroom.body));
  assert.match(viaBoardroom.body.error || '', /Alleen de eigenaar/);

  // 6. het spoor noemt de eigenaar met de sleutel uit zijn sessie
  const eigKey = 'user-' + (await api('/api/auth/me', {}, eigLid)).body.user.id;
  const bord = await api('/api/office/boardroom', {}, eigKantoor);
  assert.equal(bord.status, 200, kort(bord.body));
  const regel = (bord.body.audit || []).find(r => /Kantooruitnodiging gemaakt voor/.test(r.wat));
  assert.ok(regel, kort(bord.body.audit));
  assert.equal(regel.wie, eigKey, 'de actor komt uit de sessie van de eigenaar');
  assert.match(regel.wat, /passkey bevestigd/);

  // 7. laatste passkey weg terwijl de kantoorsessie openstaat: geen terugval
  const lijst = await api('/api/webauthn/lijst', {}, eigLid);
  const pk = (lijst.body.sleutels || [])[0];
  assert.ok(pk && pk.id, kort(lijst.body));
  const wo = await api('/api/webauthn/bevestig/opties', {}, eigLid);
  const weg = await api('/api/webauthn/weg', { id: pk.id, ceremonie: wo.body.ceremonie,
    antwoord: eigSleutel.loginAntwoord(wo.body.opties.challenge, APP, 4) }, eigLid);
  assert.equal(weg.status, 200, kort(weg.body));
  const opnieuw = await api('/api/office/kantoor/uitnodiging', { codenaam: mwCodenaam }, eigKantoor);
  assert.equal(opnieuw.status, 403, kort(opnieuw.body));
  assert.equal(opnieuw.body.watNu, 'passkey-zetten');
  assert.equal(opnieuw.body.code, undefined);
});
