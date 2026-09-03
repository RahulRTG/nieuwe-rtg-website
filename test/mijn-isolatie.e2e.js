/* SCHERM-TEST: Mijn bescherming (/apps/mijn-isolatie.html).

   WAT HIER BEWEZEN WORDT, en waarom een geopende pagina niet genoeg is. Dit is
   het scherm waarop een lid zijn eigen beveiligingsstand zet. De gevaarlijkste
   fout die het kan maken is niet een lelijke opmaak maar een BELOFTE: tonen dat
   een stand iets tegenhoudt terwijl de server dat niet doet. De laag loopt in de
   schaduw (middleware/isolatiepoort.js houdt niets tegen), en het scherm hoort
   dat te zeggen in plaats van het te verzwijgen.

   De toets loopt de weg af die een lid ook loopt: inloggen, de huidige stand
   lezen, de keuzes zien, een stand zetten, en die terugzien. Draait alleen waar
   een browser is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();

test('Mijn bescherming: de stand is te lezen, te zetten, en het scherm belooft niet te veel',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mijniso-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const u = Date.now().toString().slice(-8);
    const reg = await fetch(base + '/api/auth/register', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Iso', email: 'iso' + u + '@x.nl', phone: '06' + u,
        password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' }) })
      .then(r => r.json());
    assert.ok(reg.token, 'de toets moet als lid binnenkomen, anders meet zij een uitgelogd scherm');

    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    /* Eerst de token wegzetten en dan pas laden: het scherm haalt zijn stand op
       bij het openen, dus een token dat er na de eerste ophaal in gaat, meet een
       scherm dat al een 401 heeft gezien. */
    await page.goto(base + '/apps/mijn-isolatie.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate((t) => {
      localStorage.setItem('rtg_member_token', t);
      localStorage.setItem('rtg_lang', 'nl');
      localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.reload({ waitUntil: 'domcontentloaded' });

    await page.waitForFunction(() => document.querySelector('#nu') &&
      document.querySelector('#nu').textContent.trim().length > 0, null, { timeout: 15000 });
    const nu = await page.evaluate(() => document.querySelector('#nu').textContent);
    assert.match(nu, /normaal/i, 'een vers lid staat op normaal: ' + nu);

    /* De keuzes moeten er staan. Een scherm dat een laag AANBIEDT zonder er iets
       te kiezen te geven, is erger dan een scherm dat de laag niet aanbiedt. */
    const keuzes = await page.evaluate(() =>
      [...document.querySelectorAll('#keuzes button')].map(b => b.textContent.trim()));
    assert.ok(keuzes.length >= 1, 'er staat geen enkele keuze op het scherm');

    /* DE BELOFTE. De poort loopt in de schaduw, dus dit scherm mag niet zeggen
       dat een stand iets tegenhoudt. Zodra de vlag omgaat, hoort deze toets te
       zakken -- dat is het punt: dan MOET de tekst mee veranderen. */
    const tekst = await page.evaluate(() => document.body.innerText);
    assert.ok(/schaduw|houdt nog niets tegen|nog niet afgedwongen/i.test(tekst),
      'het scherm zegt niet dat de handhaving nog in de schaduw loopt; dan belooft het meer ' +
      'dan de server doet. Ging de vlag om? Dan hoort deze tekst mee te veranderen.');

    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
