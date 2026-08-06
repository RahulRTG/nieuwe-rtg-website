/* RTG Stadsweefsel, deel "meetkunde": graden erin, meters eruit.

   Pure rekenkunde, geen staat en geen database: punt-in-vlak, de afstand van
   een punt tot een lijnstuk, het midden van een reeks punten en de omhullende
   rechthoek. Los van geografie.js omdat dit het enige stuk is dat je met een
   pen kunt narekenen -- en omdat een fout hier stil doorwerkt in alles wat
   erboven hangt (welke zone, welke straat, welk object het dichtst bij).

   Alles rekent op enkele kilometers rond het middelpunt van de stad. Op die
   schaal is een vlakke projectie ruim nauwkeurig genoeg; over honderden
   kilometers zou hij scheef lopen, en dat is precies waarom REF hier
   binnenkomt in plaats van dat elk deel zijn eigen aanname doet. */

module.exports = ({ REF }) => {
  const mPerLat = 110540;
  const mPerLng = Math.cos(REF.lat * Math.PI / 180) * 111320;

  // de vier hoeken van een lat/lng-rechthoek, met de klok mee
  const hoeken = (v) => [
    { lat: v.lat0, lng: v.lng0 }, { lat: v.lat0, lng: v.lng1 },
    { lat: v.lat1, lng: v.lng1 }, { lat: v.lat1, lng: v.lng0 }
  ];

  /* Punt-in-vlak met de stralenmethode. Een punt op een gedeelde rand valt
     naar het eerst gezaaide gebied; dat is met opzet vast in plaats van
     willekeurig, zodat dezelfde positie altijd dezelfde zone geeft. */
  function inVlak(p, punten) {
    let binnen = false;
    for (let i = 0, j = punten.length - 1; i < punten.length; j = i++) {
      const a = punten[i], b = punten[j];
      if ((a.lat > p.lat) !== (b.lat > p.lat) &&
        p.lng < (b.lng - a.lng) * (p.lat - a.lat) / (b.lat - a.lat) + a.lng) binnen = !binnen;
    }
    return binnen;
  }

  /* Afstand van een punt tot een LIJNSTUK in meters. Een straatsegment is een
     lijn, dus "sta ik bij deze straat" is geen afstand tot een punt: bij een
     segment van 300 meter zou het midden anders 150 meter weg lijken terwijl
     je er met je voet op staat. */
  function totLijnstuk(p, a, b) {
    const px = (p.lng - a.lng) * mPerLng, py = (p.lat - a.lat) * mPerLat;
    const bx = (b.lng - a.lng) * mPerLng, by = (b.lat - a.lat) * mPerLat;
    const len2 = bx * bx + by * by;
    const t = len2 ? Math.max(0, Math.min(1, (px * bx + py * by) / len2)) : 0;
    const dx = px - t * bx, dy = py - t * by;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // de afstand tot een hele geometrie: binnen een vlak is nul, langs een lijn
  // het dichtstbijzijnde segment
  function totGeometrie(p, geo, haversine) {
    if (!geo || !Array.isArray(geo.punten) || !geo.punten.length) return Infinity;
    if (geo.soort === 'punt') return haversine(p, geo.punten[0]);
    if (geo.soort === 'vlak' && inVlak(p, geo.punten)) return 0;
    let min = Infinity;
    for (let i = 1; i < geo.punten.length; i++) min = Math.min(min, totLijnstuk(p, geo.punten[i - 1], geo.punten[i]));
    if (geo.soort === 'vlak') min = Math.min(min, totLijnstuk(p, geo.punten[geo.punten.length - 1], geo.punten[0]));
    return min;
  }

  const middenVan = (punten) => ({
    lat: punten.reduce((s, p) => s + p.lat, 0) / punten.length,
    lng: punten.reduce((s, p) => s + p.lng, 0) / punten.length
  });

  /* De omhullende rechthoek van een stel gebieden. De grens van een wijk is
     hiermee een GEVOLG van zijn buurten en geen los ingevoerd tweede getal:
     wie een zone verlegt, verlegt de wijk mee. */
  function omhullende(kinderen) {
    const punten = kinderen.flatMap(k => (k.geometrie && k.geometrie.punten) || []);
    if (!punten.length) return null;
    const lat = punten.map(p => p.lat), lng = punten.map(p => p.lng);
    return hoeken({ lat0: Math.min(...lat), lat1: Math.max(...lat), lng0: Math.min(...lng), lng1: Math.max(...lng) });
  }

  return { hoeken, inVlak, totLijnstuk, totGeometrie, middenVan, omhullende };
};
