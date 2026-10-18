/* DE DEKKINGSVANG, KANT VAN DE TOETSSERVER (preload, alleen in dekkingsmodus).

   test/helper.js laadt dit bestand met `--require` in een toetsserver, en
   uitsluitend als NODE_V8_COVERAGE gezet is (test/lib/dekkingsvang.js). Het
   staat dus nooit in server/ en draait nooit in productie: er is daar geen
   regel code die het laadt.

   Op SIGUSR2 schrijft de server zijn V8-dekking tot nu toe weg
   (v8.takeCoverage, synchroon) en legt daarna het bevestigingsbestand neer
   waar stop() op wacht. Daarna volgt gewoon de SIGKILL van stop(); een proces
   dat met SIGKILL stopt schrijft zelf nooit iets weg, en dat is precies waarom
   deze vang bestaat.

   De variabele gaat meteen uit de omgeving, zodat een kindproces van de server
   (fork erft --require) geen tweede luisteraar op hetzelfde pad zet. */
'use strict';
const fs = require('node:fs');

const pad = process.env.RTG_DEKKINGSVANG;
delete process.env.RTG_DEKKINGSVANG;
if (pad && process.env.NODE_V8_COVERAGE) {
  process.on('SIGUSR2', () => {
    let uit = 'ok';
    try { require('node:v8').takeCoverage(); } catch (e) { uit = 'fout: ' + e.message; }
    try { fs.writeFileSync(pad, uit); } catch (e) { /* stop() valt terug op zijn grens */ }
  });
}
