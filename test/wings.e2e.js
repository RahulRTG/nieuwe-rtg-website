/* DE WINGS van de leden-app: de werkbank naast de console.

   Op de computer kan de middenconsole niet groter -- dat is gemeten, niet
   gekozen: --e wordt begrensd door 1.48cqh omdat het beginscherm in EEN scherm
   past zonder scrollen, dus op een 900px hoog venster staat --e op 12,5px,
   dezelfde maat als op een telefoon. De breedte die daardoor overblijft is waar
   de wings voor zijn.

   WAAROM DEZE TOETS ER IS, EN NIET ALLEEN EEN SCHERMSCHOT.

   De eerste versie van deze wings stond in een eigen deelbestand tussen
   app-main-59 en -60. De bron in public/apps/app-main/ is op GROOTTE geknipt en
   niet op functiegrenzen, dus dat bestand belandde midden in een functie die
   nooit wordt aangeroepen. Geen syntaxfout, geen uitzondering in de console, de
   CSS-poort werkte, de elementen stonden in de DOM en de browser haalde de code
   op -- en er gebeurde niets. Precies het beeld waarbij je "hij staat erin"
   zegt.

   Dat is pas gebleken door in de PAGINA te kijken of er iets in de flanken
   stond. Deze toets doet dat elke keer opnieuw:

     1. onder 1100px zijn de wings er niet (display:none EN leeg)
     2. erboven staan de zakelijke apps erin, met echte namen
     3. de naam van een tab-app komt uit de tabbar (itemDef kent hem niet)
     4. de keuze is aanpasbaar en overleeft een herlaadbeurt

   Draait alleen waar Playwright beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function laadPlaywright() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) {}
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) {}
  return null;
}
const pw = laadPlaywright();

async function opzet() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wings-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: dataDir } });
  const u = Date.now().toString(36);
  const r = await fetch(srv.base + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Wing Proef', email: 'wing' + u + '@voorbeeld.test', phone: '0612345678',
      password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
  });
  const d = await r.json();
  return { srv, token: d.token, dataDir };
}

/* De OS-laag toont zijn springboard pas als #app de klasse `active` draagt. Een
   verse registratie zit nog in de intake, dus die klasse zetten we zelf: we
   toetsen de WINGS en niet de onboarding. */
