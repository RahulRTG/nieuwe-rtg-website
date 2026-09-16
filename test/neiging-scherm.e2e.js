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
const { laadScherm, startServer, stop, browserOpties, geenBrowser, letOpFouten,
  wachtTot, wachtOpVerandering, wachtOpRust, klikEnWacht } = require('./helper');
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
    /* EN WACHTEN TOT DE SCHIL ZELF KLAAR IS, niet alleen het werkblad.

       Dit is de race die de vaste wachttijden toedekten, precies zoals de kop
       van scripts/klokwacht.js voorspelt. `.vraagkaart` is van DIT scherm; de
       Rahul-tab komt uit de gedeelde schil en zijn kleur wordt daarna nog een
       keer gezet door shared/rahul-tab/inkt.js -- die meet de grond en kiest de
       inkt, want er bestaat geen vast grijs dat op een lichte en een donkere
       balk allebei 4,5:1 haalt. Tot dat script heeft gedraaid staat er nog het
       basisgrijs #746D67 uit style-base.js, en dat haalde op de grond van dit
       scherm 1,63:1.

       De contrasttoets keurde dus een scherm dat nog niet af was. Met
       `waitForTimeout(600)` erin viel dat niet op omdat de schil er meestal
       binnen die 600ms was -- meestal, en dat is precies het woord waarom een
       vaste tijd geen wacht is. De toestand waar het echt om gaat is: heeft
       inkt.js zijn kleur gezet? Dat is te zien, want hij zet hem INLINE. */
    await wachtTot(page, () => {
      const tab = document.querySelector('.rtg-rahul-tab');
      return !!tab && !!tab.style.color;
    }, null, { wat: 'de inkt van de Rahul-tab (shared/rahul-tab/inkt.js)' });
    await fn(page, fouten, base);
  } finally {
    if (browser) await browser.close();
    await stop(child);
  }
}

/* WACHTEN OP EEN TOESTAND EN NOOIT OP EEN TIJD.

   Hier stond vijf keer `waitForTimeout(600)` -- en test/klokwacht.test.js zakte
   daarop, terecht. Een vaste tijd is een gok die twee kanten op fout gaat: op
   een trage runner is 600ms te kort en zakt de toets zonder dat er iets stuk
   is, op een snelle is het verspilde tijd. Beide keren meet je de machine in
   plaats van het scherm.

   Wat er in de plaats komt zijn VIER wachten, en dat aantal is geen slordigheid
   maar de uitslag: het scherm doet na een klik vier dingen, en de vaste tijd
   dekte er drie van toe. Ze staan uitgeschreven bij `verder()` hieronder en bij
   de schilwacht in `metLid()` hierboven. Wie ze terugbrengt tot een enkele
   wacht, keurt een scherm dat nog niet af is. */
async function vraagTekst(page) {
  const el = page.locator('.vraagkaart p.vraag').first();
  if (!(await el.count())) return '';
  return String(await el.textContent()).replace(/\s+/g, ' ').trim();
}

/* Verder, en pas terug als het scherm werkelijk verder IS. De volgende vraag en
   het slotscherm staan allebei in `.vraagkaart p.vraag`, dus een verandering
   van die tekst dekt beide uitgangen -- ook de laatste ronde, waar er geen
   volgende vraag meer komt. */
async function verder(page) {
  const voor = await vraagTekst(page);
  /* DRIE WACHTEN EN NIET EEN, want een klik op Verder zet DRIE dingen in gang.
     Dat is geen omslachtigheid maar de tweede race die de vaste wachttijd
     toedekte, en hij staat in de bron van het scherm zelf:

         const r = await api('/api/neiging/antwoord', ...);
         toonIntake(r.body);
         laadGeheugen();          <-- GEEN await

     `laadGeheugen()` haalt /api/neiging/geheugen op en hangt dus NA de
     vraagwissel nog in de lucht. Wie alleen op het antwoord wacht, of alleen op
     de nieuwe vraag, kijkt naar een geheugenlijst die nog van voor de klik is.
     Met `waitForTimeout(600)` viel dat niet op omdat die tweede aanroep er
     meestal binnen die 600ms was -- en "meestal" is precies waarom een vaste
     tijd geen wacht is. De toets die eronder sneuvelde was niet de contrasttoets
     maar 'vergeten haalt de regel van het scherm': die telde nul regels op een
     scherm waar er een hoorde te staan, en gaf als reden "voorwaarde: er staat
     iets in het geheugen".

     De tweede aanroep wordt daarom OPGEVANGEN VOORDAT er geklikt wordt -- daarna
     is hij misschien al langs. En het opvangen van het antwoord is niet genoeg:
     het tekenen gebeurt pas erna, dus de rust van #geheugen sluit de rij. */
  const geheugen = page.waitForResponse(
    (r) => r.url().includes('/api/neiging/geheugen'), { timeout: 20000 });
  await klikEnWacht(page, '.door', '/api/neiging/antwoord');
  await wachtOpVerandering(page, '.vraagkaart p.vraag', voor);
  await geheugen;
  await wachtOpRust(page, '#geheugen', { rondes: 2 });
}

/* Een ronde: kies de eerste optie en ga verder. */
async function ronde(page) {
  await page.locator('.keuze').first().click();
  await verder(page);
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

      await verder(page);
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
      await verder(page);
      await page.locator('.keuze', { hasText: 'Thuis laten komen' }).first().click();
      await verder(page);
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
      /* Op de TOESTAND wachten en niet op een tijd. De wacht draagt hier de
         bevinding: zakt vergeet() terug naar een `ok` zonder te splicen, dan
         blijft de regel staan en loopt deze wacht af met die tekst erbij. De
         assert eronder blijft staan omdat hij het getal noemt waar het om gaat. */
      await wachtTot(page, (n) => document.querySelectorAll('.neiging').length === n,
        voor - 1, { wat: 'de vergeten regel van het scherm' });
      assert.equal(await page.locator('.neiging').count(), voor - 1,
        'vergeten hoort de regel van het scherm te halen');
    });
  });
});
