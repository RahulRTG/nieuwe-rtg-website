/* HET SSO-CLIENTGEHEIM OP EEN ECHTE SERVER (B16; de passkey van B22 ook in
   ./sso-clientgeheim-b22.test.js).

   Deel 1, gewone server: de eigenaar zet en roteert (met passkey); geen antwoord
   of bestand draagt het kale geheim; de overlap loopt en sluit; lid en kantoor
   komen er niet bij; zonder geheim is de inlog dicht met de reden.

   Deel 2, dezelfde opslag in PRODUCTIE: een goed geheim laat de inlog door,
   een opgerekte datum of geen geheim houdt hem dicht met de reden, en de oude
   opslag wordt bij het laden herzegeld. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { startServer, stop, stopNet } = require('./helper');
const { zwaarApi } = require('./zwaarpasskey');

const KEYS = { RTG_ENC_KEY: 'k'.repeat(64), RTG_VAULT_KEY: 'v'.repeat(64), RTG_SECRET_KEY: 's'.repeat(64) };
const GEHEIM = 'ssogeheim-' + crypto.randomBytes(10).toString('hex');
const NIEUW = 'ssogeheim-nieuw-' + crypto.randomBytes(10).toString('hex');

function maakApi(base, extra) {
  return (pad, body, token, methode) => fetch(base + pad, {
    method: methode || 'POST',
    headers: { 'Content-Type': 'application/json', ...(extra || {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: methode === 'GET' ? undefined : JSON.stringify(body || {})
  }).then(async r => { const tekst = await r.text(); let j = {}; try { j = JSON.parse(tekst); } catch (e) {}
    return { status: r.status, body: j, tekst }; });
}
const koppeling = (org, geheim) => ({ org, naam: org, issuer: 'https://idp.' + org + '.test', clientId: 'c-' + org,
  domeinen: [org + '.test'], actief: true, ...(geheim ? { clientSecret: geheim } : {}) });
/* De oude opslag (kluis.enc) en de state van een inlogpoging (sso/staat.js) zijn
   allebei AES-256-GCM onder de kluissleutel; met dezelfde RTG_VAULT_KEY als de
   server kan de toets ze zelf maken. */
