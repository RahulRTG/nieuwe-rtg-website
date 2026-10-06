/* DE KANTOORDEUR OP EEN ECHTE PRODUCTIESERVER (besluit B10, deur
   office.gedeelde_kantoorcode).

   In productie opent de gedeelde kantoorcode het kantoor niet meer; het kantoor
   gaat alleen open op naam, met een passkey (server/kern/kantoor/productiedeur.js).
   Deze toets bewijst dat tegen een echte server in productiemodus, met sessies
   die op een testserver op DEZELFDE opslag zijn gemaakt -- zo staat ook vast dat
   een sessie van voor het besluit niets meer opent:

     1. buiten productie werkt de code nog (tegenproef);
     2. in productie: de code (formulier en gesprek) wordt geweigerd;
     3. een oude codesessie en een sessie op naam zonder passkey openen niets;
     4. op naam zonder passkey op het account: geen kantoor, met de weg erheen;
     5. op naam met een passkey: eerst de ceremonie, daarna binnen;
     6. OFFICE_CODE en OFFICE_TOTP_SECRET zijn geen productie-eis meer (besluit
        van de eigenaar, 4 oktober 2026, B10/B24): de server start ZONDER beide,
        en MET beide start hij ook, opent de code niets en staat er precies een
        regel in het opstartlog dat ze genegeerd worden (opzet/startcontrole.js).

   Draai los: node --test test/kantoordeur-productie.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop, stopHard, stopNet, kantoorKoppelBody, wachtOpWaarde } = require('./helper');
const { maakAuthenticator } = require('./webauthn-authenticator');
const { totpCode } = require('../server/kern/totp');

const APP = 'https://rtg.voorbeeld.test';
const CODE = 'GEHEIME-CODE-123';
const KEYS = { RTG_ENC_KEY: 'k'.repeat(64), RTG_VAULT_KEY: 'v'.repeat(64), RTG_SECRET_KEY: 's'.repeat(64) };

function maakApi(base, extra) {
  return (pad, body, token) => {
    const h = { 'Content-Type': 'application/json', ...(extra || {}) };
    if (token) h.Authorization = 'Bearer ' + token;
    return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
      .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  };
}

test('echte productieserver: de kantoorcode opent niets, op naam met een passkey wel', async t => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kantoordeur-prod-'));

  /* ---- buiten productie: de oude deur werkt nog, en we leggen sessies aan ---- */
  const proef = await startServer({ env: { RTG_DATA_DIR: tmp, SMTP_URL: '', OFFICE_CODE: CODE, ...KEYS } });
  t.after(() => stopHard(proef.child));   // ook als een assertie hieronder zakt
  const pa = maakApi(proef.base);
  const code = await pa('/api/office/login', { code: CODE });
  assert.equal(code.status, 200, 'buiten productie blijft de gedeelde code werken: ' + JSON.stringify(code.body).slice(0, 120));
  const oudeCodeSessie = code.body.token;

  const u = Date.now().toString(36);
  const reg = await pa('/api/auth/register', { name: 'Kantoormens Prod', email: 'kprod' + u + '@voorbeeld.test',
    phone: '06' + String(10000000 + Math.floor(Math.random() * 8e7)), password: 'Geheim123!',
    geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(reg.body.token, 'medewerker geregistreerd');
  const lid = reg.body.token;
  const kop = await pa('/api/account/koppel', await kantoorKoppelBody(proef.base, lid), lid);
  assert.equal(kop.status, 200, 'kantoorrol gekoppeld: ' + JSON.stringify(kop.body).slice(0, 120));
  const naamZonder = await pa('/api/account/start', { rol: 'kantoor' }, lid);
  assert.equal(naamZonder.status, 200, 'buiten productie opent de kantoorrol zonder passkey');
  assert.equal(naamZonder.body.token && (await pa('/api/office/securitylog', {}, naamZonder.body.token)).status, 200);
  await stopNet(proef.child);

  /* ---- dezelfde opslag in productie ---- */
  const { child, base } = await startServer({ env: { NODE_ENV: 'production', RTG_DEMO: '0', RTG_DATA_DIR: tmp,
    APP_URL: APP + '/', SMTP_URL: 'smtp://rtg:test@mail.voorbeeld.test:587',
    RTG_ANKERPOST_URL: 'https://anker.voorbeeld.test/', ERR_WEBHOOK_URL: 'https://alarm.voorbeeld.test/rtg', ...KEYS, RTG_OWNER_EMAIL: 'eigenaar@echtdomein.nl',
    STUN_PUBLIC_HOST: 'stun.rahultravelgroup.com', STUN_URL: 'stun:stun.rahultravelgroup.com:3478',
    TURN_URL: 'turns:turn.rahultravelgroup.com:5349', TURN_SECRET: 'T9!relay-A7#tijdelijk-B4$geheim-C8%2026',
    RTG_ISOLATIE_AFDWINGEN: '1',
    RTG_BETALEN_UIT: '1', RTG_AI_UIT: '1', RTG_HERSTEL_SMS_UIT_BEWUST: '1' } });
  t.after(() => stopHard(child));   // ook deze schrijft in tmp: eerst weg, dan pas de map
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  const api = maakApi(base, { 'X-Forwarded-Proto': 'https' });

  // 2. de juiste code wordt geweigerd, voor er iets vergeleken wordt, met de weg erheen
  const dicht = await api('/api/office/login', { code: CODE });
  assert.equal(dicht.status, 403, JSON.stringify(dicht.body));
  assert.equal(dicht.body.code, 'KANTOORCODE_NIET_IN_PRODUCTIE');
  assert.equal(dicht.body.watNu, 'inloggen-op-naam');
  assert.equal(dicht.body.token, undefined, 'geen sessie');
  const gesprek = await api('/api/kantoor/gesprek/start', {});
  assert.equal(gesprek.status, 403, 'ook het kantoorgesprek neemt de code niet meer aan');
  assert.equal(gesprek.body.code, 'KANTOORCODE_NIET_IN_PRODUCTIE');

  // 3. sessies van voor het besluit openen niets
  const oud = await api('/api/office/securitylog', {}, oudeCodeSessie);
  assert.equal(oud.status, 401, 'een codesessie opent in productie niets: ' + JSON.stringify(oud.body).slice(0, 120));
  const oudNaam = await api('/api/office/securitylog', {}, naamZonder.body.token);
  assert.equal(oudNaam.status, 401, 'een sessie op naam zonder passkey opent niets');
  assert.equal(oudNaam.body.code, 'KANTOOR_PASSKEY_ONTBREEKT');
  const stroom = await fetch(base + '/api/office/stream?token=' + oudeCodeSessie, { headers: { 'X-Forwarded-Proto': 'https' } });
  assert.equal(stroom.status, 401, 'ook niet via een query-token');
  await stroom.body?.cancel().catch(() => {});

  // 4. op naam, maar het account heeft geen passkey: dicht met de weg erheen
  const zonder = await api('/api/account/start', { rol: 'kantoor' }, lid);
  assert.equal(zonder.status, 403, JSON.stringify(zonder.body).slice(0, 200));
  assert.equal(zonder.body.watNu, 'passkey-zetten');
  assert.equal(zonder.body.token, undefined);

  // 5. een passkey op het eigen account, en dan de ceremonie aan de kantoordeur
  const sleutel = maakAuthenticator(new URL(APP).hostname);
  const ro = await api('/api/webauthn/registreer/opties', {}, lid);
  assert.equal(ro.status, 200, 'registratieopties: ' + JSON.stringify(ro.body).slice(0, 160));
  const rr = await api('/api/webauthn/registreer', { antwoord: sleutel.registratieAntwoord(ro.body.opties.challenge, APP),
    naam: 'Toestel kantoor' }, lid);
  assert.equal(rr.status, 200, 'passkey geregistreerd: ' + JSON.stringify(rr.body).slice(0, 160));

  const vraag = await api('/api/account/start', { rol: 'kantoor' }, lid);
  assert.equal(vraag.status, 401, JSON.stringify(vraag.body).slice(0, 200));
  assert.equal(vraag.body.bevestigingNodig, true);
  assert.equal(vraag.body.actie, 'kantoor-binnen');
  assert.equal(vraag.body.token, undefined, 'zonder ceremonie geen sessie');
  const b = vraag.body.bevestiging;
  assert.ok(b && b.ceremonie && b.opties && b.opties.challenge, 'de ceremonie reist mee');

  const vals = await api('/api/account/start', { rol: 'kantoor', ceremonie: b.ceremonie,
    antwoord: maakAuthenticator(new URL(APP).hostname).loginAntwoord(b.opties.challenge, APP, 1) }, lid);
  assert.notEqual(vals.status, 200, 'een andere sleutel opent het kantoor niet');
  assert.equal(vals.body.token, undefined);

  const opnieuw = await api('/api/account/start', { rol: 'kantoor' }, lid);
  const c = opnieuw.body.bevestiging;
  const binnen = await api('/api/account/start', { rol: 'kantoor', ceremonie: c.ceremonie,
    antwoord: sleutel.loginAntwoord(c.opties.challenge, APP, 1) }, lid);
  assert.equal(binnen.status, 200, 'op naam met een passkey: ' + JSON.stringify(binnen.body).slice(0, 200));
  assert.ok(binnen.body.token, 'een kantoorsessie');
  const log = await api('/api/office/securitylog', {}, binnen.body.token);
  assert.equal(log.status, 200, 'de kantoorsessie met passkey opent een kantoorroute: ' + JSON.stringify(log.body).slice(0, 120));
});

