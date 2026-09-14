/* ============================================================================
   HET TWEEDE MEETPUNT: HEEFT DIT VERZOEK DE OPSLAG VERANDERD?

   WAAROM DIT ER IS

   De idempotentieproef doet drie oproepen (twee met dezelfde sleutel, een met
   een verse) en vergelijkt de ANTWOORDEN. Verschilt de derde van de eerste, dan
   is het antwoord gevoelig voor een nieuwe oproep en zegt een gelijke herhaling
   iets. Verschilt hij niet, dan valt er van buitenaf niets te zien -- en dat
   gold voor 768 routes (TAKEN.md 4.30).

   Een route die bij elke oproep hetzelfde teruggeeft, verraadt in zijn antwoord
   niet of hij twee keer heeft gewerkt. Maar de OPSLAG verraadt dat wel. Dus
   meten we daar: is er na dit verzoek iets bijgekomen of afgegaan?

   HOE, EN WAAROM ZO

   Opt-in via RTG_STAATLOG=1. Zonder die variabele doet deze module niets en
   kost hij niets -- hij hoort in de proef, niet in productie. Zelfde vorm als
   server/routelog.js, dat om dezelfde reden bestaat.

   De uitkomst gaat mee als ANTWOORDKOP (`X-RTG-Staat`) en niet als endpoint of
   journaal. Drie redenen: er komt geen route bij die in productie zou kunnen
   blijven staan, de meting hangt exact aan het verzoek dat hem opriep (geen
   koppeling op volgorde die door een achtergrondverzoek kan verschuiven), en de
   proef heeft het antwoord toch al in handen.

   WAT ER IN DE KOP STAAT: `naam=lengte,naam=lengte,...` voor elke collectie die
   een ARRAY is en niet leeg. Per collectie en niet als totaal, en dat is geen
   luxe maar noodzaak: `doorgeefjournaal` groeit bij ELK verzoek, ook bij lezen.
   Een totaal zou daardoor altijd bewegen en dit meetpunt meteen blind maken --
   gemeten, en het was de eerste vorm die ik probeerde.

   Wie de ruis is, staat hier NIET als lijst. De proef ijkt dat zelf: eerst een
   paar oproepen die geen werk doen, kijken welke collecties dan tóch groeien,
   en die uitsluiten. Een handgeschreven lijst zou stil verouderen zodra er een
   teller bij komt; een ijking niet.

   TWEE STANDEN, EN DE TWEEDE IS ER GEKOMEN DOORDAT DE EERSTE TE SMAL BLEEK.

     RTG_STAATLOG=1  alleen de LENGTE per array. O(1) per collectie, dus zo goed
                     als gratis. Ziet een toevoeging en een verwijdering.
     RTG_STAATLOG=2  de lengte EN een korte inhoudsafdruk per collectie, arrays
                     en objecten allebei. Ziet daarmee ook een wijziging op zijn
                     plaats.

   Stand 1 was blind voor twee dingen, en die twee stonden hier eerst als grens
   opgeschreven: een status van 'open' naar 'betaald' zetten verandert geen
   enkele lengte, en collecties die OBJECTEN zijn (bankPassen, bankIdem) hebben
   er helemaal geen. Dat laatste bleek geen randgeval: `bank/pas/uitgeven` maakte
   een pas in een OBJECT, dus die route was met stand 1 onzichtbaar.

   Stand 2 kost een JSON.stringify plus een sha1 per collectie per verzoek. Dat
   klinkt duur en is het niet: gemeten op een geseede proefdatabase 0,29 ms voor
   de hele stand, ofwel een seconde of zes over een volledige ronde van 9.324
   oproepen. Daarom is het een tweede stand en geen apart gereedschap -- maar wel
   opt-in, want in productie hoort geen van beide.

   WAT OOK STAND 2 NIET ZIET:

     - een verandering die zichzelf terugdraait binnen een verzoek.
     - een verschuiving in de SLEUTELVOLGORDE van een object telt als een
       wijziging, ook al betekent hij niets. In de praktijk herordent deze code
       geen objecten, dus dat blijft theorie -- maar het staat er.
     - het verschil tussen "de handeling" en "de aantekening van de handeling"
       BINNEN een collectie. Een rij die bij elke oproep een tijdstempel bijwerkt,
       ziet er hier uit als werk. Per collectie vangt IDEMBESLUIT.json dat af
       (`vastlegging`); binnen een rij niet.

   Dit meetpunt is er om ONGEMETEN kleiner te maken, niet om groen te kunnen
   zeggen. */
'use strict';

const crypto = require('crypto');
const state = require('./db/state');

let aan = false, diep = false;

/* Een korte afdruk van de inhoud. Acht hex-tekens: een botsing zou hier een
   gemiste bevinding zijn en geen fout antwoord, en de kop moet klein blijven.
   Gaat stringify stuk (een cyclus), dan geeft hij '?' terug -- dat verschilt
   nooit van zichzelf, dus zo'n collectie telt als onveranderd in plaats van als
   voortdurend gewijzigd. Stil ruis toevoegen is erger dan niets zien. */
function afdruk(v) {
  try { return crypto.createHash('sha1').update(JSON.stringify(v)).digest('hex').slice(0, 8); }
  catch (e) { return '?'; }
}

/* De stand. In stand 1 alleen `.length` van arrays (O(1)); in stand 2 ook het
   aantal sleutels van objecten en van allebei een inhoudsafdruk. Alleen wat
   gevuld is, zodat de kop niet volloopt met honderd nullen. */
