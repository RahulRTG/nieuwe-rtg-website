/* De belofte van het toegankelijkheidsprofiel is "op elk scherm van RTG", en
   dat is precies wat een servertoets niet kan zien. Deze toets zet de
   instelling op de ene pagina (apps/ik.html) en kijkt of hij doorwerkt op een
   HEEL ANDERE app (apps/balans.html) die er zelf niets van weet en er geen
   regel voor heeft.

   Er wordt niet op een klasse afgegaan maar op de gemeten tekstgrootte: een
   class die niets doet is nog steeds een instelling die niet werkt.
   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
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

// de gemeten tekstgrootte van de wortel: dit is wat een lezer echt merkt
const wortelMaat = (page) => page.evaluate(() =>
  parseFloat(getComputedStyle(document.documentElement).fontSize));

/* WAT DEZE TOETS ECHT NODIG HEEFT NA EEN NAVIGATIE, en dat is minder dan `load`.

   Elke goto stond op `waitUntil: 'load'`: wachten tot ELK subverzoek binnen is,
   elk plaatje en elk lettertype. Dat houdt stand op een rustige machine en valt
   onder belasting om -- dezelfde vorm als wachten op de klok (TAKEN.md 6.5),
   alleen met een ander teken ernaast.

   Wat er wel toe doet is de OPMAAK, want deze toets meet een gemeten
   tekstgrootte (`getComputedStyle`). Let op: `window.__rtgBasis` alleen is niet
   genoeg -- shared/basis.js zet die vlag op zijn EERSTE regel, dus hij zegt
   alleen dat het script begonnen is. Vandaar het stijlblad erbij. */
const opgemaakt = (page) => page.waitForFunction(
  () => document.styleSheets.length > 0 && !!window.__rtgBasis, null, { timeout: 15000 });

/* ik.html is een lange pagina en shared/deelmenu.js knipt hem op in stukken
   met een balk erboven; alles wat niet open staat is display:none. De toets
   loopt dus dezelfde weg als een lid: eerst het stuk openen. */
async function openHetDeel(page) {
  const knop = page.locator('.rtgdeel-balk button', { hasText: 'Hoe het scherm zich gedraagt' });
  await knop.waitFor({ timeout: 10000 });
  await knop.click();
}

