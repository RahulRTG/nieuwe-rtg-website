/* DE NAAMGRENS -- wat het kost dat een mens op naam wordt gevonden.

   De soort `lid` in ./soorten.js is de enige in dit huis die met een eigen
   `verwijst` op NAAM wordt gevonden en niet op sleutel. Dat moest wel: geen
   module van het Werk OS legt een lid-id vast bij "eigenaar", "wie" of "door"
   -- dat zijn vrije tekstvelden met een naam erin. Zonder die uitzondering
   vindt het dossier van een medewerker niets.

   DE PRIJS STAAT HIER, EN HIJ WORDT GEMETEN. Een naam is geen sleutel, en dat
   levert twee gevaren op die allebei stil zijn:

     - TWEE MEDEWERKERS MET DEZELFDE NAAM. Dan haalt het dossier van de een het
       werk van de ander binnen, en niets aan de uitslag verraadt dat.
     - EEN NAAM DIE OOK EEN GEWONE VELDWAARDE IS ("Open", "Actief", "Hoog").
       Dan matcht hij op statusvelden door de hele werkruimte heen.

   Dit bestand woont naast het register en niet bij de routes, omdat de oorzaak
   hier ligt: wie de `verwijst`-override zet, hoort de waarschuwing mee te
   leveren. Een verband dat op een naam rust en zich voordoet als een sleutel,
   is precies het soort stille onwaarheid waar dit huis het vaakst op is
   gevallen (LAT-regel 5). */
'use strict';

/* Waarden die in dit huis zo vaak als status, fase of prioriteit voorkomen dat
   een medewerker met die naam de halve werkruimte binnenhaalt. De lijst hoeft
   niet volledig te zijn -- hij hoeft alleen de gevallen te vangen die echt
   voorkomen, en wat hij mist blijft zichtbaar via het aantal treffers. */
const GEWONE_WAARDEN = new Set(['open', 'actief', 'concept', 'bezig', 'klaar', 'normaal',
  'hoog', 'laag', 'lead', 'demo', 'offerte', 'gewonnen', 'verloren', 'gesloten', 'wacht',
  'extern', 'intern', 'nl', 'loopt', 'vervallen', 'nieuw']);

function naamgrens(leden, naam) {
  const n = String(naam || '');
  const klein = n.toLowerCase();
  const gelijk = Object.values(leden || {})
    .filter(l => l && String(l.naam || '').toLowerCase() === klein);
  const gewoon = GEWONE_WAARDEN.has(klein);
  return {
    opNaam: true, naam: n,
    naamgenoten: Math.max(0, gelijk.length - 1),
    naamIsGewoneWaarde: gewoon,
    let: 'Een mens wordt hier op NAAM gevonden en niet op een sleutel: geen module legt een lid-id vast bij "eigenaar", "wie" of "door".'
      + (gelijk.length > 1 ? ' LET OP: er werken ' + gelijk.length + ' mensen met deze naam in deze werkruimte, dus de samenhang hieronder kan werk van een ander bevatten.' : '')
      + (gewoon ? ' LET OP: deze naam is ook een gewone veldwaarde, dus er kunnen rijen bij zitten die niets met deze persoon te maken hebben.' : '')
  };
}

module.exports = { naamgrens, GEWONE_WAARDEN };
