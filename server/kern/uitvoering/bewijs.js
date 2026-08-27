/* UITVOERENDE MEDIA (deelmodule): WAT EEN UITVOERING OVER ZICHZELF ZEGT.

   Een uitvoering is een bewering van RTG over het werk van iemand anders: "dit
   is de korte versie van deze documentaire." BESTUUR.md eist dat elke bewering
   in dit huis haar bewijsgraad draagt, en dit bestand is die van de montage:
   waaruit bestaat hij, wat is er weggelaten en waarom, wat stond de maker toe,
   en waar kwam het recht om hem te zien vandaan.

   WAAROM DIT NIET IN ./uitvoer.js STAAT. Dezelfde reden die BESTUUR.md aan de
   cockpit stelt: de laag die iets TOONT, meet het niet. Het kiezen van
   fragmenten en het verantwoorden van die keuze zijn twee dingen, en zolang ze
   in één functie zitten is de verleiding om het bewijs mee te laten bewegen met
   wat er toevallig uitkwam. Nu levert de motor de getallen en maakt dit bestand
   er de verantwoording van -- die kan dus niet vriendelijker uitvallen dan de
   montage was.

   EEN WEIGERING DRAAGT HETZELFDE BEWIJS als een geslaagde uitvoering. Dat is
   met opzet: juist wie NIET krijgt wat hij vroeg, hoort te kunnen zien waarom
   -- hoe lang het onmisbare deel duurt, wat de maker heeft toegestaan, en wat
   er ontbrak (LAT.md regel 5). */
'use strict';

/* De weigering. Een volwaardige uitslag naast een uitvoering, geen fout: wie om
   24 minuten vraagt van een werk waarvan de kern er 40 duurt, krijgt geen half
   werk maar dit. */
const weiger = (status, reden, grond) => ({ status, geweigerd: true, reden, bewijs: grond || {} });

/* De grond onder een weigering: wat er al bekend was op het moment dat hij
   werd genomen. Zo leest een weigering met dezelfde velden als een uitvoering. */
const grondVan = ({ kernS, totaalS, nietBeschikbaar, toestemming, aanspraak }) =>
  ({ kernS, totaalS, nietBeschikbaar, toestemming, aanspraak });

function maakBewijs(g) {
  return {
    gevraagd: { secondenBudget: g.gevraagd, diepte: g.diepte },
    gerekendMet: g.budget,
    kernS: g.kernS, totaalS: g.totaalS, gekozenS: g.gekozenS,
    weggelaten: g.weggelaten, nietBeschikbaar: g.nietBeschikbaar,
    hermonteerd: g.hermonteerd,
    toestemming: g.toestemming, aanspraak: g.aanspraak,
    /* Deze zin is geen marketing maar de belofte van ./uitvoer.js in woorden.
       Gaat die code ooit tóch iets tussenvoegen, dan wordt deze zin een leugen
       -- en dat is precies waarom hij hier staat en niet in een scherm
       (LAT.md regel 6: een belofte in tekst is een belofte in code). */
    herleidbaar: 'Elke regel hierboven komt uit een onderdeel dat de maker zelf heeft aangewezen. ' +
      'Er is niets tussengevoegd, overbrugd of gladgestreken.'
  };
}

/* De zin eronder. Hij noemt alleen wat er ECHT is gebeurd: er staat geen
   "samengesteld voor u" als er niets is weggelaten, en geen hermontage als de
   volgorde van de maker gewoon is blijven staan. */
function maakUitleg({ hermonteerd, weggelaten }) {
  return (hermonteerd ? 'De maker staat hermonteren toe; het onmisbare deel staat daarom vooraan. ' : '') +
    (weggelaten.length ? weggelaten.length + ' onderdelen zitten er niet in; onder "bewijs" staat per stuk waarom. ' : '') +
    'Dit is één uitvoering van deze partituur, geen kopie van het werk.';
}

module.exports = { weiger, grondVan, maakBewijs, maakUitleg };
