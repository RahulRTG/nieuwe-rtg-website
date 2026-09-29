/* Schermtoets op de tab Besluiten in de boardroom (public/apps/boardroom-besluiten.js):
   het beslisgeheugen (C13) en de cadeaubon (C14), alleen met knoppen op het scherm.

   Vijf beweringen, en alle vijf kunnen ze zakken:
   1. een besluit vastleggen op het scherm legt het echt vast, op naam van de
      eigenaar en met de gronden van nu;
   2. intrekken vraagt een reden en laat het besluit staan;
   3. de cadeaubon omzetten vraagt de passkey, en de ceremonie kent de handeling
      (zonder vinger weigert de server met bevestigingNodig);
   4. open zegt het scherm er meteen bij dat de uitgifte nog steeds niet mag;
   5. geen fouten in de console.

   Draai los: node --test test/boardroombesluiten.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();

test('de boardroom legt een besluit vast en zet de cadeaubon om, vanaf het scherm',
  { skip: geenBrowser(pw), timeout: 240000 }, async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-boardroombesluiten-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: dataDir } });
  const base = srv.base.replace('127.0.0.1', 'localhost');
  const browser = await pw.chromium.launch(browserOpties(pw));
  const fouten = [];
  async function api(pad, data, token) {
    const r = await fetch(base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(data || {}) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  }
  const antwoord = (p, pad) => p.waitForResponse(r => new URL(r.url()).pathname === pad && r.status() !== 401);
  try {
    const eig = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
    assert.ok(eig, 'de eigenaar is ingelogd');
    const c = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    await c.addInitScript((t) => {
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.setItem('rtg_member_token', t);
    }, eig);
    const cdp = await c.newCDPSession(await c.newPage());
    await cdp.send('WebAuthn.enable');
    await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal',
      hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
    const p = c.pages()[0];
    letOpFouten(p, fouten);

    await p.goto(base + '/apps/passkeys.html', { waitUntil: 'domcontentloaded' });
    await p.locator('#bNaam').fill('Virtuele vinger');
    const reg = antwoord(p, '/api/webauthn/registreer');
    await p.locator('#bMaak').click();
    assert.equal((await reg).status(), 200, 'de passkey is geregistreerd');
    await p.locator('#sleutels', { hasText: 'Virtuele vinger' }).waitFor();

    await p.goto(base + '/apps/boardroom.html', { waitUntil: 'domcontentloaded' });
    await p.locator('#boTabs .tab[data-paneel="tabBesluiten"]').click();
    await p.locator('#bgSectie').waitFor({ state: 'visible' });

    /* 1. een besluit vastleggen */
    await p.locator('#bgTekst').fill('De prijs van de RTG Pass blijft dit kwartaal gelijk.');
    await p.locator('#bgVerwacht select').first().selectOption('omzet.leden-ontvangen');
    await p.locator('#bgVerwacht select').nth(1).selectOption('gelijk');
    await p.locator('#bgTermijn').fill('90');
    const leg = antwoord(p, '/api/office/beslisgeheugen/leg');
    await p.getByRole('button', { name: 'Leg vast, op mijn naam' }).click();
    assert.equal((await leg).status(), 200, 'het besluit is vastgelegd');
    await p.locator('#bgLijst [data-besluit]', { hasText: 'blijft dit kwartaal gelijk' }).waitFor();
    const lijst = (await api('/api/office/beslisgeheugen', {}, eig)).body.besluiten;
    assert.equal(lijst.length, 1);
    assert.ok(lijst[0].wie, 'op naam, gezet door de server');
    assert.equal(lijst[0].gronden[0].id, 'omzet.leden-ontvangen', 'de grond van nu reist mee');
    assert.equal(lijst[0].uitkomst.stand, 'NOG_NIET');
    assert.deepEqual(lijst[0].verwachting, [{ maat: 'omzet.leden-ontvangen', richting: 'gelijk' }], 'de gekozen richting komt aan');

    /* 2. intrekken met een reden */
    const rij = p.locator('#bgLijst [data-besluit]').first();
    await rij.locator('input').fill('Het kwartaal is anders gelopen');
    const trek = antwoord(p, '/api/office/beslisgeheugen/intrek');
    await rij.getByRole('button', { name: 'Trek in' }).click();
    assert.equal((await trek).status(), 200, 'ingetrokken');
    await p.locator('#bgLijst', { hasText: 'Het kwartaal is anders gelopen' }).waitFor();
    const na = (await api('/api/office/beslisgeheugen', {}, eig)).body.besluiten;
    assert.equal(na.length, 1, 'het besluit blijft staan');
    assert.equal(na[0].ingetrokken.reden, 'Het kwartaal is anders gelopen');

    /* 3 en 4. de cadeaubon: zonder vinger weigert de server, met de vinger gaat hij open */
    const kaal = await api('/api/office/cadeaubon/stand', { stand: 'open' }, eig);
    assert.equal(kaal.status, 401, 'zonder vinger geen omzetting: ' + JSON.stringify(kaal.body));
    assert.equal(kaal.body.bevestigingNodig, true);
    await p.locator('#cbStand', { hasText: 'dicht' }).waitFor();
    const zet = antwoord(p, '/api/office/cadeaubon/stand');
    await p.locator('#cbSchakel').click();
    assert.equal((await zet).status(), 200, 'met de passkey omgezet');
    await p.locator('#cbStand', { hasText: 'De cadeaubon · open' }).waitFor();
    await p.locator('#cbStand', { hasText: 'mag niet' }).waitFor();
    const beeld = (await api('/api/office/cadeaubon', {}, eig)).body;
    assert.equal(beeld.stand, 'open');
    assert.equal(beeld.uitgifte.mag, false, 'open zonder vergunning geeft nog steeds geen e-geld uit');

    assert.deepEqual(fouten, [], 'geen fouten in de console');
    await c.close();
  } finally {
    await browser.close();
    stop(srv);
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) { /* opruimen */ }
  }
});
