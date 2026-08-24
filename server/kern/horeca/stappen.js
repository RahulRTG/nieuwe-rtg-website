/* Horeca (kern): BEREIDINGSSTAPPEN -- een gerecht is zelden één handeling aan
   één station.

   WAT ER MIS WAS. Een regel droeg één station en één norm: "tournedos, warm,
   12 minuten". De cadans rekende daarmee één startmoment terug, en dat klopt
   alleen voor een gerecht dat van begin tot eind op één plek staat. Een
   tournedos die drie minuten koud gemarineerd wordt, acht minuten op de grill
   ligt en drie minuten saus krijgt aan de warme kant, is DRIE handelingen op
   DRIE plekken -- en de grill hoort een ander moment te horen dan de sauzier.
   Met één getal krijgen ze allebei hetzelfde moment, en dan begint de een te
   vroeg of de ander te laat.

   De keten in HORECA.md zegt het al: bestelling -> gang -> gerecht ->
   BEREIDINGSSTAPPEN -> station. Die schakel was de enige die er niet was.

   DRIE DINGEN LIGGEN HIER VAST:

   1. DE NORM IS DE SOM VAN DE STAPPEN, en geen tweede getal ernaast. Zou een
      gerecht zowel stappen als een eigen totaaltijd hebben, dan lopen die twee
      uiteen zodra iemand er één aanpast -- en dan plant de keuken met het ene
      getal terwijl het bord het andere toont (LAT-regel 4).
   2. GEEN STAPPEN IS GEEN FOUT. Verreweg de meeste gerechten zijn één
      handeling. Wie niets invult, houdt precies het gedrag dat er altijd al
      was: de eigen tijd van de zaak, en anders de standaard van het station.
      Deze module maakt niets stiekem anders.
   3. DE STAPPEN STAAN IN VOLGORDE EN LOPEN NA ELKAAR. Ze worden niet parallel
      gerekend. Twee stappen tegelijk uitvoeren kán in een echte keuken, maar
      dat is een keuze van de kok en niet iets wat een plansom mag aannemen --
      aannemen dat het parallel gaat, maakt de belofte aan de gast korter dan
      hij is.

   WAT DIT NIET DOET: het start niets, het houdt niets tegen, en het vinkt geen
   stap af. Een stap afvinken zou een tweede orderstaat zijn naast de stand van
   de regel, en dan is er geen enkele plek meer die weet hoe ver een gerecht is. */
'use strict';

const MAXSTAPPEN = 8;
const MAXMIN = 180;

/* De sleutel is de gerechtnaam in kleine letters -- dezelfde sleutel als
   `bereidingstijden` in de zaakinstelling. Bewust niet het menu-id: een regel
   die vrij is ingetypt (een special) heeft er geen, en die hoort ook stappen te
   kunnen dragen. */
const sleutel = (naam) => String(naam || '').toLowerCase().trim();

function doos(h) {
  if (!h.instel || typeof h.instel !== 'object') h.instel = {};
  if (!h.instel.bereidingsstappen || typeof h.instel.bereidingsstappen !== 'object') {
    h.instel.bereidingsstappen = {};
  }
  return h.instel.bereidingsstappen;
}

/* Eén stap opschonen. Een stap zonder minuten of zonder station is geen stap;
   die valt weg in plaats van als nul mee te tellen. */
function schoneStap(x) {
  const s = x || {};
  const minuten = Math.round(Number(s.minuten));
  const station = String(s.station || '').toLowerCase().trim().slice(0, 30);
  if (!station) return null;
  if (!Number.isFinite(minuten) || minuten < 1 || minuten > MAXMIN) return null;
  return { station, minuten, wat: String(s.wat || '').trim().slice(0, 80) || null };
}

function schoneLijst(lijst) {
  if (!Array.isArray(lijst)) return null;
  const uit = lijst.slice(0, MAXSTAPPEN).map(schoneStap).filter(Boolean);
  return uit.length ? uit : null;
}

/* De stappen van een gerecht, of null als de zaak er geen heeft vastgelegd. */
function stappenVan(h, naam) {
  return schoneLijst(doos(h)[sleutel(naam)]);
}

/* Vastleggen. Een lege lijst wist de stappen -- en dan valt het gerecht terug
   op de oude weg, wat het enige eerlijke gedrag is: "geen stappen" hoort niet
   te betekenen "nul minuten". */
