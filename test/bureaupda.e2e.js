/* De drie bureau-PDA's (studio, hardware, architect) draaien op ÉÉN gedeelde
   werking (shared/bureaupda.js) en verschillen alleen in gegevens. Deze toets
   bewijst twee dingen tegelijk: alle drie komen op met hun eigen bureau, en ze
   blijven in de pas -- wat de een kan, kan de ander ook.

   WAT DIT DICHTZET. Ze waren drie kopieën van hetzelfde ontwerp en liepen uit
   elkaar: de studio kreeg de nieuwe chip-stijl en elf uitvoerkolommen, de
   architect bleef op oude pillen en acht kolommen staan, en de deur stond op
   een andere plek. Zo'n verschil merkt niemand, want niemand opent drie apps
   naast elkaar. Deze toets doet dat wel.

   Draait alleen waar Playwright (of onze eigen CDP-driver) beschikbaar is.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* Een browser KIEZEN door hem te starten, niet door hem te laden: zie de
   kop van ./browser.js. Dit bestand droeg nog een eigen kopie van de oude
   lader, en die zakte op 'Executable doesn't exist' zodra het pakket er wel
   was en de bijbehorende Chromium niet -- een rode toets die niets over zijn
   onderwerp zei. */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

/* Wat elk bureau van zichzelf hoort te tonen. Deze tabel staat met opzet NIET
   uit shared/bureaupda.js gelezen: dan zou de toets de code overschrijven met
   zichzelf en altijd slagen. Hij staat hier apart opgeschreven, zodat een
   wijziging in die tabel hier zichtbaar wordt. */
const BUREAUS = [
  { id: 'studio', pad: '/apps/studio-pda.html', ey: 'RTG Ontwerpstudio', h1: 'Studio PDA', api: '/api/office/studio' },
  { id: 'hardware', pad: '/apps/hardware-pda.html', ey: 'RTG Hardwarelab', h1: 'Hardware PDA', api: '/api/office/hardware' },
  { id: 'architect', pad: '/apps/architect-pda.html', ey: 'RTG Architectenbureau', h1: 'Architect PDA', api: '/api/office/architect' }
];

test('de drie bureau-PDA\'s komen op, elk met hun eigen bureau, op één werking',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bureau-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'RTG-OFFICE' } });
  let browser;
  try {
    const login = await (await fetch(base + '/api/office/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'RTG-OFFICE' })
    })).json();
    assert.ok(login.token, 'de kantoorinlog geeft een token');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    for (const b of BUREAUS) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const fouten = [];
      letOpFouten(page, fouten);
      /* De verzoeken meelezen: zo bewijzen we dat dit scherm ECHT zijn eigen
         bureau aanspreekt en niet dat van de buurman -- de fout die je bij een
         samengevoegde werking het eerst zou maken. */
      const geraakt = new Set();
      page.on('request', (r) => { const u = r.url(); if (u.includes('/api/office/')) geraakt.add(new URL(u).pathname); });
      await page.addInitScript((t) => {
        localStorage.setItem('rtg_office_token', t);
        localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
      }, login.token);

      await page.goto(base + b.pad, { waitUntil: 'load' });
      await page.waitForFunction(() => {
        const e = document.querySelector('#pLijst');
        return e && !/Laden/.test(e.textContent);
      }, null, { timeout: 20000 });

      /* NIET op `header .ey` toetsen. De iOS-laag (shared/ios.js) breekt een
         kopbalk af die niets te bedienen heeft en zet de titel als GROTE titel
         boven de inhoud -- het <header>-element is er daarna niet meer, maar de
         .ey en de h1 wel. Toetsen op de kopbalk zou hier dus een tijdslimiet
         geven die niets zegt over dit scherm. */
      assert.equal(await page.textContent('.ey'), b.ey, b.id + ': eigen eyebrow');
      assert.equal(await page.textContent('h1'), b.h1, b.id + ': eigen titel');
      assert.ok(geraakt.has(b.api), b.id + ' vraagt zijn eigen bureau op (' + [...geraakt].join(',') + ')');
      for (const ander of BUREAUS) {
        if (ander.id === b.id) continue;
        assert.equal(geraakt.has(ander.api), false, b.id + ' hoort ' + ander.api + ' niet aan te spreken');
      }

      /* De disciplinerij is de gedeelde stijl: alle drie horen nu de rustige
         balk te hebben en niet meer de oude pillen. Dat verschil was precies
         wat er uit elkaar was gelopen, dus het staat hier als eis. */
      const chip = await page.evaluate(() => {
        const c = document.querySelector('#pFilters .chip');
        if (!c) return null;
        const s = getComputedStyle(c);
        return { radius: s.borderRadius, transform: s.textTransform };
      });
      assert.ok(chip, b.id + ': de disciplinerij is getekend');
      assert.equal(chip.radius, '0px', b.id + ': de rustige balk, geen pil met ronde hoeken');
      assert.equal(chip.transform, 'uppercase', b.id + ': kleine kapitalen, zoals het deelmenu');

      assert.deepEqual(fouten, [], 'geen JS-fouten op ' + b.pad);
      await page.close();
    }
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
