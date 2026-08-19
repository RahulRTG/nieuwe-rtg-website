/* Schermtoets voor apps/gedachten.html.

   Het punt dat hier op het scherm zelf moet kloppen: bij een zin waar de
   crisisregel op aanslaat blijft de notitie STAAN en komt de hulp ernaast. Een
   motor die netjes bewaart en een scherm dat de tekst alsnog laat verdwijnen,
   is voor de schrijver hetzelfde verlies.
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

async function openDeel(page, naam) {
  const knop = page.locator('.rtgdeel-balk button', { hasText: naam });
  if (await knop.count()) { await knop.first().click(); }
}

test('Gedachtenboek: wat je opschrijft blijft staan, ook op je zwaarste moment',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gedscherm-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const reg = await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ged Lid', email: 'gedscherm@x.nl', phone: '0612345877',
        password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
    }).then(r => r.json());
    assert.ok(reg.token, 'lid-registratie geeft een token');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const paginaFouten = [];
    letOpFouten(page, paginaFouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/gedachten.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const e = document.getElementById('lijst');
      return e && e.textContent.trim() && !/laden/i.test(e.textContent);
    }, { timeout: 15000 });

    /* 1. gewoon opschrijven en teruglezen. */
    await openDeel(page, 'Iets opschrijven');
    await page.locator('#gTekst').fill('Vandaag was lang maar het ging.');
    const bewaar = page.locator('#gBewaar');
    await bewaar.scrollIntoViewIfNeeded();
    await bewaar.click();
    await page.waitForFunction(() => /het ging/.test(document.getElementById('lijst').textContent),
      { timeout: 10000 });
    assert.equal(await page.locator('#gTekst').inputValue(), '',
      'het veld is leeg voor de volgende keer');
    assert.equal(await page.locator('#gHulp').textContent(), '',
      'en er staat geen hulpkaart bij een gewone zin');

    /* 2. de grens. De notitie hoort te BLIJVEN staan en de hulp ernaast. */
    await page.locator('#gTekst').fill('ik wil niet meer leven');
    await bewaar.scrollIntoViewIfNeeded();
    await bewaar.click();
    await page.waitForFunction(() => /0800-0113/.test(document.getElementById('gHulp').textContent),
      { timeout: 10000 });
    const hulp = await page.textContent('#gHulp');
    assert.match(hulp, /bewaard/i, 'het scherm zegt zelf dat er niets is weggegooid');

    await openDeel(page, 'Wat u eerder schreef');
    const lijst = await page.textContent('#lijst');
    assert.match(lijst, /niet meer leven/,
      'en de woorden staan er echt: ze laten verdwijnen zou eerlijk zijn bestraffen');
    assert.match(lijst, /het ging/, 'naast wat er al stond');

    assert.deepEqual(paginaFouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
