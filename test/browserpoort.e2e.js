/* ============================================================================
   DE BROWSERPOORT -- de enige schermtoets die ZICHZELF niet mag overslaan.

   Elke andere e2e in deze map begint met dezelfde regel:

       { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }

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

/* Dezelfde zoektocht als in elke andere e2e -- bewust letterlijk hetzelfde, want
   deze toets moet vinden wat zij vinden, niet iets soepelers. */
function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}

test('een omgeving die schermtoetsen belooft, heeft ook een browser', (t) => {
  const pw = laadBrowser();
  const streng = process.env.RTG_E2E_STRICT === '1';

  if (!streng) {
    t.diagnostic('RTG_E2E_STRICT staat niet aan; browser ' + (pw ? 'gevonden' : 'NIET gevonden') +
      '. In CI staat de vlag wel aan, daar is dit een harde poort.');
    /* Geen stille exit: ook zonder de vlag legt deze toets een bewering vast,
       namelijk dat de zoektocht naar een browser uberhaupt een antwoord geeft.
       Een laadBrowser() die zou crashen valt hier om. */
    assert.ok(pw === null || typeof pw === 'object', 'de browserzoektocht geeft een bruikbaar antwoord');
    return;
  }

  assert.ok(pw, 'RTG_E2E_STRICT=1 zegt dat deze omgeving schermtoetsen draait, maar er is geen browser gevonden.\n' +
    '  Alle e2e-bestanden slaan zichzelf dan over en de suite meldt 0 fail -- groen zonder iets gezien te hebben.\n' +
    '  Installeer playwright + chromium, of zet RTG_E2E_STRICT uit als deze omgeving inderdaad geen schermen toetst.');
  assert.equal(typeof pw.chromium.launch, 'function', 'de gevonden browser kan ook echt starten');
});
