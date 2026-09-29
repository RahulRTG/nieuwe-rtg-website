/* Mobility OS (deelmodule): de punten van een rit na de rit (NAVIGATIE.md N16).

   HET BESLUIT (29 september 2026, eigenaar; beantwoordt B10). De ritlijn -- de
   `trip.location_updated`-gebeurtenissen met hun lat/lng en `o.positie` -- wordt
   gewist zodra de rit voorbij is. Wat blijft is wat op de factuur staat:
   afstand (`km`), duur (`minuten` plus de tijdstempels van de standen) en de
   begin- en eindplek als TEKST (`label`, en bij een zaak de zaakcode). Het
   ophaalpunt is tijdens de rit exact -- de chauffeur moet je kunnen vinden --
   en wordt bij afronden het label van de factuur, zonder coordinaat.

   WAAROM HIER EN NIET BIJ ELKE LEZER. Er is precies een weg naar een andere
   status (./voortgang.js, opdrachtNaar), en daar wordt dit aangeroepen. Een
   wis-regel per scherm of per export laat de punten bestaan zodra de volgende
   lezer erbij komt; een wis op de overgang laat ze niet bestaan.

   WAT HIER NIET VERANDERT (N11). Tijdens de rit blijft alles wat goede
   navigatie vraagt: de live positie, de lijn, het exacte ophaalpunt. Alleen
   wat er NA de taak van de mens overblijft wordt kleiner.

   WAT HIER BEWUST BLIJFT. De tijdstempels van de standen (`ingestaptAt`,
   `voltooidAt`) zijn de duur op de factuur en geen bewegingsspoor: ze zeggen
   wanneer, niet waar. `gewist` legt vast DAT er gewist is en hoeveel punten,
   zodat een lege lijn niet leest als "er is nooit gevolgd". */
'use strict';

/* Standen waarin de rit voor de reiziger voorbij is. `voltooid` en `no-show`
   staan hier naast de twee eindstanden van ./keten.js (EIND), want na die twee
   rijdt er niemand meer met deze reiziger -- ook al moet er nog afgerekend
   worden. Een rit die via `incident` terug de keten in gaat, is niet voorbij
   en krijgt weer posities; bij de volgende afronding wordt opnieuw gewist. */
const VOORBIJ = new Set(['voltooid', 'no-show', 'afgerekend', 'geannuleerd']);

const PUNT = 'trip.location_updated';

// een plek zonder coordinaat: label, bron en de verwijzing naar zaak of halte
// blijven, want daarmee is de plek op de factuur leesbaar zonder een punt
function zonderPunt(p) {
  if (!p || typeof p !== 'object') return p;
  const r = Object.assign({}, p);
  delete r.lat; delete r.lng;
  return r;
}

/* Wis de punten van een opdracht. Muteert `o` en geeft het aantal gewiste
   locatiegebeurtenissen terug. Idempotent: een tweede keer wist niets meer. */
function wisRitpunten(o, tijd) {
  if (!o) return 0;
  const voor = (o.gebeurtenissen || []).length;
  o.gebeurtenissen = (o.gebeurtenissen || [])
    .filter(g => g && g.soort !== PUNT)
    .map(g => (g && ('lat' in g || 'lng' in g)) ? zonderPunt(g) : g);
  const aantal = voor - o.gebeurtenissen.length;
  delete o.positie;
  o.van = zonderPunt(o.van);
  o.naar = zonderPunt(o.naar);
  if (Array.isArray(o.stops)) o.stops = o.stops.map(zonderPunt);
  o.ritpunten = { gewist: tijd || new Date().toISOString(),
    locatiepunten: ((o.ritpunten && o.ritpunten.locatiepunten) || 0) + aantal };
  return aantal;
}

module.exports = { VOORBIJ, wisRitpunten, zonderPunt };