/* ---- 6. geen productie-eis meer op de kantoorcode en haar TOTP ---- */
const TOTP = 'JBSWY3DPEHPK3PXP';
const REGEL = /\[start\] OFFICE_CODE en OFFICE_TOTP_SECRET staan gezet maar worden in productie genegeerd \(B10\/B24\)/g;

const PROD = { NODE_ENV: 'production', RTG_DEMO: '0', APP_URL: 'https://rtg.voorbeeld.test/',
  SMTP_URL: 'smtp://rtg:test@mail.voorbeeld.test:587', RTG_ANKERPOST_URL: 'https://anker.voorbeeld.test/', ERR_WEBHOOK_URL: 'https://alarm.voorbeeld.test/rtg',
  ...KEYS, RTG_OWNER_EMAIL: 'eigenaar@echtdomein.nl', RTG_ISOLATIE_AFDWINGEN: '1',
  RTG_BETALEN_UIT: '1', RTG_AI_UIT: '1', RTG_HERSTEL_SMS_UIT_BEWUST: '1',
  // Productie start alleen met een geldige STUN- en TURN-configuratie (#444).
  STUN_PUBLIC_HOST: 'stun.rahultravelgroup.com', STUN_URL: 'stun:stun.rahultravelgroup.com:3478',
  TURN_URL: 'turns:turn.rahultravelgroup.com:5349', TURN_SECRET: 'T9!relay-A7#tijdelijk-B4$geheim-C8%2026' };

