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

   EEN BEWUSTE STOP IS GEEN FOUT

   Veertig RTF-tool-pagina's beginnen met dezelfde regel:

       if (!window.Sessie || !Sessie.eisProfiel()) throw new Error('geen sessie');

   eisProfiel() stuurt door naar de inlog en geeft false; de throw stopt de
   rest van het bestand. Dat is bedoeld gedrag en het staat op 40 plekken, dus
   die ene melding telt hier niet als fout. Alles wat anders luidt wel.

   DE BASISLIJN

   Twee pagina's gooien vandaag nog een echte fout. Die staan hieronder met
   naam en reden in MAG_STUK, precies zoals de uitzonderingen in
   scripts/check.js: een uitzondering die je moet opschrijven wordt gelezen,
   een stilzwijgende niet.

   EEN SCHOON GEWORDEN PAGINA MELDT HIJ, MAAR LAAT HEM NIET ZAKKEN. Dat is
   geen slordigheid maar de eerlijke grens van deze scan: sommige fouten komen
   uit een api-aanroep die NA de load binnenkomt. Hoe lang je ook wacht, dat
   blijft een wedloop. Zou een schone pagina de toets laten zakken, dan zakt
   hij vroeg of laat op de klok in plaats van op de code -- en dat is precies
   het soort toets dat mensen uitzetten.

   Draai los: node --test test/paginas.e2e.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser, wachtOpNetstilte } = require('./helper');

const PUB = path.join(__dirname, '..', 'public');

/* De bewuste stop van de RTF-tools: geen fout, zie de kop van dit bestand. */
const BEWUSTE_STOP = /(^|: )geen sessie$/;

/* Pagina's die vandaag nog een echte fout gooien, met de reden erbij. */
/* LEEG, en dat hoort zo. De laatste bewoner was /apps/rtgschool.html: uitgelogd
   vervangt dat scherm zijn hele #main door de inlogkaart, en leer.js hing zijn
   luisteraar op #oefenOpties BUITEN start() -- op een element dat er dan niet
   meer is. Dat het "in start()" leek te gebeuren was juist de misleiding; de
   luisteraar staat nu waar de andere twaalf al stonden. */
const MAG_STUK = {};