function zetStappen(h, naam, lijst) {
  const k = sleutel(naam);
  if (!k) return { status: 400, error: 'Welk gerecht?' };
  const schoon = schoneLijst(lijst);
  if (!schoon) { delete doos(h)[k]; return { ok: true, naam: k, stappen: null, gewist: true }; }
  doos(h)[k] = schoon;
  return { ok: true, naam: k, stappen: schoon, minuten: schoon.reduce((n, s) => n + s.minuten, 0) };
}

// de stations die aan dit gerecht werken, in volgorde en zonder herhaling
function stationsVan(stappen) {
  const uit = [];
  for (const s of (stappen || [])) if (!uit.includes(s.station)) uit.push(s.station);
  return uit;
}

/* ---------- WELK STATION ZIET DIT GERECHT ----------

   Een gerecht met stappen hoort op het bord van ELK station dat eraan werkt, en
   niet alleen op dat van de regel. Een tournedos met een grill-stap die op het
   warme bord staat, is precies de fout die de stappen moesten oplossen: de
   grill weet niet dat hij hem moet aanzetten.

   Zonder stappen blijft het wat het was: één station, dat van de regel. */
function stationsVanRegel(h, regel) {
  const stappen = stappenVan(h, regel.naam);
  if (stappen) return stationsVan(stappen);
  return [String(regel.station || 'warm').toLowerCase()];
}

/* WIE MAG DE STAND ZETTEN. Het LAATSTE station, want daar verlaat het gerecht
   de keuken richting de pas.

   Dit is geen detail maar de reden dat een gerecht op meer borden mag staan.
   Zou elk station de stand mogen zetten, dan meldt de grill "klaar" terwijl de
   saus nog moet -- en dan staat er een bord bij de pas dat niet af is. Elk
   ander station ziet zijn eigen stap en kijkt verder mee; zetten doet de
   laatste. */
function eigenaarStation(h, regel) {
  const stappen = stappenVan(h, regel.naam);
  if (stappen && stappen.length) return stappen[stappen.length - 1].station;
  return String(regel.station || 'warm').toLowerCase();
}

/* De stap van EEN station, met wat ervoor en erna komt. Een kok die alleen zijn
   eigen stap ziet, weet niet of hij begint of afmaakt -- en dat verandert wat
   hij doet met een bord dat te vroeg klaar is.

   Er staat NIET bij welke stap "nu loopt". Stappen worden niet afgevinkt (zie
   de kop van dit bestand): dat zou een tweede orderstaat zijn naast de stand
   van de regel. Wat er staat is het plan, en de kok ziet zelf waar hij is. */
function stapVoorStation(h, regel, station) {
  const stappen = stappenVan(h, regel.naam);
  if (!stappen) return null;
  const st = String(station || '').toLowerCase();
  const i = stappen.findIndex((x) => x.station === st);
  if (i < 0) return null;
  return {
    stap: stappen[i], nummer: i + 1, totaal: stappen.length,
    vorige: i > 0 ? stappen[i - 1].station : null,
    volgende: i < stappen.length - 1 ? stappen[i + 1].station : null,
    laatste: i === stappen.length - 1
  };
}

/* DE BELASTING PER STATION. Met stappen tellen de minuten van een stap bij het
   station van die STAP -- de grill draagt acht minuten van een tournedos en
   niet veertien. Zonder stappen valt alles op het station van de regel, precies
   zoals het was.

   `valMinuten` is de norm voor een gerecht zonder stappen. Die komt van buiten
   omdat bereidingsMinuten() in keukenlaag.js woont en dat bestand DIT bestand
   al gebruikt; andersom zou een kringetje zijn. */
function minutenPerStation(h, regel, valMinuten) {
  const stappen = stappenVan(h, regel.naam);
  const aantal = Math.max(1, parseInt(regel.aantal, 10) || 1);
  const uit = {};
  if (stappen) {
    for (const s of stappen) uit[s.station] = (uit[s.station] || 0) + s.minuten * aantal;
    return uit;
  }
  const st = String(regel.station || 'warm').toLowerCase();
  uit[st] = Math.max(0, Number(valMinuten) || 0) * aantal;
  return uit;
}

module.exports = { stappenVan, zetStappen, stationsVan, stationsVanRegel, eigenaarStation,
  stapVoorStation, minutenPerStation, schoneLijst, MAXSTAPPEN, MAXMIN };
