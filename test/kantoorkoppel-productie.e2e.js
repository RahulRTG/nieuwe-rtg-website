/* B24 + B10 VIA HET SCHERM, OP EEN PRODUCTIESERVER, IN EEN ECHTE BROWSER.

   test/kantoor-koppel-passkey.test.js bewijst de server; deze toets bewijst
   dat het SCHERM die weg ook aflegt. Een medewerker met een eigen lid-account
   zet op /apps/passkeys.html een passkey (virtuele authenticator), vult op
   /apps/personeel.html zijn kantooruitnodiging in en klikt "Koppel aan mijn
   account": het koppelen vraagt de ceremonie (B24) en slaagt zonder gedeelde
   TOTP; daarna opent het scherm het kantoor met een tweede ceremonie (B10) en
   staat hij in zijn kantoor, met een kantoortoken en zonder foutmelding.

   De opstelling, niet de productiecode, lost de herkomst op: APP_URL is
   https://rtg.voorbeeld.test, dus de browser bezoekt DAT adres en Playwright
   stuurt elk verzoek door naar de lokale server (met X-Forwarded-Proto https,
   zoals een proxy). Zo is de pagina een veilige context met de RP-id van
   APP_URL, en blijft de grens "WebAuthn-herkomst komt uit APP_URL" heel.

   Draai los: node --test test/kantoorkoppel-productie.e2e.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stopHard, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const { maakAuthenticator } = require('./webauthn-authenticator');

const pw = laadPlaywright();
const APP = 'https://rtg.voorbeeld.test';
const HOST = new URL(APP).hostname;
const EIGENAAR = 'eigenaar@echtdomein.nl';
const BOOTSTRAP = 'd'.repeat(32);
const KEYS = { RTG_ENC_KEY: 'k'.repeat(64), RTG_VAULT_KEY: 'v'.repeat(64), RTG_SECRET_KEY: 's'.repeat(64) };
const kort = b => JSON.stringify(b).slice(0, 200);
const tel = () => '06' + String(10000000 + Math.floor(Math.random() * 8e7));

test('productie, via het scherm: uitnodiging koppelen met de eigen passkey en daarna het kantoor in',
  { skip: geenBrowser(pw), timeout: 180000 }, async t => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kantoorkoppel-e2e-'));
  /* EEN opruiming, in de volgorde die de opstelling vraagt. node:test draait
     t.after-hooks in de volgorde van registratie, dus drie losse hooks stopten
     eerst de SERVER en sloten pas daarna de browser -- terwijl de service
     worker en de Edge-scripts na de laatste assert nog bestanden ophaalden.
     Die verzoeken lopen via route.fetch naar de server; met de server weg
     werd dat ECONNRESET of "Request context disposed", als unhandledRejection
     na een groene toets. Eerst de browser dicht (dan stopt het verkeer), dan
     de server, dan de map. */
  let child, browser, sluit = false;
  const routeFouten = [];
  t.after(async () => {
    sluit = true;
    if (browser) await browser.close();
    if (child) await stopHard(child);
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    assert.deepEqual(routeFouten, [], 'de opstelling stuurde elk verzoek door naar de server');
  });
  const srv = await startServer({ env: { NODE_ENV: 'production', RTG_DEMO: '0', RTG_DATA_DIR: tmp,
    APP_URL: APP + '/', SMTP_URL: 'smtp://rtg:test@mail.voorbeeld.test:587',
    ERR_WEBHOOK_URL: 'https://alarm.voorbeeld.test/rtg', ...KEYS, RTG_OWNER_EMAIL: EIGENAAR,
    RTG_OWNER_BOOTSTRAP: BOOTSTRAP, OFFICE_CODE: 'GEHEIME-CODE-123', OFFICE_TOTP_SECRET: 'JBSWY3DPEHPK3PXP',
    RTG_ISOLATIE_AFDWINGEN: '1', RTG_BETALEN_UIT: '1', RTG_AI_UIT: '1', RTG_HERSTEL_SMS_UIT_BEWUST: '1' } });
  child = srv.child;
  const base = srv.base;
  const api = (pad, body, token) => fetch(base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json',
    'X-Forwarded-Proto': 'https', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  const reg = (naam, email, extra) => api('/api/auth/register', { name: naam, email, phone: tel(),
    password: 'Geheim123!', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg', ...(extra || {}) });

  /* de eigenaar maakt de uitnodiging langs de API (dat is niet wat hier getoetst wordt) */
  const eigLid = (await reg('Eigenaar', EIGENAAR, { eigenaarSleutel: BOOTSTRAP })).body.token;
  assert.ok(eigLid, 'eigenaar geregistreerd');
  const eigSleutel = maakAuthenticator(HOST);
  const ro = await api('/api/webauthn/registreer/opties', {}, eigLid);
  assert.equal((await api('/api/webauthn/registreer', { antwoord: eigSleutel.registratieAntwoord(ro.body.opties.challenge, APP), naam: 'E' }, eigLid)).status, 200);
  const teken = (b, n) => ({ ceremonie: b.ceremonie, antwoord: eigSleutel.loginAntwoord(b.opties.challenge, APP, n) });
  const st = await api('/api/account/start', { rol: 'kantoor' }, eigLid);
  const eigKantoor = (await api('/api/account/start', { rol: 'kantoor', ...teken(st.body.bevestiging, 1) }, eigLid)).body.token;
  assert.ok(eigKantoor, 'eigenaar in het kantoor');
  const mwLid = (await reg('Nieuwe Medewerker', 'mw' + Date.now().toString(36) + '@voorbeeld.test')).body.token;
  assert.ok(mwLid, 'medewerker geregistreerd');
  const mwCodenaam = (await api('/api/auth/me', {}, mwLid)).body.user.codename;
  const op = await api('/api/office/boardroom/bevestig/opties', { actie: 'eigenaar-kantooruitnodiging' }, eigKantoor);
  const uitn = await api('/api/office/kantoor/uitnodiging', { codenaam: mwCodenaam, ...teken(op.body, 2) }, eigKantoor);
  assert.equal(uitn.status, 200, kort(uitn.body));
  assert.match(uitn.body.code, /^KU\.[0-9A-F]{32}$/i);

  browser = await pw.chromium.launch(browserOpties(pw));
  const c = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  /* de opstelling: https://rtg.voorbeeld.test wordt de lokale server */
  /* Een doorgestuurd verzoek dat faalt OMDAT de opruiming de browser sluit,
     is geen bevinding: dat is het verkeer dat na de laatste assert nog liep.
     Alleen die ene oorzaak wordt genegeerd -- de vlag `sluit` staat dan aan en
     de fout is een sluitfout. Elke andere fout (de server weg terwijl de toets
     nog loopt, een ECONNRESET midden in de keten) breekt het verzoek af en
     laat de toets zakken via routeFouten. */
  const sluitFout = /has been closed|context disposed|Target closed/i;
  await c.route(APP + '/**', async route => {
    const u = new URL(route.request().url());
    try {
      const response = await route.fetch({ url: base + u.pathname + u.search, maxRedirects: 0,
        headers: { ...route.request().headers(), 'x-forwarded-proto': 'https' } });
      await route.fulfill({ response });
    } catch (err) {
      if (sluit && sluitFout.test(String(err && err.message))) return;
      routeFouten.push(u.pathname + ': ' + String(err && err.message).split('\n')[0]);
      await route.abort('failed').catch(() => {});
    }
  });
  await c.addInitScript(tok => {
    localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    localStorage.setItem('rtg_member_token', tok);
  }, mwLid);
  const p = await c.newPage();
  const cdp = await c.newCDPSession(p);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2',
    transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  const fouten = [];
  letOpFouten(p, fouten);
  const antwoord = (pad, filter) => p.waitForResponse(r => new URL(r.url()).pathname === pad && (!filter || filter(r)));

  /* de medewerker zet zijn eigen passkey, op het scherm daarvoor */
  await p.goto(APP + '/apps/passkeys.html', { waitUntil: 'domcontentloaded' });
  await p.locator('#bNaam').fill('Eigen toestel');
  const regA = antwoord('/api/webauthn/registreer');
  await p.locator('#bMaak').click();
  assert.equal((await regA).status(), 200, 'de passkey van de medewerker is geregistreerd');
  assert.equal((await cdp.send('WebAuthn.getCredentials', { authenticatorId })).credentials.length, 1);

  /* 1. koppelen: eerst 401 met de ceremonie, dan 200 met de passkey (B24) */
  await p.goto(APP + '/apps/personeel.html?kantoor', { waitUntil: 'domcontentloaded' });
  await p.locator('#kaUitn').waitFor({ state: 'visible' });
  assert.equal(await p.locator('#kaTotp').inputValue(), '', 'er wordt geen gedeelde TOTP ingevuld');
  await p.locator('#kaUitn').fill(uitn.body.code);
  const koppelVraag = antwoord('/api/account/koppel', r => r.status() === 401);
  const koppelOk = antwoord('/api/account/koppel', r => r.status() !== 401);
  const startOk = antwoord('/api/account/start', r => r.status() !== 401);
  await p.locator('#kaUitnGo').click();
  const vraag = await (await koppelVraag).json();
  assert.equal(vraag.bevestigingNodig, true, 'het koppelen vraagt de ceremonie');
  assert.equal(vraag.actie, 'kantoor-koppel');
  const kop = await koppelOk;
  assert.equal(kop.status(), 200, 'gekoppeld met de passkey: ' + (await kop.text()).slice(0, 200));
  assert.ok(JSON.parse(kop.request().postData()).ceremonie, 'het tweede verzoek droeg de ceremonie');

  /* 2. het kantoor openen: de B10-ceremonie, daarna het kantoorscherm */
  const start = await startOk;
  assert.equal(start.status(), 200, 'het kantoor opent op naam: ' + (await start.text()).slice(0, 200));
  await p.locator('#kaMeld').waitFor({ state: 'visible', timeout: 20000 });
  const stand = await p.evaluate(() => ({ token: localStorage.getItem('rtg_office_token'),
    fout: document.querySelector('#kaFout') ? document.querySelector('#kaFout').textContent.trim() : '' }));
  assert.ok(stand.token, 'er staat een kantoortoken in de browser');
  assert.equal(stand.fout, '', 'geen foutmelding in #kaFout');
  assert.equal((await api('/api/office/securitylog', {}, stand.token)).status, 200, 'het token opent het kantoor');
  const rollen = (await api('/api/account/rollen', {}, mwLid)).body.rollen || [];
  assert.ok(rollen.some(r => r.rol === 'kantoor'), 'de kantoorrol hangt aan zijn account');
  assert.deepEqual(fouten, [], 'geen paginafouten');
  assert.deepEqual(routeFouten, [], 'de opstelling stuurde elk verzoek door naar de server');
});
