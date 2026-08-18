/* DE SCHERMEN TERWIJL DE BACKEND LIEGT.

   WAAROM DIT BESTAND ER IS, en het is een gat dat te meten viel. De liegpoort
   (server/opzet/liegpoort.js) bestaat sinds de mutatieronde en doet precies wat
   je wil: met RTG_LIEG geeft elk endpoint een geldig maar LEEG antwoord,
   `{ok:true}` en verder niets. De mutatiemotor richt hem op 465 servertoetsen.

   Op de 119 schermtoetsen werd hij NUL keer gebruikt. Nagemeten met een grep,
   niet aangenomen. Het wapen lag er dus al en was nooit op de UI gericht, en
   daarmee bleef een hele foutklasse onzichtbaar: niet "geeft de server het
   goede antwoord", maar "wat doet het scherm als hij het NIET krijgt".

   DE DRIE DINGEN DIE HIER FOUT ZIJN, en waarom juist deze drie:

   1. EEN JS-FOUT. Het scherm rekent op een veld dat er niet is en valt om. Dan
      staat er een half scherm, of "Laden..." tot het eind der tijden.
   2. ROMMEL IN BEELD. `undefined`, `NaN`, `[object Object]`. Objectief fout,
      nooit een bewuste keuze, en voor een lid het duidelijkste teken dat er
      iets stuk is. Een bedrag van "€ NaN" is erger dan een foutmelding.
   3. EEN ZEKERHEID DIE NIET UIT GEGEVENS KOMT. Dit is de scherpste van de drie.
      Een scherm mag nooit meer zekerheid tonen dan de backend bezit: betaling
      in behandeling is nooit "Betaald", een boeking-aanvraag is nooit
      "Bevestigd", een upload die niet is opgeslagen is nooit "Opgeslagen".

   HOE 3 ZONDER VALS ALARM WORDT GEMETEN. Een zekerheidswoord mag gewoon in een
   scherm staan -- als vaste tekst, in een uitleg, op een knop. De vraag is of
   het er staat ZONDER dat er gegevens zijn. Dus vergelijken we twee dingen:

     de STATISCHE bron van het scherm (het .html-bestand, geen JS gedraaid)
     de GERENDERDE tekst met een liegende backend (JS gedraaid, nul gegevens)

   Staat een zekerheidswoord in de tweede en niet in de eerste, dan heeft het
   scherm het zelf verzonnen op een leeg antwoord. Dat is de bewering, en hij
   kalibreert zichzelf per scherm -- geen woordenlijst die per pagina moet
   worden bijgehouden.

   DE SCHULD STAAT IN SCHERMLEUGEN.json EN MAG ALLEEN KRIMPEN. Dit is nieuwe
   dekking over een klasse die nooit is bekeken, dus er ligt schuld. Die
   wegpoetsen door de toets zwakker te maken zou het gat verplaatsen in plaats
   van sluiten; hem meteen hard laten zakken maakt de suite rood om iets wat
   niemand vandaag repareert. Dus: opgeschreven, per scherm, met wat er precies
   misgaat -- en de poort gaat dicht zodra er iets BIJ komt. Zelfde patroon als
   BEREIK.json.

   Draai los: node --test test/liegend-scherm.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const { vindKlachten, vergelijk } = require('../scripts/lib/schermleugen');

const pw = laadPlaywright();

const WORTEL = path.join(__dirname, '..');
const SCHULD = path.join(WORTEL, 'SCHERMLEUGEN.json');

/* DE SCHERMEN. Ledenschermen die hun inhoud van de server halen -- op een
   scherm zonder gegevens valt niets te liegen. Bewust een handvol en niet alle
   242: elk scherm kost een echte browserstart, en deze toets moet in een
   gewone e2e-ronde passen. Groeit hij, dan groeit hij met reden. */
const SCHERMEN = [
  '/apps/geld.html',
  '/apps/berichten.html',
  '/apps/bestanden.html',
  '/apps/agenda.html',
  '/apps/notities.html',
  '/apps/boeken.html'
];

/* WAT NIET MAG LIEGEN. De deuren, anders komt de browser niet eens binnen en
   meet je de inlog in plaats van het scherm. Plus de schil die elk scherm nodig
   heeft om überhaupt op te bouwen: taal, configuratie, de appgids. Alles daarbuiten
   liegt, dus elk gegeven dat het scherm toont komt uit een leeg antwoord. */
const SPAAR = ['/api/auth/', '/api/config', '/api/i18n', '/api/talen',
  '/api/vertaal/', '/api/gids/app', '/api/push/key'].join(',');

