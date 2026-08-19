/* Kern-module "plaats": DE PLAATSLAAG (zie PLAATS.md).

   In één zin: RTG weet wát je nodig hebt zonder te weten wáár je bent geweest.

   WAAROM DEZE LAAG BESTAAT. Er lag al veel: een eigen wegennet met A*-router
   (kern/navigatie), één geografische waarheid met echte geometrie
   (kern/stadsweefsel/geografie.js), en ruim honderd kernmodules die coördinaten
   dragen. Wat er níét lag was een laag: de positie woonde op minstens vier
   plekken die niets van elkaar wisten -- db.data.ontmoetPosities, db.data
   .veilig.plek, opdracht.positie in mobiliteit, en db.data.live/rides bij
   vervoer -- elk met een eigen bewaarregel, en geen van vieren in
   server/bewaarbeleid.js. geografie.js schrijft zelf op waarom dat misgaat:
   "Twee plekken die dezelfde waarheid vasthouden lopen uiteen."

   Twee dingen konden daardoor niet bestaan. Er was geen HEK: inVlak() werd
   alleen gebruikt om te vrágen in welke zone een punt ligt, nooit om iets te
   laten gebeuren als iemand er binnenkomt -- terwijl prikklok, patrouille,
   dispatch-SLA, aankomst en bezorgvolg allemaal hekken zijn. En de VOORSPELLER
   kende geen plaats: kern/voorspel leert uitsluitend uit payBoekingen, dus hij
   weet wanneer en wat, nooit waar.

   DE VORM. Vier begrippen, en het is belangrijk dat het er vier zijn en geen
   veld met coördinaten:

     hek         een gebied met een naam en een DOEL (./hekken.js)
     venster     de toestemming, met een einde erin (./venster.js)
     waarneming  dat een hek is gepasseerd, met de tijd -- meer niet
     actielog    wat er is waargenomen; groeit aan, wordt nooit herschreven

   DE HARDE GRENS: OP HET TOESTEL EERST. De hek-motor draait in de browser
   (public/shared/plaats.js). Hekken zijn plaatsen en geen personen, dus die
   lijst mag naar het toestel; wat gevoelig is, is welk lid waar staat, en dat
   blijft daar. De server hoort alleen { hek, binnen|buiten, tijd }. De
   waarneemroute WEIGERT dan ook een verzoek waar een lat of lng in staat --
   niet negeert, weigert -- want een veld dat je stil weggooit staat er over een
   half jaar weer in.

   WAT DEZE LAAG NIET DOET, en niet mag gaan doen: zelf handelen. Het werkwoord
   van de vierde laag is KLAARZETTEN, nooit DOEN (PLAATS.md par. 3, in lijn met
   LIFE.md). Een hek opent geen deur, sluit geen dienst af en verplaatst geen
   geld; het meldt dat er iets is gepasseerd, en een mens bevestigt.

   Krijgt db, save, crypto en de weefsel-api. Na kern/navigatie en
   kern/stadsweefsel gemount (het leest hun geometrie). */
'use strict';

module.exports = function maakPlaats({ db, save, crypto, weefsel, navPoi }) {
  const hek = require('./hekken')({ db, weefsel, navPoi });
  /* Drie delen, en de knip loopt langs drie onderwerpen: WAT ER LIGT en hoe het
     weggaat (opslag), de TOESTEMMING (venster), en WAT ERBINNEN VALT
     (waarnemen). De opslag gaat er als eerste in en wordt door de andere twee
     gedeeld -- drie kopieen van "een waarneming leeft zolang haar venster
     leeft" lopen uiteen. */
  const opslag = require('./opslag')({ db, save, crypto });
  const vst = require('./venster')({ db, save, opslag, DOELEN: hek.DOELEN });
  const wrn = require('./waarnemen')({ db, save, opslag, kentHek: hek.kentHek });

  return {
    /* De naam `plaats` op de kern is het hele koppelvlak. Een domein dat
       aanwezigheid wil weten, vraagt het hier en houdt geen eigen positie bij --
       dat is precies de vijfde opslag die deze laag moet voorkomen. */
    plaats: {
      DOELEN: hek.DOELEN,
      // wat het toestel ophaalt om lokaal mee te kunnen rekenen
      plaatsHekken: (doel) => hek.hekkenVoor(doel),
      // toestemming met een einde
      plaatsVensterOpen: (codenaam, v) => vst.vensterOpen(codenaam, v),
      plaatsVensterSluit: (codenaam, doel) => vst.vensterSluit(codenaam, doel),
      // de uitkomst van de motor op het toestel
      plaatsWaarneem: (codenaam, w) => wrn.waarneem(codenaam, w),
      // zelf-inzage: alles wat RTG nu van mij weet over plaats
      plaatsStand: (codenaam) => wrn.stand(codenaam),
      /* Voor andere domeinen: binnen of buiten, met een tijd. Dit is met opzet
         het enige dat een domein (en dus een werkgever) krijgt -- grens 4 uit
         PLAATS.md. Geen coördinaat, en ook niet hoe ver erbuiten. */
      plaatsAanwezig: (codenaam, doel, hekId) => wrn.aanwezig(codenaam, doel, hekId),
      plaatsRuim: () => opslag.ruim()
    }
  };
};
