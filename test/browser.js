/* DE BROWSER VOOR DE SCHERMTOETSEN -- één keuze, op één plek.

   WAT HIER MIS WAS, EN HOE HET ZICH VERBORG. Deze functie stond letterlijk
   gekopieerd in 94 bestanden, en zij koos de EERSTE kandidaat die te requiren
   viel:

       try { return require('playwright'); } catch (e) { ... }

   Dat gaat mis zodra het PAKKET er wel is maar de bijbehorende Chromium niet --
   dan lukt de require en zakt pas de launch, met "Executable doesn't exist".
   Geen enkele toets keek daarnaar: `pw` was waarheidsgetrouw, dus geen enkele
   toets sloeg over, en allemaal vielen ze om met een fout die niets over de
   code zegt. De eigen driver van dit huis (server/lib/browser.js) stond er als
   terugval al bij en werd nooit bereikt.

   DE REGEL IS NU: probeer te STARTEN, niet te laden. `chromium.launch()`
   hieronder loopt de kandidaten af tot er een echt opent. Alleen als er geen
   enkele opengaat, is er werkelijk geen browser -- en dan slaat de toets over,
   zoals hij altijd al bedoeld was.

   HET CONTRACT BLIJFT HETZELFDE, want dat scheelt 94 bestanden herschrijven:
   laadBrowser() geeft null als er niets is, en anders iets met `.chromium
   .launch(opties)`. Elke bestaande aanroep (`const pw = laadBrowser()`, later
   `pw.chromium.launch({ args: [...] })`) werkt ongewijzigd door. */
'use strict';

/* Alle plekken waar een Playwright kan staan, plus de eigen driver als laatste.
   De volgorde is de voorkeur; de werkelijkheid beslist bij het starten. */
function kandidaten(opties) {
  const uit = [];
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { uit.push(require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright')); } catch (e) { /* volgende */ }
  }
  /* De eigen driver kan worden overgeslagen, en dat is geen smaak maar een
     eis: hij kent geen aparte contexten met eigen permissies, dus een toets die
     `newContext({ permissions: [...] })` nodig heeft (test/meet.e2e.js) hoort
     liever over te slaan dan te draaien op iets dat die vraag niet kent. */
  if (!opties || opties.eigenDriver !== false) {
    try {
      const eigen = require('../server/lib/browser');
      if (eigen.beschikbaar()) uit.push(eigen);
    } catch (e) { /* geen eigen driver */ }
  }
  return uit;
}

function laadBrowser(opties) {
  const lijst = kandidaten(opties);
  if (!lijst.length) return null;
  return {
    chromium: {
      async launch(opties) {
        let laatste = null;
        for (const k of lijst) {
          try { return await k.chromium.launch(opties); } catch (e) { laatste = e; }
        }
        /* Alle kandidaten geprobeerd en geen enkele opende. Dat is een echte
           fout en geen "geen browser": de toets hoort hem te zien, niet stil
           over te slaan (LAT-regel 5). */
        throw laatste || new Error('geen bruikbare browser gevonden');
      }
    }
  };
}

module.exports = { laadBrowser, kandidaten };