/* De drie detectoren staan in scripts/lib/schermleugen.js: puur, dus toetsbaar
   zonder browser en bereikbaar voor de mutatiemotor. Zie de kop daar. */

const leesSchuld = () => {
  try { return JSON.parse(fs.readFileSync(SCHULD, 'utf8')); } catch (e) { return null; }
};

/* De zichtbare tekst, en nadrukkelijk niet de HTML: een zekerheidswoord in een
   verborgen sjabloon of een aria-label is geen bewering aan een lid. */
const zichtbareTekst = (page) => page.evaluate(() => {
  const uit = [];
  const loop = (el) => {
    for (const k of el.children) {
      const st = getComputedStyle(k);
      if (st.display === 'none' || st.visibility === 'hidden' || k.hidden) continue;
      if (!k.children.length) { const t = (k.textContent || '').trim(); if (t) uit.push(t); }
      else loop(k);
    }
  };
  loop(document.body);
  return uit.join(' · ');
});

test('geen scherm liegt als de backend leeg antwoordt',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-liegscherm-'));
  const { child, base } = await startServer({ env: {
    SMTP_URL: '', RTG_DATA_DIR: TMP,
    RTG_LIEG: '/api/', RTG_LIEG_NIET: SPAAR
  } });
  let browser;
  const gevonden = {};
  try {
    const u = Date.now().toString().slice(-8);
    const reg = await fetch(base + '/api/auth/register', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Liegproef', email: 'lp' + u + '@x.nl', phone: '06' + u,
        password: 'geheim123', geboortedatum: '1986-06-06', geslacht: 'm', tier: 'rtg', pasApp: 'rtg' })
    }).then(r => r.json());
    assert.ok(reg && reg.token, 'de deur mag niet liegen, anders meet deze toets de inlog');

    browser = await pw.chromium.launch(browserOpties(pw));

    for (const scherm of SCHERMEN) {
      const klachten = [];
      /* De statische bron: wat het scherm zegt VOORDAT er JS heeft gedraaid.
         Dit is de ijklijn voor de zekerheidsvraag. */
      const statisch = await fetch(base + scherm).then(r => r.ok ? r.text() : '').catch(() => '');
      if (!statisch) { gevonden[scherm] = ['scherm niet op te halen']; continue; }

      const page = await browser.newPage();
      const fouten = [];
      letOpFouten(page, fouten);
      try {
        await page.goto(base + scherm, { waitUntil: 'domcontentloaded' });
        await page.evaluate(t => {
          localStorage.setItem('rtg_member_token', t);
          localStorage.setItem('rtg_lang', 'nl');
          localStorage.setItem('rtg_cookieinfo_v1', '1');
        }, reg.token);
        await page.goto(base + scherm, { waitUntil: 'domcontentloaded' });
        /* Even laten uitrazen: de meeste schermen halen hun gegevens na het
           laden op, en dan is juist het antwoord daarop wat we willen zien. */
        await page.waitForFunction(() => new Promise(r => setTimeout(() => r(true), 2500)),
          null, { timeout: 8000 });

        const tekst = await zichtbareTekst(page);

        klachten.push(...vindKlachten({ tekst, statisch, fouten }));
      } catch (e) {
        klachten.push('scherm viel om: ' + String((e && e.message) || e).slice(0, 120));
      } finally {
        try { await page.close(); } catch (e) {}
      }
      if (klachten.length) gevonden[scherm] = klachten;
    }
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }

  /* ---- DE RATEL ----
     Nieuw ten opzichte van de opgeschreven schuld is een fout; minder is winst
     en hoort te worden vastgelegd. Precies BEREIK.json, en om dezelfde reden:
     een schuld die niet kan groeien wordt vanzelf kleiner. */
  const schuld = leesSchuld();
  if (!schuld) {
    assert.fail('SCHERMLEUGEN.json ontbreekt. Leg de huidige stand vast:\n' +
      JSON.stringify(gevonden, null, 2));
  }
  const { nieuw, opgelost } = vergelijk(gevonden, schuld.schuld || {});
  assert.deepEqual(nieuw, [],
    'een scherm liegt op een manier die nog niet in SCHERMLEUGEN.json staat');
  assert.deepEqual(opgelost, [],
    'dit staat als schuld opgeschreven maar gebeurt niet meer -- haal het uit ' +
    'SCHERMLEUGEN.json, anders beschermt de ratel een gat dat dicht is');
});
