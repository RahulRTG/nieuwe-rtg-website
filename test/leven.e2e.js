/* ============================================================================
   LEEFT ELK SCHERM, OF STAAT HET ER ALLEEN MAAR?

   test/paginas.e2e.js vraagt: gaat deze pagina open zonder te klagen. Dat is de
   ene helft. Deze toets vraagt de andere, en het is de helft die vandaag een uur
   kostte: DOET er ook iets?

   HET GEVAL WAAR DEZE TOETS UIT KOMT

   De wings van de leden-app stonden in een eigen deelbestand. De bron in
   public/apps/app-main/ wordt op GROOTTE geknipt en niet op functiegrenzen, dus
   dat bestand belandde midden in een functie die nooit wordt aangeroepen. Het
   beeld was volmaakt geruststellend: 200, geen JS-fout, titel klopt, taal klopt,
   body vol, alle elementen in de DOM, de browser haalde de code op. Elke poort
   die we hadden stond groen. Er gebeurde alleen niets.

   Zo'n scherm is niet stuk, het is DOOD. En dood is stiller dan stuk.

   HOE JE LEVEN MEET ZONDER ELK SCHERM APART TE KENNEN

   Twee tekenen, allebei generiek: een scherm dat leeft praat met de API, of het
   verandert zijn eigen DOM nadat de pagina geladen is. Een MutationObserver die
   bij DOMContentLoaded begint, telt precies dat.

   DE DREMPEL IS GEMETEN, NIET GEKOZEN. Over alle 189 schermen:

       dood (geen api, geen mutatie)           0 mutaties   1 scherm
       het STILSTE levende scherm             54 mutaties
       p5 / p25 / mediaan                     84 / 112 / 143

   Tussen 0 en 54 zit niets. Tien is daarom een veilige grens: vijf keer onder
   het stilste levende scherm en ver boven dood. Geen wedloop met de klok, want
   de afstand is een factor vijf en geen paar procent.

   WAT DEZE TOETS NIET VANGT, en dat hoort erbij: een scherm dat wel iets doet
   maar het VERKEERDE. Daar zijn de gerichte toetsen voor. Deze vangt de
   categorie waar de rest blind voor is.

   Draai: npm run e2e   (of los: node --experimental-sqlite --test test/leven.e2e.js)
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const PUB = path.join(__dirname, '..', 'public');
const DREMPEL = 10;          // mutaties na de load; zie de meting hierboven

/* Schermen die met REDEN niets doen. Elke regel is een keuze, geen omissie --
   dezelfde afspraak als de publieke-routelijst in scripts/check.js. Wie hier
   iets aan toevoegt, zet de reden erbij; een lijst die stil groeit is precies
   hoe een toets zijn tanden verliest. */
const MAG_STIL = new Map([
  ['/site/404.html', 'een statische foutpagina: geen JS, en dat hoort zo']
]);

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadBrowser();

function alleHtml(map) {
  const uit = [];
  for (const naam of fs.readdirSync(map)) {
    const vol = path.join(map, naam);
    if (fs.statSync(vol).isDirectory()) uit.push(...alleHtml(vol));
    else if (naam.endsWith('.html')) uit.push('/' + path.relative(PUB, vol).split(path.sep).join('/'));
  }
  return uit;
}

test('elk scherm geeft een teken van leven', { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async (t) => {
  const paginas = alleHtml(PUB).sort();
  /* Een lege lijst is geen "alles goed" maar een kapotte meting (LAT.md regel
     3). Zonder deze regel zou een verplaatste map netjes nul schermen vinden en
     groen geven -- de stilste manier om een toets uit te zetten. */
  assert.ok(paginas.length > 150, 'de scan vindt de schermen (' + paginas.length + ')');

  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-leven-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  const dood = [];       // geen api en te weinig mutaties
  const genezen = [];    // stond op MAG_STIL maar leeft nu
  const stilste = [];    // voor het rapport: waar zit de ondergrens vandaag
  try {
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const banen = 4;
    const werk = Array.from({ length: banen }, () => []);
    paginas.forEach((p, i) => werk[i % banen].push(p));

    await Promise.all(werk.map(async (lijst) => {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
      const page = await ctx.newPage();
      /* De teller wordt VOOR elke navigatie opnieuw gezet (addInitScript draait
         bij elke load) en begint pas bij DOMContentLoaded: wat de browser zelf
         tijdens het parsen bouwt, telt niet mee. Alleen wat de JS daarna doet. */
      await page.addInitScript(() => {
        window.__mut = 0;
        addEventListener('DOMContentLoaded', () => {
          new MutationObserver(ms => { window.__mut += ms.length; })
            .observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
        });
      });
      for (const p of lijst) {
        let api = 0;
        const tel = r => { try { if (new URL(r.url()).pathname.startsWith('/api/')) api++; } catch (e) {} };
        page.on('request', tel);
        let mut = 0, kapot = null;
        try {
          await page.goto(base + p, { waitUntil: 'load', timeout: 30000 });
          // ruim wachten: veel schermen doen hun eerste aanroep pas na de load
          await new Promise(r => setTimeout(r, 900));
          mut = await page.evaluate(() => window.__mut || 0);
        } catch (e) { kapot = e.message.slice(0, 120); }
        page.off('request', tel);

        const leeft = api > 0 || mut >= DREMPEL;
        const magStil = MAG_STIL.has(p);
        if (!leeft && !magStil) dood.push(p + '  ->  ' + api + ' api-aanroepen, ' + mut + ' mutaties' + (kapot ? ', laadfout: ' + kapot : ''));
        if (leeft && magStil) genezen.push(p);
        if (api === 0) stilste.push({ p, mut });
      }
      await ctx.close();
    }));
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }

  /* De ondergrens in beeld, elke ronde. Zakt die richting de drempel, dan is dat
     zichtbaar VOORDAT de toets omvalt -- en dan is het een gesprek over de
     drempel in plaats van een verrassing. */
  stilste.sort((a, b) => a.mut - b.mut);
  t.diagnostic('stilste schermen zonder api-aanroep: ' +
    stilste.slice(0, 5).map(s => s.p + '=' + s.mut).join(', ') + '  (drempel ' + DREMPEL + ')');

  assert.deepEqual(dood, [],
    'deze schermen geven geen enkel teken van leven -- ze openen, maar hun JS doet niets:\n  ' + dood.join('\n  '));
  /* Een scherm dat op MAG_STIL staat maar inmiddels leeft, is geen fout maar
     wel een lijst die krimpen kan. Melden, niet laten zakken: zie de kop van
     test/paginas.e2e.js voor waarom dat hier de goede kant is. */
  if (genezen.length) console.log('  # deze schermen leven nu en mogen uit MAG_STIL:\n  #   ' + genezen.join('\n  #   '));
});
