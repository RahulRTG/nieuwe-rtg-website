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

   WAT DIT NIET ZIET, en dat hoort er hardop bij te staan:

     - een WIJZIGING OP ZIJN PLAATS. Een status van 'open' naar 'betaald' zetten
       verandert geen enkele lengte. Een tweede oproep die alleen een veld
       overschrijft, blijft hier dus onzichtbaar. Voor de creatie-routes waar
       4.30 over gaat is dat geen bezwaar -- daar is bijkomen de vorm -- maar
       een route die alleen bijwerkt, komt met dit meetpunt niet verder dan
       "geen verschil gezien".
     - collecties die OBJECTEN zijn in plaats van arrays. `Object.keys()` daarop
       is O(n) en dat is per verzoek te duur; die tellen als 1. Bij de proef gaat
       het om arrays (orders, meldingen, kaarten), dus dat kost daar niets.

   Die twee grenzen maken dit meetpunt smaller dan het klinkt. Het is er om
   ONGEMETEN kleiner te maken, niet om groen te kunnen zeggen. */
'use strict';

const state = require('./db/state');

let aan = false;

/* De stand: alleen `.length` van arrays -- dat is O(1) -- en alleen wat gevuld
   is, zodat de kop niet volloopt met honderd nullen. */
function stand() {
  const data = state.db && state.db.data;
  if (!data || typeof data !== 'object') return '';
  const uit = [];
  for (const k of Object.keys(data)) {
    const v = data[k];
    if (Array.isArray(v) && v.length) uit.push(k + '=' + v.length);
  }
  return uit.join(',');
}

/* De stand als map, voor wie hem wil vergelijken (de proef, en de toets). */
function lees(kop) {
  const uit = {};
  for (const deel of String(kop || '').split(',')) {
    if (!deel) continue;
    const i = deel.lastIndexOf('=');
    if (i > 0) uit[deel.slice(0, i)] = Number(deel.slice(i + 1)) || 0;
  }
  return uit;
}

/* Welke collecties zijn er tussen twee standen bij gekomen of afgegaan?
   `negeer` is de ruis die de ijking heeft gevonden. */
function verschil(voor, na, negeer) {
  const a = typeof voor === 'string' ? lees(voor) : (voor || {});
  const b = typeof na === 'string' ? lees(na) : (na || {});
  const uit = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (negeer && negeer.has(k)) continue;
    const d = (b[k] || 0) - (a[k] || 0);
    if (d) uit[k] = d;
  }
  return uit;
}

/* De haak. `res.json` is het punt waar elke route zijn antwoord geeft, dus daar
   staat de opslag in de stand die dit verzoek heeft achtergelaten -- na het
   werk en voor het antwoord de deur uit gaat. Koppen moeten voor het lijf
   geschreven zijn; vandaar hier en niet op 'finish'. */
function haak(app) {
  if (!aan || !app || typeof app.use !== 'function') return false;
  app.use((req, res, next) => {
    const echt = res.json;
    res.json = function (...args) {
      try { if (!res.headersSent) res.setHeader('X-RTG-Staat', stand()); } catch (e) {}
      return echt.apply(this, args);
    };
    next();
  });
  return true;
}

function begin(vlag) { aan = String(vlag || '') === '1'; return aan; }

begin(process.env.RTG_STAATLOG);

module.exports = { haak, stand, lees, verschil, begin, get aan() { return aan; } };
