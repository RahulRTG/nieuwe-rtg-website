/* Scherm-test voor de speelhoek van de kleintjes (RTF-golf 7): het nieuwe
   Pakken-spel bij tellen, Welke is anders? bij kleuren, samen om de beurt bij
   memorie en de napraatvraag aan het eind van een voorleesverhaaltje. Alles op
   deze pagina's blijft lokaal; de test kijkt alleen naar het scherm zelf. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* Eén browserkeuze voor alle schermtoetsen: ./browser.js. Die probeert te
   STARTEN in plaats van te laden -- een Playwright zonder bijbehorende Chromium
   liet elke schermtoets anders omvallen op "Executable doesn't exist". */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

test('Speelhoek: pakken, welke is anders, samen memorie en de napraatvraag',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-speelhoek-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const g = await fetch(base + '/api/foundation/gezin/maak', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gezinsnaam: 'Fam Speel', naam: 'Mam', pin: '1234' }) }).then(r => r.json());

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/foundation/tellen.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(sess => {
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.setItem('rtf_sessie', JSON.stringify(sess));
    }, { code: g.code, token: g.token, profiel: { naam: 'Juno', groep: 'mini' } });

    /* tellen: het Pakken-spel -- het getal komt eerst, de hoeveelheid pak je zelf */
    /* Het bezoek hierboven was uitgelogd -- alleen om localStorage te kunnen
       zetten -- en de pagina stopt daar bewust met 'geen sessie'. De meting
       begint bij het ingelogde bezoek hieronder. */
    fouten.length = 0;
    await page.goto(base + '/apps/foundation/tellen.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { document.querySelector('[data-m="pak"]').click(); });
    await page.waitForFunction(() => /Pak er precies/.test(document.querySelector('#vraag').textContent), null, { timeout: 8000 });
    const doel = await page.evaluate(() => Number(document.querySelector('#vraag').textContent.match(/\((\d+)\)/)[1]));
    assert.ok(doel >= 1 && doel <= 6, 'het doel is klein genoeg voor kleutervingers');
    await page.evaluate(n => {
      document.querySelectorAll('#veld .ding').forEach((b, i) => { if (i < n) b.click(); });
      document.querySelector('#pakKlaar').click();
    }, doel);
    assert.ok(await page.evaluate(() => /Knap gepakt/.test(document.querySelector('#melding').textContent)),
      'precies genoeg pakken is feest');

    /* kleuren: Welke is anders? -- de ene afwijker aantikken */
    await page.goto(base + '/apps/foundation/kleuren.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { document.querySelector('[data-m="anders"]').click(); });
    await page.waitForFunction(() => /Welke is anders/.test(document.querySelector('#opdracht').textContent), null, { timeout: 8000 });
    await page.evaluate(() => {
      const vakken = [...document.querySelectorAll('#rooster .vak')];
      const labels = vakken.map(v => v.getAttribute('aria-label'));
      const ander = vakken.find(v => labels.filter(l => l === v.getAttribute('aria-label')).length === 1);
      ander.click();
    });
    assert.ok(await page.evaluate(() => /Precies/.test(document.querySelector('#melding').textContent)),
      'de afwijker vinden wordt rustig gevierd');

    /* memorie: samen om de beurt -- de beurt wisselt of je mag nog eens */
    await page.goto(base + '/apps/foundation/memorie.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { document.querySelector('[data-s="2"]').click(); });
    await page.waitForFunction(() => document.querySelector('#beurt').textContent === 'Nu mag speler 1', null, { timeout: 8000 });
    await page.evaluate(() => {
      const k = document.querySelectorAll('#bord .kaartje');
      k[0].click();
    });
    await page.evaluate(() => { document.querySelectorAll('#bord .kaartje')[1].click(); });
    await page.waitForFunction(() =>
      /nog een keer/.test(document.querySelector('#melding').textContent) ||
      document.querySelector('#beurt').textContent === 'Nu mag speler 2', null, { timeout: 8000 });

    /* verhaaltje: op de laatste bladzijde gaat het gesprek open */
    await page.goto(base + '/apps/foundation/verhaaltje.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { document.querySelector('#keuzelijst .titelknop').click(); });
    await page.waitForFunction(() => !document.querySelector('#leesblok').hidden, null, { timeout: 8000 });
    for (let i = 0; i < 12 && await page.evaluate(() => document.querySelector('#verder').textContent !== 'Uit'); i++) {
      await page.evaluate(() => { document.querySelector('#verder').click(); });
    }
    assert.ok(await page.evaluate(() => !document.querySelector('#napraat').hidden &&
      /Om samen na te praten/.test(document.querySelector('#napraat').textContent)),
      'de laatste bladzijde nodigt uit tot napraten');

    assert.deepEqual(fouten, [], 'geen JS-fouten op de speelhoekpagina\'s');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
