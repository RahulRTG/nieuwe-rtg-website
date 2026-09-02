/* SCHERM-TEST: de isolatiecockpit van het kantoor (/apps/isolatie.html).

   WAAROM DEZE TOETS BESTAAT, en waarom hij meer doet dan de pagina openen. Dit
   scherm stuurde geen Authorization-kop, terwijl techAuth op de server
   uitsluitend die kop leest. Elke aanroep kwam binnen als 401 en het enige wat
   een mens zag was "Geen toegang. Log eerst in op de technische pagina" -- ook
   als hij dat al had gedaan. Het scherm zag er compleet uit en werkte niet.

   De toets loopt daarom de weg af die een beheerder ook loopt: inloggen op de
   techniekpagina, de cockpit openen, en de rail met de dragers zien vullen. Dat
   laatste kan alleen als de server heeft geantwoord.

   Draait alleen waar een browser is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();
const OWNER = 'cockpit-eigenaar@x.nl';

test('de isolatiecockpit haalt zijn stand echt op bij de server',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-isocockpit-e2e-'));
  const { child, base } = await startServer({
    env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_OWNER_EMAIL: OWNER } });
  let browser;
  try {
    const inlog = await fetch(base + '/api/techniek/inloggen', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: OWNER, wachtwoord: 'Imran' }) }).then(r => r.json());
    assert.ok(inlog.token, 'de toets moet als eigenaar binnenkomen, anders meet zij een dichte deur');

    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    await page.goto(base + '/apps/isolatie.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate((t) => {
      sessionStorage.setItem('techToken', t);
      localStorage.setItem('rtg_lang', 'nl');
      localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, inlog.token);
    await page.reload({ waitUntil: 'domcontentloaded' });

    /* DE RAIL IS HET BEWIJS. Hij wordt gevuld uit het antwoord van de server;
       blijft hij leeg, dan heeft de cockpit niets opgehaald -- en precies dat
       was de fout. Vijf cellen: het huis plus de vier dragers. */
    await page.waitForFunction(() => document.querySelectorAll('#rail .cel').length >= 5,
      null, { timeout: 15000 });
    const labels = await page.evaluate(() =>
      [...document.querySelectorAll('#rail .cel .l')].map(e => e.textContent.trim()));
    for (const d of ['Huis', 'organisatie', 'identiteit', 'sessie', 'apparaat'])
      assert.ok(labels.includes(d), d + ' staat niet op de rail: ' + JSON.stringify(labels));

    /* En de voetregel zegt iets over de dragers zonder bron. Een cockpit die
       daarover zwijgt, laat een mens denken dat alles gemeten is. */
    const voet = await page.evaluate(() => document.querySelector('#railvoet').textContent);
    assert.ok(voet.trim().length > 0, 'de rail zegt niets over de dragers zonder bron');

    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
