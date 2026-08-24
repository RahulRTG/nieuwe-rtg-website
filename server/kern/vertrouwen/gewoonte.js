/* ============================================================================
   DE WAARGENOMEN GEWOONTE: wat is voor DEZE actor een normaal bereik?

   blootstelling.js meet een handeling tegen het eigen normale bereik. Dit
   bestand is dat bereik. Het houdt per actor en per soort handeling een korte
   reeks van de LAATSTE omvangen bij en levert daar een p95 uit.

   DE AANVAL OP DE METER ZELF, en dit is de belangrijkste regel hier.

   Een grondslag die meetelt wat er is GEPROBEERD, is door de aanvaller zelf te
   verzetten: honderd keer een grote uitvoer aanvragen die netjes wordt
   tegengehouden, en de honderdeneerste is "normaal". Daarom telt hier
   uitsluitend wat DAADWERKELIJK IS UITGEVOERD. Een geweigerde of afgebroken
   handeling laat geen spoor in de gewoonte -- wel in het journaal, want daar
   hoort hij juist wel.

   Dat sluit niet alles: wie honderd keer een step-up bevestigt, verlegt zijn
   grens wel degelijk. Dat is met opzet zo -- iemand wiens werk verandert, moet
   niet eeuwig bevestigen -- maar het kost dan honderd bevestigde momenten met
   elk een regel in het journaal, en dat is precies het spoor dat een onderzoek
   nodig heeft. De grens staat hieronder in NIET_GEDEKT.

   DIT IS GEEN PROFIEL VAN EEN MENS. Er wordt uitsluitend een OMVANG bewaard --
   een getal, geen inhoud, geen tijdstip van de dag, geen oordeel. De sleutel is
   een actor-id en nooit een naam. En het venster is kort: wie ander werk gaat
   doen, wordt binnen honderd handelingen niet meer afgerekend op vorig jaar.
   Deze reeks mag nooit als prestatie of gedrag van een persoon worden getoond;
   dat is dezelfde grens als in LEVEN.md en LIFE.md, waar geen score op een mens
   komt te staan.
   ========================================================================== */
'use strict';

const { nu: klokNu } = require('../../lib/klok');

/* Kort genoeg om te vergeten, lang genoeg om een p95 te dragen. */
const VENSTER = 100;

const NIET_GEDEKT = [
  { wat: 'de traag opgevoerde grens', reden: 'Wie honderd keer een step-up bevestigt, verlegt zijn eigen normaal. Dat is bedoeld gedrag; het spoor ervan staat in het journaal en niet in deze meter.' },
  { wat: 'het tijdstip', reden: 'Deze reeks bewaart alleen de omvang. Of iets midden in de nacht gebeurde, is een signaal van een andere laag en wordt hier niet vastgelegd.' },
  { wat: 'gedeelde accounts', reden: 'Twee mensen achter een account leveren een gemiddelde gewoonte van twee mensen. Dat is een reden om accounts niet te delen, geen tekortkoming van de meter.' }
];

const sleutel = (actor, soort) => String(actor || '') + '|' + String(soort || '');

/* Het p95-punt van een reeks: de waarde waar 95% onder zit. Bewust de
   dichtstbijzijnde rang en geen interpolatie -- een grens die tussen twee echte
   waarnemingen in ligt, is niet aan te wijzen als "dit deed u eerder". */
function p95Van(waarden) {
  const v = waarden.slice().sort((a, b) => a - b);
  if (!v.length) return null;
  return v[Math.min(v.length - 1, Math.ceil(v.length * 0.95) - 1)];
}

/* Alleen aanroepen NADAT de handeling is uitgevoerd. Zie de kop. */
function noteer(bak, actor, soort, aantal) {
  if (!bak || typeof aantal !== 'number' || !Number.isFinite(aantal) || aantal < 0) return null;
  bak.gewoonte = bak.gewoonte || {};
  const k = sleutel(actor, soort);
  const rij = bak.gewoonte[k] || (bak.gewoonte[k] = { waarden: [], laatst: null });
  rij.waarden.push(aantal);
  if (rij.waarden.length > VENSTER) rij.waarden = rij.waarden.slice(-VENSTER);
  rij.laatst = klokNu();
  return rij.waarden.length;
}

/* Levert de vorm die blootstelling.js verwacht, of null. Nooit een verzonnen
   p95 bij een lege reeks: dan is er geen grondslag, en dat hoort de meter te
   weten in plaats van een nul te krijgen die als "u doet nooit iets" leest. */
function lees(bak, actor, soort) {
  const rij = bak && bak.gewoonte && bak.gewoonte[sleutel(actor, soort)];
  if (!rij || !rij.waarden || !rij.waarden.length) return null;
  return { p95: p95Van(rij.waarden), n: rij.waarden.length };
}

/* Voor de uitgang en het vergeetrecht: alles van een actor weg. Een gewoonte is
   een gegeven over een mens, dus hij hoort mee te verdwijnen als die mens
   verdwijnt -- anders overleeft het profiel de persoon. */
function vergeetActor(bak, actor) {
  if (!bak || !bak.gewoonte) return 0;
  const voor = String(actor || '') + '|';
  let weg = 0;
  for (const k of Object.keys(bak.gewoonte))
    if (k.startsWith(voor)) { delete bak.gewoonte[k]; weg += 1; }
  return weg;
}

module.exports = { noteer, lees, vergeetActor, p95Van, VENSTER, NIET_GEDEKT };
