/* DE GEOGRAFIE VAN HET STADSNET -- middelpunt, grenzen, rasterinstellingen en
   de eigen POI-lagen (tank, laad, loket).

   Apart van ../navigatie.js omdat het GEGEVENS zijn en geen motor: kern/plaats
   en het stadsweefsel lezen dezelfde waarden, en de router werd te groot om in
   een keer na te kijken. Ze gaan nog steeds via ../navigatie.js naar buiten,
   zodat geen enkele aanroeper verandert.

   EEN TWEEDE MIDDELPUNT ZOU BETEKENEN DAT DE STAD EN HAAR WEGEN NAAST ELKAAR
   BESTAAN ZONDER ELKAAR TE RAKEN: de geografie van de stad hangt op hetzelfde
   middelpunt en dezelfde grenzen als het wegennet, en de laadpunten in het
   objectregister zijn dezelfde laadpunten als die de navigatie aanwijst. */
'use strict';

const REF = { lat: 38.91, lng: 1.43 };                          // Ibiza-stad, het midden
const BOUNDS = { lat0: 38.855, lat1: 38.995, lng0: 1.28, lng1: 1.56 };
const GRID = 22;                                                 // rasterknopen per as
const ARTERIE = 3;                                               // elke 3e lijn is hoofdweg
const V_HOOFD = 22, V_STAD = 11;                                 // m/s (~80 / ~40 km/h)
const MODI = { auto: 13.9, ev: 13.9, fiets: 4.4, lopen: 1.4 };  // terugval-ETA per m/s
const LANGS_M = 450;                                             // "langs de route" straal
// de eigen POI-lagen: tankstations, laadpalen en civiele loketten rond Ibiza
const POI = {
  tank: [
    { naam: 'Repostar Vila', lat: 38.909, lng: 1.421 },
    { naam: 'Estacio Platja', lat: 38.884, lng: 1.406 },
    { naam: 'Benzina Nord', lat: 38.972, lng: 1.318 }
  ],
  laad: [
    { naam: 'RTG Laadplein Marina', lat: 38.918, lng: 1.449, kw: 150 },
    { naam: 'Laadpunt Aeroport', lat: 38.874, lng: 1.377, kw: 50 },
    { naam: 'Snellaad Sant Antoni', lat: 38.980, lng: 1.304, kw: 300 },
    { naam: 'Laadpunt Dalt Vila', lat: 38.906, lng: 1.436, kw: 22 }
  ],
  civic: [
    { naam: 'Gemeenteloket Ibiza', lat: 38.909, lng: 1.434, soort: 'gemeente' },
    { naam: 'Overheidsloket (Rijk)', lat: 38.911, lng: 1.428, soort: 'overheid' },
    { naam: 'Gemeenteloket Sant Antoni', lat: 38.981, lng: 1.301, soort: 'gemeente' }
  ]
};

module.exports = { REF, BOUNDS, GRID, ARTERIE, V_HOOFD, V_STAD, MODI, LANGS_M, POI };
