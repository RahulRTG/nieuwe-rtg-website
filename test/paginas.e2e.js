/* ============================================================================
   DE PAGINASCAN -- elke pagina in public/ wordt echt geopend in een browser.

   WAAROM DIT ER IS

   De schermtests hiernaast (test/*.e2e.js) beproeven allemaal EEN scherm dat
   iemand belangrijk vond. Er staan 189 pagina's in public/. Een pagina die
   niemand een eigen test gaf, kon dus stuk zijn zonder dat iets dat merkte --
   en stuk gaat het stil: een script dat halverwege sneuvelt laat de rest van
   dat bestand ongelezen, en het scherm ziet er nog steeds uit alsof het werkt.

   Precies dat gebeurde deze week met een naambotsing op window.RTGPoort. De
   aanroep stierf in een async afhandeling, er kwam geen melding in beeld, en
   de inlogpoort ging simpelweg nooit open. Vier schermtests zakten pas nadat
   iemand toevallig langs dat scherm liep.

   WAT DEZE SCAN AFREKENT

   Per pagina: geen onafgevangen fout, een titel, een lang-attribuut en een
   body die iets rendert. Dat is bewust weinig. Deze scan vervangt geen enkele
   schermtest -- hij vangt de categorie "deze pagina is stukgegaan en niemand
   keek", en dat is de categorie waar de rest van de suite blind voor is.

   DE BASISLIJN

   Zestien pagina's gooien vandaag een fout. Die staan hieronder met naam en
   reden in MAG_STUK, precies zoals de uitzonderingen in scripts/check.js: een
   uitzondering die je moet opschrijven wordt gelezen, een stilzwijgende niet.

   EEN SCHOON GEWORDEN PAGINA MELDT HIJ, MAAR LAAT HEM NIET ZAKKEN. Dat is
   geen slordigheid maar de eerlijke grens van deze scan: sommige fouten komen
   uit een api-aanroep die NA de load binnenkomt (apps/payroll.html is er zo
   een). Hoe lang je ook wacht, dat blijft een wedloop. Zou een schone pagina
   de toets laten zakken, dan zakt hij vroeg of laat op de klok in plaats van
   op de code -- en dat is precies het soort toets dat mensen uitzetten.

   Draai los: node --experimental-sqlite --test test/paginas.e2e.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const PUB = path.join(__dirname, '..', 'public');

/* Pagina's die vandaag een onafgevangen fout gooien, met de reden erbij.
   Alle vijftien hebben dezelfde vorm: de pagina wist bij "niet ingelogd" zijn
   eigen opmaak (innerHTML op de hoofdcontainer) en bindt daarna alsnog een
   luisteraar aan een element dat daarmee net verdwenen is. Het scherm dat de
   bezoeker ziet klopt; het script stopt alleen eerder dan het denkt. */
const MAG_STUK = {
  '/apps/foundation/beheer.html': 'leest de gezinscode uit een sessie die er uitgelogd niet is',
  '/apps/foundation/beroepen.html': 'werpt "geen sessie" zonder gezinsprofiel',
  '/apps/foundation/bieb.html': 'werpt "geen sessie" zonder gezinsprofiel',
  '/apps/foundation/contact.html': 'leest de gezinscode uit een sessie die er uitgelogd niet is',
  '/apps/foundation/geloofbieb.html': 'werpt "geen sessie" zonder gezinsprofiel',
  '/apps/foundation/projecten.html': 'leest het profiel uit een sessie die er uitgelogd niet is',
  '/apps/foundation/schoolbieb.html': 'werpt "geen sessie" zonder gezinsprofiel',
  '/apps/foundation/schrijven.html': 'leest het profiel uit een sessie die er uitgelogd niet is',
  '/apps/foundation/steun.html': 'leest het profiel uit een sessie die er uitgelogd niet is',
  '/apps/foundation/toetsen.html': 'leest de gezinscode uit een sessie die er uitgelogd niet is',
  '/apps/foundation/zakgeld.html': 'leest de gezinscode uit een sessie die er uitgelogd niet is',
  '/apps/home.html': 'bindt #allesUit nadat de uitgelogde tak #main heeft leeggemaakt',
  '/apps/overheid.html': 'bindt #idStart nadat de uitgelogde tak de opmaak heeft leeggemaakt',
  '/apps/payroll.html': 'werpt "Geen backoffice-sessie" uit een api-aanroep die na de load binnenkomt',
  '/apps/reisbureau.html': 'bindt #adviesGo nadat de uitgelogde tak de opmaak heeft leeggemaakt',
  '/apps/rtgschool.html': 'bindt een luisteraar nadat de uitgelogde tak de opmaak heeft leeggemaakt'
};

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

test('elke pagina in public/ opent zonder onafgevangen fout',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const paginas = alleHtml(PUB).sort();
  assert.ok(paginas.length > 150, 'de scan vindt de pagina\'s (' + paginas.length + ')');

  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-paginascan-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  const stuk = [];       // pagina's met een fout die er niet hoort
  const genezen = [];    // pagina's op de basislijn die het niet meer nodig hebben
  const kaal = [];       // pagina's zonder titel, taal of inhoud
  try {
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    /* Vier tabbladen naast elkaar. Bijna alle tijd is wachten (900 ms per
       pagina om late aanroepen te laten binnenkomen), dus serieel duurde dit
       ruim drie minuten en zo een kleine minuut. Elk tabblad heeft zijn eigen
       foutenlijst, dus de fout blijft bij de pagina waar hij vandaan komt. */
    const banen = 4;
    const werk = Array.from({ length: banen }, () => []);
    paginas.forEach((p, i) => werk[i % banen].push(p));

    await Promise.all(werk.map(async (lijst) => {
      const page = await browser.newPage();
      const fouten = [];
      page.on('pageerror', e => fouten.push(e.message));
      for (const p of lijst) {
        fouten.length = 0;
        let probe = null;
        try {
          await page.goto(base + p, { waitUntil: 'load' });
          // ruim laten uitlopen: de meeste schermen doen hun eerste api-aanroep
          // pas na de load, en juist daar sneuvelt er iets. Bij 300ms miste hij
          // apps/payroll.html, waarvan de fout uit een afgewezen aanroep komt.
          await new Promise(r => setTimeout(r, 900));
          probe = await page.evaluate(() => ({
            titel: (document.title || '').trim(),
            taal: document.documentElement.getAttribute('lang') || '',
            kinderen: document.body ? document.body.children.length : 0
          }));
        } catch (e) {
          fouten.push('LAADFOUT: ' + e.message);
        }
        const bekend = Object.prototype.hasOwnProperty.call(MAG_STUK, p);
        if (fouten.length && !bekend) stuk.push(p + '  ->  ' + fouten[0]);
        if (!fouten.length && bekend) genezen.push(p);
        if (probe && (!probe.titel || !probe.taal || probe.kinderen === 0)) {
          kaal.push(p + '  ->  titel=' + JSON.stringify(probe.titel) + ' lang=' + JSON.stringify(probe.taal) + ' kinderen=' + probe.kinderen);
        }
      }
    }));
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }

  assert.equal(stuk.length, 0,
    'deze pagina(s) gooien een onafgevangen fout en staan niet op de basislijn:\n  ' + stuk.join('\n  '));
  assert.equal(kaal.length, 0,
    'deze pagina(s) missen een titel, een taal of tonen niets:\n  ' + kaal.join('\n  '));
  // advisering, geen poort: zie de kop van dit bestand
  if (genezen.length) console.log('  # deze pagina(s) waren schoon en mogen misschien uit MAG_STUK:\n  #   ' + genezen.join('\n  #   '));
});
