/* HET SCHERM VAN RTG NEIGING IN EEN ECHTE BROWSER (NEIGING.md par. 4).

   WAAROM DIT NAAST test/neiging.e2e.js BESTAAT. Die toets bewijst dat de routes
   leven en wat ze teruggeven. Of een lid daar iets aan HEEFT, is een andere
   vraag: of de vragen verschijnen, of een tik aankomt, of de balk binnen de
   schermbreedte blijft, en of de bestemmingen aan het eind werkelijk ergens
   heen gaan. Dat zijn dingen die alleen een echt scherm kan zeggen -- en een
   ervan was hier fout, op een manier die geen enkele serverzijdige toets kon
   zien (zie de derde toets hieronder).

   Draait alleen waar Playwright met een passende browser staat; anders
   overgeslagen. Draai: npm run e2e */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { laadScherm, startServer, stop, browserOpties, geenBrowser, letOpFouten } = require('./helper');
/* De EIGEN keuring van dit huis, dezelfde BRON die scripts/a11y.js injecteert.
   Geen tweede contrastregel ernaast: dan zeggen twee meters iets anders over
   dezelfde kleur, en de poort van de keten is degene die telt. */
const { BRON } = require('../scripts/a11ykeuring');

const pw = laadScherm();

/* Een lid, een server, een telefoonvenster. */
async function metLid(fn, breedte = 390, hoogte = 844) {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-neiging-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const r = await fetch(base + '/api/auth/register', { method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Neiging Lid', email: 'neiging' + process.pid + breedte + '@x.nl',
        phone: '0612345799', password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' }) });
    const reg = await r.json();
    assert.ok(reg.token, 'lid-registratie geeft een token');
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: breedte, height: hoogte } });
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem('rtg_member_token', t);
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      } catch (e) {}
    }, reg.token);
    const page = await ctx.newPage();
    const fouten = letOpFouten(page, []);
    await page.goto(base + '/apps/mijn-neigingen.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.vraagkaart', { timeout: 20000 });
    await fn(page, fouten, base);
  } finally {
    if (browser) await browser.close();
    await stop(child);
  }
}

/* Een ronde: kies de eerste optie en ga verder. */
async function ronde(page) {
  await page.locator('.keuze').first().click();
  await page.locator('.door').click();
  await page.waitForTimeout(600);
}

