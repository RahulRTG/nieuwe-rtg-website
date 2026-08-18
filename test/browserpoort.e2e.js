/* ============================================================================
   DE BROWSERPOORT -- de enige schermtoets die ZICHZELF niet mag overslaan.

   Elke andere e2e in deze map begint met dezelfde regel:

       { skip: geenBrowser(pw) }

   Dat is met opzet: wie de suite draait zonder Playwright hoort niet op een
   muur van rode toetsen te stuiten voor iets wat niet zijn schuld is. Maar het
   is ook precies de vorm waar dit huis het bangst voor is. Draait er ergens een
   suite waar de browser stilletjes ontbreekt, dan slaan drieenveertig bestanden
   zichzelf over en meldt de uitvoer keurig "0 fail". Groen, en niets gezien.

   Deze toets is de tegenhanger. Hij kent maar een vraag:

       zegt deze omgeving dat ze schermtoetsen draait, en is er dan ook echt
       een browser?

   Zo ja: klaar. Zo nee: zakken, hard, met de reden erbij. Hij slaat zichzelf
   NOOIT over -- dat zou de grap zijn.

   HOE EEN OMGEVING DAT ZEGT: RTG_E2E_STRICT=1. Die staat in .github/workflows/
   ci.yml op de stap die `npm run e2e` draait, en mag lokaal aan zodra iemand
   zeker wil weten dat hij echt schermen toetst. Staat hij niet, dan meldt deze
   toets alleen wat hij ziet; hij dwingt niemand een browser te installeren.

   Waarom een eigen bestand en geen regel in check.js: de keuring leest bron,
   deze vraag gaat over de OMGEVING waarin de suite nu draait. Dat kun je niet
   uit een bestand lezen.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
/* Dezelfde zoektocht als in elke andere e2e -- letterlijk dezelfde functies,
   want deze toets moet vinden wat zij vinden en niet iets soepelers. Daarom uit
   test/helper.js en niet uit een kopie hier. */
const { laadPlaywright, browserOpties, geenBrowser } = require('./helper');

test('een omgeving die schermtoetsen belooft, heeft ook een browser', (t) => {
  const pw = laadPlaywright();
  const reden = geenBrowser(pw);
  const streng = process.env.RTG_E2E_STRICT === '1';

  if (!streng) {
    t.diagnostic('RTG_E2E_STRICT staat niet aan; browser ' + (reden ? 'NIET bruikbaar: ' + reden : 'gevonden en startbaar') +
      '. In CI staat de vlag wel aan, daar is dit een harde poort.');
    /* Geen stille exit: ook zonder de vlag legt deze toets een bewering vast,
       namelijk dat de zoektocht naar een browser uberhaupt een antwoord geeft.
       Een laadPlaywright() die zou crashen valt hier om. */
    assert.ok(pw === null || typeof pw === 'object', 'de browserzoektocht geeft een bruikbaar antwoord');
    return;
  }

  /* HET MODULE-GAT. Hier stond `assert.ok(pw)` gevolgd door
     `typeof pw.chromium.launch === 'function'`, met als tekst "de gevonden
     browser kan ook echt starten". Dat is precies wat het NIET aantoont: op
     18 augustus 2026 bestond die functie gewoon, en toch startte er geen enkele
     browser -- de omgeving had chromium 1194 en playwright vroeg om bouw 1234.
     Deze poort zou onder RTG_E2E_STRICT=1 groen zijn gebleven terwijl alle 122
     browsertoetsen omvielen. Een aanwezige functie is geen startende browser. */
  assert.equal(reden, false, 'RTG_E2E_STRICT=1 zegt dat deze omgeving schermtoetsen draait, maar: ' + reden + '\n' +
    '  Alle e2e-bestanden slaan zichzelf dan over of vallen om op een installatiebanner, en dan is\n' +
    '  er niets bewezen over of een scherm werkt.\n' +
    '  Installeer playwright + chromium, wijs er een aan met RTG_BROWSER_PATH, of zet RTG_E2E_STRICT\n' +
    '  uit als deze omgeving inderdaad geen schermen toetst.');
  assert.ok(browserOpties(pw), 'er zijn startopties voor deze browser');
});