function oudeKluis(tekst) {
  const sleutel = crypto.createHash('sha256').update(KEYS.RTG_VAULT_KEY).digest();
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', sleutel, iv);
  const ct = Buffer.concat([c.update(tekst, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}
const staatVoor = (org) => Buffer.from(oudeKluis(JSON.stringify({ org, nonce: 'n', verifier: 'v', terug: '/',
  tot: Date.now() + 600000 })), 'base64').toString('base64url');
const bevatOpSchijf = (map, tekst) => fs.readdirSync(map).filter(f => /^(rtg\.db|db\.json)/.test(f))
  .filter(f => fs.readFileSync(path.join(map, f)).includes(tekst));

test('het clientgeheim: zetten, roteren met overlap, nooit terug, en dicht met de reden -- ook in productie', async t => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ssogeheim-e2e-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

  /* ---- deel 1: gewone server ---- */
  const proef = await startServer({ env: { RTG_DATA_DIR: tmp, SMTP_URL: '', RTG_OWNER_EMAIL: '',
    OFFICE_CODE: 'KANTOOR-SSOGEHEIM', ...KEYS } });
  t.after(() => stop(proef.child));
  const api = maakApi(proef.base);
  const eig = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(eig, 'de eigenaar is binnen');
  const u = Date.now().toString().slice(-9);
  const lid = (await api('/api/auth/register', { name: 'Gewoon Lid', email: 'sg' + u + '@x.nl', phone: '06' + u.slice(0, 8),
    password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body.token;
  const kantoor = (await api('/api/office/login', { code: 'KANTOOR-SSOGEHEIM' })).body.token;
  assert.ok(lid && kantoor);
  const zw = await zwaarApi(api, proef.base, eig, 'Imran'); // B22: verse passkey onder elk geheim

  for (const org of ['goed', 'gerekt', 'oud']) {
    const r = await zw('/api/techniek/sso', koppeling(org, GEHEIM), eig);
    assert.equal(r.status, 200, r.tekst.slice(0, 200));
    assert.equal(r.tekst.includes(GEHEIM), false, 'het zetten geeft het geheim niet terug');
    assert.match(r.body.geheim.vingerafdruk, /^hmac:[0-9a-f]{16}$/);
  }
  assert.equal((await api('/api/techniek/sso', koppeling('leeg'), eig)).status, 200);

  // de lijst: stand en vingerafdruk, nooit de tekst
  const lijst = await api('/api/techniek/sso', null, eig, 'GET');
  const goed = lijst.body.koppelingen.find(k => k.org === 'goed');
  assert.equal(goed.geheimGezet, true);
  assert.equal(goed.geheim.bruikbaar, true);
  assert.equal(goed.geheim.overlap, null);
  assert.equal(lijst.body.koppelingen.find(k => k.org === 'leeg').geheim.code, 'GEEN_GEHEIM');
  assert.equal(lijst.tekst.includes(GEHEIM), false);

  // roteren met overlap
  const rot = await zw('/api/techniek/sso/geheim', { org: 'goed', clientSecret: NIEUW, overlapDagen: 3, dagen: 90 }, eig);
  assert.equal(rot.status, 200, rot.tekst.slice(0, 200));
  assert.equal(rot.tekst.includes(NIEUW) || rot.tekst.includes(GEHEIM), false, 'geen van beide geheimen in het antwoord');
  assert.equal(rot.body.geheim.overlap.vingerafdruk, goed.geheim.vingerafdruk, 'het vorige loopt mee');
  assert.notEqual(rot.body.geheim.vingerafdruk, goed.geheim.vingerafdruk);
  assert.ok([89, 90].includes(rot.body.geheim.dagenOver), 'vervalt over 90 dagen');
  const nogEens = await zw('/api/techniek/sso/geheim', { org: 'goed', clientSecret: NIEUW, overlapDagen: 3 }, eig);
  assert.equal(nogEens.status, 200);
  assert.equal(nogEens.body.ongewijzigd, true, 'hetzelfde geheim opnieuw maakt geen overlap met zichzelf');
  assert.equal(nogEens.body.geheim.overlap.vingerafdruk, goed.geheim.vingerafdruk);
  const sluit = await api('/api/techniek/sso/geheim/overlap/sluit', { org: 'goed' }, eig);
  assert.equal(sluit.status, 200, sluit.tekst.slice(0, 200));
  assert.equal(sluit.body.geheim.overlap, null);
  assert.equal((await api('/api/techniek/sso/geheim/overlap/sluit', { org: 'goed' }, eig)).status, 409);
  assert.equal((await zw('/api/techniek/sso/geheim', { org: 'bestaat-niet', clientSecret: 'x' }, eig)).status, 404);
  assert.equal((await api('/api/techniek/sso/geheim/overlap/sluit', { org: 'bestaat-niet' }, eig)).status, 404);
  const teLang = await zw('/api/techniek/sso/geheim', { org: 'goed', clientSecret: 'x', dagen: 91 }, eig);
  assert.equal(teLang.status, 400);
  assert.equal(teLang.body.code, 'VERVAL_ONGELDIG');
  assert.equal((await zw('/api/techniek/sso/geheim', { org: 'goed', clientSecret: 12 }, eig)).body.code, 'GEHEIM_ONGELDIG');

  /* Alleen de EIGENAAR, ook niet iemand die de eigenaar tot de techniekpagina
     toeliet: techAuth laat die door, eigenaarAlleen niet. */
  const lidMail = 'sg' + u + '@x.nl';
  assert.equal((await zw('/api/techniek/toegang', { email: lidMail, actie: 'geef' }, eig)).status, 200);
  const toegelaten = (await api('/api/techniek/inloggen', { login: lidMail, wachtwoord: 'geheim12345' })).body.token;
  assert.ok(toegelaten, 'het toegelaten lid komt op de techniekpagina');
  assert.equal((await api('/api/techniek/sso/geheim', { org: 'goed', clientSecret: 'overname' }, toegelaten)).status, 403);
  assert.equal((await api('/api/techniek/sso/geheim/overlap/sluit', { org: 'goed' }, toegelaten)).status, 403);
  for (const [wat, token] of [['zonder token', null], ['een lid', lid], ['kantoor', kantoor]])
    for (const pad of ['/api/techniek/sso/geheim', '/api/techniek/sso/geheim/overlap/sluit']) {
      const r = await api(pad, { org: 'goed', clientSecret: 'overname' }, token);
      assert.ok([401, 403].includes(r.status), pad + ' met ' + wat + ': ' + r.status);
    }

  // de inlog: zonder geheim dicht met de reden, met geheim door naar de provider
  const dicht = await api('/api/sso/start?org=leeg', null, null, 'GET');
  assert.equal(dicht.status, 503, dicht.tekst.slice(0, 200));
  assert.equal(dicht.body.code, 'SSO_GEHEIM_GEEN_GEHEIM');
  assert.match(dicht.body.error, /geen clientgeheim/);
  const door = await fetch(proef.base + '/api/sso/start?org=goed', { redirect: 'manual' });
  assert.equal(door.status, 502, 'met een geldig geheim gaat de inlog door tot de (hier onbereikbare) provider');

  await stopNet(proef.child);
  assert.deepEqual(bevatOpSchijf(tmp, GEHEIM), [], 'het eerste geheim staat nergens kaal in de datamap');
  assert.deepEqual(bevatOpSchijf(tmp, NIEUW), [], 'het nieuwe ook niet');

  /* ---- tussen de servers: een datum oprekken en een rij in de oude opslag ---- */
  const db = new DatabaseSync(path.join(tmp, 'rtg.db'));
  const rij = (org) => db.prepare('SELECT enc_client_secret AS w FROM sso_koppelingen WHERE org = ?').get(org).w;
  const j = JSON.parse(rij('gerekt').slice('RTGSSO2:'.length));
  j.sloten[0].vervalt = '2030-01-01T00:00:00.000Z';
  db.prepare('UPDATE sso_koppelingen SET enc_client_secret = ? WHERE org = ?').run('RTGSSO2:' + JSON.stringify(j), 'gerekt');
  db.prepare('UPDATE sso_koppelingen SET enc_client_secret = ? WHERE org = ?').run(oudeKluis('uit-de-oude-opslag'), 'oud');
  db.close();

  /* ---- deel 2: dezelfde opslag in productie ---- */
  const prod = await startServer({ env: { NODE_ENV: 'production', RTG_DEMO: '0', RTG_DATA_DIR: tmp,
    APP_URL: 'https://rtg.voorbeeld.test/', SMTP_URL: 'smtp://rtg:test@mail.voorbeeld.test:587',
    STUN_PUBLIC_HOST: 'stun.rahultravelgroup.com', STUN_URL: 'stun:stun.rahultravelgroup.com:3478',
    TURN_URL: 'turns:turn.rahultravelgroup.com:5349', TURN_SECRET: 'T9!relay-A7#tijdelijk-B4$geheim-C8%2026',
    ERR_WEBHOOK_URL: 'https://alarm.voorbeeld.test/rtg', ...KEYS, RTG_OWNER_EMAIL: 'eigenaar@echtdomein.nl',
    OFFICE_CODE: 'KANTOOR-SSOGEHEIM', OFFICE_TOTP_SECRET: 'JBSWY3DPEHPK3PXP', RTG_ISOLATIE_AFDWINGEN: '1',
    RTG_BETALEN_UIT: '1', RTG_AI_UIT: '1', RTG_HERSTEL_SMS_UIT_BEWUST: '1' } });
  t.after(() => stop(prod.child));
  const start = (org) => fetch(prod.base + '/api/sso/start?org=' + org,
    { redirect: 'manual', headers: { 'X-Forwarded-Proto': 'https' } })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  const pGoed = await start('goed');
  assert.equal(pGoed.status, 502, 'productie: een geldig geheim laat de inlog door tot de (hier onbereikbare) provider: ' + JSON.stringify(pGoed.body));
  const pLeeg = await start('leeg');
  assert.equal(pLeeg.status, 503);
  assert.equal(pLeeg.body.code, 'SSO_GEHEIM_GEEN_GEHEIM');
  const pGerekt = await start('gerekt');
  assert.equal(pGerekt.status, 503, 'een opgerekte datum maakt het slot onleesbaar, niet langer geldig');
  assert.equal(pGerekt.body.code, 'SSO_GEHEIM_ONLEESBAAR');
  // ook de terugreis: een geldige state, maar zonder bruikbaar geheim geen tokenruil
  const terug = (org) => fetch(prod.base + '/api/sso/terug?code=c&state=' + staatVoor(org),
    { redirect: 'manual', headers: { 'X-Forwarded-Proto': 'https' } })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  const tLeeg = await terug('leeg');
  assert.equal(tLeeg.status, 503, JSON.stringify(tLeeg.body));
  assert.equal(tLeeg.body.code, 'SSO_GEHEIM_GEEN_GEHEIM');
  assert.equal((await terug('gerekt')).body.code, 'SSO_GEHEIM_ONLEESBAAR');
  const tGoed = await terug('goed');
  assert.equal(tGoed.status, 401, 'met een geldig geheim gaat de terugreis wel naar de (onbereikbare) provider: ' + JSON.stringify(tGoed.body));
  const pOud = await start('oud');
  assert.equal(pOud.status, 502, 'een geheim uit de oude opslag werkt na herzegelen: ' + JSON.stringify(pOud.body));
  await stopNet(prod.child);

  const na = new DatabaseSync(path.join(tmp, 'rtg.db'));
  const w = na.prepare('SELECT enc_client_secret AS w FROM sso_koppelingen WHERE org = ?').get('oud').w;
  na.close();
  assert.ok(w.startsWith('RTGSSO2:'), 'bij het laden herzegeld naar de sleutel per tenant');
  assert.equal(w.includes('uit-de-oude-opslag'), false);
  assert.equal(JSON.parse(w.slice(8)).sloten[0].gemigreerd, true);
});
