/* ============================================================================
   DE LAATSTE ONVERKLAARDE BEPROEFBARE ROUTES -- deel 3.

   WAAR DEZE VANDAAN KOMEN. Toen scripts/lib/idemmeting.js de meting als tweede
   grond onder een formele status legde, viel NOG_NIET_GECLASSIFICEERD van 3604
   naar 27. Wat overbleef was een scherp omschreven groep: routes waarvan de
   idemproef zegt dat de oproep SLAAGDE en de opslag NIET veranderde, gemeten
   met een inhoudsafdruk (RTG_STAATLOG=2, dus ook geen wijziging op zijn
   plaats).

   EN WAAROM DIE GROEP NIET AUTOMATISCH `leest: true` KREEG. Een oproep die
   slaagt en niets verandert kan een leesroute zijn, of een route die deze keer
   niets te doen had. Dat verschil is een besluit en geen waarneming -- en het
   was hier geen theorie. Drie van de dertig zagen er in de meting precies zo
   uit als een leesroute en zijn het niet:

     /api/bank/akkoord   schrijft het akkoord weg en OPENT een betaalrekening
                         (kern/bank/rekeningen.js: store[c] = ... ; save()).
                         Hij deed niets omdat het lid al akkoord was.
     /api/bank/veeg      VERPLAATST GELD naar de spaarpot (boekAsync). Hij gaf
                         geveegdCenten: 0 omdat er die maand niets te vegen was.
     /api/podium/weg     haalt de kijker uit het kanaal en herstelt de boom
                         (kern/podium/kanaal.js: delete + save()).

   Wie deze drie op de waarneming had afgevinkt, had een geldverplaatsing als
   leesroute in het register gezet. Vandaar dat de meting een status geeft en
   nooit een verklaring: deze regels zijn stuk voor stuk uit de BRON gelezen.

   De uitleg over de vier vormen staat in ./idemsleutels.js en hoort daar; twee
   koppen met dezelfde regels lopen uiteen (LAT.md regel 4). */
'use strict';

module.exports = {
  /* ---- routes die niets veranderen: nagelopen in de handler en de kern ---- */

  // de bank, leeskant (server/routes/bank.js, server/routes/bankhart.js)
  'POST /api/bank/overzicht': { leest: true },        // bankLedenOverzicht: een scherm
  'POST /api/bank/rekening': { leest: true },         // rekeningDetail
  'POST /api/bank/afschrift': { leest: true },        // afschrift, met limit/offset
  'POST /api/bank/afschrift.csv': { leest: true },    // hetzelfde afschrift als CSV
  'POST /api/bank/passen': { leest: true },           // bankPassen
  'POST /api/bank/terugkerend': { leest: true },      // bankTerugkerend: de lijst
  'POST /api/bank/rente-voorbeeld': { leest: true },  // een rekensom op een bedrag, raakt niets
  'POST /api/bank/hart': { leest: true },             // bankHart
  'POST /api/bank/inzichten': { leest: true },        // bankInzichten
  'POST /api/bank/vastelasten': { leest: true },      // bankVasteLasten

  // betalen en facturen, leeskant
  'POST /api/betaal/mijn': { leest: true },           // dpMijnBetalingen
  // pay/portefeuille, pay/graaf en pay/terugstand stonden hier ook, met dezelfde
  // verklaring; ze wonen in ./idemsleutels-geld.js en een route mag maar in EEN
  // zijbestand staan (./idemsleutels-eenmaal.js).
  'POST /api/betaal/verzoeken': { leest: true },      // dpVerzoekenVoor
  'POST /api/facturen/overzicht': { leest: true },    // ledenInvoices, gefilterd op jaar

  // RTG Pay, leeskant
  'POST /api/pay/overzicht': { leest: true },         // pay.overzicht
  'POST /api/pay/tegoed': { leest: true },            // tegoedOverzicht -- kijken kost niets
  'POST /api/pay/tiks': { leest: true },              // tikFeed

  'POST /api/podium/mijn': { leest: true },           // podiumMijn
  'POST /api/pakket/typen': { leest: true },          // een vaste lijst bedrijfstypen

  /* De exports. Alle vier zijn POST met het token in de kop en niet in de
     querystring -- de reden staat bij de routes zelf. Ze schrijven een CSV of
     een PDF naar het antwoord en raken de opslag niet. */
  'POST /api/office/export.csv': { leest: true },
  'POST /api/supplier/dagrapport.csv': { leest: true },
  'POST /api/supplier/rides.csv': { leest: true },
  'POST /api/supplier/finance/export': { leest: true },

  /* ---- en de vier die WEL iets doen ---- */

  'POST /api/bank/akkoord': { nietIdempotent: true,
    waarom: 'de kern ontdubbelt zelf op STAND (kern/bank/rekeningen.js: alHad, en de zakelijke rekening komt er ' +
      'maar een keer bij); het tweede antwoord zegt dan met recht zakelijk: null. Een afgespeeld eerste antwoord ' +
      'zou beweren dat er opnieuw een rekening is geopend -- test/bankhart.test.js houdt dat vast' },
  // ^ Stond hier eerst als zelfdeVerzoek, en dat las mooi: een leeg lijf, dus
  //   elke tweede oproep is woordelijk hetzelfde verzoek. Maar de poort speelt
  //   dan het EERSTE antwoord af, met de rekening erin, en het lid ziet een
  //   tweede opening die nooit is gebeurd. De kern is er al tegen bestand; de
  //   poort hoort hier zijn mond te houden (zie ./idemsleutels-nooit.js over
  //   het antwoord dat loog over wat er gebeurd was).

  'POST /api/bank/bevries': { velden: ['iban', 'aan'] },
  // ^ een stand zetten op EEN rekening: iban en aan bepalen samen de handeling.
  //   Twee keer "bevries deze rekening" is een keer bevriezen.

  'POST /api/bank/veeg': { nietIdempotent: true,
    waarom: 'een RONDE (zie ./idemsleutels-kaleronde-b.js): de kern houdt per maand bij wat er al geveegd is ' +
      '(bankWisselgeld) en de tweede veeg vindt met recht 0 -- dat is het bewijs dat de eerste werkte. Een ' +
      'afgespeeld eerste antwoord zou 50 cent melden die niet opnieuw zijn verplaatst; test/bankhart.test.js ' +
      'houdt de 0 vast' },
  // ^ Stond hier eerst als zelfdeVerzoek: een dubbeltik op een geldverplaatsing,
  //   precies waar deze laag voor is. Alleen verplaatst de tweede veeg niets --
  //   de kern rekent per maand -- en het afgespeelde antwoord loog daarover.

  'POST /api/podium/weg': { velden: ['id'] },
  // ^ weggaan bij een kanaal. De kern geeft ok terug als je er al niet meer in
  //   zit, maar herstelt daarbij wel de kijkersboom; twee keer weggaan is een
  //   keer weggaan.

  'POST /api/bank/advies': { zelfdeVerzoek: true }
  // ^ dezelfde vraag binnen het venster is een dubbeltik, geen tweede vraag.
  //   Deze route roept een model aan (kern/bank/advies.js); een herhaling
  //   opslikken scheelt een modelaanroep en verliest niets, want het advies
  //   gaat over dezelfde stand.
};
