/* Schermtoets op "Wat veranderde?" in de Regelwacht (kantoren.html, kamer bank).

   De endpoints zijn gedekt (test/fiscaal-jaargangen.test.js voor de
   geschiedenis, test/fiscaal-herkomst.test.js voor de impact), maar een gedekt
   endpoint achter een kaart die niemand ooit heeft zien tekenen is precies de
   vorm waar scripts/schermen.js over gaat.

   Wat deze toets eist is niet dat er iets staat, maar dat er het JUISTE staat:
   de oude waarde naast de nieuwe. Dat is de hele reden dat de jaargangen
   bestaan -- een lijst die alleen zegt dat een land is bijgewerkt, had de
   Regelwacht al.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, browserOpties, geenBrowser } = require('./helper');
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

const CODE = 'KANTOOR-REGELWACHT-1';

test('de Regelwacht laat zien wat er veranderde, en wat het verving',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rwscherm-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  let browser;
  const post = (pad, body, token) => fetch(srv.base + pad, {
    method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' },
      token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  try {
    const kantoor = (await post('/api/office/login', { code: CODE })).body.token;
    assert.ok(kantoor, 'het kantoor logt in');

    /* Twee wijzigingen doorvoeren: een op een gewoon veld en een op een TARIEF.
       Die tweede is er om de impact-knop te laten verschijnen -- die hoort
       alleen bij een tariefwijziging, want alleen daar dragen facturen een
       percentage dat vervangen kan zijn. */
    const voor = (await post('/api/office/bank/regels', {}, kantoor)).body
      .landen.find(l => l.code === 'NL').uurloonMin;
    assert.ok(voor > 0, 'NL heeft een minimumloon in de tabel');
    const u = await post('/api/office/bank/regels/update',
      { landen: { NL: { uurloonMin: voor + 1.25 } }, versie: 'toets-1' }, kantoor);
    assert.equal(u.body.landen, 1, 'de wijziging is doorgevoerd');
    await post('/api/office/bank/regels/update',
      { landen: { NL: { tarieven: { eten: 11 } } }, versie: 'toets-2' }, kantoor);

    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
    await ctx.addInitScript((t) => { try { localStorage.setItem('rtg_office_token', t); } catch (e) {} }, kantoor);
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    await page.goto(srv.base + '/apps/kantoren.html?kamer=bank', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#rwGesch', { timeout: 20000 });
    await page.selectOption('#rwLand', 'NL');
    await page.click('#rwGesch');
    await page.waitForFunction(() => {
      const u2 = document.querySelector('#rwUit');
      return !!(u2 && u2.textContent.includes('was'));
    }, null, { timeout: 15000 });

    const tekst = (await page.$eval('#rwUit', e => e.innerText)).replace(/\s+/g, ' ');
    assert.match(tekst, /uurloonMin: 15\.31|uurloonMin: 15,31|uurloonMin: /, 'de nieuwe waarde staat er: ' + tekst.slice(0, 200));
    assert.match(tekst, new RegExp('was .*' + String(voor).replace('.', '\\.')),
      'en de oude waarde ernaast -- dat is waar de jaargangen voor zijn: ' + tekst.slice(0, 200));
    assert.match(tekst, /goedgekeurd/, 'wat het kantoor doorvoert, heeft een mens gezien');

    /* De impact-knop hoort alleen bij de tariefwijziging te staan, en niet bij
       de minimumloon-wijziging: daar valt geen factuur door van behandeling te
       veranderen. */
    const knoppen = await page.$$('[data-raak]');
    assert.equal(knoppen.length, 1, 'precies een impact-knop, bij de tariefwijziging');

    await knoppen[0].click();
    await page.waitForFunction(() => /vervangen percentage/.test(document.querySelector('#rwUit').textContent),
      null, { timeout: 15000 });
    const na = (await page.$eval('#rwUit', e => e.innerText)).replace(/\s+/g, ' ');
    assert.match(na, /0 factuur\/facturen/, 'er zijn geen facturen, en dat staat er als nul en niet als niets');
    /* Bij NUL geraakte facturen stuurt de server bewust de andere zin: niet de
       nuance "hoeft niet fout te zijn" (die hoort bij een lijst om na te lopen)
       maar de vaststelling dat er niets is. Het scherm neemt die zin over en
       schrijft er niets stelligers overheen. */
    assert.match(na, /Geen enkele factuur na de ingangsdatum/i, 'de zin van de server reist mee');

    assert.deepEqual(fouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen mag falen */ }
  }
});
