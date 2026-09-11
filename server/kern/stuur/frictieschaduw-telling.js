/* DE TELLING VAN DE FRICTIESCHADUW -- hoe vaak zou de motor verzwaren.

   Deel van ./frictieschaduw.js; zie de kop daar voor waarom die schaduw bestaat
   en wat hij wel en niet kan zien. Dit bestand doet alleen het TELLEN.

   WAAROM DE NAAD HIER LIGT. Het wegen (wat zegt de motor van dit geval) en het
   tellen (hoe vaak zou dat verzwaren) zijn twee dingen: het eerste is een
   berekening zonder toestand, het tweede is toestand zonder berekening. De kop
   van ./frictieschaduw.js zei al dat het tellen eruit hoort zodra er een derde
   schaduw komt; de omvangregel van scripts/keuring.js gaf de directe aanleiding
   (9789 van 10240 bytes -- vlak onder de grens is een waarschuwing, geen
   boekhouding).

   TELLERS EN GEEN JOURNAAL, zoals kern/kosten/: voor deze vraag is niet nodig
   wie wat vroeg, alleen hoe vaak. En het pad wordt geschrobd voor het in een
   teller landt -- dezelfde vorm als ./schaduwtelling.js, want deze getallen
   kunnen een scherm bereiken. */
'use strict';

/* Wat op een identiteit lijkt. Bewust breed en bewust fail-closed: bij twijfel
   gaat het pad onder een schuilnaam de teller in in plaats van dat er een
   codenaam blijft staan. Weglaten zou het getal stil verlagen, en dat is erger. */
const LIJKT_OP_IEMAND = /@|\bcn-|\blid:|\buser-|\d{6,}/;

const TELLERS = new Map();
let SINDS = new Date().toISOString();
let EENHEIDLOOS_GEZIEN = 0;
let EIGEN_GRENZEN = false;

function noteer(wereld, pad, uitslag) {
  const w = String(wereld || 'onbekend');
  const p = String(pad || 'onbekend');
  const veilig = LIJKT_OP_IEMAND.test(p) ? '(pad met een kenmerk erin)' : p;
  const s = w + '|' + veilig;
  const t = TELLERS.get(s) || { wereld: w, pad: veilig, gewogen: 0, zouVerzwaren: 0, hoogsteScore: 0 };
  t.gewogen++;
  if (uitslag && uitslag.zouVerzwaren) t.zouVerzwaren++;
  if (uitslag && uitslag.score > t.hoogsteScore) t.hoogsteScore = uitslag.score;
  if (uitslag && uitslag.eenheidOnbekend && uitslag.eenheidOnbekend.length) EENHEIDLOOS_GEZIEN++;
  TELLERS.set(s, t);
}

function meldGrenzen(eigen) { EIGEN_GRENZEN = !!eigen; }

function stand() {
  const rijen = [...TELLERS.values()]
    .sort((a, b) => b.zouVerzwaren - a.zouVerzwaren || b.hoogsteScore - a.hoogsteScore);
  return {
    sinds: SINDS,
    bewaard: false,
    gewogen: rijen.reduce((n, r) => n + r.gewogen, 0),
    zouVerzwaren: rijen.reduce((n, r) => n + r.zouVerzwaren, 0),
    bodyMetEenheidloosBedrag: EENHEIDLOOS_GEZIEN,
    paden: rijen.slice(0, 25),
    grens: 'Deze telling staat in het geheugen van dit proces en begint bij elke herstart opnieuw. ' +
      'Lees haar als "sinds ' + SINDS + '" en nooit als een totaal over de levensduur.',
    nietGemeten:
      'of de motor GELIJK zou hebben. En belangrijker: een lage telling bewijst niet dat er weinig ' +
      'risico is. De grondslag staat op `lezen` (0 punten) omdat er geen afbeelding bestaat van een ' +
      'AI-route op de zestien Command-handelingen, en drie factoren die zwaar wegen -- onomkeerbaar, ' +
      'persoonsgegevens, klantImpact -- zijn eigenschappen van de HANDELING en staan niet in een ' +
      'HTTP-body. Wat deze telling wel vangt is bedrag EN aantal samen; bedrag alleen komt niet ' +
      'boven de autogrens. Een nul hier is een besluit waard en geen geruststelling.',
    grenzenUit: EIGEN_GRENZEN ? 'het meegegeven beleidsregister' :
      'de standaardwaarden in kern/frictie/motor.js; het stuur heeft het boardroom-register niet in ' +
      'zijn tas, dus een aangescherpte grens in de boardroom telt hier NIET mee en deze telling ' +
      'staat dan te laag'
  };
}

/* Alleen voor de toets: een module die zijn toestand vasthoudt, laat de volgende
   toets de vorige meten. Zelfde valkuil als in ./schaduwtelling.js. */
function vergeet() { TELLERS.clear(); SINDS = new Date().toISOString(); EENHEIDLOOS_GEZIEN = 0; EIGEN_GRENZEN = false; }

module.exports = { noteer, stand, vergeet, meldGrenzen, LIJKT_OP_IEMAND };
