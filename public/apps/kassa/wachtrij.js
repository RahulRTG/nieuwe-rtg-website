/* RTG Kassa: DE BON DIE NIET WEG KON.

   HORECA.md zegt dat elke locatie moet blijven werken zonder internet. Viel de
   verbinding weg, dan gaf `pos/sale` een netwerkfout, verdween de bon en telde
   de omzet nooit mee. Een kassa die bij een haperende lijn stilstaat, dwingt
   een zaak om op papier te gaan werken -- en dat papier komt zelden terug in de
   boekhouding.

   HET GEVAARLIJKE DEEL IS NIET DE WACHTRIJ MAAR DE HERHALING. Een wachtrij is
   per definitie iets dat opnieuw verstuurt, en `pos/sale` ontdubbelde niets:
   twee keer versturen gaf twee bonnen, twee keer voorraadafboeking en twee
   facturen. Die kant is eerst gerepareerd (kern/kassa/herhaling.js,
   test/kassa-herhaling.test.js); pas daarna mocht dit bestaan.

   DE MECHANIEK ZELF STAAT SINDS 23 AUGUSTUS 2026 IN /shared/wachtrij.js. Toen
   de horeca ook een rij nodig had, waren er twee mogelijkheden: een tweede rij
   schrijven, of erkennen dat "werk dat niet weg kon" overal hetzelfde probleem
   is. Twee rijen lopen uiteen op de dag dat iemand er een repareert (LAT-regel
   4). Wat hier overblijft is wat ALLEEN voor de kassa geldt:

   1. DE SLEUTEL WORDT EEN KEER GEMAAKT, bij het afrekenen in kassa.html, en
      gaat MEE de wachtrij in. Wie hem bij elke poging opnieuw maakt, heeft geen
      idempotentie maar een generator van dubbele omzet.
   2. RTG PAY GAAT NOOIT IN DE WACHTRIJ. Contant geld ligt in de la en pin gaat
      buiten ons om; die zijn echt gebeurd en mogen later aankomen. Een
      RTG-betaalcode moet gecontroleerd worden op het moment zelf -- een bon
      "afgerekend" noemen terwijl niemand weet of de code geldig was, is een
      belofte die we niet kunnen waarmaken.

   WAT DIT NIET REPAREERT. De tijd op de bon blijft de tijd van AANKOMST bij de
   server; het moment waarop de kassa hem opstelde reist mee als `offlineVanaf`
   en staat op de bon, maar bepaalt niets. De client mag de datum van omzet niet
   kunnen kiezen -- dat is precies de knop waarmee je een dagrapport verplaatst. */
(function () {
  'use strict';
  // alleen deze betaalwijzen mogen wachten; zie regel 2 hierboven
  var MAG_WACHTEN = ['contant', 'pin', 'tafel'];
  var W = null;

  window.RTGKassaWachtrij = {
    zet: function (token, bijWijziging) {
      W = window.RTGWachtrij.maak({
        naam: 'rtg_kassa_wachtrij', pad: '/api/supplier/pos/sale', token: token,
        mag: function (body) { return MAG_WACHTEN.indexOf(body.method) >= 0; },
        vol: 'De wachtrij zit vol (' + window.RTGWachtrij.MAX + ' bonnen). Herstel eerst de verbinding.'
      });
      W.start(bijWijziging);
    },
    zaak: function (naam) { return W && W.zaak(naam); },
    rij: function () { return W ? W.rij() : []; },
    vastgelopen: function () { return W ? W.vastgelopen() : []; },
    vreemd: function () { return W ? W.vreemd() : []; },
    stand: function () { return W ? W.stand() : { wacht: 0, vast: 0, vreemd: 0, vreemdeZaak: null }; },
    verstuur: function (body) { return W.verstuur(body); },
    leeg: function () { return W ? W.leeg() : Promise.resolve(); },
    vergeet: function (i) { return W && W.vergeet(i); }
  };
})();
