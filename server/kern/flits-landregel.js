/* DE LANDREGEL VAN RTG FLITS: REKENT DE SERVER, UIT DE PLEK.

   Besluit van 19 oktober 2026 (stap A van optie C). Het land kwam van de
   client en flits.html stuurde hard 'ES', dus de regel greep nooit in. Nu telt
   alleen de plek van de melding of van wie kijkt; een land dat de client
   meestuurt verandert de uitkomst nooit (test/flits.test.js 5 en 11).

   RTG heeft (nog) geen landsgrenzen. Dit zijn OMHULLENDE VAKKEN, bron: eigen
   benadering. Een vak is geen grens: wie in een vak staat, krijgt fail-closed
   een weigering die dat zegt, ook in een grensstreek (Oost-Nederland ligt in
   het vak van Duitsland). Stap B vervangt dit door echte veelhoeken langs de
   importweg van de navigatie, met grenspunttoetsen. Welke landen een verbod
   hebben, staat in de bronnen van docs/domeinkaarten/travelos.md (8.4); een
   jurist per land hoort die lijst te bevestigen. */
'use strict';

// bron: eigen benadering -- [lat0, lat1, lng0, lng1]
const VAKKEN = {
  DE: [47.27, 55.06, 5.87, 15.04], FR: [41.33, 51.12, -5.14, 9.56], CH: [45.82, 47.81, 5.96, 10.49],
  TR: [35.81, 42.11, 25.66, 44.82], MK: [40.85, 42.37, 20.45, 23.04]
};

/* Het land met een verbod waarvan het vak deze plek bevat, of null. */
function verbodenVak(p) {
  const lat = Number(p && p.lat), lng = Number(p && p.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return Object.keys(VAKKEN).find(k => { const [a, b, c, d] = VAKKEN[k]; return lat >= a && lat <= b && lng >= c && lng <= d; }) || null;
}

const LANDREGEL = 'Op deze plek kan RTG niet uitsluiten dat u in een land bent waar flitsermeldingen wettelijk niet zijn toegestaan ' +
  '(RTG rekent met een benadering van de landsgrenzen, geen exacte grens); file- en gevaarmeldingen werken gewoon.';

module.exports = { VAKKEN, verbodenVak, LANDREGEL };
