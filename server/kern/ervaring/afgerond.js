/* WANNEER IS IETS AFGEROND -- als pure tabel.

   Deze lijst stond in kern/ervaring/leden/waardering.js, waar hij bepaalt of je
   al een review mag plaatsen (dat kan pas na afronding). Het Mall-brede
   bestellingenoverzicht heeft dezelfde vraag nodig: loopt dit nog, of is het
   klaar? Twee lijstjes met statussen is precies hoe je de ene plek "afgerond"
   ziet zeggen terwijl de andere hem nog als lopend toont (LAT-regel 4).

   Wat hier NIET in staat: een vertaling van elke status naar een vriendelijk
   woord. De domeinen houden hun eigen statussen, en die worden in het overzicht
   ongewijzigd getoond. Een status die dit bestand niet kent, telt gewoon als
   "loopt nog" -- zichtbaar, met zijn eigen naam erbij, in plaats van
   weggemoffeld onder een label dat wij verzonnen. */

const AFGEROND = {
  order: ['geserveerd', 'bezorgd', 'opgehaald'],
  ride: ['afgerond', 'gearriveerd'],
  boeking: ['afgerond'],
  reservering: ['geweest'],
  verblijf: ['uitgecheckt'],
  reis: ['geboekt', 'afgerond']
};

// afgezegd is iets anders dan afgerond: het is wel klaar, maar er kwam niets van
const AFGEZEGD = ['geannuleerd', 'geweigerd', 'terugbetaald', 'ingetrokken', 'afgezegd', 'vervallen'];

function isAfgerond(soort, status) {
  return (AFGEROND[soort] || []).includes(String(status || ''));
}
function isAfgezegd(status) {
  return AFGEZEGD.includes(String(status || ''));
}
/* Drie bakjes, en meer niet: loopt / klaar / afgezegd. Alles wat we niet
   herkennen valt in "loopt" en houdt zijn eigen statusnaam. */
function stand(soort, status) {
  if (isAfgezegd(status)) return 'afgezegd';
  if (isAfgerond(soort, status)) return 'klaar';
  return 'loopt';
}

module.exports = { AFGEROND, AFGEZEGD, isAfgerond, isAfgezegd, stand };
