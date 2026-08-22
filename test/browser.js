/* DE BROWSER VOOR DE SCHERMTOETSEN -- doorgeefluik naar ./helper.js.

   Dit bestand koos ooit zelf een Playwright. Dat was een van de DRIE "ene
   plekken" die uit drie takken tegelijk kwamen (deze, test/helper.js en
   scripts/lib/scherm.js). Sinds de samenvoeging van 20 augustus 2026 is er er
   echt maar een, en dat is test/helper.js -- de plek waar check-regel 57 een
   poort omheen heeft gezet. Drie opruimingen van dezelfde dubbeling leverden
   samen een nieuwe dubbeling op; dit bestand is de kant die wijkt.

   De naam blijft, want een aantal toetsen roept hem zo aan, en het contract
   blijft hetzelfde: laadBrowser() geeft null als er geen browser is, en anders
   iets met .chromium.launch(opties). */
'use strict';

const { laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const laadBrowser = (opties) => laadPlaywright(opties);

module.exports = { laadBrowser, laadPlaywright, browserOpties, geenBrowser };
