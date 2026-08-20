/* ELKE WERELD PAST OP EEN TELEFOON.

   Vier van de twaalf werelden liepen op 390px rechts buiten beeld: Partner
   Network 558, Private Office 557, Living OS 532, Instant Reality 459. En er
   was niet naartoe te scrollen, want die schermen staan zelf op
   overflow:hidden -- de helft van een kolom was gewoon weg.

   Twee van die vier bestaan niet meer: Instant Reality is opgegaan in Het
   Vooruitzicht (het vroegere Living OS) en Private Office in het Privekantoor
   (WERELDEN.md, "De twee dubbele paren"). De metingen hierboven blijven staan
   als wat ze waren -- ze zeggen waar deze toets vandaan komt.

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
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();

/* Dezelfde elf als in shared/command/catalog.js. Bewust hier uitgeschreven en
   niet uit die module gelezen: dit is een lijst van SCHERMEN die op een telefoon
   moeten passen, en dat blijft gelden als de catalogus ooit anders wordt
   ingedeeld.

   /apps/lifestyle.html staat er zonder inlog op: die toont dan zijn inlogpaneel,
   en ook DAT hoort op 390px te passen. De diepere schermen erachter worden hier
   dus niet gemeten; dat doet test/lifestyleschermen.e2e.js met een sessie.

   ZE HEETTEN HIER "WERELDEN" EN DAT ZIJN ZE NIET. Toen deze toets werd
   geschreven stonden ze in de bank onder het kopje Software, naast de werelden,
   en werd het woord er losjes voor gebruikt. Sinds WERELDEN.md is een wereld een
   van de vier menselijke contexten (LivingOS, WorkOS, TravelOS, FoundationOS) en
   zijn deze twaalf gewone schermen die daarin hangen. De variabele houdt zijn
   naam niet: een toets die het huisvocabulaire tegenspreekt, leert je het
   verkeerde woord. */
const SCHERMEN = [
  '/apps/vandaag.html', '/apps/living-os.html', '/apps/lifestyle.html',
  '/apps/partner-network.html', '/apps/reizen-veilig.html',
  '/apps/leven.html', '/apps/geld-command.html', '/apps/sociaal.html',
  '/apps/media.html', '/apps/horeca.html', '/apps/reisboek.html',
];

