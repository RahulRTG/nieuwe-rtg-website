/* DE VASTE BRONINDEX voor test/navigatie-index.test.js.

   Dit is de gedocumenteerde vorm van Geofabriks `index-v1.json`: een GeoJSON
   FeatureCollection waarin elk gebied een `id`, een `name`, meestal een
   `parent` en een `urls.pbf` draagt. Hij is met de hand gemaakt, want de echte
   bron is uit deze omgeving niet te halen (de proxy weigert
   download.geofabrik.de met een 403). Wat hier staat bewijst dus het ONTLEDEN
   en niet dat de bron er zo uitziet; die graad is `vermoed`.

   Elke rij staat er om een bepaald geval te dekken; dat staat er per rij bij.
   Een fixture waarvan je niet meer weet waarom een rij erin zit, wordt bij de
   eerste verandering stilzwijgend aangepast tot de toets weer groen is. */
'use strict';

/* Een simpel vierkant, zodat het vak na te rekenen is. GeoJSON is [lng, lat]:
   deze ring loopt van lng 3..7 en lat 50..54. Wie de assen verwisselt, krijgt
   een vak dat de aarde verlaat -- en dat is precies wat toets 2 nakijkt. */
const vierkant = (lng0, lat0, lng1, lat1) => ({
  type: 'Polygon',
  coordinates: [[[lng0, lat0], [lng1, lat0], [lng1, lat1], [lng0, lat1], [lng0, lat0]]]
});

const FEATURES = [
  /* Het gewone geval: een land onder een werelddeel. */
  { type: 'Feature', geometry: vierkant(3.2, 50.7, 7.3, 53.7),
    properties: { id: 'europe/netherlands', name: 'Netherlands', parent: 'europe',
      urls: { pbf: 'https://download.geofabrik.de/europe/netherlands-latest.osm.pbf' } } },
  /* Een KIND, zodat de ouderketen te toetsen is: de code van de ouder moet
     dezelfde vertaling ondergaan als de code van het kind, anders wijst
     `ouder` naar niets en valt gebiedkeuze.js terug op oppervlak. */
  { type: 'Feature', geometry: vierkant(4.4, 52.1, 5.4, 53.2),
    properties: { id: 'europe/netherlands/noord-holland', name: 'Noord-Holland',
      parent: 'europe/netherlands',
      urls: { pbf: 'https://download.geofabrik.de/europe/netherlands/noord-holland-latest.osm.pbf' } } },
  /* Het werelddeel zelf: hij heeft geen ouder, en dat is geen fout. */
  { type: 'Feature', geometry: vierkant(-25, 34, 45, 71),
    properties: { id: 'europe', name: 'Europe',
      urls: { pbf: 'https://download.geofabrik.de/europe-latest.osm.pbf' } } },
  /* DE BOTSING. Twee verschillende gebieden die na het vertalen van de schuine
     streep dezelfde code krijgen (`asia-a-b`). Ze horen ALLEBEI te worden
     geweigerd, met de naam van de ander in de reden. */
  { type: 'Feature', geometry: vierkant(100, 1, 102, 3),
    properties: { id: 'asia/a-b', name: 'A-B', parent: 'asia', urls: { pbf: 'x' } } },
  { type: 'Feature', geometry: vierkant(103, 1, 105, 3),
    properties: { id: 'asia/a/b', name: 'A / B', parent: 'asia/a', urls: { pbf: 'y' } } },
  /* Een id die geen veilige bestandsnaam wordt (liggend streepje). Weigeren en
     TELLEN; stilletjes het teken weghalen zou een botsing maken. */
  { type: 'Feature', geometry: vierkant(10, 10, 11, 11),
    properties: { id: 'africa/foo_bar', name: 'Foo Bar', parent: 'africa', urls: { pbf: 'z' } } },
  /* Zonder naam. De bron hoort er een te hebben; zonder naam is er niets om op
     een scherm te zetten, dus dit gebied bestaat voor ons niet. */
  { type: 'Feature', geometry: vierkant(20, 20, 21, 21),
    properties: { id: 'africa/naamloos', urls: { pbf: 'q' } } },
  /* ZONDER GEOMETRIE. Mag bestaan en krijgt `vak: null` -- gebiedkeuze.js kent
     daar de grond `geen-vak` voor. Een 0-vak zou "past nergens" betekenen. */
  { type: 'Feature', geometry: null,
    properties: { id: 'south-america/zonder-vak', name: 'Zonder vak', parent: 'south-america',
      urls: { pbf: 'https://example.invalid/zonder-vak.osm.pbf' } } },
  /* ZONDER DOWNLOADADRES: aangeboden door de index, maar niet te bouwen. Het
     veld blijft `null` en wordt geen lege tekst. */
  { type: 'Feature', geometry: vierkant(30, 30, 31, 31),
    properties: { id: 'oceania/zonder-url', name: 'Zonder url', parent: 'oceania' } }
];

const INDEX = { type: 'FeatureCollection', features: FEATURES };

module.exports = { INDEX, FEATURES, tekst: () => JSON.stringify(INDEX), vierkant };
