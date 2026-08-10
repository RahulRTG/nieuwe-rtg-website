/* Go-live-keuring: controleert in een keer of deze omgeving echt live kan.
   Draai op de productiemachine (met de echte omgevingsvariabelen geladen):

     npm run golive

   Staat er een .env.productie in de projectmap (gemaakt met
   npm run sleutels -- --schrijf), dan leest de keuring die vanzelf mee;
   echte omgevingsvariabelen winnen altijd van het bestand. De keuring
   beoordeelt de configuratie ALSOF het productie is (ook als NODE_ENV nog
   niet op production staat), probeert PostgreSQL echt te bereiken, en drukt
   een lijst af met kruisjes en vinkjes. Exitcode 1 zolang er blokkerende
   punten zijn; 0 = klaar om live te gaan.

   DE CONTROLES ZELF STAAN HIER NIET MEER. Ze wonen in server/golive.js, want
   de eigenaar leest dit oordeel ook in de boardroom -- op dezelfde plek waar
   hij het papierwerk invult dat drie van de acht blokkerende punten uitmaakt.
   Dit bestand is nog wat het altijd had moeten zijn: de afdruk en de
   exitcode. */
const { keuring } = require('../server/golive');

(async () => {
  const r = await keuring({ database: true });

  console.log('\n=== RTG go-live-keuring ===\n');
  for (const p of r.punten) console.log(' ' + p.teken + ' ' + p.tekst);

  console.log('\nBuiten de code, op de server zelf (zie PRODUCTION.md):');
  for (const regel of r.buitenDeCode) console.log(' - ' + regel);

  console.log('');
  if (r.blokkers) {
    console.log('NIET klaar om live te gaan: ' + r.blokkers + ' blokkerend(e) punt(en). (npm run sleutels -- --schrijf maakt de geheimen.)');
    process.exit(1);
  }
  console.log('Klaar om live te gaan. Start met NODE_ENV=production (of npm run vloot voor losse processen).');
})();