test('elk scherm uit de catalogus past op een telefoon van 390px', { skip: geenBrowser(pw) }, async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-breedte-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: dataDir } });
  const browser = await pw.chromium.launch(browserOpties(pw));
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await volgVerzoeken(page);
  const teBreed = [];
  const navigatieBuiten = [];
  let vooruitzicht = null;
  try {
    for (const url of SCHERMEN) {
      /* `domcontentloaded` en niet `load`: `load` wacht op ELK subverzoek -- elk
         plaatje, elk lettertype -- terwijl de regel eronder al op het echte
         teken wacht. Onder belasting valt dat om op zijn eigen 45 seconden, en
         dan is de uitslag rood zonder dat er iets stuk is (TAKEN.md 4.39). */
      await page.goto(srv.base + url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      /* Wachten op de OPMAAK, niet op de klok: zolang er geen stijlblad binnen is
         meet je een ongestileerde pagina, en die past altijd. */
      await page.waitForFunction(() => document.styleSheets.length > 0, { timeout: 15000 });
      await wachtOpRust(page);
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

         Dit stond hier voor Instant Reality, dat op telefoonmaat al zijn
         artikelen verborg met `.ir-grid>article{display:none}`; de regel erna
         probeerde .ir-world terug te tonen maar verloor op CSS-specificiteit.
         De breedtescan was groen terwijl een mens een volledig zwart werkvlak
         zag. Dat scherm bestaat niet meer -- het is opgegaan in Het
         Vooruitzicht (WERELDEN.md, "De twee dubbele paren") -- maar de valkuil
         is meeverhuisd, want /apps/living-os.html doet op telefoonmaat precies
         hetzelfde: `.lo-panel{display:none}` en daarna `.lo-worlds{display:block}`.
         De bewering verhuist dus mee.

         De mutatie: draai die twee regels om in shared/living-os.css, of geef
         `.lo-panel` een selector die van `.lo-worlds` wint. Dan worden titel,
         kaart en knop allemaal nul hoog en zakt deze toets. De knopmaat bewaakt
         tegelijk dat de ene beslissende actie op een telefoon ook echt met een
         duim te bedienen is -- die knop stond eerder in het beslissingspaneel,
         dat een telefoon niet toont. */
      if (url === '/apps/living-os.html') {
        vooruitzicht = await page.evaluate(() => {
          const meet = () => {
            const wereld = document.querySelector('.lo-worlds');
            const titel = document.getElementById('loWorldTitle');
            const actie = document.getElementById('loApprove');
            const navigatie = document.querySelector('.lo-rail');
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
          };
          /* VERBERGEN BESTAAT NIET (ADAPTIEF.md). De vijf knoppen in de balk
             waren nergens aan gebonden: op een telefoon toonde dit scherm
             altijd hetzelfde paneel en waren intent en beslissingen niet te
             bereiken. Elke knop hoort nu HET PANEEL op te leveren dat erbij
             hoort.

             Deze lijst staat er bewust naast en wordt niet uit de code gelezen:
             de eerste versie van deze toets keek alleen of er ENIG paneel
             zichtbaar was, en dat is altijd waar -- het wereldpaneel staat er
             standaard. Met de binding eruit bleef hij groen. Nu zakt hij. */
          const VERWACHT = { universe: '.lo-worlds', intent: '.lo-intent', worlds: '.lo-worlds',
            decisions: '.lo-decisions', evidence: '.lo-decisions' };
          const knoppen = [...document.querySelectorAll('.lo-rail nav button')];
          const leeg = [];
          for (const knop of knoppen) {
            const v = knop.dataset.view;
            knop.click();
            const paneel = VERWACHT[v] && document.querySelector(VERWACHT[v]);
            if (!paneel || paneel.getBoundingClientRect().height < 120) leeg.push(v || knop.textContent.trim());
          }
          knoppen[0] && knoppen[0].click();
          return Object.assign(meet(), { knoppen: knoppen.length, leeg });
        });
      }
    }
    assert.deepEqual(teBreed, [], 'deze werelden lopen op een telefoon buiten beeld, en er is niet naartoe te scrollen');
    assert.deepEqual(navigatieBuiten, [],
      'de mobiele navigatie van deze werelden valt buiten het niet-scrollende venster:\n  ' + navigatieBuiten.join('\n  '));
    assert.ok(vooruitzicht, 'Het Vooruitzicht is werkelijk in de schermronde gemeten');
    assert.ok(vooruitzicht.wereldHoog > 300,
      'Het Vooruitzicht toont op telefoonmaat zijn hoofdwereld, kreeg ' + vooruitzicht.wereldHoog + 'px');
    assert.match(vooruitzicht.titel, /Alles ligt al klaar/i,
      'de zichtbare hoofdkaart draagt zijn eigen kernboodschap');
    assert.equal(vooruitzicht.actieZichtbaar, true, 'de hoofdactie is zichtbaar');
    assert.ok(vooruitzicht.actieHoog >= 44,
      'de hoofdactie heeft duimmaat (minimaal 44px), kreeg ' + vooruitzicht.actieHoog + 'px');
    assert.ok(vooruitzicht.navigatieBoven >= 0 && vooruitzicht.navigatieOnder <= vooruitzicht.vensterHoog,
      'de mobiele wereldnavigatie blijft volledig in beeld, kreeg y ' +
      vooruitzicht.navigatieBoven + '..' + vooruitzicht.navigatieOnder + ' bij ' + vooruitzicht.vensterHoog + 'px');
    assert.equal(vooruitzicht.knoppen, 5, 'de balk draagt vijf knoppen');
    assert.deepEqual(vooruitzicht.leeg, [],
      'deze balkknoppen leveren op telefoonmaat geen zichtbaar paneel op: ' + vooruitzicht.leeg.join(', '));
  } finally {
    await ctx.close();
    await browser.close();
    await stop(srv.child);
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
  }
});
