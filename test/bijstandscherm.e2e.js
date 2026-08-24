/* SCHERMTOETS VOOR RTG BIJSTAND, DE KLANTKANT -- de kaart in het Werk OS waarmee
   een organisatie ons binnenlaat en er weer uitzet.

   WAAROM DIT EEN SCHERMTOETS NODIG HEEFT. De keten over de lijn staat in
   test/bijstandketen.test.js en die dekt de server. Wat hij niet ziet is of een
   klant er werkelijk bij kan: of de vier niveaus verschijnen, of het voorstel
   van RTG zichtbaar wordt zonder dat iemand iets stuurt, en of "intrekken"
   werkelijk teruggaat naar de vraagvorm. Precies dat laatste is de knop waar de
   hele belofte aan hangt.

   DE KNOPPEN WORDEN VIA DE DOM AANGEKLIKT en niet via page.click(): de
   Rahul-schil van het Werk OS ligt over de rechterkolom heen, en een toets die
   op dat overlappen stukloopt, toetst de opmaak en niet het gedrag.

   MUTATIES die zijn gedraaid en welke bewering erop zakte (LAT.md regel 2):
   - de aanroep van RTGWerkBijstand.laad() uit status.js gehaald
     -> "de kaart vult zich" ZAKT (RAAK)
   - de intrekknop niet meer tekenen bij een lopende sessie
     -> "intrekken brengt de klant terug bij de vraagvorm" ZAKT (RAAK)

   Draait alleen waar Playwright beschikbaar is. Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* NIET zelf een playwright zoeken. Die kopie stond hier eerst wel, en hij koos
   de eerste die te REQUIREN viel -- terwijl het pakket er kan zijn zonder dat de
   bijbehorende Chromium er staat. Dan lukt de require, zakt de launch met
   "Executable doesn't exist", en zegt de toets iets over de omgeving in plaats
   van over het scherm. `test/browser.js` bestaat precies daarvoor: die probeert
   te STARTEN en loopt de kandidaten af. */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

test('de klant nodigt uit, ziet het voorstel en trekt weer in',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bijstandscherm-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const post = (p, b, t) => fetch(base + p, { method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, t ? { Authorization: 'Bearer ' + t } : {}),
      body: JSON.stringify(b || {}) }).then(async r => ({ s: r.status, b: await r.json().catch(() => ({})) }));

    const eigenaar = (await post('/api/techniek/inloggen',
      { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).b.token;
    assert.ok(eigenaar, 'de eigenaar komt binnen');
    const w = (await post('/api/bedrijf/werkruimte/maak', { naam: 'Hoshi Haarlem' })).b;
    assert.equal((await post('/api/techniek/tenant', { org: 'O-HOSHI', naam: 'Hoshi' }, eigenaar)).s, 200);
    assert.equal((await post('/api/techniek/tenant/bind',
      { org: 'O-HOSHI', soort: 'werkruimte', code: w.werkruimte }, eigenaar)).s, 200);

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    await page.goto(base + '/apps/werk.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate((s) => {
      localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.setItem('rtg_werk_sessie', JSON.stringify(s));
    }, { werkruimte: w.werkruimte, beheerToken: w.beheerToken });
    await page.goto(base + '/apps/werk.html', { waitUntil: 'domcontentloaded' });

    /* De tenantstand openen en laten laden; de bijstandskaart hangt aan
       dezelfde laadbeurt, want twee schermen die elk hun eigen moment kiezen,
       zeggen op een dag verschillende dingen over dezelfde organisatie. */
    await page.waitForFunction(() => !!window.RTGWerkStatus, null, { timeout: 15000 });
    await page.evaluate(() => {
      const v = document.getElementById('vStatus');
      if (v) v.hidden = false;
      window.RTGWerkStatus.laad();
    });

    await page.waitForFunction(() => {
      const e = document.getElementById('stBijstand');
      return e && /Bijstand vragen/.test(e.textContent);
    }, null, { timeout: 15000 });
    const niveaus = await page.evaluate(() =>
      [...document.querySelectorAll('#bjNiveau option')].map(o => o.value));
    assert.deepEqual(niveaus, ['kijken', 'meedenken', 'herstellen', 'nood'],
      'de vier niveaus komen niet van de server op het scherm');

    await page.fill('#bjWat', 'de kassakoppeling doet niets');
    await page.selectOption('#bjNiveau', 'herstellen');
    await page.evaluate(() => document.getElementById('bjVraag').click());
    await page.waitForFunction(() => /Wat er gebeurt/.test(document.getElementById('stBijstand').textContent),
      null, { timeout: 15000 });
    assert.match(await page.textContent('#stBijstand'), /Intrekken kan op elk moment/,
      'de klant leest niet dat hij op elk moment kan intrekken');

    /* RTG doet zijn kant over de gewone routes; de klant hoort dat te zien
       zodra hij zijn kaart opnieuw laadt -- zonder dat iemand hem iets stuurt. */
    const id = (await post('/api/command/bijstand', {}, eigenaar)).b.sessies[0].id;
    await post('/api/command/bijstand/betreed', { id }, eigenaar);
    await post('/api/command/bijstand/voorstel',
      { id, wat: 'de kassakoppeling opnieuw opbouwen' }, eigenaar);

    await page.evaluate(() => window.RTGWerkBijstand.laad());
    await page.waitForFunction(() => /Goedkeuren/.test(document.getElementById('stBijstand').textContent),
      null, { timeout: 15000 });
    await page.evaluate(() => document.querySelector('[data-ja]').click());
    await page.waitForFunction(() => /goedgekeurd/.test(document.getElementById('stBijstand').textContent),
      null, { timeout: 15000 });

    await page.evaluate(() => document.getElementById('bjStop').click());
    await page.waitForFunction(() => /Bijstand vragen/.test(document.getElementById('stBijstand').textContent),
      null, { timeout: 15000 });

    assert.deepEqual(fouten, [], 'geen JS-fouten tijdens de hele keten');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
