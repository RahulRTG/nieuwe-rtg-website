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
  const navigatieBuiten = [];
  let instantReality = null;
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

      /* Deze vier vlaggenschepen gebruiken dezelfde mobiele compositie:
         hoofdwerkvlak boven, vaste wereldnavigatie onder. Hun inhoud kan
         hoger zijn dan het werkvlak, maar hoort BINNEN het artikel te
         scrollen. Zonder min-height:0 op het main-griditem duwt de inhoud de
         navigatie onder een body die zelf niet scrolt -- hij bestaat dan, maar
         een gebruiker kan hem nooit bereiken. */
      const navSelector = {
        '/apps/instant-reality.html': '.ir-shell>aside',
        '/apps/private-office.html': '.po-rail',
        '/apps/living-os.html': '.lo-rail',
        '/apps/partner-network.html': '.pn-rail'
      }[url];
      if (navSelector) {
        const nr = await page.evaluate((sel) => {
          const e = document.querySelector(sel);
          const r = e && e.getBoundingClientRect();
          return r ? { boven: Math.round(r.top), onder: Math.round(r.bottom), venster: innerHeight } : null;
        }, navSelector);
        if (!nr || nr.boven < 0 || nr.onder > nr.venster) {
          navigatieBuiten.push(url + ': ' + (nr ? nr.boven + '..' + nr.onder + ' bij ' + nr.venster + 'px' : 'ontbreekt'));
        }
      }

      /* EEN PAGINA DIE PAST KAN NOG STEEDS LEEG ZIJN.

         Instant Reality verborg op telefoonmaat alle drie zijn artikelen met
         `.ir-grid>article{display:none}`. De regel erna probeerde .ir-world
         terug te tonen, maar verloor op CSS-specificiteit: de breedtescan was
         groen terwijl een mens een volledig zwart werkvlak zag.

         De mutatie voor deze bewering is precies de oude selector terugzetten:
         `.ir-grid>.ir-world` -> `.ir-world`. Dan worden titel, kaart en knop
         allemaal nul hoog en zakt deze toets. De knopmaat bewaakt tegelijk dat
         de ene beslissende actie op een telefoon ook echt met een duim te
         bedienen is. */
      if (url === '/apps/instant-reality.html') {
        instantReality = await page.evaluate(() => {
          const wereld = document.querySelector('.ir-world');
          const titel = wereld && wereld.querySelector('h2');
          const actie = document.getElementById('irApprove');
          const navigatie = document.querySelector('.ir-shell>aside');
          const wr = wereld && wereld.getBoundingClientRect();
          const ar = actie && actie.getBoundingClientRect();
          const nr = navigatie && navigatie.getBoundingClientRect();
          return {
            wereldHoog: wr ? Math.round(wr.height) : 0,
            titel: titel ? titel.textContent.trim() : '',
            actieHoog: ar ? Math.round(ar.height) : 0,
            actieZichtbaar: !!(actie && getComputedStyle(actie).display !== 'none' && ar && ar.width > 0),
            navigatieBoven: nr ? Math.round(nr.top) : 0,
            navigatieOnder: nr ? Math.round(nr.bottom) : 0,
            vensterHoog: innerHeight
          };
        });
      }
    }
    assert.deepEqual(teBreed, [], 'deze werelden lopen op een telefoon buiten beeld, en er is niet naartoe te scrollen');
    assert.deepEqual(navigatieBuiten, [],
      'de mobiele navigatie van deze werelden valt buiten het niet-scrollende venster:\n  ' + navigatieBuiten.join('\n  '));
    assert.ok(instantReality, 'Instant Reality is werkelijk in de schermronde gemeten');
    assert.ok(instantReality.wereldHoog > 300,
      'Instant Reality toont op telefoonmaat zijn hoofdwereld, kreeg ' + instantReality.wereldHoog + 'px');
    assert.match(instantReality.titel, /Alles ligt al klaar/i,
      'de zichtbare hoofdkaart draagt zijn eigen kernboodschap');
    assert.equal(instantReality.actieZichtbaar, true, 'de hoofdactie is zichtbaar');
    assert.ok(instantReality.actieHoog >= 44,
      'de hoofdactie heeft duimmaat (minimaal 44px), kreeg ' + instantReality.actieHoog + 'px');
    assert.ok(instantReality.navigatieBoven >= 0 && instantReality.navigatieOnder <= instantReality.vensterHoog,
      'de mobiele wereldnavigatie blijft volledig in beeld, kreeg y ' +
      instantReality.navigatieBoven + '..' + instantReality.navigatieOnder + ' bij ' + instantReality.vensterHoog + 'px');
  } finally {
    await ctx.close();
    await browser.close();
    await stop(srv.child);
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
  }
});
