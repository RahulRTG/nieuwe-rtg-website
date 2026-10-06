/* SCHERM-TEST: de SSO-clientgeheimen op de techniekpagina (besluit B16).

   Het blok toont per koppeling de STAND en nooit het geheim: de vingerafdruk,
   verval, overlap, en of de inlog dicht staat met de reden. De toets loopt de
   weg van de eigenaar: inloggen, het blok zien vullen uit het antwoord van de
   server, een nieuw geheim invoeren en roteren, de overlap sluiten -- en
   onderweg staat geen van beide geheimen ooit in de pagina, ook niet in het
   invoerveld nadat het verstuurd is. Sinds B22 vraagt roteren een verse passkey:
   de eigenaar heeft er een (een nagespeelde sleutel, in de browser als virtuele
   authenticator), en het scherm doet de ceremonie via shared/zwaarbevestig.js.
   Op localhost, want een IP-adres is voor de browser geen geldige rpId.

   Draait alleen waar een browser is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const { zwaarApi } = require('./zwaarpasskey');

const pw = laadPlaywright();
const OWNER = 'ssoscherm-eigenaar@x.nl';
const EERSTE = 'eerste-geheim-' + Date.now().toString(36);
const TWEEDE = 'tweede-geheim-' + Date.now().toString(36);

test('de techniekpagina toont het SSO-clientgeheim alleen als stand, en roteert zonder het terug te tonen',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ssoscherm-e2e-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_OWNER_EMAIL: OWNER } });
  const child = srv.child, base = srv.base.replace('127.0.0.1', 'localhost');
  let browser;
  try {
    const inlog = await fetch(base + '/api/techniek/inloggen', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: OWNER, wachtwoord: 'Imran' }) }).then(r => r.json());
    assert.ok(inlog.token, 'de toets moet als eigenaar binnenkomen, anders meet zij een dichte deur');
    const api = (pad, body, token) => fetch(base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token }, body: JSON.stringify(body || {}) })
      .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
    const lid = (await api('/api/auth/login', { login: OWNER, password: 'Imran', pasApp: 'business' })).body.token;
    const zw = await zwaarApi(api, base, lid, 'Imran');
    const post = (pad, body) => zw(pad, body, inlog.token).then(r => r.body);
    const gezet = await post('/api/techniek/sso', { org: 'schermklant', naam: 'Schermklant BV',
      issuer: 'https://idp.schermklant.test', clientId: 'c', clientSecret: EERSTE, domeinen: ['schermklant.test'] });
    assert.ok(gezet.ok, JSON.stringify(gezet));
    await post('/api/techniek/sso', { org: 'zonder', naam: 'Zonder Geheim', issuer: 'https://idp.zonder.test',
      clientId: 'c', domeinen: ['zonder.test'] });

    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('WebAuthn.enable');
    const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2',
      transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true,
      automaticPresenceSimulation: true } });
    await cdp.send('WebAuthn.addCredential', { authenticatorId, credential: { isResidentCredential: false,
      credentialId: zw.sleutel.credId.toString('base64'), rpId: 'localhost', signCount: 100,
      privateKey: zw.sleutel.privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64') } });
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/techniek.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate((t) => {
      sessionStorage.setItem('techToken', t);
      localStorage.setItem('rtg_lang', 'nl');
      localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, inlog.token);
    await page.reload({ waitUntil: 'domcontentloaded' });

    await page.waitForFunction(() => document.querySelectorAll('#ssoLijst .zeker').length >= 2, null, { timeout: 15000 });
    const tekst = await page.evaluate(() => document.querySelector('#ssoBlok').innerText);
    assert.match(tekst, /Vingerafdruk hmac:[0-9a-f]{16}/, 'de vingerafdruk staat er');
    assert.match(tekst, /Inloggen staat dicht: er is voor deze koppeling geen clientgeheim gezet/, 'dicht met de reden');
    const html = () => page.evaluate(() => document.documentElement.outerHTML);
    assert.equal((await html()).includes(EERSTE), false, 'het geheim staat nergens in de pagina');

    const rij = page.locator('#ssoLijst .zeker', { hasText: 'schermklant' });
    /* Een geweigerde rotatie (overlap buiten de grens) tekent de lijst niet
       opnieuw; ook dan staat het ingetypte geheim niet meer in het veld. */
    await rij.locator('input[type="password"]').fill(TWEEDE);
    await rij.locator('input[type="number"]').fill('99');
    await rij.locator('button', { hasText: 'Roteren' }).click();
    await page.waitForFunction(() => /overlap is 0 tot 7/.test(document.querySelector('#toast').textContent), null, { timeout: 15000 });
    assert.equal(await rij.locator('input[type="password"]').inputValue(), '', 'ook na een weigering is het veld leeg');
    await rij.locator('input[type="number"]').fill('7');

    // roteren via het scherm: het veld is een wachtwoordveld en is daarna leeg
    const veld = rij.locator('input[type="password"]');
    await veld.fill(TWEEDE);
    await rij.locator('button', { hasText: 'Roteren' }).click();
    await page.waitForFunction(() => /werkt nog tot/.test(document.querySelector('#ssoBlok').innerText), null, { timeout: 15000 });
    assert.equal(await rij.locator('input[type="password"]').inputValue(), '', 'het invoerveld is leeg na versturen');
    const na = await html();
    assert.equal(na.includes(EERSTE) || na.includes(TWEEDE), false, 'geen van beide geheimen in de pagina');

    await page.locator('#ssoLijst .zeker', { hasText: 'schermklant' }).locator('button', { hasText: 'Overlap sluiten' }).click();
    await page.waitForFunction(() => !/werkt nog tot/.test(document.querySelector('#ssoBlok').innerText), null, { timeout: 15000 });
    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
