/* RTG Horeca: VENUE EDGE -- de bestelling die altijd opgenomen kan worden.

   HORECA.md eist dat elke locatie blijft werken zonder internet. De kassa had
   dat al (apps/kassa/wachtrij.js); de zaal en de PDA niet, en daar zat een
   echte reden onder: een KASSABON is één verzoek, maar een REKENING leeft over
   tientallen aanroepen -- openen, regel, regel, stoel, gang vrijgeven, betalen.
   Opnieuw versturen lost daar niets op.

   DE UITWEG IS NIET ALLES OFFLINE MAKEN MAAR KIEZEN WAT ER ECHT TOE DOET.
   Zonder lijn is niet elke handeling even erg:

     opnemen          ALS DIT MISGAAT IS DE BESTELLING WEG. De gast heeft
                      besteld, de bediening liep naar het scherm, en er staat
                      niets. Dit is het enige dat een avond werkelijk breekt.
     gang vrijgeven   zinloos zonder lijn: het keukenscherm is óók offline. Zodra
                      de lijn terug is, geeft de zaal hem gewoon vrij -- en dan
                      met de kennis van dát moment, wat beter is.
     standen zetten   idem: de keuken die het bord zou lezen, is er niet.
     verzoeken        de telefoon van de gast is ook offline; er komt niets
                      binnen om op te pakken.
     betalen          gaat over geld en over een tweede weg waarlangs het
                      beweegt. Dat is een eigen besluit en geen bijvangst.

   Dus doet deze laag ÉÉN ding, en dat goed: een bestelling die zonder lijn is
   opgenomen, blijft op het toestel staan en gaat als GEHEEL weg zodra de lijn
   terug is. De mechaniek komt uit /shared/wachtrij.js -- dezelfde die de kassa
   gebruikt, want twee rijen lopen uiteen op de dag dat iemand er een repareert.

   DRIE DINGEN DIE HIER ANDERS ZIJN DAN BIJ DE KASSA:

   1. HET PAKKET IS EEN HELE BESTELLING, geen bon. Tafel, gasten, en de regels
      met hun gang, station, stoel en ALLERGIE. Die allergie is de reden dat de
      serverkant twee soorten kent: een opgenomen bestelling komt binnen als
      `besteld` en niet als `uitgegeven`, want de keuken moet hem nog maken.
   2. ER WORDT NIETS VRIJGEGEVEN. De bestelling landt op de rekening en blijft
      daar staan tot de zaal hem doorstuurt. Tussen het opnemen en het
      terugkeren van de lijn kan er van alles veranderd zijn.
   3. DE SLEUTEL IS DE BESTELLING, niet de poging. `clientId` wordt gemaakt op
      het moment dat de bediening op "opnemen" drukt, en nooit meer opnieuw. */
(function () {
  'use strict';
  var K = window.RTGHoreca;
  var W = null;

  window.RTGHorecaEdge = {
    zet: function (token, bijWijziging) {
      W = window.RTGWachtrij.maak({
        naam: 'rtg_horeca_edge', pad: '/api/supplier/horeca/offline/sync', token: token,
        /* Alleen opgenomen bestellingen mogen wachten. Een pakket met een
           betaling erin hoort hier niet: dat is een eigen besluit (zie de kop). */
        mag: function (pakket) {
          var b = (pakket.bonnen || [])[0] || {};
          return b.soort === 'opgenomen' && !b.betaald;
        },
        vol: 'De wachtrij van dit toestel zit vol. Herstel eerst de verbinding.'
      });
      W.start(bijWijziging);
    },
    zaak: function (naam) { return W && W.zaak(naam); },
    rij: function () { return W ? W.rij() : []; },
    vastgelopen: function () { return W ? W.vastgelopen() : []; },
    stand: function () { return W ? W.stand() : { wacht: 0, vast: 0, vreemd: 0, vreemdeZaak: null }; },
    leeg: function () { return W ? W.leeg() : Promise.resolve(); },

    /* Een opgenomen bestelling wegzetten. `clientId` komt van de aanroeper en is
       daar EEN keer gemaakt -- hier wordt hij nooit gezet, want dan zou hij bij
       elke poging anders zijn (regel 3). */
    neemOp: function (bestelling) {
      return W.verstuur({ bonnen: [Object.assign({ soort: 'opgenomen' }, bestelling)] });
    }
  };
})();