function stand() {
  const data = state.db && state.db.data;
  if (!data || typeof data !== 'object') return '';
  const uit = [];
  for (const k of Object.keys(data)) {
    const v = data[k];
    if (!v || typeof v !== 'object') continue;
    if (!diep) { if (Array.isArray(v) && v.length) uit.push(k + '=' + v.length); continue; }
    const n = Array.isArray(v) ? v.length : Object.keys(v).length;
    if (n) uit.push(k + '=' + n + ':' + afdruk(v));
  }
  return uit.join(',');
}

/* De stand als map, voor wie hem wil vergelijken (de proef, en de toets).
   `{ n, h }` per collectie; `h` is null in stand 1. */
function lees(kop) {
  const uit = {};
  for (const deel of String(kop || '').split(',')) {
    if (!deel) continue;
    const i = deel.lastIndexOf('=');
    if (i <= 0) continue;
    const waarde = deel.slice(i + 1);
    const j = waarde.indexOf(':');
    uit[deel.slice(0, i)] = j < 0
      ? { n: Number(waarde) || 0, h: null }
      : { n: Number(waarde.slice(0, j)) || 0, h: waarde.slice(j + 1) };
  }
  return uit;
}

const LEEG = { n: 0, h: null };

/* Wat is er tussen twee standen veranderd? Een getal als de LENGTE veranderde
   (met de richting erin), en 'gewijzigd' als de lengte gelijk bleef maar de
   inhoud niet -- dat laatste kan alleen in stand 2. `negeer` is de ruis die de
   ijking heeft gevonden. */
function verschil(voor, na, negeer) {
  const a = typeof voor === 'string' ? lees(voor) : (voor || {});
  const b = typeof na === 'string' ? lees(na) : (na || {});
  const uit = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (negeer && negeer.has(k)) continue;
    const x = a[k] || LEEG, y = b[k] || LEEG;
    const d = y.n - x.n;
    if (d) uit[k] = d;
    else if (x.h && y.h && x.h !== y.h) uit[k] = 'gewijzigd';
  }
  return uit;
}

/* De haak. Hij hangt aan `res.end` en NIET aan `res.json`, en dat is een
   gemeten reparatie (14 september 2026).

   HIJ HING AAN res.json, met als reden: "dat is het punt waar elke route zijn
   antwoord geeft". Dat klopte niet, en het mislukte STIL. `res.json` is het punt
   waar elke route zijn antwoord AANBIEDT; wie het verstuurt kan iemand anders
   zijn. server/middleware/compressie.js hangt zich boven deze haak en verpakt elk
   JSON-lijf van 1 kB of meer zelf: hij serialiseert, comprimeert en stuurt het
   resultaat met `res.send` -- en roept de keten onder zich dan NOOIT aan
   (`return gewoonJson(data)` is alleen de uitweg voor een klein of mislukt lijf).
   Elk antwoord boven die drempel droeg dus geen X-RTG-Staat.

   WAT DAT KOSTTE, en waarom het erger is dan een gat. De idempotentieproef leest
   deze kop als tweede meetpunt; zonder kop geeft `staatVan` een LEEG verschil
   terug, en dat is niet hetzelfde als "niets veranderd". kern/stuur/gevolg.js
   maakt van een leeg verschil de graad `geen-effect-gemeten` met de zin "de proef
   draaide en zag geen enkele collectie veranderen" -- een uitspraak over een
   meting die nooit heeft plaatsgevonden. Precies de verwisseling die dit huis
   overal weigert: onbekend dat stilletjes nul wordt. Gevonden aan
   /api/office/bank/incasso, dat een voornemen, een dossier en een vooruitblik
   teruggeeft (ruim boven de kilobyte) en daarmee in IDEMPROEF.json op een leeg
   `opslag` stond terwijl de effectmeter in hetzelfde verzoek vier schrijfacties
   telde.

   ER STOND AL EEN ANTWOORD IN DIT HUIS. server/effectmeter.js is om dezelfde
   reden verhuisd -- daar stond het op 282 routes -- en de zin die daar staat
   geldt hier woordelijk: res.end is de ene uitgang waar alle andere doorheen
   lopen (res.json roept hem aan, res.send ook, een redirect ook). Twee meters met
   dezelfde blinde vlek en een verschillende uitgang is het gat dat niemand ziet;
   nu hangen ze op dezelfde plek.

   KOPPEN MOETEN VOOR HET LIJF GESCHREVEN ZIJN, en dat blijft gelden: op `finish`
   is het te laat. `res.end` is het laatste moment waarop het nog kan, en de
   `headersSent`-controle houdt vast dat een tweede end niets overschrijft. */
function haak(app) {
  if (!aan || !app || typeof app.use !== 'function') return false;
  app.use((req, res, next) => {
    const echt = res.end;
    res.end = function (...args) {
      try { if (!res.headersSent) res.setHeader('X-RTG-Staat', stand()); } catch (e) {}
      return echt.apply(this, args);
    };
    next();
  });
  return true;
}

function begin(vlag) {
  const v = String(vlag || '');
  diep = v === '2';
  aan = v === '1' || diep;
  return aan;
}

begin(process.env.RTG_STAATLOG);

module.exports = { haak, stand, lees, verschil, afdruk, begin, get aan() { return aan; }, get diep() { return diep; } };
