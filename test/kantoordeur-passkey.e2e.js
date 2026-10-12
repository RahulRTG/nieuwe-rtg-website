/* EEN KANTOORDEUR IN PRODUCTIE: DE PASSKEY, OP DRIE SCHERMEN EEN WEG.

   De eigenaar logde in productie in met zijn eigen account en kwam niet in het
   kantoor. Op /apps/personeel.html?kantoor stonden twee ingangen: het
   kantoorcodeveld (dat in productie altijd 403 geeft, B10) en "Verder met uw
   RTG-account"; en Werk -> Backoffice in de app liep vast op "Bevestig deze
   handeling met uw passkey." omdat hij de ceremonie niet kende. Besluit van de
   eigenaar: een ingang, de passkey (shared/kantoordeur.js).

   Wat hier op een echte productieserver in een echte browser vastligt:
   1. ZONDER PASSKEY: geen codeveld en geen knop die toch niets doet, maar een
      directe link naar /apps/passkeys.html. Geen kantoortoken.
   2. MET PASSKEY: het codevak staat niet op het scherm, er is precies een knop
      ("Kantoor openen met passkey"), de ceremonie ligt klaar voor de tik en er
      gaat niets open zonder tik. Na de tik: het kantoor, op naam.
   3. WERK -> BACKOFFICE gebruikt dezelfde deur: zonder passkey op het toestel
      blijft het kantoor dicht (de dialoog, afgebroken, geen token); met de
      passkey komt hij binnen in /apps/backoffice.html.

   De opstelling lost de herkomst op zoals test/kantoorkoppel-productie.e2e.js:
   APP_URL is https://rtg.voorbeeld.test en Playwright stuurt dat door naar de
   lokale server, zodat de RP-id uit APP_URL komt en niet uit de toets.

   Draai los: node --test test/kantoordeur-passkey.e2e.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stopHard, letOpFouten, laadPlaywright, browserOpties, geenBrowser, bankDeur } = require('./helper');

const pw = laadPlaywright();
const APP = 'https://rtg.voorbeeld.test';
const EIGENAAR = 'eigenaar@echtdomein.nl';
const BOOTSTRAP = 'd'.repeat(32);
const KEYS = { RTG_ENC_KEY: 'k'.repeat(64), RTG_VAULT_KEY: 'v'.repeat(64), RTG_SECRET_KEY: 's'.repeat(64) };
const tel = () => '06' + String(10000000 + Math.floor(Math.random() * 8e7));

test('productie: het kantoor opent op een weg, de passkey, op personeel en via Werk -> Backoffice',
  { skip: geenBrowser(pw), timeout: 240000 }, async t => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kantoordeur-passkey-'));
  let child, browser, sluit = false;
  const routeFouten = [];
  t.after(async () => {
    sluit = true;
    if (browser) await browser.close();
    if (child) await stopHard(child);
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  const srv = await startServer({ env: { NODE_ENV: 'production', RTG_DEMO: '0', RTG_DATA_DIR: tmp,
    STUN_PUBLIC_HOST: 'stun.rahultravelgroup.com', STUN_URL: 'stun:stun.rahultravelgroup.com:3478',
    TURN_URL: 'turns:turn.rahultravelgroup.com:5349', TURN_SECRET: 'T9!relay-A7#tijdelijk-B4$geheim-C8%2026',
    APP_URL: APP + '/', SMTP_URL: 'smtp://rtg:test@mail.voorbeeld.test:587',
    RTG_ANKERPOST_URL: 'https://anker.voorbeeld.test/', ERR_WEBHOOK_URL: 'https://alarm.voorbeeld.test/rtg', ...KEYS, RTG_OWNER_EMAIL: EIGENAAR,
    RTG_OWNER_BOOTSTRAP: BOOTSTRAP, OFFICE_CODE: 'GEHEIME-CODE-123', OFFICE_TOTP_SECRET: 'JBSWY3DPEHPK3PXP',
    RTG_ISOLATIE_AFDWINGEN: '1', RTG_BETALEN_UIT: '1', RTG_AI_UIT: '1', RTG_HERSTEL_SMS_UIT_BEWUST: '1' } });
  child = srv.child;
  const base = srv.base;
  const api = (pad, body, token) => fetch(base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json',
    'X-Forwarded-Proto': 'https', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  // de stand van de deur komt van de server, en in productie is de code dicht
  const health = await (await fetch(base + '/api/health', { headers: { 'X-Forwarded-Proto': 'https' } })).json();
  assert.deepEqual(health.kantoordeur, { code: false, passkey: true }, 'de server meldt een deur: de passkey');
  assert.equal((await api('/api/office/login', { code: 'GEHEIME-CODE-123' })).status, 403, 'de code opent in productie niet');

  const eig = await api('/api/auth/register', { name: 'Eigenaar', email: EIGENAAR, phone: tel(), password: 'Geheim123!',
    geboortedatum: '1980-01-01', tier: 'rtg', pasApp: 'rtg', eigenaarSleutel: BOOTSTRAP });
  const lid = eig.body.token;
  assert.ok(lid, 'de eigenaar heeft zijn eigen account');

  browser = await pw.chromium.launch(browserOpties(pw));
  const sluitFout = /has been closed|context disposed|Target closed/i;
  async function context() {
    const c = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
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
    }, lid);
    const p = await c.newPage();
    const cdp = await c.newCDPSession(p);
    await cdp.send('WebAuthn.enable');
    const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2',
      transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true,
      automaticPresenceSimulation: true } });
    const fouten = [];
    letOpFouten(p, fouten);
    return { c, p, cdp, authenticatorId, fouten };
  }
  const zichtbareKnoppen = p => p.evaluate(() => [...document.querySelectorAll('#gateStep .card button, #gateStep .card a.abtn')]
    .filter(b => b.offsetParent !== null).map(b => ({ id: b.id, tekst: b.textContent.trim(), href: b.getAttribute('href') })));

  const A = await context();
  const p = A.p;

  /* 1. zonder passkey: geen codeveld, geen nutteloze knop, wel de weg erheen */
  await p.goto(APP + '/apps/personeel.html?kantoor', { waitUntil: 'domcontentloaded' });
  await p.locator('#kaPasskeyZet').waitFor({ state: 'visible', timeout: 20000 });
  assert.equal(await p.locator('#kaCode').isVisible(), false, 'het codeveld staat niet op het scherm');
  assert.deepEqual(await zichtbareKnoppen(p), [{ id: 'kaPasskeyZet', tekst: 'Een passkey toevoegen', href: '/apps/passkeys.html' }],
    'zonder passkey is de enige ingang de weg naar een passkey');
  assert.equal(await p.evaluate(() => localStorage.getItem('rtg_office_token')), null, 'zonder passkey geen kantoortoken');

  /* de eigenaar zet zijn passkey, op het scherm daarvoor */
  await p.goto(APP + '/apps/passkeys.html', { waitUntil: 'domcontentloaded' });
  await p.locator('#bNaam').fill('Eigen toestel');
  const reg = p.waitForResponse(r => new URL(r.url()).pathname === '/api/webauthn/registreer');
  await p.locator('#bMaak').click();
  await p.locator('#rtgHbWw').fill('Geheim123!');
  await p.locator('dialog[open] button[type=submit]').click();
  assert.equal((await reg).status(), 200, 'de passkey is geregistreerd');

  /* 2. met passkey: een knop, de ceremonie klaar, niets open zonder tik */
  const starts = [];
  p.on('response', r => { if (new URL(r.url()).pathname === '/api/account/start') starts.push(r.status()); });
  const vooraf = p.waitForResponse(r => new URL(r.url()).pathname === '/api/account/start', { timeout: 20000 });
  await p.goto(APP + '/apps/personeel.html?kantoor', { waitUntil: 'domcontentloaded' });
  assert.equal((await vooraf).status(), 401, 'de ceremonie wordt vooraf opgehaald, zonder sessie');
  await p.waitForFunction(() => /Kantoor openen met passkey/.test((document.querySelector('#kaAccountVerder') || {}).textContent || ''), null, { timeout: 20000 });
  assert.equal(await p.locator('#kaCode').isVisible(), false, 'het codeveld staat niet op het scherm');
  assert.deepEqual((await zichtbareKnoppen(p)).map(b => b.id), ['kaAccountVerder'], 'er is precies een ingang');
  assert.deepEqual(starts, [401], 'de ceremonie is vooraf opgehaald, en de deur ging nog niet open');
  assert.equal(await p.evaluate(() => localStorage.getItem('rtg_office_token')), null, 'zonder tik geen kantoortoken');
  const binnen = p.waitForResponse(r => new URL(r.url()).pathname === '/api/account/start' && r.status() === 200);
  await p.locator('#kaAccountVerder').click();
  const ok = await binnen;
  assert.ok(JSON.parse(ok.request().postData()).ceremonie, 'de tik leverde een passkeyceremonie in');
  await p.locator('#kaMeld').waitFor({ state: 'visible', timeout: 20000 });
  const tok = await p.evaluate(() => localStorage.getItem('rtg_office_token'));
  assert.ok(tok, 'er staat een kantoortoken');
  assert.equal((await api('/api/office/securitylog', {}, tok)).status, 200, 'het token opent het kantoor');

  /* 3. Werk -> Backoffice: dezelfde deur. Eerst op een toestel ZONDER de passkey. */
  async function naarBackoffice(q) {
    const st = (await api('/api/state', {}, lid)).body;
    const tier = st && st.state && st.state.user && st.state.user.tier;
    await q.goto(APP + '/apps/app.html?pas=' + (tier === 'guest' || !tier ? 'rtg' : tier), { waitUntil: 'domcontentloaded' });
    await q.waitForSelector('#gate', { state: 'hidden', timeout: 30000 });
    await q.waitForSelector('#app.active', { state: 'attached', timeout: 15000 });
    await q.evaluate(() => { localStorage.removeItem('rtg_office_token'); const g = document.getElementById('onbGate'); if (g) g.hidden = true; });
    await bankDeur(q, 'Instellingen');
    await q.waitForSelector('#osCcScrim.open', { timeout: 10000 });
    await q.click('#osCcZoek');
    await q.waitForFunction(() => { const i = document.querySelector('#osZoekInput'); return !!i && document.activeElement === i && i.value === ''; }, null, { timeout: 10000 });
    await q.waitForFunction(() => {
      const i = document.querySelector('#osZoekInput'); i.value = 'werkplekken'; i.dispatchEvent(new Event('input', { bubbles: true }));
      return [...document.querySelectorAll('#osZoekLijst button')].some(b => /Mijn werkplekken/.test(b.textContent));
    }, null, { timeout: 10000 });
    await q.evaluate(() => [...document.querySelectorAll('#osZoekLijst button')].find(b => /Mijn werkplekken/.test(b.textContent)).click());
    await q.waitForFunction(() => [...document.querySelectorAll('#osBelLijst button')].some(b => /Backoffice/.test(b.textContent)), null, { timeout: 15000 });
    await q.evaluate(() => [...document.querySelectorAll('#osBelLijst button')].find(b => /Backoffice/.test(b.textContent)).click());
    // de algemene pin, de eerste keer: zetten
    const pin = q.locator('#osBelLijst input[type=password]');
    await pin.waitFor({ state: 'visible', timeout: 10000 });
    await pin.fill('482916');
    await pin.press('Enter');
  }
  const B = await context();   // een eigen virtuele sleutel, zonder de passkey van dit account
  await naarBackoffice(B.p);
  /* De virtuele sleutel kent geen passkey van dit account: de ceremonie zakt,
     de dialoog vraagt een tik, en afbreken laat het kantoor dicht. */
  await B.p.locator('#rtgKdTik').waitFor({ state: 'visible', timeout: 20000 });
  await B.p.locator('#rtgKdTik button:not(#rtgKdTikGo)').click();
  await B.p.waitForFunction(() => !document.querySelector('#rtgKdTik'), null, { timeout: 10000 });
  assert.equal(await B.p.evaluate(() => localStorage.getItem('rtg_office_token')), null, 'zonder passkey blijft het kantoor dicht');
  assert.match(B.p.url(), /\/apps\/app\.html/, 'en het toestel blijft in de app');

  // op het toestel met de passkey: binnen, in de backoffice
  const naar = A.p.waitForURL(/\/apps\/backoffice\.html/, { timeout: 30000 });
  const startOk = A.p.waitForResponse(r => new URL(r.url()).pathname === '/api/account/start' && r.status() === 200, { timeout: 30000 });
  await naarBackoffice(A.p);
  const s = await startOk;
  assert.ok(JSON.parse(s.request().postData()).ceremonie, 'Werk -> Backoffice leverde een passkeyceremonie in');
  await naar;
  const tok2 = await A.p.evaluate(() => localStorage.getItem('rtg_office_token'));
  assert.ok(tok2, 'Werk -> Backoffice zette een kantoortoken');
  assert.equal((await api('/api/office/securitylog', {}, tok2)).status, 200, 'en dat opent het kantoor');

  assert.deepEqual(routeFouten, [], 'de opstelling stuurde elk verzoek door naar de server');
});