test('een instelling op ik.html werkt door op een app die er niets van weet',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-toegscherm-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const reg = await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Toeg Scherm', email: 'toegscherm@x.nl', phone: '0612345811',
        password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
    }).then(r => r.json());
    assert.ok(reg.token, 'lid-registratie geeft een token');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const paginaFouten = [];
    letOpFouten(page, paginaFouten);
    await page.route('**/api/onboarding/status', r => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ klaar: true })
    }));
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);

    /* 1. de nulmeting op de andere app, VOOR er iets is ingesteld. Zonder deze
       meting zou "groter" een getal zijn zonder betekenis. */
    await page.goto(base + '/apps/balans.html', { waitUntil: 'domcontentloaded' });
    await opgemaakt(page);
    const voor = await wortelMaat(page);
    assert.ok(voor > 0, 'de nulmeting levert een echte tekstgrootte op');
    assert.equal(await page.evaluate(() => document.documentElement.className.includes('rtg-tekst')), false);

    /* 2. instellen waar het hoort: op ik.html, met een echte tik op de knop. */
    await page.goto(base + '/apps/ik.html', { waitUntil: 'domcontentloaded' });
    await openHetDeel(page);
    await page.waitForSelector('#toegankelijk [data-tgveld="tekst"][data-tgwaarde="groter"]', { timeout: 10000 });
    const knop = page.locator('#toegankelijk [data-tgveld="tekst"][data-tgwaarde="groter"]');
    await knop.scrollIntoViewIfNeeded();
    await knop.click();
    await page.waitForFunction(() => {
      const b = document.querySelector('#toegankelijk [data-tgveld="tekst"][data-tgwaarde="groter"]');
      return b && b.getAttribute('aria-pressed') === 'true';
    }, null, { timeout: 10000 });

    /* 3. en dan de vraag waar het om gaat: merkt een app die hier niets van
       weet er iets van? balans.html heeft geen regel voor toegankelijkheid en
       leest de instelling nergens; hij krijgt hem van de gedeelde laag. */
    await page.goto(base + '/apps/balans.html', { waitUntil: 'domcontentloaded' });
    await opgemaakt(page);
    const na = await wortelMaat(page);
    assert.ok(na > voor * 1.2, 'de tekst op de andere app is echt groter geworden (' + voor + ' -> ' + na + ')');

    /* 3b. en nu het SNELLE pad apart, want zonder deze stap bewijst stap 3 te
       weinig. Er zijn twee wegen waarlangs de stand op het scherm komt: de
       plaatselijke kopie die shared/basis.js meteen toepast, en de server die
       shared/toegankelijk.js even later ophaalt. Haalt de toets pas na de
       tweede weg de maat op, dan blijft hij groen terwijl de eerste weg kapot
       is -- en juist die eerste bepaalt of iemand grote tekst ziet vanaf het
       eerste beeld of pas na een flits kleine tekst.

       Daarom: de server-weg wordt hier hard afgesneden. Wat er dan nog staat,
       staat er van de plaatselijke kopie. Dit bewijst meteen de belofte in
       shared/toegankelijk.js dat een onbereikbare server niets uitzet. */
    await page.goto(base + '/apps/ik.html', { waitUntil: 'domcontentloaded' });
    await openHetDeel(page);
    const opnieuw = page.locator('#toegankelijk [data-tgveld="tekst"][data-tgwaarde="groter"]');
    await opnieuw.scrollIntoViewIfNeeded();
    await opnieuw.click();
    await page.waitForFunction(() => {
      const b = document.querySelector('#toegankelijk [data-tgveld="tekst"][data-tgwaarde="groter"]');
      return b && b.getAttribute('aria-pressed') === 'true';
    }, null, { timeout: 10000 });

    await page.route('**/api/ik/toegankelijk', r => r.abort());
    await page.goto(base + '/apps/balans.html', { waitUntil: 'domcontentloaded' });
    await opgemaakt(page);
    const zonderServer = await wortelMaat(page);
    assert.ok(zonderServer > voor * 1.2,
      'zonder server staat de tekst er nog steeds groot (' + voor + ' -> ' + zonderServer + ')');
    await page.unroute('**/api/ik/toegankelijk');

    /* 4. terugzetten moet ook echt terugzetten. Een instelling die vastzit is
       erger dan een die er niet is. */
    await page.goto(base + '/apps/ik.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#toegankelijk [data-tgveld="tekst"][data-tgwaarde="normaal"]', { timeout: 10000 });
    const terug = page.locator('#toegankelijk [data-tgveld="tekst"][data-tgwaarde="normaal"]');
    await terug.scrollIntoViewIfNeeded();
    await terug.click();
    await page.waitForFunction(() => {
      const b = document.querySelector('#toegankelijk [data-tgveld="tekst"][data-tgwaarde="normaal"]');
      return b && b.getAttribute('aria-pressed') === 'true';
    }, null, { timeout: 10000 });
    await page.goto(base + '/apps/balans.html', { waitUntil: 'domcontentloaded' });
    await opgemaakt(page);
    assert.equal(await wortelMaat(page), voor, 'terug op de oorspronkelijke maat');

    /* 5. "Een ding tegelijk" is de enige instelling die geen OPMAAK zet maar
       GEDRAG verandert: shared/deelmenu.js knipt een pagina normaal pas op vanaf
       drie delen, en met deze klas al vanaf twee. Dat is precies het soort
       belofte dat op een echt scherm nagekeken moet worden -- een klas die
       nergens gelezen wordt, is een knop naar niets. */
    await page.goto(base + '/apps/ik.html', { waitUntil: 'domcontentloaded' });
    await openHetDeel(page);
    const eenDing = page.locator('#toegankelijk [data-tgveld="eenDing"][data-tgwaarde="altijd"]');
    await eenDing.scrollIntoViewIfNeeded();
    await eenDing.click();
    await page.waitForFunction(() => {
      const b = document.querySelector('#toegankelijk [data-tgveld="eenDing"][data-tgwaarde="altijd"]');
      return b && b.getAttribute('aria-pressed') === 'true';
    }, null, { timeout: 10000 });

    /* apps/tijdlijn.html heeft precies TWEE delen: normaal geen menu, met deze
       stand wel. */
    await page.goto(base + '/apps/tijdlijn.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.classList.contains('rtg-eending'),
      null, { timeout: 10000 });
    const metMenu = await page.locator('.rtgdeel-balk button').count();

    await page.goto(base + '/apps/ik.html', { waitUntil: 'domcontentloaded' });
    await openHetDeel(page);
    const terugEen = page.locator('#toegankelijk [data-tgveld="eenDing"][data-tgwaarde="normaal"]');
    await terugEen.scrollIntoViewIfNeeded();
    await terugEen.click();
    await page.waitForFunction(() => {
      const b = document.querySelector('#toegankelijk [data-tgveld="eenDing"][data-tgwaarde="normaal"]');
      return b && b.getAttribute('aria-pressed') === 'true';
    }, null, { timeout: 10000 });
    await page.goto(base + '/apps/tijdlijn.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !document.documentElement.classList.contains('rtg-eending'),
      null, { timeout: 10000 });
    const zonderMenu = await page.locator('.rtgdeel-balk button').count();
    assert.ok(metMenu > zonderMenu,
      'met "een ding tegelijk" verschijnt er een deelmenu waar er anders geen is (' +
      zonderMenu + ' -> ' + metMenu + ')');

    assert.deepEqual(paginaFouten, [], 'geen JS-fouten tijdens de schermen');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
