'use strict';
/* EEN BROWSER DIE ER ECHT IS.

   `require('playwright')` lukt bijna altijd -- het pakket staat er -- maar dat
   zegt niets over de BROWSER erachter. Op deze machine wijst de standaard
   Playwright naar chromium-1234 en staat er 1194 geinstalleerd. Het pakket
   laadt, de launch gooit, en wie daar een terugval achter heeft gezet ziet die
   nooit draaien: de eerste poging slaagde immers.

   DAT IS HIER TWEE KEER MISGEGAAN, EN DE TWEEDE KEER ERGER DAN DE EERSTE.

     - Tweeendertig e2e-bestanden hadden elk hun eigen laadPlaywright() met een
       dode terugval. Drieendertig van de vierendertig "fouten" in een ronde
       waren de installatiebanner van Playwright.
     - En scripts/a11y.js had dezelfde lader. Die scan MELDT ZICHZELF NETJES AF
       als er geen browser is (exitcode 0, "scan overgeslagen"), en dat is
       bedoeld voor een kale CI. Maar met een lader die op de verkeerde
       Playwright uitkomt, meldt hij zich af terwijl er wel degelijk een browser
       stond -- en dan staat er in TOEGANKELIJK.md "0 van 259" bij een ronde die
       niet gedraaid heeft. Een nul die niemand gemeten heeft is erger dan geen
       getal.

   Vandaar deze module: een plek die weet welke browser er werkelijk is, en die
   pas 'niets' teruggeeft als hij ook echt niets kan vinden. test/helper.js en
   scripts/a11y.js gebruiken hem allebei (LAT.md regel 4).

   De volgorde is: eerst een Playwright met een bestaande chromium, dan de eigen
   CDP-driver (server/lib/browser.js -- die is met zoveel woorden voor a11y.js
   gebouwd), dan niets. */
const fs = require('fs');

const PADEN = [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules'];

function laadScherm() {
  for (const p of PADEN) {
    try {
      const mod = require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright');
      /* DIT IS DE HELE TRUC: niet of het pakket laadt, maar of de browser BESTAAT. */
      if (mod && mod.chromium && fs.existsSync(mod.chromium.executablePath())) return mod;
    } catch (e) { /* volgende pad */ }
  }
  try {
    const eigen = require('../../server/lib/browser');
    if (eigen.beschikbaar()) return eigen;
  } catch (e) { /* geen browser */ }
  return null;
}

/* Waar hij hem vond, zodat een ronde kan zeggen waarmee hij gemeten heeft in
   plaats van alleen dat hij gemeten heeft. */
function herkomst() {
  for (const p of PADEN) {
    try {
      const mod = require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright');
      if (mod && mod.chromium && fs.existsSync(mod.chromium.executablePath())) {
        return 'playwright (' + (p || 'standaard') + ') -> ' + mod.chromium.executablePath();
      }
    } catch (e) { /* volgende pad */ }
  }
  try {
    const eigen = require('../../server/lib/browser');
    if (eigen.beschikbaar()) return 'eigen CDP-driver (server/lib/browser.js)';
  } catch (e) {}
  return 'geen';
}

module.exports = { laadScherm, herkomst, PADEN };
