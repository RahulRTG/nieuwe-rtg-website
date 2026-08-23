/* ============================================================================
   DE BEGROTING -- de eerste laag die een handeling kan WEIGEREN.

   WAAROM DIT ER IS. server/opzet/handeling.js meet wat een verzoek heeft
   veranderd, ACHTERAF. Daarmee is een massamutatie te zien en te melden, maar
   niet tegen te houden: als de logregel er staat, zijn de rijen al weg.
   Detecteren is niet tegenhouden. Dit bestand is het verschil.

   HOE HET KAN ZONDER HET SCHRIJFPAD TE HERSCHRIJVEN, en dat is de hele vondst.
   Een echte voorproef -- de handeling eerst tegen een kopie draaien -- kan hier
   niet: een route stuurt post, roept een betaaldienst aan en schrijft bestanden.
   Zo'n handler twee keer draaien is gevaarlijker dan wat we ermee zouden
   voorkomen.

   Maar een massamutatie ziet er in deze code bijna altijd hetzelfde uit. Geteld
   op de dag dat dit bestand werd geschreven:

       db.data.X = ...filter(...)      30
       db.data.X = ...slice(...)       82
       db.data.X = []                 142     -> samen 254
       db.data.X.splice(...)            3
       db.data.X.length = 0             0

   Vierentwintig van de vijfentwintig keer is een massaverwijdering een
   HERVULLING van de collectie, en die is te onderscheppen VOORDAT hij landt --
   met een `set`-val op db.data. Op dat moment is de oude lengte bekend, de
   nieuwe ook, en is er nog niets gebeurd. Dat is geen simulatie maar iets
   beters: de echte handeling, tegengehouden op de drempel.

   WAT ER NIET ONDER VALT, en dat hoort er hard bij: de drie splice-plekken, elke
   wijziging BINNEN een rij, en alles wat via push groeit. Groei is hier
   trouwens bewust geen weigering -- een collectie die te hard groeit is een
   ander probleem (opslag, niet verlies), en er een grens op zetten zou legitiem
   werk breken zonder dat er iets onherstelbaars tegenover staat.

   WAT HET KOST. Een Proxy op db.data raakt elke leesactie. Gemeten op 450
   sleutels: 251 ms zonder en 294 ms met, over twee miljoen leesacties -- 0,02
   microseconde per leesactie. Een schrijfactie kost 59 nanoseconde. Op een p50
   van 13 ms is dat niet te zien.

   EN DE BELANGRIJKSTE KEUZE: HIJ STAAT STANDAARD OP MELDEN.

   Een weigering die vandaag aangaat over 3706 routes is precies het soort
   wijziging waarvan je pas in productie merkt wat er stuk ging. Er zijn hier
   LEGITIEME grote krimpen -- de bewaarveger, het archiveren, de kappen als
   `slice(0, 60000)` -- en die catalogus bestaat nog niet. Dus meet deze laag
   eerst wat er WEL zou zijn geweigerd, en dat getal bouwt de catalogus. Met
   RTG_BEGROTING=weigeren gaat de tand erin.

   Dat is geen halfheid maar de volgorde die dit huis overal aanhoudt: meten,
   ratelen, dan handhaven. Wat er nu al is, is het mechanisme -- getoetst,
   bewezen weigerend -- met de trekker nog niet overgehaald.

   BUITEN EEN VERZOEK GEBEURT ER NIETS. Een cronjob, de onderhoudsveger, een
   migratie en het inlezen van de seed hebben geen handelingscontext, en die
   horen nooit geweigerd te worden: dat zijn geen actoren met een budget maar
   het huis dat zijn eigen werk doet.
   ========================================================================== */
'use strict';

const handeling = require('./handeling');

/* De grens: hoeveel rijen mag EEN hervulling in EEN verzoek wegnemen. Bewust een
   getal en geen tabel per actor: die tabel zou verzonnen zijn, en een verzonnen
   risicoklasse is gevaarlijker dan geen. Welke actoren een eigen grens nodig
   hebben, moet uit de meting komen. */
const KRIMPGRENS = (() => {
  const n = Number(process.env.RTG_BEGROTING_KRIMP);
  return Number.isFinite(n) && n > 0 ? n : 1000;
})();

const MODUS = process.env.RTG_BEGROTING === 'weigeren' ? 'weigeren' : 'melden';

/* Wat er is tegengehouden of zou zijn tegengehouden, sinds het opstarten. Dit is
   het getal dat de catalogus bouwt: zolang hier legitieme handelingen in staan,
   kan de tand er niet in. */
const teller = { gezien: 0, overschreden: 0, geweigerd: 0, laatste: [] };

function onthoud(rij) {
  teller.laatste.unshift(rij);
  if (teller.laatste.length > 25) teller.laatste.length = 25;
}

/* De fout die een geweigerde handeling oplevert. Een eigen klasse zodat een
   route hem kan herkennen en er een net antwoord van kan maken in plaats van een
   500 -- en zodat hij in een log niet op een programmeerfout lijkt. */
