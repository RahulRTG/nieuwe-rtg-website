/* EEN PASSKEY WEGHALEN VANAF HET SCHERM, IN EEN ECHTE BROWSER.

   Gevonden door de voltooiproef (scripts/lib/voltooi/passkeys.js): weghalen is
   een zware handeling (server/routes/auth/webauthn.js), dus wie een passkey
   heeft moet er zijn vinger voor geven -- en dat is per definitie iedereen die
   er een wil weghalen. /apps/passkeys.html stuurde alleen het id, kreeg 401 met
   bevestigingNodig terug, en toonde die zin: "Verwijder" deed vanaf het scherm
   nooit iets. Nu vangt /shared/zwaarstap.js de vraag, tekent de browser, en
   gaat dezelfde handeling met het bewijs nog een keer.

   Een virtuele authenticator in Chromium en alleen knoppen op het scherm, net
   als test/eigenaarpasskey.e2e.js.

   Draai los: node --test test/passkeys-weg.e2e.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();

test('een passkey weghalen op /apps/passkeys.html vraagt de vinger en haalt hem dan echt weg',
  { skip: geenBrowser(pw), timeout: 180000 }, async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-passkeysweg-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: dataDir } });
  const base = srv.base.replace('127.0.0.1', 'localhost');
  const browser = await pw.chromium.launch(browserOpties(pw));
  const fouten = [];
  try {
    const r = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' }) });
    const token = (await r.json()).token;
    assert.ok(token, 'ingelogd');
    const c = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    await c.addInitScript((t) => {
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.setItem('rtg_member_token', t);
    }, token);
    const p = await c.newPage();
    const cdp = await c.newCDPSession(p);
    await cdp.send('WebAuthn.enable');
    await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal',
      hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
    letOpFouten(p, fouten);

    await p.goto(base + '/apps/passkeys.html', { waitUntil: 'domcontentloaded' });
    await p.locator('#bNaam').fill('Wegwerpvinger');
    const reg = p.waitForResponse(x => new URL(x.url()).pathname === '/api/webauthn/registreer');
    await p.locator('#bMaak').click();
    await p.locator('#rtgHbWw').fill('Imran');
    await p.getByRole('button', { name: 'Bevestig', exact: true }).click();
    assert.equal((await reg).status(), 200, 'de passkey is geregistreerd');
    await p.locator('#sleutels', { hasText: 'Wegwerpvinger' }).waitFor();

    const weg = p.waitForResponse(x => new URL(x.url()).pathname === '/api/webauthn/weg' && x.status() !== 401);
    await p.locator('#sleutels .sleutel', { hasText: 'Wegwerpvinger' }).getByRole('button', { name: 'Verwijder' }).click();
    assert.equal((await weg).status(), 200, 'met de vinger gaat het weghalen door');
    await p.locator('#sleutels', { hasText: 'Nog geen passkeys.' }).waitFor();

    const lijst = await fetch(base + '/api/webauthn/lijst', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: '{}' });
    assert.equal(((await lijst.json()).sleutels || []).length, 0, 'de server heeft hem ook echt niet meer');
    assert.deepEqual(fouten, [], 'geen fouten in de console');
  } finally {
    await browser.close();
    stop(srv.child);
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) { /* al weg */ }
  }
});
