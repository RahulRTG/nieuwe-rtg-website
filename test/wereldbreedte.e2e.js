/* ELKE WERELD PAST OP EEN TELEFOON.

   Vier van de twaalf werelden liepen op 390px rechts buiten beeld: Partner
   Network 558, Private Office 557, Living OS 532, Instant Reality 459. En er
   was niet naartoe te scrollen, want die schermen staan zelf op
   overflow:hidden -- de helft van een kolom was gewoon weg.

   Het was er altijd al; het viel pas op toen de werktafel deze werelden op een
   telefoon bereikbaar maakte. De oorzaak was in alle vier dezelfde vorm: een
   tabrij met knoppen op min-width 170-190px, en daarnaast rasters met vier of
   vijf vaste kolommen. Beide duwden het paneel open, en die breedte plantte
   zich voort naar alles eronder.

   Deze toets meet de uitkomst en niet de reparatie: scrollWidth mag de
   vensterbreedte niet overschrijden. Wie er een kolom bij zet of een min-width
   verhoogt, ziet het hier -- ongeacht hoe hij het doet.

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

/* Dezelfde twaalf als in de bank van de werktafel (shared/command/catalog.js).
   Bewust hier uitgeschreven en niet uit die module gelezen: dit is een lijst van
   SCHERMEN die op een telefoon moeten passen, en dat blijft gelden als de
   catalogus ooit anders wordt ingedeeld. */
const WERELDEN = [
  '/apps/vandaag.html', '/apps/instant-reality.html', '/apps/private-office.html',
  '/apps/living-os.html', '/apps/partner-network.html', '/apps/reizen-veilig.html',
  '/apps/leven.html', '/apps/geld-command.html', '/apps/sociaal.html',
  '/apps/media.html', '/apps/horeca.html', '/apps/reisboek.html',
];

test('elke wereld past op een telefoon van 390px', { skip: pw ? false : 'geen Playwright' }, async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-breedte-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: dataDir } });
  const browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const teBreed = [];
  try {
    for (const url of WERELDEN) {
      await page.goto(srv.base + url, { waitUntil: 'load', timeout: 45000 });
      /* Wachten op de OPMAAK, niet op de klok: zolang er geen stijlblad binnen is
         meet je een ongestileerde pagina, en die past altijd. */
      await page.waitForFunction(() => document.styleSheets.length > 0, { timeout: 15000 });
      await page.waitForTimeout(1200);
      const m = await page.evaluate(() => ({
        venster: document.documentElement.clientWidth,
        inhoud: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        /* het breedste element dat zelf geen te breed kind heeft: dat is de
           dwinger, en die naam maakt een zakkende toets meteen bruikbaar */
        dwinger: (() => {
          const W = document.documentElement.clientWidth;
          for (const el of document.querySelectorAll('body *')) {
            const r = el.getBoundingClientRect();
            if (r.width <= W + 2) continue;
            if ([...el.children].some(k => k.getBoundingClientRect().width > W + 2)) continue;
            return el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className
              ? '.' + el.className.trim().split(/\s+/)[0] : '') + ' (' + Math.round(r.width) + 'px)';
          }
          return null;
        })(),
      }));
      assert.equal(m.venster, 390, 'voorwaarde: het venster is echt 390 breed, anders meet dit niets');
      if (m.inhoud > m.venster + 2) teBreed.push(url + ': ' + m.inhoud + 'px' + (m.dwinger ? ' door ' + m.dwinger : ''));
    }
    assert.deepEqual(teBreed, [], 'deze werelden lopen op een telefoon buiten beeld, en er is niet naartoe te scrollen');
  } finally {
    await ctx.close();
    await browser.close();
    await stop(srv.child);
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
  }
});
