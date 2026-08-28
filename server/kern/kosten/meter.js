/* DE METER: tellen wat een gebruiker echt verbruikt, en niets anders.

   TELLERS EN GEEN JOURNAAL. De verleiding is om elk verbruik als een regel weg
   te schrijven ("om 14:03 vroeg dit lid 812 tokens"). Dat is een gedragslogboek
   van elk lid, het groeit oneindig, en het is voor een factuur niet nodig: op
   een rekening staat een TOTAAL. Dus staat hier per gebruiker per maand één rij
   met een teller per soort. Wat er niet is, kan ook niet uitlekken.

   DE SLEUTEL IS NOOIT EEN NAAM. Leden staan met hun sessiesleutel, zaken met
   hun code, gezinnen met hun gezinscode -- dezelfde handvatten waar de facturen
   al mee werken. Zie ./haak.js voor de vorm.

   VERBRUIK ZONDER EIGENAAR IS EEN HUISKOST, geen afrondingsfout. Alles wat
   buiten een verzoek gebeurt (cronrondes, achtergrondwerk, het aanmeldgesprek
   van iemand die nog geen account heeft) landt op 'huis'. Dat is een echte post:
   ./toerekening.js verdeelt hem niet stiekem alsnog over leden maar laat hem
   staan, zodat zichtbaar blijft welk deel van de rekening niemands verbruik is.

   DE MAAND IS DE PERIODE. Niet de dag (dan wordt de rij twaalfhonderd keer zo
   groot voor een factuur die per maand komt) en niet het jaar (dan is een
   maandfactuur niet te maken). De periodesleutel is 'JJJJ-MM' in UTC. */
'use strict';

const { soort } = require('./soorten');
const { HUIS } = require('./haak');

/* Hoeveel maanden blijven staan. Vierentwintig: genoeg voor een jaarvergelijking
   en voor een correctie op een oude factuur, en niet meer dan dat. */
const MAANDEN = 24;
/* AFRONDEN ZONDER TE LIEGEN. Drie decimalen is prima voor tokens, en fataal voor
   opslag: die staat in gigabytes, dus drie decimalen is een megabyte, en dan
   leest de kluis van een lid met een paar bestanden als NUL. Onder de duizendste
   dus drie SIGNIFICANTE cijfers. Een getal dat op nul afrondt terwijl het niet
   nul is, is een leugen met een decimaalteken. */
function afrond(n) {
  const v = Number(n) || 0;
  if (v === 0) return 0;
  if (Math.abs(v) >= 0.001) return Math.round(v * 1000) / 1000;
  return Number(v.toPrecision(3));
}

const MAX_AANTAL = 1e12;   // een grens op het doel: één melding kan de maand niet omgooien
const BUFFER_MAX = 500;    // hoeveel gebruiker-maandrijen er in het geheugen mogen wachten
const SPOEL_MS = 5000;     // en hoe lang, als niemand kijkt

