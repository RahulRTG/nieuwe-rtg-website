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
  const { d, kijkD, save, bewerkCollectie, nu } = ctx;

  const periodeVan = (t) => String(t || nu()).slice(0, 7);

  function metersVan(k, maak) {
    if (!k.meters || typeof k.meters !== 'object') {
      if (!maak) return {};
      k.meters = {};
    }
    return k.meters;
  }
  const meters = () => metersVan(d(), true);
  const leesMeters = () => metersVan(kijkD ? kijkD() : d(), false);

  /* Lezen zonder aan te maken. Een overzicht dat een lege rij achterlaat voor
     elke gebruiker die er ooit naar keek, laat de opslag groeien met kijken in
     plaats van met verbruik (dezelfde fout als in kern/levensgraaf). */
  function kijk(periode, drager) {
    const p = beeldPeriode(periode);
    return (p && p[String(drager || HUIS)]) || null;
  }
  function kijkPeriode(periode) { return beeldPeriode(periode); }
  function perioden() {
    const uit = new Set(Object.keys(leesMeters()));
    for (const batch of [achtergrondBatch, wacht]) if (batch) {
      for (const sleutel of batch.keys()) uit.add(sleutel.slice(0, sleutel.indexOf('\u0000')));
    }
    return [...uit].sort().reverse();
  }

  function pak(periode, drager) {
    const m = meters();
    const p = periodeVan(periode);
    const rij = m[p] || (m[p] = {});
    const dr = String(drager || HUIS);
    return rij[dr] || (rij[dr] = { laatst: null });
  }

  /* Oude maanden opruimen. Gebeurt bij het schrijven en niet in een aparte
     ronde: een opruiming die zijn eigen aanleiding nodig heeft, blijft liggen. */
  function snoeiIn(k) {
    const m = metersVan(k, true);
    const alle = Object.keys(m).sort();
    if (alle.length <= MAANDEN) return;
    for (const p of alle.slice(0, alle.length - MAANDEN)) delete m[p];
  }
  const snoei = () => snoeiIn(d());

  /* Verzoeken tellen in RAM; lezers of de vijfsecondenklok schrijven de batch. */
  let wacht = new Map();
  let klaarZetter = null, achtergrondBatch = null, achtergrondBelofte = null;

  function pasBatchToe(kosten, batch, alleenPeriode) {
    const m = metersVan(kosten, true);
    for (const [sleutel, tel] of batch) {
      const k = sleutel.indexOf('\u0000');
      const p = sleutel.slice(0, k);
      if (alleenPeriode && p !== alleenPeriode) continue;
      const vak = m[p] || (m[p] = {}), dr = sleutel.slice(k + 1);
      const rij = vak[dr] || (vak[dr] = { laatst: null });
      for (const id of Object.keys(tel.per)) rij[id] = Math.round(((rij[id] || 0) + tel.per[id]) * 1000) / 1000;
      if (!rij.laatst || Date.parse(tel.laatst) >= Date.parse(rij.laatst)) rij.laatst = tel.laatst;
      if (tel.pas && (!rij.pasGezien || Date.parse(tel.laatst) >= Date.parse(rij.pasGezien))) {
        rij.pas = tel.pas; rij.pasGezien = tel.laatst;
      }
    }
  }

  function beeldPeriode(periode) {
    const p = periodeVan(periode), bron = leesMeters()[p] || {};
    const beeld = { meters: { [p]: JSON.parse(JSON.stringify(bron)) } };
    if (achtergrondBatch) pasBatchToe(beeld, achtergrondBatch, p);
    if (wacht.size) pasBatchToe(beeld, wacht, p);
    return beeld.meters[p];
  }

  function voegTerug(batch) {
    for (const [sleutel, tel] of batch) {
      const nuTel = wacht.get(sleutel);
      if (!nuTel) { wacht.set(sleutel, tel); continue; }
      for (const id of Object.keys(tel.per)) nuTel.per[id] = (nuTel.per[id] || 0) + tel.per[id];
      if (!nuTel.laatst || tel.laatst > nuTel.laatst) {
        nuTel.laatst = tel.laatst;
        if (tel.pas) nuTel.pas = tel.pas;
      }
    }
  }

  /* Een timer heeft geen requestcommit. Hij mag daarom nooit eerst de levende
     db.data muteren en daarna save() roepen: in PostgreSQL sluit dat terecht de
     verkeerspoort. De batch gaat rechtstreeks door het collectieslot en komt
     bij een fout volledig terug in de buffer. */
  function spoelAchtergrond() {
    if (achtergrondBelofte || !wacht.size) return achtergrondBelofte || false;
    const batch = wacht; wacht = new Map(); achtergrondBatch = batch;
    let uit;
    try {
      if (typeof bewerkCollectie === 'function') {
        uit = bewerkCollectie('kosten', kosten => { pasBatchToe(kosten, batch); snoeiIn(kosten); });
      } else {
        pasBatchToe(d(), batch); snoei(); save(); uit = true;
      }
    } catch (e) {
      achtergrondBatch = null; voegTerug(batch);
      if (!klaarZetter) planSpoel();
      return false;
    }
    if (!uit || typeof uit.then !== 'function') { achtergrondBatch = null; return true; }
    achtergrondBelofte = Promise.resolve(uit).then(() => true, () => {
      voegTerug(batch); return false;
    }).finally(() => {
      achtergrondBatch = null; achtergrondBelofte = null;
      if (wacht.size && !klaarZetter) planSpoel();
    });
    return achtergrondBelofte;
  }

  /* Ook een expliciete spoeling gebruikt dezelfde autoritatieve baan. Lezers
     projecteren de RAM-batch hierboven en maken daardoor nooit van een GET een
     verborgen schrijfactie. */
  const spoel = () => spoelAchtergrond();

  function planSpoel() {
    klaarZetter = setTimeout(() => {
      klaarZetter = null; try { spoelAchtergrond(); } catch (e) {}
    }, SPOEL_MS);
    if (klaarZetter.unref) klaarZetter.unref();
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
    if (wacht.size >= BUFFER_MAX) spoelAchtergrond();
    else if (!klaarZetter) planSpoel();
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
