/* HAALBAARHEID VOOR DE VERKOOP -- weegt een VOORNEMEN tegen de reis die er al
   staat, voordat er iets vaststaat.

   Dit is de vraag uit de opzet: een vlucht is om 18:10 op de luchthaven, de
   transfer duurt drie kwartier, en het restaurant staat op 19:00. Dat wil een
   reiziger weten VOORDAT hij reserveert, niet erna.

   HIJ WEIGERT NIETS, en dat is de grens en geen tekort. Move mag geen boeking
   tegenhouden: dan beslist de software over de reis van een mens. Wat hij doet
   is het oordeel MET en ZONDER het voornemen naast elkaar zetten -- dezelfde
   vorm als ./gevolg.js -- en de naden aanwijzen die het voornemen zelf raakt.
   Drukken doet de reiziger (MOVE.md grens 5).

   PUUR, zoals ./naad.js, ./haalbaar.js en ./gevolg.js: de plek en de tijden zijn
   al opgelost door de aanroeper. Deze module kent geen kern, geen opslag en geen
   sessie -- en daardoor is hij te toetsen zonder een server. */
'use strict';

const { haalbaar } = require('./haalbaar');
const { RANG } = require('./naad');

/* Waaraan de uitslag het voornemen herkent. Een LEESBARE sleutel en geen
   stuurteken: de eerste versie gebruikte \u0000, en dat is onzichtbaar in elke
   diff, elk logboek en elke foutmelding. Een botsing met een echt kenmerk kan
   niet -- een boekingsreferentie draagt nooit een dubbele punt. */
const VOORNEMEN_KENMERK = 'move:voornemen';

/* WORDT DE REIS ER SLECHTER VAN? Vier gesloten uitkomsten en geen boolean.

   Hier stond `slechter: true/false`, en `false` betekende twee dingen: "de reis
   wordt er niet slechter van" EN "er was niets om mee te vergelijken". Dat
   tweede geval is de eerste boeking van een reis, en daar las het antwoord als
   een goedkeuring -- een scherm dat `if (!slechter)` schrijft, meldt dan "geen
   verslechtering" over een reis die Move niet heeft kunnen vergelijken.

   De strengheid komt uit RANG en niet uit een eigen vergelijking, zodat er maar
   EEN plek is die weet welke uitkomst zwaarder weegt. */
function vergelijk(met, zonder) {
  if (met == null || zonder == null) return 'niet-te-vergelijken';
  const a = RANG.indexOf(met), b = RANG.indexOf(zonder);
  return a < b ? 'slechter' : a > b ? 'beter' : 'gelijk';
}

function vooraf({ onderdelen, voornemen, reisTijd, afstandM }) {
  const staat = Array.isArray(onderdelen) ? onderdelen : [];
  const kandidaat = Object.assign({}, voornemen, { kenmerk: VOORNEMEN_KENMERK });

  const zonder = haalbaar({ onderdelen: staat, reisTijd, afstandM });
  const met = haalbaar({ onderdelen: staat.concat([kandidaat]), reisTijd, afstandM });

  const raakt = (met.naden || []).filter(n =>
    (n.van && n.van.kenmerk === VOORNEMEN_KENMERK) ||
    (n.naar && n.naar.kenmerk === VOORNEMEN_KENMERK));

  return {
    status: 200,
    oordeelZonder: zonder.oordeel || null,
    oordeelMet: met.oordeel || null,
    vergelijking: vergelijk(met.oordeel || null, zonder.oordeel || null),
    naden: raakt,
    dekking: met.dekking,
    /* Wat dit NIET zegt. Zonder deze regel leest een groen oordeel als een
       garantie, en dat is de faalvorm die MOVE.md als grootste risico noemt: een
       oordeel over de helft van een reis aanzien voor een oordeel over de reis. */
    grens: 'Dit weegt de overgangen die Move kan bepalen; ' +
      (Number.isFinite(met.dekking) ? met.dekking + '% van de reis' : 'geen enkele overgang') +
      '. Move houdt geen boeking tegen -- u beslist.'
  };
}

module.exports = { vooraf, vergelijk, VOORNEMEN_KENMERK };