class BegrotingOverschreden extends Error {
  constructor(collectie, krimp, grens) {
    super('[begroting] deze handeling neemt ' + krimp + ' rijen weg uit "' + collectie +
      '" en de grens ligt op ' + grens + '. Splits hem op, of laat hem door iemand met dat budget doen.');
    this.name = 'BegrotingOverschreden';
    this.collectie = collectie;
    this.krimp = krimp;
    this.grens = grens;
    this.status = 409;
  }
}

/* De beoordeling, los van de Proxy zodat een toets hem kan voeden zonder een
   database op te tuigen -- en zodat het oordeel dat op het scherm komt hetzelfde
   is als wat een toets ijkt (LAT.md regel 10). */
function beoordeel(collectie, oudeLengte, nieuweLengte, opties) {
  const o = opties || {};
  const grens = Number.isFinite(o.grens) ? o.grens : KRIMPGRENS;
  const modus = o.modus || MODUS;
  const krimp = oudeLengte - nieuweLengte;
  if (!(krimp > 0)) return { oordeel: 'door', krimp: krimp };
  teller.gezien++;
  if (krimp <= grens) return { oordeel: 'door', krimp: krimp };
  teller.overschreden++;
  const rij = { collectie, krimp, grens, modus, pad: o.pad || null, correlatie: o.correlatie || null };
  onthoud(rij);
  if (modus === 'weigeren') { teller.geweigerd++; return { oordeel: 'weiger', krimp, grens, rij }; }
  return { oordeel: 'meld', krimp, grens, rij };
}

/* Dezelfde Proxy voor dezelfde onderliggende data, zodat `db.data === db.data`
   blijft kloppen en niemand twee verschillende wikkels om een ding krijgt. */
const wikkels = new WeakMap();

function bewaak(data, deps) {
  if (!data || typeof data !== 'object') return data;
  if (wikkels.has(data)) return wikkels.get(data);
  const meld = (deps && deps.log) || ((niveau, bericht, velden) => {
    try { require('../log').log[niveau](bericht, velden); } catch (e) {}
  });
  const nu = (deps && deps.handeling) || handeling;
  /* DE MODUS IS HIER OVERSCHRIJFBAAR, en dat is geen testluik maar een eis. Las
     deze wikkel alleen de module-constante, dan was de WEIGERSTAND niet te
     beproeven zonder de hele suite met een omgevingsvlag te draaien -- en een
     poort die je niet in zijn handhavende stand kunt zien werken, is een poort
     waarvan niemand weet of hij dichtgaat (LAT.md regel 10). */
  const modus = (deps && deps.modus) || MODUS;
  const grens = (deps && Number.isFinite(deps.grens)) ? deps.grens : KRIMPGRENS;

  const wikkel = new Proxy(data, {
    set(doel, sleutel, waarde) {
      const oud = doel[sleutel];
      /* Alleen een collectie die door een ANDERE collectie wordt vervangen is
         hier interessant. Al het andere (een teller, een object, een nieuwe
         sleutel) gaat er ongemoeid door. */
      if (!Array.isArray(oud) || !Array.isArray(waarde)) { doel[sleutel] = waarde; return true; }
      /* Buiten een verzoek: het huis doet zijn eigen werk (veger, migratie,
         seed). Daar hoort geen budget op te staan. */
      const h = nu.huidige();
      if (!h) { doel[sleutel] = waarde; return true; }

      const uit = beoordeel(String(sleutel), oud.length, waarde.length,
        { pad: h.pad, correlatie: h.correlatie, modus, grens });
      if (uit.oordeel === 'door') { doel[sleutel] = waarde; return true; }

      if (uit.oordeel === 'weiger') {
        meld('error', 'begroting: handeling geweigerd', {
          id: h.correlatie, p: h.pad, collectie: String(sleutel), rijen: uit.krimp, grens: uit.grens });
        throw new BegrotingOverschreden(String(sleutel), uit.krimp, uit.grens);
      }
      /* MELDEN: hij gaat door, maar niet stil. Dit is het getal dat de catalogus
         bouwt van wat er legitiem groot is (LAT.md regel 5). */
      meld('warn', 'begroting: zou zijn geweigerd', {
        id: h.correlatie, p: h.pad, collectie: String(sleutel), rijen: uit.krimp, grens: uit.grens });
      doel[sleutel] = waarde;
      return true;
    }
  });
  wikkels.set(data, wikkel);
  wikkels.set(wikkel, wikkel);   // bewaak(bewaakt) geeft dezelfde wikkel terug
  return wikkel;
}

function stand() {
  return { modus: MODUS, grens: KRIMPGRENS,
    gezien: teller.gezien, overschreden: teller.overschreden, geweigerd: teller.geweigerd,
    laatste: teller.laatste.slice(0, 10) };
}

module.exports = { bewaak, beoordeel, stand, BegrotingOverschreden, KRIMPGRENS, MODUS };
