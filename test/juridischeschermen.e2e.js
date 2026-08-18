/* ============================================================================
   DE VIER JURIDISCHE PAGINA'S: STAAT ERIN WAT ERIN MOET?

   WAAROM DIT EEN TOETS VERDIENT

   Dit zijn de saaiste schermen van het huis en tegelijk de enige waar een
   ontbrekende alinea een boete oplevert. Ze stonden alle vier in de lijst van
   TAKEN 4.9: nooit door een toets aangeraakt, alleen door de veeg die kijkt of
   er iets laadt.

   Het bijzondere van deze vier is dat ze GEEN functionaliteit hebben. Er valt
   niets te klikken en niets te bewaren; de inhoud IS het product. Een
   privacyverklaring waar het klachtrecht uit is gevallen ziet er nog steeds
   perfect uit -- er is geen knop die stukgaat en geen scherm dat leeg blijft.
   Precies daarom is een tekstcontrole hier geen slappe toets maar de enige
   toets die iets zegt.

   WAT ER MOET STAAN, en waarom juist dat:

   PRIVACY (AVG). De verwerkingsverantwoordelijke (wie is aanspreekbaar), de
   rechten van de betrokkene (inzage, vergetelheid, bezwaar), de bewaartermijn
   en het klachtrecht bij de Autoriteit Persoonsgegevens. Die laatste is de
   makkelijkste om te vergeten en de pijnlijkste om te missen: hij vertelt de
   lezer dat hij ergens terechtkan als wij niet luisteren.

   VOORWAARDEN en PARTNERVOORWAARDEN. Aansprakelijkheid en opzegging: waar
   sta je als het misgaat, en hoe kom je er weer uit. Bij de partnerkant ook de
   commissie -- dat is de kern van de afspraak.

   EN DE MERKREGEL. Nergens op deze pagina's mag een echt hotel- of
   luchtvaartmerk als bevestigde partner staan. Dat staat in CLAUDE.md en het is
   op juridische pagina's het gevaarlijkst: daar leest een lezer het als een
   toezegging.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten } = require('./helper');

/* Eén browserkeuze voor alle schermtoetsen: ./browser.js. Die probeert te
   STARTEN in plaats van te laden -- een Playwright zonder bijbehorende Chromium
   liet elke schermtoets anders omvallen op "Executable doesn't exist". */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-jur-'));

/* Per pagina wat er beslist in moet staan. Bewust als losse eisen met een
   naam, zodat een gezakte toets zegt WELKE alinea ontbreekt in plaats van
   alleen dat er iets mis is. */
const PAGINAS = [
  { pad: '/apps/juridisch.html', naam: 'de juridische index', eisen: [
    ['verwijst naar de privacyverklaring', /privacy/i],
    ['verwijst naar de voorwaarden', /voorwaarden/i]
  ] },
  { pad: '/apps/juridisch/privacy.html', naam: 'de privacyverklaring', eisen: [
    ['noemt de verwerkingsverantwoordelijke', /verwerkingsverantwoordelijke/i],
    ['noemt het recht op inzage of vergetelheid', /inzage|vergetelheid|verwijdering/i],
    ['noemt het recht van bezwaar', /bezwaar/i],
    ['noemt een bewaartermijn', /bewaartermijn|bewaren wij|bewaard/i],
    ['noemt het klachtrecht bij de Autoriteit Persoonsgegevens', /Autoriteit Persoonsgegevens/i]
  ] },
  { pad: '/apps/juridisch/voorwaarden.html', naam: 'de algemene voorwaarden', eisen: [
    ['regelt aansprakelijkheid', /aansprakelijk/i],
    ['regelt herroeping of opzegging', /herroeping|opzegg|beeindig|beëindig/i]
  ] },
  { pad: '/apps/juridisch/partnervoorwaarden.html', naam: 'de partnervoorwaarden', eisen: [
    ['regelt aansprakelijkheid', /aansprakelijk/i],
    ['regelt opzegging', /opzegg|beeindig|beëindig/i],
    ['noemt de commissie', /commissie|vergoeding/i]
  ] }
];

/* Merken die dit huis nooit als bevestigde partner opvoert. De regel staat in
   CLAUDE.md; dit is de plek waar hij het duurst is, want op een juridische
   pagina leest een lezer een merknaam als een toezegging. */
const MERKEN = /\b(Hilton|Marriott|Four Seasons|Ritz[- ]Carlton|Aman|Rosewood|Mandarin Oriental|Emirates|KLM|Lufthansa|Air France|British Airways|Qatar Airways|Singapore Airlines|NetJets|VistaJet)\b/i;

test('de vier juridische pagina\'s dragen wat er wettelijk in moet',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    /* DE SERVICE WORKER ERUIT. Zonder dit blokje meet deze toets iets anders
       dan hij denkt: de RTF-schil registreert een service worker die tientallen
       schermen vooruit ophaalt, en die staan daarna in het schermjournaal alsof
       DEZE toets ze heeft afgelegd. Bij rtfkinderschermen liep dat op tot 55
       schermen -- boven de veeggrens van scripts/schermen.js, waardoor de toets
       als veegtoets telde en zijn eigen acht schermen niet meer meetelden.
       test/leven.e2e.js blokkeerde ze al; hier stond het nog niet. */
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    const stuk = [];
    for (const p of PAGINAS) {
      await page.goto(base + p.pad, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => localStorage.setItem('rtg_cookieinfo_v1', '1'));
      await page.goto(base + p.pad, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
      const tekst = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));

      /* Een juridische pagina van drie regels is geen juridische pagina. De
         index mag korter; de verklaringen zelf niet. */
      const minimum = p.pad === '/apps/juridisch.html' ? 150 : 1200;
      if (tekst.length < minimum) {
        stuk.push(p.naam + ': te kort om iets te regelen (' + tekst.length + ' tekens, minstens ' + minimum + ')');
        continue;
      }
      for (const [wat, patroon] of p.eisen) {
        if (!patroon.test(tekst)) stuk.push(p.naam + ': ' + wat + ' -- niet gevonden');
      }
      const merk = tekst.match(MERKEN);
      if (merk) stuk.push(p.naam + ': voert "' + merk[0] + '" op, en dit huis noemt geen echte merken als partner');
    }
    assert.deepEqual(stuk, [], 'de juridische pagina\'s zijn compleet:\n  ' + stuk.join('\n  '));
    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
