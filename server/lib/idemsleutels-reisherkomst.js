/* HET IDEM-REGISTER, deel "reisherkomst" -- zelfde register, eigen bestand.

   Twee routes: het lid betaalt een bevestigde reis, en het kantoor draait die
   betaling terug. Ze staan naast hun mutatiecontracten in
   ./mutatiecontracten-reisherkomst.js; dat bestand zegt WAT een tweede aanroep
   doet, dit bestand zegt wat de POORT ervan moet vinden.

   ================== BEIDE OP nietIdempotent, EN DAT IS GEEN GAT ==============

   Dat lijkt tegenstrijdig met de mutatiecontracten hiernaast, die allebei
   `klasse: 'idempotent'` dragen. Dat is het niet, want het zijn twee
   verschillende vragen:

     het contract   is de STAND na twee aanroepen gelijk aan die na een?
                    Ja, bij allebei -- een boeking, een stel herkomstrijen,
                    een saldo, een teruggaverecht.
     dit register   mag de POORT het tweede antwoord vervangen door het eerste?
                    Nee, bij allebei -- en dat is de toetsvraag uit de kop van
                    ./idemsleutels.js: krijgt een woordelijk gelijke herhaling
                    een ANDER antwoord dan de eerste keer?

   Bij allebei is dat antwoord ja:

     /betaal            1e: de betaling met haar bedrag en haar rijen
                        2e: 200 met `alBetaald: true`
     /terugboeking      1e: 200 met zes spiegelrijen
                        2e: geweigerd, want deze rijen zijn al teruggedraaid

   MUTATIECONTRACT.md zegt het in een zin: een herhaling die wordt GEWEIGERD is
   een toestandscontrole en geen idempotentie. De bescherming zit in de STAND
   (`a.betaald`, en een rij die al een spiegel heeft) en niet in een sleutel.

   ================== WAAROM DAT BIJ DE TERUGBOEKING ERNSTIG IS ===============

   ./idem-poort.js bewaart alleen een GESLAAGD antwoord (2xx) en speelt dat
   terug. Zou de poort hier dedupliceren, dan kreeg de tweede terugboeking de
   200 van de eerste in plaats van de weigering -- en een medewerker die twee
   keer drukt zou lezen dat hij zojuist EEN TWEEDE keer heeft teruggeboekt
   terwijl er niets gebeurde. Dat is precies de faalvorm waar de kop van
   ./idemsleutels.js voor waarschuwt: van een weigering een bevestiging maken.

   Bij /betaal is het zachter maar dezelfde vorm: het lid hoort te lezen dat de
   reis AL betaald was, niet nog een keer de bevestiging van een afschrijving
   die het net heeft zien gebeuren.

   ================== WAT DIT NIET ZEGT ==================

   Dat een tweede aanroep werk verzet. Hij doet niets -- en dat is gemeten, over
   HTTP tegen een wegwerpserver; de uitslagen staan in de bewijsblokken van
   ./mutatiecontracten-reisherkomst.js. `nietIdempotent` betekent hier dus niet
   "een herhaling is een tweede handeling" maar "de poort blijft eraf, want de
   route weigert of meldt zelf". Zonder deze verklaring zou beide routes een GAT
   zijn in scripts/idemschuld.js, en een gat is erger dan een verklaring die een
   nuance nodig heeft. */
'use strict';

const SLEUTELS = {
  'POST /api/reisbureau/betaal': {
    nietIdempotent: true,
    waarom: 'de route beschermt zichzelf op de STAND van de aanvraag (`a.betaald`): een tweede ' +
      'poging boekt niets en geeft 200 met `alBetaald: true`. Dat tweede antwoord hoort het lid ' +
      'te bereiken; zou de poort de eerste bevestiging terugspelen, dan leest iemand die net geld ' +
      'heeft zien weggaan nog een keer dezelfde afschrijving'
  },
  'POST /api/office/reisbureau/terugboeking': {
    nietIdempotent: true,
    waarom: 'de spiegellaag weigert een rij die al een spiegel heeft, dus een tweede oproep wordt ' +
      'geweigerd met de reden erbij. De poort bewaart alleen 2xx en zou die weigering vervangen ' +
      'door de 200 van de eerste -- dan leest een medewerker dat hij een tweede keer heeft ' +
      'teruggeboekt terwijl er niets gebeurde'
  }
};

module.exports = { SLEUTELS };