async function meet(pwBrowser, base, token, breed, hoog) {
  const ctx = await pwBrowser.newContext({ viewport: { width: breed, height: hoog }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const fouten = [];
  page.on('pageerror', e => fouten.push(String(e.message)));
  await page.addInitScript(t => { try { localStorage.setItem('rtg_member_token', t); } catch (e) {} }, token);
  await page.goto(base + '/apps/app.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.evaluate(() => { const a = document.getElementById('app'); if (a) a.classList.add('active'); });
  await page.waitForTimeout(2500);   // de widgets halen hun bron op
  const uit = await page.evaluate(() => {
    const L = document.getElementById('wingL'), R = document.getElementById('wingR');
    const namen = el => [...el.querySelectorAll('.wing-naam')].map(n => n.textContent.trim());
    return {
      display: L ? getComputedStyle(L).display : null,
      links: L ? namen(L) : [], rechts: R ? namen(R) : [],
      instel: !!document.querySelector('.wing-instel'),
      widgets: document.querySelectorAll('.wing-widget').length,
      pijlen: document.querySelectorAll('.wing-vol').length,
      metWaarde: [...document.querySelectorAll('.wing-widget.heeft-waarde')]
        .map(x => x.querySelector('.wing-naam').textContent.trim() + ' = ' + x.querySelector('.wing-lijf').textContent.trim()),
      leegLijfZichtbaar: [...document.querySelectorAll('.wing-widget:not(.heeft-waarde)')]
        .some(x => { const l = x.querySelector('.wing-lijf'); return l && getComputedStyle(l).display !== 'none'; }),
      shell: Math.round(document.getElementById('shell').getBoundingClientRect().width)
    };
  });
  uit.fouten = fouten;
  return { uit, page, ctx };
}

test('wings: weg op de iPad, gevuld op de computer, en aanpasbaar', { skip: pw ? false : 'geen Playwright' }, async () => {
  const { srv, token, dataDir } = await opzet();
  const browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
  try {
    // 1) op iPad-breedte bestaan de wings niet
    {
      const { uit, ctx } = await meet(browser, srv.base, token, 820, 1180);
      assert.equal(uit.display, 'none', 'onder 1100px horen de wings weg te zijn');
      assert.deepEqual(uit.links, [], 'en leeg: de OS-laag vult ze daar niet');
      assert.deepEqual(uit.rechts, []);
      assert.equal(uit.instel, false, 'ook geen aanpasknop');
      assert.deepEqual(uit.fouten, [], 'geen JS-fouten');
      await ctx.close();
    }

    // 2) op de computer staan de zakelijke apps erin
    {
      const { uit, page, ctx } = await meet(browser, srv.base, token, 1440, 900);
      assert.equal(uit.display, 'flex', 'boven 1100px horen ze er te zijn');
      assert.ok(uit.links.length >= 3, 'de werkbank is gevuld, maar stond op ' + uit.links.length);
      assert.ok(uit.rechts.length >= 3, 'de administratie is gevuld, maar stond op ' + uit.rechts.length);
      assert.ok(uit.links.includes('RTG Office'), 'RTG Office (document, rekenblad, presentatie) hoort in de werkbank');
      assert.ok(uit.rechts.includes('Balans'), 'Balans hoort in de administratie');
      assert.equal(uit.instel, true, 'en er is een aanpasknop');
      /* De naam van een TAB-app komt niet uit de registry maar uit de tabbar.
         Zonder die weg stond hier letterlijk "tab:bestellen" in de flank. */
      for (const n of [...uit.links, ...uit.rechts]) {
        assert.ok(!/^(tab|link|os):/.test(n), 'een ruwe sleutel als label: ' + n);
      }
      /* WIDGETS, GEEN TEGELS. Elke kaart heeft een uitklappijl (full screen =
         de app), en een kaart ZONDER bron toont geen leeg lijf -- want een lege
         regel leest als "u heeft niets" en dat is een bewering. */
      assert.equal(uit.widgets, uit.links.length + uit.rechts.length, 'elke flank-app hoort een widget te zijn');
      assert.equal(uit.pijlen, uit.widgets, 'elke widget heeft een uitklappijl naar de app');
      assert.equal(uit.leegLijfZichtbaar, false, 'een widget zonder bron toont geen leeg lijf');
      assert.ok(uit.metWaarde.some(w => w.startsWith('Balans')), 'de Balans-widget hoort een echt advies te tonen, kreeg: ' + JSON.stringify(uit.metWaarde));
      assert.ok(uit.metWaarde.some(w => /€/.test(w)), 'een geld-widget hoort een echt bedrag te tonen, kreeg: ' + JSON.stringify(uit.metWaarde));
      assert.deepEqual(uit.fouten, [], 'geen JS-fouten');

      // 3) aanpassen: de eerste app links uitzetten en dat moet blijven staan
      const eerste = uit.links[0];
      await page.click('.wing-instel');
      await page.waitForSelector('.wing-kaart');
      await page.evaluate(naam => {
        const rij = [...document.querySelectorAll('.wing-rij')].find(r => r.firstChild.textContent.trim() === naam);
        rij.querySelector('.wing-stand').click();          // de eerste stand is "uit"
      }, eerste);
      await page.waitForTimeout(250);
      const na = await page.evaluate(() => [...document.querySelectorAll('#wingL .wing-naam')].map(n => n.textContent.trim()));
      assert.ok(!na.includes(eerste), '"' + eerste + '" hoort na uitzetten weg te zijn');

      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.evaluate(() => { const a = document.getElementById('app'); if (a) a.classList.add('active'); });
      await page.waitForTimeout(700);
      const naHerlaad = await page.evaluate(() => [...document.querySelectorAll('#wingL .wing-naam')].map(n => n.textContent.trim()));
      assert.ok(!naHerlaad.includes(eerste), 'de keuze hoort een herlaadbeurt te overleven');
      await ctx.close();
    }
  } finally {
    await browser.close();
    await stop(srv);
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
  }
});
