/* Het werkblad en de middenconsole in een echte browser.

   Twee dingen die alleen daar te zien zijn:

   1. RTG Kantoren is niet meer stuk. Er stond maandenlang losse JS als platte
      tekst in beeld doordat een ingeplakte scriptregel het inline script van de
      pagina afsloot. Een toets die de PAGINA-tekst nakijkt vangt precies dat.
   2. Het werkblad doet wat het belooft: meerdere vlakken, met de eigen pagina
      in het eerste, en een scheiding die je kunt verslepen. En de console van
      Rahul is te verplaatsen en van maat te veranderen.

   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
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

test('kantoren: heel scherm, werkblad en een verplaatsbare console', { skip: pw ? false : 'geen browser beschikbaar' }, async (t) => {
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
    page.on('pageerror', (e) => fouten.push(String(e && e.message || e)));
    await page.goto(srv.base + '/apps/kantoren.html', { waitUntil: 'domcontentloaded' });
    /* Wachten tot de PAGINA zich heeft aangemeld, niet tot het script bestaat.
       window.RTGWerkblad staat er zodra shared/werkblad.js is ingelezen, maar
       de lijst met schermen komt uit kantoren.html zelf. Wie op het eerste
       wacht, toetst een werkblad zonder schermen -- en dan lijkt "een scherm
       kiezen" stuk terwijl er alleen niets te kiezen was. */
    await page.waitForSelector('.wb-balk button', { timeout: 20000 });
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

    await t.test('twee vlakken naast elkaar, met de eigen pagina in het eerste', async () => {
      await page.evaluate(() => window.RTGWerkblad.indeling('naast'));
      await page.waitForSelector('.wb-blad .wb-vlak', { timeout: 5000 });
      const d = await page.evaluate(() => {
        const vlakken = document.querySelectorAll('.wb-blad .wb-vlak');
        return {
          aantal: vlakken.length,
          eigenErin: !!(vlakken[0] && vlakken[0].querySelector('main')),
          kolommen: getComputedStyle(document.querySelector('.wb-blad')).gridTemplateColumns.split(' ').length,
          greep: !!document.querySelector('.wb-greep-x')
        };
      });
      assert.equal(d.aantal, 2);
      assert.equal(d.eigenErin, true, 'de echte pagina hoort in het eerste vlak te staan, geen kopie');
      assert.equal(d.kolommen, 2);
      assert.equal(d.greep, true, 'er hoort een greep tussen de vlakken te zitten');
    });

    await t.test('een scherm in het tweede vlak zetten werkt', async () => {
      /* Let op de selector. Het eerste vlak bevat de HELE pagina, en die heeft
         zelf ook keuzelijsten (taal, filters). '.wb-vlak select' pakt die dus
         mee en dan zet je per ongeluk iets in een lijst van de pagina in
         plaats van in de kopbalk van het vlak. Alleen '.wb-kopbalk' telt. */
      const keuzes = await page.evaluate(() =>
        [...document.querySelectorAll('.wb-blad .wb-vlak')[1].querySelectorAll('.wb-kopbalk option')].map(o => o.value));
      assert.ok(keuzes.indexOf('/apps/lab.html') >= 0, 'het lab hoort in de lijst te staan: ' + JSON.stringify(keuzes));
      await page.evaluate(() => {
        const k = document.querySelectorAll('.wb-blad .wb-vlak > .wb-kopbalk select')[1];
        k.value = '/apps/lab.html';
        k.dispatchEvent(new Event('change'));
      });
      await page.waitForSelector('.wb-blad iframe', { state: 'attached', timeout: 5000 });
      const d = await page.evaluate(() => {
        const f = document.querySelector('.wb-blad iframe');
        const r = f.getBoundingClientRect();
        return { src: f.getAttribute('src'), b: Math.round(r.width), h: Math.round(r.height) };
      });
      assert.match(d.src, /lab\.html$/);
      // en hij hoort ook echt RUIMTE te hebben; een vlak van 0 bij 0 is geen vlak
      assert.ok(d.b > 200 && d.h > 200, 'het tweede vlak hoort echt beeld te krijgen (' + d.b + 'x' + d.h + ')');
    });

    await t.test('de indeling blijft staan na een verversing', async () => {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.wb-blad .wb-vlak', { timeout: 20000 });
      const n = await page.evaluate(() => document.querySelectorAll('.wb-blad .wb-vlak').length);
      assert.equal(n, 2, 'de gekozen indeling hoort onthouden te worden');
    });

    await t.test('terug naar een vlak zet de pagina weer gewoon terug', async () => {
      await page.evaluate(() => window.RTGWerkblad.indeling('een'));
      const d = await page.evaluate(() => ({
        blad: !!document.querySelector('.wb-blad'),
        main: !!document.querySelector('body > main, body > .wrap main, main')
      }));
      assert.equal(d.blad, false, 'het blad hoort weg te zijn');
      assert.equal(d.main, true, 'de pagina hoort er gewoon te staan');
    });

    await t.test('de console van Rahul is te verplaatsen en van maat te veranderen', async () => {
      await page.waitForFunction(() => !!window.RTGChatScherm, null, { timeout: 20000 });
      await page.evaluate(() => { window.__handenvrijKamer.beurt('rahul', 'Ik sta hier.'); window.RTGChatScherm.zet('half'); });
      await page.waitForSelector('.hv-maat', { timeout: 5000 });
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
