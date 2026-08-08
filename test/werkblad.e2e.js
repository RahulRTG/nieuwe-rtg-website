/* RTG Kantoren en de middenconsole in een echte browser.

   Twee dingen die alleen daar te zien zijn:

   1. RTG Kantoren is niet meer stuk. Er stond maandenlang losse JS als platte
      tekst in beeld doordat een ingeplakte scriptregel het inline script van de
      pagina afsloot. Een toets die de PAGINA-tekst nakijkt vangt precies dat.
   2. De console van Rahul is te verplaatsen en van maat te veranderen.

   HET WERKBLAD ZELF IS HIER WEG, en dat is geen versoepeling maar het najagen
   van een besluit. De ios-ronde haalde het bureaublad uit het OS ("een
   homescreen, en verder niets", zie README) en daarmee verdween
   shared/werkblad.js. Vier deeltoetsen bleven daarna een feature beweren die
   niet meer bestaat: ze riepen window.RTGWerkblad aan, dat nooit meer komt.
   Erger was de wacht op '.wb-balk button' vóór alle deeltoetsen -- daardoor
   zakte OOK de meting op de losse JS in beeld, de enige reden dat dit bestand
   ooit is geschreven. Een toets die een verdwenen feature bewaakt, bewaakt
   niets en verbergt wat hij nog wel kon zien.

   Komt het werkblad terug, dan komen die vier mee terug; ze staan in de
   git-historie van dit bestand.

   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadBrowser();

test('kantoren: de pagina draait heel, en de console is te verplaatsen', { skip: pw ? false : 'geen browser beschikbaar' }, async (t) => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werkblad-e2e-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const u = Date.now().toString().slice(-8);
    const reg = await fetch(srv.base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Blad Tester', email: 'bt' + u + '@x.nl', phone: '065' + u,
        password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
    }).then(r => r.json());
    assert.ok(reg.token);
    /* Kantoren draait op de KANTOOR-sessie, niet op de ledenpas. Zonder dat
       token stuurt de pagina je meteen door naar de personeels-app -- en dan
       toetst dit bestand een heel andere pagina zonder dat je het ziet. Dat
       ging hier de eerste keer ook mis; vandaar deze regel. */
    const kantoor = await fetch(srv.base + '/api/office/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'RTG-OFFICE' })
    }).then(r => r.json());
    assert.ok(kantoor.token, 'kantoor-inlog mislukt: ' + JSON.stringify(kantoor).slice(0, 120));

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript((t) => {
      try { localStorage.setItem('rtg_member_token', t.lid); localStorage.setItem('rtg_office_token', t.kantoor); } catch (e) {}
    }, { lid: reg.token, kantoor: kantoor.token });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(srv.base + '/apps/kantoren.html', { waitUntil: 'domcontentloaded' });
    /* Wachten tot de PAGINA er staat. Hier stond een wacht op '.wb-balk
       button' -- de knoppenbalk van het werkblad -- en die knoppen komen nooit
       meer: zie de kop van dit bestand. Die ene regel liet het hele bestand
       twintig seconden hangen en daarna zakken, inclusief de drie deeltoetsen
       hieronder die niets met het werkblad te maken hebben. */
    await page.waitForSelector('main', { timeout: 20000 });
    assert.match(page.url(), /kantoren\.html/, 'we horen op kantoren te staan, niet doorgestuurd te zijn');

    await t.test('er staat geen losse JS meer als tekst op de pagina', async () => {
      const tekst = await page.evaluate(() => document.body.innerText);
      /* Precies wat er in beeld stond toen het script te vroeg werd afgesloten.
         Dit zijn geen willekeurige tekens: het zijn de brokstukken van de
         string die de portfolio-export opbouwt. */
      for (const brok of ["d.ontwerpen.length", "d.disciplines.map(esc)", "'+ secties+'", '.filter(Boolean).join']) {
        assert.ok(tekst.indexOf(brok) < 0, 'losse code in beeld: ' + brok);
      }
      assert.ok(tekst.indexOf('<') < 0 || !/<div class="sub">/.test(tekst), 'onverwerkte HTML in beeld');
    });

    await t.test('het inline script draait echt (geen JS-fout)', async () => {
      assert.deepEqual(fouten.filter(f => !/favicon|manifest|Failed to load resource/i.test(f)), []);
    });

    await t.test('de console van Rahul is te verplaatsen en van maat te veranderen', async () => {
      await page.waitForFunction(() => !!window.RTGChatScherm, null, { timeout: 20000 });
      await page.evaluate(() => { window.__handenvrijKamer.beurt('rahul', 'Ik sta hier.'); window.RTGChatScherm.zet('half'); });
      await page.waitForSelector('.hv-maat', { timeout: 5000 });
      /* EERST DE OPSTART-ANIMATIE LATEN UITLOPEN, en dat is geen "even wachten
         tot het rustig is" maar een harde voorwaarde.

         ios.js opent elke app met `ios-lanceer`, een animatie die een transform
         op de BODY zet. Zolang die loopt is body het bevattende blok voor alles
         wat position:fixed is -- zo werkt CSS -- en dus rekent de console zijn
         `bottom` af tegen de hele pagina in plaats van tegen het venster. Op
         kantoren.html is dat een document van 3121px: de greep lag op y=2836
         terwijl het venster 900 hoog is. De sleep hieronder miste hem daardoor
         volledig, klikte naast de console, en die klapte dicht -- waarna de
         meting 0 breed teruggaf en het leek alsof de console stuk was.

         Hij is niet stuk. Een halve seconde later staat hij op 615, precies
         waar hij hoort. Wachten tot de transform weg is meet dus de app en niet
         de animatie. */
      await page.waitForFunction(
        () => getComputedStyle(document.body).transform === 'none',
        null, { timeout: 10000 });
      const voor = await page.evaluate(() => document.querySelector('.hv-chat').getBoundingClientRect().toJSON());

      // aan de maat-greep trekken: breder en hoger
      const m = await page.locator('.hv-maat').boundingBox();
      await page.mouse.move(m.x + m.width / 2, m.y + m.height / 2);
      await page.mouse.down();
      await page.mouse.move(m.x + 140, m.y + 90, { steps: 6 });
      await page.mouse.up();
      const na = await page.evaluate(() => document.querySelector('.hv-chat').getBoundingClientRect().toJSON());
      assert.ok(na.width > voor.width + 40, 'de console hoort breder te worden (was ' + Math.round(voor.width) + ', nu ' + Math.round(na.width) + ')');
      assert.equal(await page.evaluate(() => document.body.classList.contains('hv-verzet')), true);

      // en de plek blijft staan na een verversing
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.body.classList.contains('hv-verzet'), null, { timeout: 20000 });
    });

    await page.close();
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    stop(srv && srv.child);
  }
});