const pw = laadPlaywright();

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
  { skip: geenBrowser(pw) }, async () => {
  const paginas = alleHtml(PUB).sort();
  assert.ok(paginas.length > 150, 'de scan vindt de pagina\'s (' + paginas.length + ')');

  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-paginascan-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  const stuk = [];       // pagina's met een fout die er niet hoort
  const genezen = [];    // pagina's op de basislijn die het niet meer nodig hebben
  const kaal = [];       // pagina's zonder titel, taal of inhoud
  const ontbreekt = [];  // pagina's die een eigen bestand niet kunnen ophalen
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    /* Vier tabbladen naast elkaar. Bijna alle tijd is wachten (900 ms per
       pagina om late aanroepen te laten binnenkomen), dus serieel duurde dit
       ruim drie minuten en zo een kleine minuut. Elk tabblad heeft zijn eigen
       foutenlijst, dus de fout blijft bij de pagina waar hij vandaan komt. */
    const banen = 4;
    const werk = Array.from({ length: banen }, () => []);
    paginas.forEach((p, i) => werk[i % banen].push(p));

    await Promise.all(werk.map(async (lijst) => {
      for (const p of lijst) {
        /* EEN PAGINA PER DOCUMENT. Met één hergebruikt tabblad kon een late
           omleiding van het vorige document de volgende page.goto onderbreken.
           Dan meldde de scan tientallen kapotte pagina's die alleen het
           slachtoffer waren van één achtergebleven navigatie. Sluiten is het
           harde einde van alle timers en omleidingen van dat document. */
        const page = await browser.newPage();
        const fouten = [];
        letOpFouten(page, fouten);
      /* EEN 404 OP EEN EIGEN BESTAND GEEFT GEEN JS-FOUT.

         Een vergeten <script> of stylesheet levert geen uitzondering op: de
         pagina heeft nog steeds een titel, een taal en kinderen, dus hij kwam
         hier vrolijk doorheen. Dat is dezelfde stille categorie waar deze scan
         voor bestaat, alleen een verdieping lager. /api/ blijft erbuiten (een
         401 op een uitgelogde pagina is normaal) en favicons ook. Vandaag
         staat de teller op nul; deze regel houdt dat zo. */
        const missend = [];
        page.on('response', r => {
          try {
            const u = new URL(r.url());
            if (r.status() >= 400 && u.origin === new URL(base).origin
                && !/^\/api\//.test(u.pathname) && !/favicon|apple-touch/.test(u.pathname)) {
              missend.push(r.status() + ' ' + u.pathname);
            }
          } catch (e) { /* geen bruikbare url */ }
        });
        let probe = null;
        try {
          /* `domcontentloaded` en niet `load`: `load` wacht tot ELK subverzoek
             binnen is, en valt bij 258 pagina's onder belasting op een dag om op
             zijn eigen tijdslimiet -- rood zonder dat er iets stuk is (TAKEN.md
             4.39). De scan verliest er niets mee: de wacht hieronder blijft
             juist doorlopen zolang er verzoeken binnenkomen, dus een plaatje of
             een lettertype dat 404 geeft komt nog steeds langs `missend`. */
          await page.goto(base + p, { waitUntil: 'domcontentloaded' });
          /* LATEN UITPRATEN, niet 900 ms aftellen.

             De meeste schermen doen hun eerste api-aanroep pas NA de load, en
             juist daar sneuvelt er iets: bij 300 ms miste deze scan
             apps/payroll.html, waarvan de fout uit een afgewezen aanroep komt.
             Het antwoord daarop was 900 ms, en dat is dezelfde gok een maat
             groter -- onder belasting nog steeds te kort, en 258 keer 900 ms is
             bijna vier minuten die er meestal niet nodig zijn.

             wachtOpNetstilte wacht op het GEDRAG: zolang het scherm verzoeken
             blijft afvuren is het bezig, en zodra er 400 ms geen nieuw verzoek
             meer begint is het uitgepraat. Zie test/helper.js voor waarom dit
             niet Playwrights networkidle is (de SSE-lijn).

             Gemeten op 19 augustus 2026: de hele scan duurt hierna 63 s. Alleen
             al de vaste wachten die eruit gingen waren er samen meer dan 230. */
          await wachtOpNetstilte(page);
          /* NA EEN META-REFRESH MEET JE DE BESTEMMING, NIET DEZE PAGINA.

             Drie paden zijn een briefje met `<meta http-equiv="refresh"
             content="0;url=...">`: berichten, zorgbalie en kantoorpda. Die staan
             er nul milliseconden, dus wat je 900 ms later uit de DOM leest is de
             pagina waar je INMIDDELS bent -- meestal de bestemming (die zijn
             eigen titel en inhoud heeft, dus dan slaagt de meting om de
             verkeerde reden), en onder belasting soms een halve navigatie zonder
             kinderen. Zo zakte deze toets een keer op kantoorpda.html met
             `kinderen=0`, terwijl er niets mis was.

             Voor die drie meten we daarom het BRIEFJE ZELF, uit zijn eigen
             bestand: heeft hij een titel, een taal en inhoud, en bestaat de
             pagina waar hij heen wijst? Dat is deterministisch en het gaat over
             het juiste document. De browser blijft hem wel openen -- de
             JS-fouten en de 404's op eigen bestanden komen gewoon binnen, en
             daar is deze scan voor. */
          const bron = fs.readFileSync(path.join(PUB, p), 'utf8');
          const refresh = /<meta[^>]+http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"'>]+)/i.exec(bron);
          if (refresh) {
            const doel = refresh[1].split('?')[0].split('#')[0];
            const bestaat = doel.startsWith('/') && fs.existsSync(path.join(PUB, doel));
            if (!bestaat) ontbreekt.push(p + '  ->  omleiding wijst naar ' + doel + ', dat bestaat niet');
            const t = /<title>([^<]*)<\/title>/i.exec(bron);
            const h = /<html[^>]*\blang\s*=\s*["']([^"']+)["']/i.exec(bron);
            const b = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(bron);
            probe = {
              titel: t ? t[1].trim() : '',
              taal: h ? h[1] : '',
              kinderen: b && /<\w+/.test(b[1]) ? 1 : 0
            };
          } else {
            probe = await page.evaluate(() => ({
              titel: (document.title || '').trim(),
              taal: document.documentElement.getAttribute('lang') || '',
              kinderen: document.body ? document.body.children.length : 0
            }));
          }
        } catch (e) {
          fouten.push('LAADFOUT: ' + e.message);
        } finally {
          await page.close().catch(() => {});
        }
        const echt = fouten.filter(m => !BEWUSTE_STOP.test(String(m)));
        const bekend = Object.prototype.hasOwnProperty.call(MAG_STUK, p);
        if (echt.length && !bekend) stuk.push(p + '  ->  ' + echt[0]);
        if (!echt.length && bekend) genezen.push(p);
        if (missend.length) ontbreekt.push(p + '  ->  ' + [...new Set(missend)].join(', '));
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
  assert.equal(ontbreekt.length, 0,
    'deze pagina(s) vragen een eigen bestand dat er niet is (geen JS-fout, wel stuk):\n  ' + ontbreekt.join('\n  '));
  // advisering, geen poort: zie de kop van dit bestand
  if (genezen.length) console.log('  # deze pagina(s) waren schoon en mogen misschien uit MAG_STUK:\n  #   ' + genezen.join('\n  #   '));
});
