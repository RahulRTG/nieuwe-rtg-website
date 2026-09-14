/* ============================================================================
   VAN EEN KAAL DOEL NAAR EEN HANDVOL MANIEREN -- schakel 4 van de Adam-keten.

   HET GAT DAT DIT VULT. `kern/knelpunt/index.js` is een rekenmachine: hij krijgt
   MANIEREN en zegt per manier wat hem blokkeert. Zonder manieren weigert hij,
   en terecht -- er valt dan niets te vergelijken. Maar een mens zegt "ik wil
   weer aan het werk", en dat is een DOEL zonder wegen. Tot nu toe moest de
   aanroeper de wegen dus al kennen, en niemand leverde ze: scripts/adamproef.js
   schakel 4 stond daarom op `openBekend`.

   DE VORM IS BESLOTEN DOOR DE EIGENAAR (13 september 2026) en staat uitgeschreven
   in die schakel. Twee regels, en ze dragen dit hele bestand:

   1. DE MANIEREN VOLGEN UIT DE BRONNEN DIE ER ZIJN -- via werk, via opleiding,
      via opvang -- en niet uit een lijst die iemand bedenkt. Daarmee wordt er
      niets VERZONNEN: elke manier heeft een aantoonbare bron, en de zinnen
      eronder komen woord voor woord uit ./openingen-kaart.js, die gemeten is en
      niet gehoopt.

   2. HET VELD `nodig` BLIJFT LEEG. Welke voorwaarden een weg vergt, weet dit
      huis niet. Ze afleiden uit de trefwoorden van de kaart zou de motor laten
      GOKKEN welke randvoorwaarde bij welke weg hoort -- en dat is grens zes van
      de motor: hij rekent niets uit wat hij niet weet. Liever een manier zonder
      voorwaarden dan een voorwaarde die niemand heeft gemeten.

   EN DAAR ZIT DE VALKUIL DIE DIT BESTAND BIJNA IN LIEP. Een manier met een leeg
   `nodig` krijgt bij de motor de stand `open`, met de zin *"alles wat deze
   manier nodig heeft, staat volgens uw eigen opgave geregeld"*. Dat zou hier
   ronduit liegen: `nodig` is leeg omdat wij de voorwaarden NIET KENNEN, niet
   omdat er geen zijn. Dat is precies regel 2 van de motor -- niet nagegaan is
   niet vervuld -- en hij gold nog niet voor de voorwaardenLIJST zelf, alleen
   voor de standen erin. Vandaar `voorwaardenOnbekend: true` op elke manier die
   hier vandaan komt; de motor maakt er dan `onbepaald` van met de reden erbij.

   WAT DIT NIET DOET, en dat is de helft die het eerlijk houdt:

   - HIJ RAADPLEEGT DE BRONNEN NIET. Een bron levert vondsten bij een
     RANDVOORWAARDE, en bij een kaal doel is er geen randvoorwaarde om mee te
     geven. Wat hier telt is dus of een bron BEDRAAD is, niet of hij vandaag iets
     te bieden heeft -- die tweede vraag beantwoordt ./aanvoer-bronnen.js later,
     als er wel knelpunten zijn.
   - HIJ LEEST HET DOEL NIET. Er wordt niet op trefwoorden gefilterd. Wie "ik wil
     weer aan het werk" intikt, krijgt ook de opleidings- en opvangweg te zien --
     en dat is geen slordigheid maar het hele punt van het voorbeeld waar de
     motor omheen is gebouwd: *de bottleneck is niet motivatie, de bottleneck is
     kinderopvang.* Een weg wegfilteren omdat het doel er niet naar klinkt, is
     precies "dit is niets voor jou" (FOUNDATION.md par. 5.3).
   - HIJ RANGSCHIKT NIET. De volgorde is die van `TERREINEN` op de kaart, en dat
     staat in het antwoord met zoveel woorden.
   - HIJ KENT DE MENS NIET. Net als ./aanvoer-bronnen.js neemt `wegenBij()` geen
     tweede argument. Wie er een mens in wil hebben, moet deze handtekening
     veranderen, en dan is het een besluit.
   ========================================================================== */
'use strict';

const { TERREINEN, KAART } = require('./openingen');

/* De bronnen komen binnen als een lijst HERKOMSTEN -- dezelfde sleutels als
   ./aanvoer-bronnen.js krijgt. Ze worden tegen de kaart gehouden en niet
   geloofd: een herkomst die geen terrein op de kaart is, levert geen manier en
   wordt APART gemeld. Stil overslaan zou een bron onzichtbaar laten
   verdwijnen, stil doorlaten zou een manier maken zonder zinnen eronder. */
function maakWegen(herkomsten) {
  const gevraagd = Array.isArray(herkomsten) ? herkomsten.map(String) : [];

  function wegenBij() {
    const nietOpDeKaart = [];
    const bekend = new Set();
    for (const h of gevraagd) {
      if (TERREINEN.includes(h) && KAART[h]) bekend.add(h);
      else nietOpDeKaart.push({ herkomst: h, reden: 'geen terrein op de kaart; er is geen gemeten ' +
        'zin over wat dit terrein in dit huis is, en die verzinnen zou de manier een belofte maken' });
    }

    /* De volgorde is die van de KAART en niet die van de aanroeper: zo hangt de
       volgorde niet af van hoe iemand toevallig zijn bronnen opschreef. */
    const manieren = TERREINEN.filter((t) => bekend.has(t)).map((t) => ({
      id: 'via-' + t,
      wat: 'Via ' + t + ' -- ' + KAART[t].wat,
      /* LEEG, en met de vlag erbij. Zie de kop: zonder die vlag leest leeg als
         "er is niets nodig" in plaats van "wij weten niet wat er nodig is". */
      nodig: [],
      voorwaardenOnbekend: true,
      terrein: t,
      ingang: KAART[t].ingang,
      dektNiet: KAART[t].dektNiet
    }));

    return {
      manieren,
      nietOpDeKaart,
      /* Wie deze manieren heeft samengesteld, staat in het antwoord. Anders
         leest een lijst die dit huis heeft gemaakt als een lijst die de mens
         zelf opgaf -- en dan is de zin over de volgorde een onwaarheid. */
      herkomst: 'samengesteld',
      uitleg: manieren.length
        ? 'U gaf een doel en geen manieren, dus deze wegen zijn samengesteld uit de bronnen die dit ' +
          'huis werkelijk heeft aangesloten. Er is niets bij verzonnen en er is niets weggelaten op ' +
          'grond van uw doel: ook een weg die er niet bij lijkt te horen blijft staan, want dat ' +
          'oordeel is aan u.'
        : 'U gaf een doel en geen manieren, en dit huis heeft geen enkele bron aangesloten waaruit ' +
          'een weg te maken valt. Dat is iets anders dan "er zijn geen wegen": er is hier niet gekeken.'
    };
  }

  return { wegenBij };
}

module.exports = { maakWegen };
