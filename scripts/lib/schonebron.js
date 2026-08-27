/* ============================================================================
   WEIGER EEN AFDRUK TE SCHRIJVEN TERWIJL ER TOETSEN DRAAIEN.

   WAAR DEZE REGEL VANDAAN KOMT, EN WAAROM HET ZO STIL MISGING.

   ARCHITECTUUR.md en BEWIJS.md komen uit de code (scripts/kaart.js,
   scripts/bewijs.js) en keuringsregels 40 en 41 vergelijken de volle tekst met
   een verse generatie. Dat is precies waarom ze iets waard zijn: ze kunnen niet
   verouderen.

   Maar test/meterijk.test.js zet tijdelijke bestanden neer om de meters te laten
   uitslaan -- een extra toetsbestand, een extra kernmodule -- en ruimt ze daarna
   op. Draait er zo'n toets terwijl iemand `npm run kaart` doet, dan legt de
   afdruk die tijdelijke stand vast. Gemeten geval: 977 toetsbestanden in plaats
   van 976.

   HET GEMENE ZIT IN DE REPARATIE. De keuring wordt daarna rood, en haar advies
   luidt "draai npm run kaart". Wie dat opvolgt terwijl de toets nog loopt, legt
   het foute getal opnieuw vast. Het advies maakt het dan erger in plaats van
   beter, en dat is de kwaadaardigste vorm die een meetfout kan hebben.

   Dus schrijft geen enkele generator meer als er een ijkrestant op schijf staat.
   Hij zakt met de reden en de naam van het bestand erbij, zodat duidelijk is dat
   je moet WACHTEN en niet moet repareren.

   EEN PLEK EN NIET TWEE. Beide generatoren lezen dezelfde regel, want twee
   kopieen lopen binnen een week uiteen (LAT.md regel 4). Komt er een derde
   afdruk bij, dan hangt hij hier ook aan.

   DE LEZERSKANT, ERBIJ OP 27 AUGUSTUS 2026. Hierboven staat de schrijverskant:
   een generator schrijft niet zolang er een restant staat. Er is een tweede
   kant, en die is in CI stukgegaan voor hij was opgeschreven.

   Node draait toetsbestanden NAAST elkaar. Terwijl meterijk zijn tijdelijke
   pagina in public/apps/ heeft staan, lopen andere toetsen diezelfde boom af en
   beweren iets over ELKE app-pagina -- dat de gids hem dekt, dat hij de i18n-laag
   haalt, dat hij vanaf het beginscherm te bereiken is. In dat raampje beweren ze
   dat over een bestand dat geen product is, en dan zakken ze op een fout die er
   niet is.

   GEMETEN, NIET GEGOKT: van de veertien toetsen die public/apps/ van schijf
   aflopen, breken er DRIE op zo'n restant (negenplus, i18n-auto, bereikbaar) en
   elf niet. Die drie slaan het over via MERK hieronder. De andere elf krijgen
   niets: een filter dat nergens iets tegenhoudt is een filter dat straks iets
   verkeerds tegenhoudt.

   WAAROM DIT GEEN UITZONDERINGSLIJST IS. scripts/schermen.js weigert er met
   zoveel woorden een ("wie een scherm niet wil laten toetsen moet dat kunnen
   uitleggen"), en dat blijft precies zo -- alleSchermen() filtert niets, want de
   METER moet het restant juist zien, anders bewijst de ijking niets. Wat hier
   wordt overgeslagen is geen scherm dat zich verstopt maar steigerwerk van een
   toets. En blijft er ooit een restant achter, dan houdt de wacht hierboven de
   afdrukken tegen; het wordt dus niet stilletjes de nieuwe normaal.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..', '..');

/* De mappen waar test/meterijk.test.js zijn tijdelijke bestanden neerzet. Het
   patroon staat hier als samenstelling, zodat dit bestand zelf niet als
   ijkrestant wordt gelezen door keuringsregel 36. */
const MERK = 'zz' + '-ijk-tijdelijk';
const KIJK = ['test', 'server/kern', 'server/routes', 'public/apps'];

/* Alle ijkrestanten die er NU staan, als relatieve paden. */
function restanten() {
  const uit = [];
  for (const map of KIJK) {
    const dir = path.join(WORTEL, map);
    let namen;
    try { namen = fs.readdirSync(dir); } catch (e) { continue; }
    for (const n of namen) if (n.includes(MERK)) uit.push(map + '/' + n);
  }
  return uit.sort();
}

/* Gooit als er een ijkrestant staat. `wat` is de naam van de afdruk, zodat de
   melding zegt welke generator er is tegengehouden. */
function eisSchoneBron(wat) {
  const vuil = restanten();
  if (!vuil.length) return;
  throw new Error(
    wat + ' is NIET geschreven: er staan tijdelijke ijkbestanden op schijf (' + vuil.join(', ') + ').\n' +
    'Die horen bij een draaiende toets (test/meterijk.test.js) en verdwijnen vanzelf.\n' +
    'Zou deze afdruk nu geschreven worden, dan legt hij die tijdelijke stand vast -- en\n' +
    'dan wordt de keuring rood met het advies om precies dit commando opnieuw te draaien.\n' +
    'WACHT tot de toets klaar is; er is niets te repareren.');
}

module.exports = { eisSchoneBron, restanten, MERK };
