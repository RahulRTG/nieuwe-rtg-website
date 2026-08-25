/* DE STAND VAN DE VOORDEUR -- en wat je eraan zou doen.

   Dit hoort hier en niet in server/techniek.js, om dezelfde reden als
   server/backupstand.js: twee plekken die over hetzelfde onderwerp oordelen,
   lopen vroeg of laat uiteen, en dan is er geen stand meer maar zijn er twee
   meningen. techniek.js (TRI-01) leest deze functie; wie de spreiding verbouwt,
   verbouwt het oordeel hier mee.

   WAT ER TE OORDELEN VALT. De poortwachter is een Node-proces en dat was
   gemeten het plafond: met spreiding aan nam elk van de drie servers verkeer aan
   en bewoog de doorvoer 1,4%, omdat de voordeur op 90% van EEN kern zat terwijl
   de servers op ongeveer de helft stonden. Met RTG_POORTWACHTERS=2 ging de
   doorvoer 29% omhoog en de p50 28% omlaag. De meting staat in
   docs/meerkernig.md en is na te draaien met `npm run spreiding`.

   Het is een INRICHTINGSkeuze en geen fout. Maar een machine met acht kernen en
   een voordeur die er een gebruikt, is een machine die staat te wachten -- en
   dat hoort iemand te zien zonder eerst een markdownbestand te vinden. */
'use strict';
const os = require('os');
const { autoAantal } = require('./trio-werkers');

function voordeurstand() {
  const kernen = os.cpus().length;
  /* Geen clustersleutel betekent: deze server draait niet achter de
     poortwachter. Dan doet een voordeur hier niets en oordelen we ook niet. */
  if (!process.env.RTG_CLUSTER_KEY) {
    return { status: 'ok', detail: 'Losse server, geen poortwachter ervoor. ' + kernen + ' kernen.' };
  }
  const rauw = String(process.env.RTG_POORTWACHTERS || '').trim().toLowerCase();
  const gevraagd = rauw === 'auto' ? autoAantal(kernen) : Number(rauw);
  const n = Number.isFinite(gevraagd) && gevraagd > 0 ? Math.floor(gevraagd) : 1;
  const spreiding = process.env.RTG_SPREIDING === '1' && !!process.env.REDIS_URL;
  const staart = ' (' + kernen + ' kernen, spreiding ' + (spreiding ? 'aan' : 'uit') + ').';

  if (n > 1) return { status: 'ok', detail: n + ' voordeurprocessen delen de poort' + staart };
  if (kernen <= 2) return { status: 'ok', detail: 'Een voordeurproces, en op ' + kernen + ' kernen valt er niets te verdelen.' };
  if (!spreiding) return { status: 'ok', detail: 'Een voordeurproces en geen spreiding: het verkeer gaat toch naar een server' + staart };
  return { status: 'waarschuwing', detail: 'Spreiding staat aan maar er is EEN voordeurproces' + staart +
    ' Gemeten levert spreiding dan ongeveer niets op (1,4%), want de poortwachter zelf loopt vol op een kern. ' +
    'Zet RTG_POORTWACHTERS=' + Math.max(2, autoAantal(kernen)) + ' -- gemeten +29% doorvoer en -28% p50. ' +
    'Zelf nameten: npm run spreiding.' };
}

module.exports = { voordeurstand };