test('het scherm van RTG Neiging', { skip: geenBrowser(pw), concurrency: false }, async (t) => {

  await t.test('de intake verschijnt, een tik komt aan, en hij eindigt', async () => {
    /* DE MUTATIE: laat intake() in kern/neiging/index.js altijd `klaar: true`
       geven. De eerste assert zakt dan op een ontbrekende vraagtekst. */
    await metLid(async (page, fouten) => {
      const vraag = (await page.locator('.vraagkaart p.vraag').first().textContent()).trim();
      assert.ok(vraag.length > 3, 'er hoort een vraag te staan, niet: ' + vraag);
      assert.ok(await page.locator('.keuze').count() >= 2, 'een vraag zonder keuzes is geen vraag');

      await page.locator('.keuze').first().click();
      assert.equal(await page.locator('.keuze').first().getAttribute('aria-pressed'), 'true',
        'een tik hoort zichtbaar te blijven staan');

      await page.locator('.door').click();
      await page.waitForTimeout(600);
      assert.equal(await page.locator('.neiging').count(), 1,
        'na het eerste antwoord hoort er een regel in het geheugen te staan');

      /* Doorlopen tot hij zichzelf afkapt. Een intake die niet eindigt is de
         hele bevinding van NEIGING.md par. 7. */
      let rondes = 0;
      while (await page.locator('.keuze').count() > 0) {
        assert.ok(rondes++ < 10, 'de intake eindigt niet in de browser');
        await ronde(page);
      }
      assert.match((await page.locator('.vraagkaart p.vraag').first().textContent()).trim(),
        /Dit is jouw RTG/, 'het slot hoort het resultaat te tonen');
      assert.deepEqual(fouten, [], 'geen consolefouten');
    });
  });

  await t.test('elk raakvlak haalt de aanraakmaat en niets loopt buiten beeld', async () => {
    /* TOEGANKELIJK.md houdt 24x24 aan als harde poort. En een scherm dat breder
       wordt dan het venster verbergt bediening zonder dat iets klaagt.

       DE MUTATIE: zet `min-height` op .keuze naar 12px. Deze toets zakt. */
    await metLid(async (page) => {
      const klein = await page.locator('.keuze, .door, .later').evaluateAll(
        els => els.filter(e => {
          const r = e.getBoundingClientRect();
          return r.width < 24 || r.height < 24;
        }).map(e => (e.textContent || '').trim()));
      assert.deepEqual(klein, [], 'te kleine raakvlakken: ' + klein.join(', '));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390,
        'de pagina loopt buiten het venster');
    });
  });

  await t.test('elke bestemming aan het eind gaat ergens HEEN', async () => {
    /* DIT IS DE BEVINDING DIE GEEN SERVERTOETS KON ZIEN, en hij hoort hier te
       blijven staan.

       De server geeft aan het eind een lijst SLEUTELS (`opent`), en het scherm
       zoekt daar een naam en een adres bij in sprongindex.json. Dat deed het met
       "wie het eerst komt wint" -- en `reizen` staat twee keer in die index:
       eerst als TAB (zonder url) en daarna als LINK naar /apps/reizen-veilig.html.
       Het lid kreeg dus dode tekst te zien terwijl er een prima adres bestond.
       Een winnaar op sorteervolgorde is precies de fout die KAARTEN.md bij
       gebiedkeuze.js beschrijft.

       De toets vergelijkt met wat de SERVER zegt, en niet met een getal: zo
       zakt hij ook als de vragenlijst verandert.

       DE MUTATIE: zet in mijn-neigingen.html de keuze terug op
       `if (!INDEX[i.sleutel])`. Deze toets zakt op een span in plaats van een
       link. */
    await metLid(async (page) => {
      while (await page.locator('.keuze').count() > 0) await ronde(page);

      const opent = await page.evaluate(async () => {
        const t = localStorage.getItem('rtg_member_token');
        const r = await fetch('/api/neiging/intake', { method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: '{}' });
        return (await r.json()).opent;
      });
      assert.ok(opent.length >= 2, 'voorwaarde: er horen meerdere bestemmingen open te staan');
      assert.equal(await page.locator('.opent a').count(), opent.length,
        'niet elke bestemming werd een link; de server noemde ' + opent.join(', '));
      for (const a of await page.locator('.opent a').all()) {
        const href = await a.getAttribute('href');
        assert.match(href || '', /^\/apps\//, 'een bestemming zonder bruikbaar adres: ' + href);
      }
    });
  });

  await t.test('ook een bestemming ZONDER eigen url wordt een werkende link', async () => {
    /* De vorige toets liep toevallig langs reizen/stad, en die hebben allebei een
       eigen url. Vijf van de zeven openingsopties wijzen naar een TAB of een
       OS-app die IN de leden-app woont en er geen heeft (werk, bestellen, salon,
       videobellen, zorg). Die stonden als dode tekst op het scherm, en geen
       enkele servertoets zag het -- de route gaf keurig de sleutel terug.

       Deze toets kiest daarom expliciet "Eten" en daarna "Thuis laten komen",
       en dat komt uit op `bestellen`: een tab zonder url.

       DE MUTATIE: haal de tab/os-tak uit adresVan() in mijn-neigingen.html.
       Deze toets zakt op een span in plaats van een link. */
    await metLid(async (page) => {
      await page.locator('.keuze', { hasText: 'Eten' }).first().click();
      await page.locator('.door').click();
      await page.waitForTimeout(700);
      await page.locator('.keuze', { hasText: 'Thuis laten komen' }).first().click();
      await page.locator('.door').click();
      await page.waitForTimeout(700);
      while (await page.locator('.keuze').count() > 0) await ronde(page);

      const adressen = await page.locator('.opent a').evaluateAll(
        els => els.map(e => e.getAttribute('href')));
      assert.equal(await page.locator('.opent .opent-stil').count(), 0,
        'een bestemming staat als dode tekst; links: ' + adressen.join(', '));
      assert.ok(adressen.some(h => /app\.html#tab=bestellen/.test(h || '')),
        'de tab-bestemming hoort de vorm van sprong.js te krijgen: ' + adressen.join(', '));
    });
  });

  await t.test('geen contrastfout, in BEIDE standen van het scherm', async () => {
    /* DIT IS DE TOETS DIE ER NIET WAS, en dat kostte een rode CI.

       De vorige toets hierboven meet raakvlakmaat en overloop -- allebei
       zichtbaar met een liniaal. Kleurcontrast is dat niet, en juist daar ging
       het mis: `.door` zette `background: var(--gold); color: #0C0C0B`, met een
       `--gold` die de pagina zelf op #C9A24B zette. De Heritage-laag
       overschrijft dat token in LivingOS naar rgb(103,75,18), en bijna-zwart
       daarop haalt 2,42:1. De a11y-poort van de keten vond het; deze toets niet.

       TWEE STANDEN EN NIET EEN. De intake en de geheugenkaart tonen ANDERE
       elementen (de graad-badge, de mini-knoppen, de bestemmingen), en een
       ronde die alleen de eerste meet ziet de helft van het scherm nooit --
       dezelfde les als bij de bestemmingen twee toetsen hierboven.

       DE MUTATIE, EN LET OP DAT DE VOOR DE HAND LIGGENDE NIET BIJT: alleen
       `background:var(--gold);color:#0C0C0B` terug op `.door` zetten verandert
       NIETS, want `body.rtg-stijl .knop.vol` in rtg-ui.css heeft een hogere
       soortelijkheid en wint. Dat is bij het schrijven van deze toets echt
       gebeurd -- de mutatie draaide, de toets bleef groen, en dat leest als een
       toets die niets bewaakt.

       De mutatie die WEL bijt is de oorspronkelijke fout in zijn geheel: haal
       `knop vol` uit de klasse van de knop EN zet de eigen kleuren terug. Dan
       zakt deze toets op exact de melding die de keten vond:
       `button.door "Verder" -- rgb(12,12,11) op rgb(103,75,18)`, 2,42:1. */
    const KEUR = '(function(){' + BRON + '\nreturn window.__a11yKeur()})()';
    await metLid(async (page) => {
      const intake = await page.evaluate(KEUR);
      assert.deepEqual(intake.contrast, [],
        'contrast in de intake-stand: ' + JSON.stringify(intake.contrast));
      assert.deepEqual(intake.overtredingen, [],
        'structureel in de intake-stand: ' + JSON.stringify(intake.overtredingen));

      while (await page.locator('.keuze').count() > 0) await ronde(page);

      const klaar = await page.evaluate(KEUR);
      assert.deepEqual(klaar.contrast, [],
        'contrast in de klaar-stand: ' + JSON.stringify(klaar.contrast));
      assert.deepEqual(klaar.overtredingen, [],
        'structureel in de klaar-stand: ' + JSON.stringify(klaar.overtredingen));
      /* Besturingsproef: de keuring moet WEL iets gezien hebben. Een keuring die
         op een lege pagina draait meldt ook nul (scripts/tandeloos.js). */
      assert.ok(await page.locator('.neiging').count() > 0,
         'voorwaarde: er staat iets op het scherm om te keuren');
    });
  });

  await t.test('vergeten haalt de regel van het scherm', async () => {
    /* DE MUTATIE: laat vergeet() in kern/neiging/beheer.js `ok` teruggeven
       zonder te splicen. Deze toets zakt op een regel die blijft staan. */
    await metLid(async (page) => {
      await ronde(page);
      const voor = await page.locator('.neiging').count();
      assert.ok(voor >= 1, 'voorwaarde: er staat iets in het geheugen');
      await page.locator('.neiging .mini', { hasText: 'Vergeet dit' }).first().click();
      await page.waitForTimeout(600);
      assert.equal(await page.locator('.neiging').count(), voor - 1,
        'vergeten hoort de regel van het scherm te halen');
    });
  });
});
