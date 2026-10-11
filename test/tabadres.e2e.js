/* Een stand van de ledenapp heeft een adres: /apps/app.html#tab=<stand>.

   WERELDLIJST.md zet vier LivingOS-onderdelen als stand in de ledenapp (Salon,
   Assets, Bestellen, Gezin) en de sprong (shared/sprong.js) stuurt een lid er
   van buiten de app naartoe met dat adres. Het werd ingedrukt door een timer
   van 600 ms naast het inloggen; kwam het account later binnen, dan viel
   vulTab om op `user` (null), bleef de app op Home staan en was de stand voor
   de rest van de sessie leeg -- hij stond al als "gevuld" gemarkeerd.

   Deze toets maakt dat late account met opzet: /api/state wordt anderhalve
   seconde opgehouden, zoals een trage verbinding doet. Daarna moet elke stand
   die de pas toont geopend zijn, zonder JavaScript-fout, en is het adres
   verbruikt. En de andere kant: een stand die deze pas NIET toont, gaat via
   een adres ook niet open (een link uit een bericht opent nooit iets wat u
   niet hoort te zien).

   Mutatie gezien: de keuze uit `#tab=` in renderAll() weggehaald en de oude
   timer teruggezet -- salon blijft op Home staan en de toets zakt; de
   zichtbaarheidscontrole weggehaald -- de verborgen stand opent en de toets
   zakt.

   Draait alleen waar een browser beschikbaar is; anders overgeslagen. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stopNet, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();

test('#tab=<stand> opent de stand ook als het account laat binnenkomt, en nooit een verborgen stand',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tabadres-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const reg = await (await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Adres Proef', email: 'ta' + t + '@e.test',
        phone: '06' + String(t).slice(-8), password: 'geheim123',
        geboortedatum: '1990-03-03', tier: 'rtg' })
    })).json();
    assert.ok(reg.token, 'registreren hoort een token te geven');

    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
    await ctx.addInitScript((tok) => {
      try {
        localStorage.setItem('rtg_member_token', tok);
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      } catch (e) {}
    }, reg.token);
    /* Het late account: het herstellen van de sessie wacht 1500 ms. */
    await ctx.route('**/api/state', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });

    const open = async (stand) => {
      const page = await ctx.newPage();
      const fouten = [];
      letOpFouten(page, fouten);
      await page.goto(base + '/apps/app.html#tab=' + stand, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !!document.querySelector('.view.active'), null, { timeout: 20000 });
      await page.waitForTimeout(2500);
      const beeld = await page.evaluate((s) => {
        const knop = document.querySelector('.tabbar button[data-tab="' + s + '"]');
        return {
          actief: (document.querySelector('.view.active') || {}).dataset.view || null,
          zichtbaar: !!knop && knop.style.display !== 'none',
          hash: location.hash
        };
      }, stand);
      await page.close();
      return { beeld, fouten };
    };

    const geopend = [];
    for (const stand of ['salon', 'assets', 'bestellen', 'betalen', 'gezin']) {
      const { beeld, fouten } = await open(stand);
      assert.deepEqual(fouten, [], stand + ': geen JavaScript-fout bij het openen via het adres');
      assert.equal(beeld.hash, '', stand + ': het adres is verbruikt');
      if (beeld.zichtbaar) {
        assert.equal(beeld.actief, stand, stand + ': de stand die de pas toont, gaat open via zijn adres');
        geopend.push(stand);
      } else {
        /* Waar de app dan opent (Home, of de plek van twee minuten geleden),
           is een andere afspraak; hier telt alleen dat deze stand dicht blijft. */
        assert.notEqual(beeld.actief, stand, stand + ': een stand die de pas niet toont, opent een adres niet');
      }
    }
    /* De toets moet iets openen om iets te bewijzen: een RTG Pass-lid ziet
       Salon, Assets, Bestellen en Betalen. */
    assert.ok(['salon', 'assets', 'bestellen', 'betalen'].every((s) => geopend.includes(s)),
      'de vier standen van een RTG Pass-lid gaan open via hun adres (geopend: ' + geopend.join(', ') + ')');
  } finally {
    if (browser) await browser.close().catch(() => {});
    await stopNet(child);
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
