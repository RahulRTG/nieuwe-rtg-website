/* Schermtoets voor apps/mijn-gegevens.html.

   DE BEWERING DIE ERTOE DOET is dat "niet vast te stellen" op dit scherm een
   EIGEN gezicht heeft en niet dat van "nee". Dat is de hele reden dat deze
   kaart bestaat: een lid dat leest "RTG heeft mijn adres niet" terwijl de kluis
   niet opengaat, is verkeerd gerustgesteld. Op de server staat die regel al
   vast (test/gegevenskaart.test.js toets 3); hier wordt gekeken of hij het
   scherm haalt, want een onderscheid dat in de JSON zit en niet in de opmaak,
   bestaat voor een mens niet.

   En toets 3: de kaart draagt geen enkele WAARDE. Hier staat DAT er een
   e-mailadres is, niet welk -- dat is de grens met de AVG-uitvoer.

   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();

test('Gegevenskaart: soorten en geen inhoud, met onbekend als eigen uitslag',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gkscherm-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const reg = await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Kaart Lid', email: 'gkscherm@x.nl', phone: '0612345893',
        password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
    }).then(r => r.json());
    assert.ok(reg.token);

    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage();
    const paginaFouten = [];
    letOpFouten(page, paginaFouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/mijn-gegevens.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelectorAll('#lijst .rij').length > 0,
      null, { timeout: 15000 });

    /* 1. DE DRIE UITSLAGEN, elk met een eigen gezicht. */
    assert.ok(await page.locator('#lijst .vlag.ja').count() > 0, 'er staat iets dat RTG heeft');
    assert.ok(await page.locator('#lijst .vlag.nee').count() > 0, 'en iets dat RTG niet heeft');
    assert.ok(await page.locator('#lijst .vlag.onbekend').count() > 0,
      'en minstens een dat niet vast te stellen is -- die derde uitslag moet zichtbaar zijn');
    const kleuren = await page.evaluate(() => {
      const k = s => { const e = document.querySelector(s); return e ? getComputedStyle(e).color : null; };
      return { nee: k('.vlag.nee'), onbekend: k('.vlag.onbekend') };
    });
    assert.notEqual(kleuren.onbekend, kleuren.nee,
      '"niet vast te stellen" mag er niet uitzien als "nee"; dan bestaat het onderscheid voor een mens niet');

    /* 2. ELKE RIJ BEANTWOORDT DE VIER VRAGEN. */
    const eerste = await page.locator('#lijst .rij').first().textContent();
    assert.match(eerste, /Waarvoor/, 'waarvoor het gebruikt mag worden');
    assert.match(eerste, /Waar/, 'waar het staat');
    assert.match(eerste, /Hoe het bij ons kwam/, 'hoe het bij ons kwam');
    assert.match(eerste, /kan niet weg|Weghalen kan/, 'en of het weg kan');

    /* 3. GEEN INHOUD. De grens met de AVG-uitvoer. */
    const alles = await page.textContent('main');
    assert.ok(!alles.includes('gkscherm@x.nl'), 'het e-mailadres zelf staat er niet op');
    assert.ok(!alles.includes('0612345893'), 'het telefoonnummer ook niet');
    assert.ok(!alles.includes('1990-01-01'), 'en de geboortedatum niet');
    assert.match(alles, /RTG heeft dit/, 'terwijl het scherm wel zegt DAT ze er zijn');

    /* 4. HET ANTWOORD OP "KAN ALLES WEG" -- en de twee lijsten staan los. */
    const opheffen = await page.textContent('#opheffen');
    assert.match(opheffen, /facturen/i, 'de fiscale bewaarplicht staat bij wat blijft');
    const naOpheffen = await page.locator('#opheffen > .grens').allTextContents();
    assert.ok(!naOpheffen.join(' ').includes('Uw naam'),
      'uw naam hoort NIET bij wat na opheffen blijft staan -- die staat in de uitklap eronder');
    assert.match(await page.textContent('#opheffen details'), /Uw naam/,
      'en daar staat hij wel');

    /* 5. DE RAND VAN DE KAART. */
    const grenzen = await page.textContent('#grenzen');
    assert.match(grenzen, /Zegel/, 'wat hier niet op kan komen, staat erbij');
    assert.match(grenzen, /soorten, geen inhoud/i, 'en dat dit soorten zijn en geen inhoud');

    /* 6. GEEN SAMENGESTELD CIJFER (LAT-regel 11): drie getallen naast elkaar. */
    const telling = await page.locator('#telling .telling > div').count();
    assert.equal(telling, 3, 'drie losse getallen, geen percentage eroverheen');

    assert.deepEqual(paginaFouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
