/* RTG Link: DE DEURREM -- het huisbrede budget aan MISSERS per minuut.

   Deze rem stond in server/kern/sociaal/pin-deur.js, en dat was de goede
   redenering op de verkeerde plek. De redenering (die daar staat, en die blijft
   gelden): wie de pin van NIEMAND IN HET BIJZONDER zoekt, raadt niet een pin
   maar vist naar wie er ergens achter zit. Een teller per vrager kost hem dan
   niets -- een tweede account kost een e-mailadres. Dus hangt de teller aan de
   DEUR en niet aan de aanvrager (LAT.md regel 7).

   Waarom hij is verhuisd: zodra er een tweede ingang komt die een code oplost,
   is een rem die bij de contactpin woont geen huisbrede rem meer maar de rem van
   een van de twee deuren. LINK.md par. 3.7 zegt het andersom: de rem hoort bij
   de LAAG, en elke nieuwe ingang gebruikt deze. Wie er een eigen teller naast
   zet, heeft de rem uitgezet zonder het op te schrijven.

   EEN SINGLETON, EN DAT IS DE HELE FUNCTIE. Geen fabriek, geen instantie per
   laag: het budget is van het huis, dus is er precies een teller. De
   require-cache van Node maakt daar een van; wie hier een `module.exports = () =>`
   van maakt, geeft elke aanroeper zijn eigen budget terug en dan telt niemand
   meer iets.

   ALLEEN MISSERS TELLEN. Een lid dat een pin overtypt of een QR scant, mist
   vrijwel nooit: hij kreeg de code net. Een raadster mist per definitie bijna
   altijd. Daarom staat het budget laag genoeg om te bijten en hoog genoeg dat
   normaal gebruik er nooit aan komt -- getoetst in test/contactpin.test.js, met
   tweehonderd treffers die er niet aan raken.

   DE PRIJS, EERLIJK: een huisbrede teller is een huisbrede knop. Wie bereid is
   MIS_PER_MINUUT missers per minuut te produceren, zet het oplossen van codes
   voor iedereen een minuut lang dicht. Dat is een bewuste ruil -- zoeken op
   codenaam werkt door, bestaande vrienden merken niets -- en het alternatief is
   een deur die alleen per bezoeker telt en dus bij genoeg bezoekers niet telt.

   Hij woont in het GEHEUGEN en telt per proces: dezelfde bekende beperking als
   elke rem in dit huis (zie server/pinslot.js), en hij hoort bij de stap naar
   gedeelde opslag. */
'use strict';

const VENSTER = 60 * 1000;
const MIS_PER_MINUUT = 120;

const budget = { vanaf: 0, n: 0 };

function misserGeteld() {
  const nu = Date.now();
  if (nu - budget.vanaf > VENSTER) { budget.vanaf = nu; budget.n = 0; }
  budget.n++;
}

const deurDicht = () => (Date.now() - budget.vanaf <= VENSTER) && budget.n >= MIS_PER_MINUUT;

// alleen voor de toetsen: het budget terugzetten zonder een minuut te wachten
function remReset() { budget.vanaf = 0; budget.n = 0; }

module.exports = { misserGeteld, deurDicht, remReset, MIS_PER_MINUUT, VENSTER };
