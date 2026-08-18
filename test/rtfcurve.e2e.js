/* Scherm-test voor de eerlijke vergeetcurve op overhoren.html: het blok
   "Vandaag herhalen" met de dagstapel, goed = later terug, fout = vandaag
   nog een keer, en de eerlijke lege stand als alles gehad is.
   Draait alleen waar een browser beschikbaar is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();

test('Vandaag herhalen: dagstapel, fout komt vandaag terug, en daarna eerlijk leeg',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtfcurve-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const post = async (p, b) => (await fetch(base + p, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) })).json();
  let browser;
  try {
    const g = await post('/api/foundation/gezin/maak', { gezinsnaam: 'Fam Herhaal', naam: 'Mam', pin: '1234' });
    const k = await post('/api/foundation/gezin/profiel/maak', { code: g.code, token: g.token,
      naam: 'Isa', rol: 'kind', groep: 'tiener', geboortedatum: '2011-05-14' });
    const kindToken = (await post('/api/foundation/gezin/profiel/kies', { code: g.code, profielId: k.profiel.id })).token;
    await post('/api/rtf/leren/lijst-maak', { code: g.code, token: kindToken, naam: 'Frans H3',
      paren: [{ v: 'de hond', a: 'le chien' }, { v: 'de kat', a: 'le chat' }] });
    const GOED = { 'de hond': 'le chien', 'de kat': 'le chat' };

    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/foundation/overhoren.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate((sessie) => {
      localStorage.setItem('rtf_sessie', JSON.stringify(sessie));
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, { code: g.code, token: kindToken, profiel: { naam: 'Isa', groep: 'tiener', geboortedatum: '2011-05-14' } });
    /* Het bezoek hierboven was uitgelogd -- alleen om localStorage te kunnen
       zetten -- en de pagina stopt daar bewust met 'geen sessie'. De meting
       begint bij het ingelogde bezoek hieronder. */
    fouten.length = 0;
    await page.goto(base + '/apps/foundation/overhoren.html', { waitUntil: 'domcontentloaded' });

    // het blok zegt eerlijk wat er vandaag klaarstaat
    await page.waitForFunction(() => /2 vragen staan vandaag klaar/.test((document.querySelector('#hUitleg') || {}).textContent || ''),
      null, { timeout: 15000 });
    await page.evaluate(() => { document.querySelector('#hStart').click(); });
    await page.waitForFunction(() => !document.querySelector('#vHerhaal').hidden, null, { timeout: 8000 });

    /* kaart 1 goed, kaart 2 eerst fout (die komt vandaag achteraan terug) */
    async function kaart(hoe) {
      await page.waitForFunction(() => (document.querySelector('#hVraag').textContent || '').length > 0, null, { timeout: 8000 });
      const vraag = await page.evaluate(() => document.querySelector('#hVraag').textContent);
      const antwoord = hoe === 'fout' ? 'nee hoor' : GOED[vraag];
      await page.fill('#hAntwoord', antwoord);
      await page.evaluate(() => { document.querySelector('#hCheck').click(); });
      await page.waitForFunction(() => /Goed|Het was/.test(document.querySelector('#hUitslag').textContent), null, { timeout: 8000 });
      const uitslag = await page.evaluate(() => document.querySelector('#hUitslag').textContent);
      /* wacht tot de volgende kaart (of het einde) getoond wordt; op de vraag
         letten kan niet, want een foute kaart komt direct met DEZELFDE vraag
         terug -- de uitslag wordt bij elke nieuwe kaart leeggemaakt */
      await page.waitForFunction(() => document.querySelector('#hUitslag').textContent === '' ||
        !document.querySelector('#hKlaar').hidden, null, { timeout: 8000 });
      return uitslag;
    }
    assert.ok(/Goed/.test(await kaart('goed')), 'de eerste kaart telt als goed');
    assert.ok(/vandaag nog een keer/.test(await kaart('fout')), 'fout zegt eerlijk dat hij vandaag terugkomt');
    // de foute kaart komt inderdaad nog een keer; nu goed
    assert.ok(/Goed/.test(await kaart('goed')), 'de herkansing van vandaag');
    await page.waitForFunction(() => !document.querySelector('#hKlaar').hidden, null, { timeout: 8000 });
    await page.evaluate(() => { document.querySelector('#hTerug').click(); });
    await page.waitForFunction(() => /Niets meer voor vandaag/.test((document.querySelector('#hUitleg') || {}).textContent || ''),
      null, { timeout: 8000 });

    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
