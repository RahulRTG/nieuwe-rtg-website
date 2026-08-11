/* Onderneming-deelmodule "stress-toetsen": de losse toetsen van de stress test.

   Los van ./stress.js omdat dat bestand over de 10 kB-grens van het
   modulebeleid ging. De naad is inhoudelijk: hier staat WAT er wordt getoetst,
   daar staat wat de uitkomsten SAMEN betekenen. Een toets erbij verandert het
   oordeel dus niet van vorm, en dat is precies de bedoeling.

   Elke toets krijgt (intake, sim, kans) en geeft een bevinding of null. Een
   toets die niets vindt, vindt zichtbaar niets. */
'use strict';

const MARGE_LAAG = 20;        // brutomarge in % waaronder het krap wordt
const KLANT_GROOT = 40;       // % van de omzet bij één klant dat als klomp telt
const UREN_WEINIG = 8;        // uren per week waaronder dit geen onderneming is

const bevinding = (id, zwaarte, kop, wat, doen) => ({ id, zwaarte, kop, wat, doen });

const TOETSEN = [

    /* Onder de kostprijs verkopen. Elke verkoop kost dan geld, en meer
       verkopen maakt het erger in plaats van beter. Dit is de enige toets die
       geen scenario nodig heeft: hij is waar bij elk volume. */
    function onderKostprijs(i) {
      const { prijs, kostprijs } = i.idee;
      if (!(prijs >= 0 && kostprijs >= 0) || prijs > kostprijs) return null;
      return bevinding('onder-kostprijs', 'blokkerend',
        'U verkoopt onder uw kostprijs.',
        'Uw prijs is ' + prijs + ' en uw kostprijs is ' + kostprijs + '. Elke verkoop kost u geld, en harder werken maakt het verlies groter.',
        'Verhoog de prijs of verlaag de kostprijs voordat u begint. Volume lost dit niet op.');
    },

    /* De kas duikt in het BASISscenario onder nul: het plan houdt geen jaar
       vol op de eigen aannames van de ondernemer. */
    function kasOp(i, sim) {
      const b = sim.scenarios.basis;
      if (b.runwayMaanden === null) return null;
      return bevinding('kas-op', 'blokkerend',
        'Uw geld is op in maand ' + b.runwayMaanden + '.',
        'In uw eigen basisscenario staat de kas na ' + b.runwayMaanden + ' maanden onder nul. Dit is dus niet het sombere geval, maar het geval dat u zelf verwacht.',
        'Verlaag de vaste lasten, verhoog de prijs, of zorg voor meer startkapitaal of een kredietruimte.');
    },

    /* Hetzelfde in het slechte scenario: geen blokkade, wel een zware. Een
       plan dat alleen overleeft als alles meezit, is geen plan. */
    function kasOpSlecht(i, sim) {
      const s = sim.scenarios.slecht;
      if (s.runwayMaanden === null) return null;
      if (sim.scenarios.basis.runwayMaanden !== null) return null; // dan is 'kas-op' al blokkerend
      return bevinding('kas-op-slecht', 'zwaar',
        'Bij een tegenvaller is uw geld op in maand ' + s.runwayMaanden + '.',
        'Verkoopt u een derde minder dan u verwacht, dan komt de kas in maand ' + s.runwayMaanden + ' onder nul. Uw plan heeft geen ruimte voor tegenslag.',
        'Zorg voor een buffer die minstens drie maanden vaste lasten dekt.');
    },

    /* Een dunne marge betekent dat elke tegenvaller direct verlies is. */
    function dunneMarge(i, sim) {
      const m = sim.scenarios.basis.jaar.margePercentage;
      if (m === null || m >= MARGE_LAAG) return null;
      return bevinding('dunne-marge', 'zwaar',
        'Uw brutomarge is ' + m + '%.',
        'Onder ' + MARGE_LAAG + '% is er geen ruimte voor een prijsstijging bij uw leverancier, een misgelopen opdracht of een klant die te laat betaalt.',
        'Kijk of u de prijs kunt verhogen of goedkoper kunt inkopen. Een paar procent marge is hier veel geld.');
    },

    /* Vaste lasten die de brutomarge opeten. */
    function zwareVasteLasten(i, sim) {
      const j = sim.scenarios.basis.jaar;
      if (j.brutomarge <= 0) return null; // dan slaat dunneMarge of kasOp al aan
      const deel = Math.round((j.vasteLasten / j.brutomarge) * 100);
      if (deel < 70) return null;
      return bevinding('vaste-lasten', deel >= 100 ? 'zwaar' : 'licht',
        'Uw vaste lasten zijn ' + deel + '% van uw brutomarge.',
        'Van elke euro marge gaat ' + deel + ' cent op aan lasten die doorlopen of u nu verkoopt of niet.',
        'Kijk wat er variabel kan: huren in plaats van kopen, per opdracht inhuren in plaats van vast.');
    },

    /* Afhankelijkheid van één klant. */
    function eenKlant(i) {
      const d = i.idee.grootsteKlantDeel;
      if (!(d >= KLANT_GROOT)) return null;
      return bevinding('een-klant', d >= 60 ? 'zwaar' : 'licht',
        'Eén klant is ' + d + '% van uw omzet.',
        'Als die klant vertrekt, verdwijnt ' + d + '% van uw inkomsten in één keer. Dat is geen klant meer maar een werkgever zonder ontslagbescherming.',
        'Werk aan een tweede en derde klant vóórdat u afhankelijk bent, niet erna.');
    },

    /* Te weinig tijd. */
    function weinigUren(i) {
      const u = i.persoon.urenPerWeek;
      if (!(u > 0 && u < UREN_WEINIG)) return null;
      return bevinding('weinig-uren', 'licht',
        'U rekent op ' + u + ' uur per week.',
        'Onder ' + UREN_WEINIG + ' uur per week is er nauwelijks tijd voor het werk zelf, laat staan voor verkoop en administratie.',
        'Begin bewust klein en verwacht een lange aanloop, of maak meer tijd vrij.');
    },

    /* Een drukke markt zonder onderscheid. Deze leunt op de kansverkenning,
       en slaat dus alleen aan als die is gemeten -- niet meten is hier geen
       reden om iets te beweren. */
    function geenOnderscheid(i, sim, kans) {
      if (!kans) return null;
      const c = (kans.bronnen || []).find(b => b.id === 'concurrentie');
      if (!c || !c.gemeten || c.waarde < 9) return null;
      if (i.idee.onderscheid && i.idee.onderscheid.length >= 15) return null;
      return bevinding('geen-onderscheid', 'zwaar',
        'Drukke markt, en u heeft nog geen onderscheid opgeschreven.',
        'Er zijn ' + c.waarde + ' vergelijkbare zaken in deze plaats. Zonder duidelijk verschil concurreert u op prijs, en dat wint de grootste.',
        'Schrijf op waarom een klant voor u kiest en niet voor de andere ' + c.waarde + '.');
    },

    /* Eenmalige verkoop zonder verkoopervaring: dan moet u elke maand opnieuw
       aan nul beginnen. */
    function altijdOpnieuw(i) {
      if (i.idee.verkoopmodel !== 'eenmalig') return null;
      if (i.persoon.verkoopervaring) return null;
      return bevinding('altijd-opnieuw', 'licht',
        'Eenmalige verkoop, zonder verkoopervaring.',
        'Bij eenmalige verkoop begint u elke maand weer bij nul klanten, en verkopen is het werk waar u het minst ervaring mee heeft.',
        'Overweeg onderhoud, een abonnement of een servicecontract naast de eenmalige verkoop.');
    }
  ];

module.exports = { TOETSEN, MARGE_LAAG, KLANT_GROOT, UREN_WEINIG, bevinding };
