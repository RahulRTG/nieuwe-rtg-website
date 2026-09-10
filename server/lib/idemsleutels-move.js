/* RTG Move: drie POST-routes die alle drie LEZEN. Ze wegen een reis, ze
   veranderen er niets aan -- een voorstel komt terug met `uitgevoerd: false` en
   het adres van de app waar het echte werk hoort (zie de kop van
   server/routes/move.js).

   Daarom `leest: true` en niet `zelfdeVerzoek`. Dat is geen kleinigheid: met
   `zelfdeVerzoek` zou de poort een tweede weging binnen vijf seconden het OUDE
   antwoord geven, en juist bij deze routes is dat verkeerd. `gevolg` wordt
   aangeroepen terwijl er iets aan het verschuiven is; wie tien seconden later
   nog eens vraagt of hij zijn diner haalt, hoort het antwoord van NU te krijgen
   en niet dat van de vorige vertraging.

   Waarom het een POST is en geen GET: `gevolg` draagt een lichaam (welk
   onderdeel schuift, en met hoeveel minuten), en de drie horen bij elkaar in
   een vorm. Een lezende POST is precies waar deze verklaringsvorm voor bestaat.

   De reden dat dit bestand er is: de keuring vond drie schrijfroutes zonder
   verklaring, omdat de routes vóór hun verklaring zijn geschreven. De kop van
   idemsleutels.js zegt de volgorde met zoveel woorden -- eerst de verklaring,
   dan de route. */
'use strict';
const SLEUTELS = {
  'POST /api/move/reis': { leest: true },
  'POST /api/move/gevolg': { leest: true },
  'POST /api/move/volgende': { leest: true }
};
module.exports = { SLEUTELS };
