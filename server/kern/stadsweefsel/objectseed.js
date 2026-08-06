/* RTG Stadsweefsel, deel "objectseed": de startinrichting van de stad.

   Per zone hangen zes lantaarns en twee containers langs de laan, met een put
   en een halte in de dwarsstraat; per buurt een rioolgemaal, per wijk een
   transformatorstation. Genoeg om de afhankelijkheidsgraaf, de zaakmotor en de
   vervangingsplanning echt iets te laten zeggen, en weinig genoeg om leesbaar
   te blijven.

   DE LAADPALEN KOMEN UIT KERN/NAVIGATIE. De POI-laag daar wijst laadpunten aan
   voor wie rijdt; dit register houdt bij wie ze beheert en wanneer ze aan
   vervanging toe zijn. Door ze hier uit diezelfde lijst te zaaien is het
   laadpunt dat de navigatie toont hetzelfde ding als het laadpunt dat een
   monteur bezoekt -- in plaats van twee lijsten die langzaam uit elkaar lopen.

   Alleen een LEEG register wordt ingericht; daarna raakt dit bestand niets
   meer aan. Krijgt de gedeelde ctx van kern/stadsweefsel/index.js. */
const { POI } = require('../navigatie');

module.exports = ({ geo, save, objecten, objectMaak }) => {
  // een punt op een fractie van een straatsegment: zo staan de lantaarns
  // netjes langs de weg in plaats van op een hoop in het midden
  const langs = (g, deel) => {
    const [a, b] = g.geometrie.punten;
    return { lat: a.lat + (b.lat - a.lat) * deel, lng: a.lng + (b.lng - a.lng) * deel };
  };
  const maak = (soort, naam, punt, extra) => objectMaak({ soort, naam, lat: punt.lat, lng: punt.lng, ...(extra || {}) });

  return function zorgObjecten() {
    geo.zorgGeografie();
    if (Object.keys(objecten()).length) return;
    for (const z of geo.opNiveau('zone')) {
      const laan = geo.kinderen(z.id).find(s => /laan$/.test(s.naam));
      const straat = geo.kinderen(z.id).find(s => /straat$/.test(s.naam));
      if (!laan || !straat) continue;
      /* Oplopende bouwjaren, een slechtere conditie voor de oudste palen, en
         een inspectiedatum die binnen het regime valt. Die spreiding is het
         punt: zonder haar zegt een vervangingsplanning niets en staat de hele
         stad als achterstallig op de onderhoudslijst. De PUTTEN staan met
         opzet over hun termijn (30 maanden bij een regime van 24) -- een
         demostad zonder enig achterstallig onderhoud is geen demostad maar een
         folder. */
      for (let i = 1; i <= 6; i++)
        maak('lantaarn', laan.naam + ' ' + (i * 12), langs(laan, i / 7),
          { bouwjaar: 2004 + i * 3, conditie: i > 4 ? 4 : 2, inspectieGeleden: i * 4 });
      for (let i = 1; i <= 2; i++) maak('container', z.naam + ' container ' + i, langs(laan, i / 3.2), { bouwjaar: 2016, inspectieGeleden: 3 });
      maak('put', straat.naam + ' kolk', langs(straat, 0.5), { bouwjaar: 1994, inspectieGeleden: 30 });
      maak('halte', 'Halte ' + z.naam, langs(straat, 0.25), { bouwjaar: 2011, inspectieGeleden: 6 });
    }
    for (const b of geo.opNiveau('buurt')) maak('gemaal', 'Gemaal ' + b.naam, b.centrum, { bouwjaar: 1998, conditie: 3, inspectieGeleden: 4 });
    for (const w of geo.opNiveau('wijk')) maak('transformator', 'Transformator ' + w.naam, w.centrum, { bouwjaar: 1989, inspectieGeleden: 10 });
    for (const l of (POI && POI.laad) || []) {
      const plek = geo.plaats(l.lat, l.lng);
      if (plek.binnenStad) maak('laadpaal', l.naam, l, { bron: 'navigatie:laad', bouwjaar: 2021, inspectieGeleden: 8 });
    }
    save();
  };
};
