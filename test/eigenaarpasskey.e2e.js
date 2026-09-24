/* DE EIGENAAR MET EEN PASSKEY, IN EEN ECHTE BROWSER (AUTHORITY.md fase 2 en 7).

   Alle toetsen van de zware poort draaiden tot 23 september 2026 zonder dat de
   eigenaar een passkey had -- dan gaat een zware handeling op de terugval door, en
   drie routes bleken daarna onbereikbaar omdat de ceremonie hun naam niet kende.
   Deze toets loopt de weg zoals een mens hem loopt: een virtuele authenticator in
   Chromium, en alleen knoppen op de schermen.

   1. de eigenaar zet een passkey op /apps/passkeys.html;
   2. daarna vraagt de boardroom om de vinger, en maakt hij een kantooruitnodiging
      (Iemand in het kantoor) en een doossleutel (De zaakdozen);
   3. de nieuwe medewerker verzilvert de uitnodiging in de kantoorlogin van
      /apps/personeel.html en komt het kantoor in;
   4. zonder de vinger weigert de server dezelfde handeling met bevestigingNodig.

   Draai los: node --test test/eigenaarpasskey.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();

test('de eigenaar bevestigt zware handelingen met een passkey, vanaf de schermen',
  { skip: geenBrowser(pw), timeout: 240000 }, async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-eigenaarpasskey-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: dataDir } });
  const base = srv.base.replace('127.0.0.1', 'localhost');
  const browser = await pw.chromium.launch(browserOpties(pw));
  const fouten = [];
  async function api(pad, data, token) {
    const r = await fetch(base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(data || {}) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  }
  async function context(token) {
    const c = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    await c.addInitScript((t) => {
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.setItem('rtg_member_token', t);
    }, token);
    return c;
  }
  const antwoord = (p, pad) => p.waitForResponse(r => new URL(r.url()).pathname === pad && r.status() !== 401);
  try {
    const eig = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
    assert.ok(eig, 'de eigenaar is ingelogd');
    const c = await context(eig);
    const cdp = await c.newCDPSession(await c.newPage());
    await cdp.send('WebAuthn.enable');
    await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal',
      hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
    const p = c.pages()[0];
    letOpFouten(p, fouten);

    /* 1. de passkey zetten, op het scherm daarvoor */
    await p.goto(base + '/apps/passkeys.html', { waitUntil: 'domcontentloaded' });
    await p.locator('#bNaam').fill('Virtuele vinger');
    const reg = antwoord(p, '/api/webauthn/registreer');
    await p.locator('#bMaak').click();
    assert.equal((await reg).status(), 200, 'de passkey is geregistreerd');
    await p.locator('#sleutels', { hasText: 'Virtuele vinger' }).waitFor();

    /* 4 (eerst, want het maakt de rest bewijs): zonder vinger is het nu hard */
    const nieuw = (await api('/api/auth/register', { name: 'Nieuwe Medewerker', email: 'medewerker' + Date.now() + '@voorbeeld.test',
      password: 'geheim123', geboortedatum: '1988-04-04', pasApp: 'rtg' })).body;
    const mw = nieuw.token;
    const codenaam = (await api('/api/auth/me', {}, mw)).body.user.codename;
    const kaal = await api('/api/office/kantoor/uitnodiging', { codenaam }, eig);
    assert.equal(kaal.status, 401, 'zonder vinger geen uitnodiging meer');
    assert.equal(kaal.body.bevestigingNodig, true);
    const kaalDoos = await api('/api/office/doos/sleutel', { doos: 'doos-kaal' }, eig);
    assert.equal(kaalDoos.status, 401, 'en geen doossleutel: ' + JSON.stringify(kaalDoos.body));

    /* 2. de boardroom: een uitnodiging en een doossleutel, met de vinger */
    await p.goto(base + '/apps/boardroom.html', { waitUntil: 'domcontentloaded' });
    await p.locator('#boTabs .tab[data-paneel="tabLeden"]').click();
    await p.locator('#kuSectie').waitFor({ state: 'visible' });
    await p.locator('#kuCode').fill(codenaam);
    const uitn = antwoord(p, '/api/office/kantoor/uitnodiging');
    await p.locator('#kuMaak').click();
    assert.equal((await uitn).status(), 200, 'de uitnodiging is met de passkey bevestigd');
    await p.locator('#kuUit', { hasText: 'geldig tot' }).waitFor();
    const code = ((await p.locator('#kuUit').innerText()).match(/[A-Z2-9]{10}/) || [])[0];
    assert.ok(code, 'de code staat een keer op het scherm');

    await p.locator('#dsSectie').waitFor({ state: 'visible' });
    await p.locator('#dsNaam').fill('doos-proef');
    const doos = antwoord(p, '/api/office/doos/sleutel');
    await p.locator('#dsGeef').click();
    assert.equal((await doos).status(), 200, 'de doossleutel is met de passkey bevestigd');
    await p.locator('#dsUit', { hasText: 'RTG_DOOS_ID=doos-proef' }).waitFor();
    assert.match(await p.locator('#dsUit').innerText(), /[0-9a-f]{48}/);
    await p.locator('#dsEigen', { hasText: 'doos-proef' }).waitFor();
    /* de gedeelde doos-sleutel dicht en weer open, met de vinger: hier meldt geen
       doos met de gedeelde sleutel, dus dicht mag */
    const dicht = antwoord(p, '/api/office/doos/gedeeld/zet');
    await p.locator('#dsSchakel').click();
    assert.equal((await dicht).status(), 200, 'de gedeelde sleutel is met de passkey dichtgezet');
    await p.locator('#dsGedeeld', { hasText: 'dicht' }).waitFor();
    const open = antwoord(p, '/api/office/doos/gedeeld/zet');
    await p.locator('#dsSchakel').click();
    assert.equal((await open).status(), 200, 'en weer open');
    await p.locator('#dsGedeeld', { hasText: 'open (schaduw)' }).waitFor();
    /* de kantoordeuren: in een vers proces is geen deur rijp, en de knop zegt
       dat met de reden van de server in plaats van stil te falen */
    await p.locator('#bmDeuren [data-deur="kantoor"]').waitFor();
    const deur = antwoord(p, '/api/office/beleidsmotor/afdwingen/zet');
    await p.locator('#bmDeuren [data-deur="kantoor"]').click();
    assert.equal((await deur).status(), 409, 'een vers proces is niet rijp');
    await p.locator('body', { hasText: 'nog niet afgedwongen' }).waitFor();
    await c.close();

    /* 3. de medewerker verzilvert de uitnodiging op het personeelsscherm */
    const c2 = await context(mw);
    const p2 = await c2.newPage();
    letOpFouten(p2, fouten);
    await p2.goto(base + '/apps/personeel.html?kantoor', { waitUntil: 'domcontentloaded' });
    await p2.locator('#kaUitn').waitFor({ state: 'visible' });
    await p2.locator('#kaUitn').fill(code);
    const koppel = antwoord(p2, '/api/account/koppel');
    const start = p2.waitForResponse(r => new URL(r.url()).pathname === '/api/account/start');
    await p2.locator('#kaUitnGo').click();
    assert.equal((await koppel).status(), 200, 'de uitnodiging koppelt de kantoorrol');
    assert.equal((await start).status(), 200, 'en de medewerker komt het kantoor in');
    await c2.close();

    const rollen = await api('/api/account/rollen', {}, mw);
    assert.ok(rollen.body.rollen.some(r => r.rol === 'kantoor'), JSON.stringify(rollen.body));
    assert.deepEqual(fouten, [], 'geen paginafouten');
  } finally {
    await browser.close();
    stop(srv && srv.child);
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
  }
});