module.exports = (ctx) => {
  const { d, save, nu } = ctx;

  const periodeVan = (t) => String(t || nu()).slice(0, 7);

  function meters() {
    const k = d();
    if (!k.meters || typeof k.meters !== 'object') k.meters = {};
    return k.meters;
  }

  /* Lezen zonder aan te maken. Een overzicht dat een lege rij achterlaat voor
     elke gebruiker die er ooit naar keek, laat de opslag groeien met kijken in
     plaats van met verbruik (dezelfde fout als in kern/levensgraaf). */
  function kijk(periode, drager) {
    spoel();
    const p = meters()[periodeVan(periode)];
    return (p && p[String(drager || HUIS)]) || null;
  }
  function kijkPeriode(periode) { spoel(); return meters()[periodeVan(periode)] || {}; }
  function perioden() { spoel(); return Object.keys(meters()).sort().reverse(); }

  function pak(periode, drager) {
    const m = meters();
    const p = periodeVan(periode);
    const rij = m[p] || (m[p] = {});
    const dr = String(drager || HUIS);
    return rij[dr] || (rij[dr] = { laatst: null });
  }

  /* Oude maanden opruimen. Gebeurt bij het schrijven en niet in een aparte
     ronde: een opruiming die zijn eigen aanleiding nodig heeft, blijft liggen. */
  function snoei() {
    const m = meters();
    const alle = Object.keys(m).sort();
    if (alle.length <= MAANDEN) return;
    for (const p of alle.slice(0, alle.length - MAANDEN)) delete m[p];
  }

  /* DE BUFFER, EN WAAROM HIJ ER MOET ZIJN.

     Deze meter hangt aan de poort, dus hij ziet ELK verzoek -- ook de duizenden
     die alleen maar lezen. Zou hij daar meteen db.data mee bijwerken en save()
     aanroepen, dan wordt elk leesverzoek van dit huis opeens een schrijfactie.
     Dat is precies het soort verandering dat in een demo niets doet en in
     productie de opslag verdubbelt.

     Dus: optellen in het geheugen, en in één keer wegschrijven. Elke LEZER
     spoelt eerst (zie ./overzicht.js gaat langs kijk/dragers), en een timer
     spoelt wat er blijft liggen. Bij een harde kill kan er hooguit een paar
     seconden aan tellers verloren gaan; dat is een handvol centen, en de prijs
     ervoor is een schrijfactie per leesverzoek van het hele huis. Die ruil is
     bewust, en hij staat hier zodat hij niet stil is. */
  const wacht = new Map();
  let klaarZetter = null;

  function spoel() {
    if (!wacht.size) return false;
    for (const [sleutel, tel] of wacht) {
      const k = sleutel.indexOf('\u0000');
      const rij = pak(sleutel.slice(0, k), sleutel.slice(k + 1));
      for (const id of Object.keys(tel.per)) rij[id] = Math.round(((rij[id] || 0) + tel.per[id]) * 1000) / 1000;
      rij.laatst = tel.laatst;
      if (tel.pas) { rij.pas = tel.pas; rij.pasGezien = tel.laatst; }
    }
    wacht.clear();
    snoei();
    /* Een mislukte schrijfactie mag een LEESACTIE niet omgooien. De tellers
       staan op dit punt al in db.data; alleen het wegschrijven ging mis, en de
       eerstvolgende save() van welke laag dan ook neemt ze alsnog mee. Wie hier
       laat gooien, laat een kostenoverzicht crashen omdat de schijf even vol
       was -- en dat is een slechtere uitkomst dan een minuut later bewaren. */
    try { save(); } catch (e) {}
    return true;
  }

  /* Verbruik erbij. Geeft false in plaats van te gooien: dit zit in het pad van
     een AI-antwoord en van een betaling, en een boekhouding die die kan laten
     omvallen is erger dan een ontbroken teller. Het overzicht kan zien dat er
     niets is; een verzoek dat crasht op zijn eigen meter niet. */
  function meet({ drager, soort: soortId, aantal, tijd, pas }) {
    const s = soort(soortId);
    if (!s || s.meetweg !== 'gemeten') return false;
    /* Een STAND komt niet via deze deur binnen. Zou hij dat wel doen, dan telt
       een peiling op bij de vorige en groeit de opslag van een lid dat niets
       doet vanzelf. Zie peil() hierboven. */
    if (s.aard === 'stand') return false;
    const n = Number(aantal);
    if (!Number.isFinite(n) || n <= 0 || n > MAX_AANTAL) return false;
    const sleutel = periodeVan(tijd) + '\u0000' + String(drager || HUIS);
    const tel = wacht.get(sleutel) || { per: {}, laatst: null, pas: null };
    tel.per[s.id] = (tel.per[s.id] || 0) + n;
    tel.laatst = nu();
    /* De PAS gaat mee met de meting en wordt niet later opgezocht. Twee redenen.
       Een opzoeking zou de kluis of de ledengids nodig hebben en die kent echte
       namen; deze laag hoort daar niet te komen. En een lid dat halverwege de
       maand overstapt zou anders met terugwerkende kracht op zijn nieuwe pas
       worden afgerekend. Laatst gezien wint, en dat staat erbij. */
    if (pas) tel.pas = String(pas).slice(0, 40);
    wacht.set(sleutel, tel);
    /* Vol: meteen wegschrijven. Anders zou een stille nacht met veel verkeer en
       geen enkele lezer de buffer laten groeien tot hij zelf het probleem is. */
    if (wacht.size >= BUFFER_MAX) spoel();
    else if (!klaarZetter) {
      klaarZetter = setTimeout(() => { klaarZetter = null; try { spoel(); } catch (e) {} }, SPOEL_MS);
      /* unref: deze timer mag een proces nooit in leven houden -- niet in een
         toets, en niet bij het afsluiten van de server. */
      if (klaarZetter.unref) klaarZetter.unref();
    }
    return true;
  }

  /* Alle dragers in een periode, met hun tellers. De volgorde is die van de
     opslag; sorteren doet het overzicht, want dat weet waarop. */
  function dragers(periode) { return Object.keys(kijkPeriode(periode)); }

  /* De STAND-kant (opslag peilen) woont in ./meterstand.js: een ander mechanisme
     op dezelfde opslag. Zie de kop daar voor waarom dat geen dubbeling is. */
  const { peil } = require('./meterstand')({ pak, spoel, snoei, save, nu, periodeVan, MAX_AANTAL });

  return { meet, peil, spoel, kijk, kijkPeriode, dragers, perioden, periodeVan, afrond, MAANDEN };
};