/* Start in productie en lees het opstartlog mee. Een lege string overschrijft
   wat er toevallig in de omgeving van de aanroeper staat: "niet gezet". */
async function start(t, kantoor) {
  const srv = await startServer({ stderr: 'pipe', env: { ...PROD, OFFICE_CODE: '', OFFICE_TOTP_SECRET: '', ...kantoor } });
  t.after(() => stop(srv.child));
  let log = '';
  srv.child.stderr.setEncoding('utf8');
  srv.child.stderr.on('data', d => { log += d; });
  const post = (pad, body) => fetch(srv.base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https' }, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  /* de startcontrole schrijft de kantoorregel VOOR de waarschuwing over het
     ontbrekende eigenaarsaccount, op dezelfde stderr; staat die tweede er, dan
     is de eerste er ook -- of komt hij niet. Wachten op een toestand, geen slaapje. */
  await wachtOpWaarde(() => /\[start\] LET OP: er is nog geen account op het eigenaarsadres/.test(log),
    { wat: 'de startcontrole in het opstartlog' });
  return { post, log: () => log };
}

async function codeOpentNiets(post, lijven) {
  for (const lijf of lijven) {
    const r = await post('/api/office/login', lijf);
    assert.equal(r.status, 403, 'de kantoorcode opent in productie niets: ' + JSON.stringify(r.body).slice(0, 120));
    assert.equal(r.body.code, 'KANTOORCODE_NIET_IN_PRODUCTIE');
    assert.equal(r.body.token, undefined, 'geen sessie');
  }
  const g = await post('/api/kantoor/gesprek/start', {});
  assert.equal(g.status, 403, 'ook het kantoorgesprek neemt geen code aan');
  assert.equal(g.body.code, 'KANTOORCODE_NIET_IN_PRODUCTIE');
}

test('6a. productie start zonder OFFICE_CODE en OFFICE_TOTP_SECRET, en de code opent niets', async t => {
  const { post, log } = await start(t, {});
  await codeOpentNiets(post, [{ code: 'RTG-OFFICE' }, { code: CODE }]);
  assert.equal((log().match(REGEL) || []).length, 0, 'niets gezet, dus ook niets te negeren:\n' + log().slice(0, 600));
});

test('6b. productie start MET beide gezet: genegeerd, met een regel in het opstartlog', async t => {
  const { post, log } = await start(t, { OFFICE_CODE: CODE, OFFICE_TOTP_SECRET: TOTP });
  await codeOpentNiets(post, [{ code: CODE }, { code: CODE, totp: totpCode(TOTP) }]);
  assert.equal((log().match(REGEL) || []).length, 1,
    'precies een regel dat ze genegeerd worden, niet stil en niet herhaald:\n' + log().slice(0, 600));
});
