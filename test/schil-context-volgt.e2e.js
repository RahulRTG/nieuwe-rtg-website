/* De schil toont wie de gedeelde context volgt (contract context-volgt van de
   samenproef, keten context-naar-agenda, 19 oktober 2026). Een surface meldt
   {rtg:'context-volgt', soort, id, wat}; de console toont "<naam> volgt: <wat>"
   als tekst. Een melding over een oude context, of van een venster dat geen
   surface is, doet niets; bij context weg vervalt de regel.

   Draai: node --test test/schil-context-volgt.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stopHard, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();

test('de console toont wie volgt, alleen voor de huidige context en alleen van een surface',
  { skip: geenBrowser(pw), timeout: 120000 }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-volgt-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/werkruimte.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.rtg-surface[data-actief]', { timeout: 15000 });
    await page.waitForFunction(() => window.RTGSchil && RTGSchil.surfaces.some((s) => s.id === 'agenda'));
    const regel = () => page.evaluate(() => {
      const r = document.querySelector('[data-context] [data-volgt="agenda"]'); return r ? r.textContent : null; });
    /* De melding komt echt uit het frame van de surface Agenda, naar zijn ouder. */
    const frame = await (await page.evaluateHandle(() =>
      RTGSchil.surfaces.find((s) => s.id === 'agenda').el.querySelector('iframe'))).asElement().contentFrame();
    const meld = (m) => frame.evaluate((bericht) => parent.postMessage(bericht, location.origin), m)
      .then(() => page.waitForTimeout(300));
    const naam = await page.evaluate(() => RTGSchil.surfaces.find((s) => s.id === 'agenda').naam);

    await page.evaluate(() => RTGSchil.context({ soort: 'reis', id: 'r1', label: 'Lissabon' }));
    await meld({ rtg: 'context-volgt', soort: 'reis', id: 'oud', wat: 'een oude reis' });
    assert.equal(await regel(), null, 'een melding over een oude context telt niet');

    await page.evaluate(() => window.postMessage({ rtg: 'context-volgt', soort: 'reis', id: 'r1', wat: 'van geen surface' }, location.origin));
    await page.waitForTimeout(300);
    assert.equal(await regel(), null, 'een venster dat geen surface is, meldt niets');

    await meld({ rtg: 'context-volgt', soort: 'reis', id: 'r1', wat: '1 afspraak <b>bij</b> het hotel' });
    assert.equal(await regel(), naam + ' volgt: 1 afspraak <b>bij</b> het hotel', 'de surface staat er, als tekst');

    await page.evaluate(() => RTGSchil.context({ soort: 'reis', id: 'r1', label: 'Lissabon' }));
    assert.equal(await regel(), naam + ' volgt: 1 afspraak <b>bij</b> het hotel', 'dezelfde ref twee keer: de regel blijft staan');

    await page.evaluate(() => RTGSchil.context({ soort: 'reis', id: 'r2', label: 'Porto' }));
    assert.equal(await regel(), null, 'een andere context wist de regel');
    await meld({ rtg: 'context-volgt', soort: 'reis', id: 'r2', wat: 'geen afspraken' });

    await page.evaluate(() => RTGSchil.context(null));
    assert.equal(await regel(), null, 'bij context weg vervalt de regel');
    assert.deepEqual(fouten, []);
  } finally {
    if (browser) await browser.close();
    await stopHard(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
