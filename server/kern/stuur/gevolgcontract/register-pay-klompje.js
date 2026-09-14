/* HET GEVOLGCONTRACT VAN HET KLOMPJE VRAGEN -- en dit pad verplaatst GEEN geld.

   EIGEN DEEL OM PRECIES DAT VERSCHIL. Een klompje vragen zet alleen iets klaar dat een ANDER
   mens nog moet bevestigen; pas het voldoen beweegt geld, en dat staat in
   ./register-pay-klompje-betaal.js. Dat is het onderscheid waar `VOORSTEL_MAKEN` voor bestaat
   in kern/isolatie/effectwoorden.js, en dit is de eerste plek in het huis waar dat werkwoord
   door een contract wordt gebruikt.

   WAAROM /api/pay/verzoek/intrek NERGENS STAAT, en dat is een vondst en geen nalatigheid.
   kern/stuur/gevolg.js meldt voor dat pad `payVerzoeken`, `payIdem` EN `payIdemAfdruk` als
   gemeten -- maar verzoekIntrek() in kern/pay/verzoeken.js roept geen metIdem aan en de route
   geeft geen sleutel mee. Die twee idem-collecties zijn vrijwel zeker bewogen tijdens de
   VOORBEREIDING van de proef, die het klompje eerst langs /api/pay/verzoek aanmaakt -- en dat
   pad schrijft ze wel.

   Dat legt een grens van de keuring bloot: ./keuring.js toetst of de proef een collectie ooit
   bij dit pad zag bewegen, niet of zij door de HANDELING bewoog. Een `gemeten` claim op
   payIdem bij intrek zou er dus doorkomen en toch onwaar zijn. Liever geen contract dan een
   contract dat de meting verkeerd citeert; hij komt terug zodra de toerekening per handeling
   is nagerekend.
   ========================================================================== */
'use strict';

const KLOMPJE = Object.freeze({
  '/api/pay/verzoek': {
    capability: '/api/pay/verzoek',
    classificatie: 'persoonsgegeven',
    streefstand: 'er staat voor elk genoemd lid een open klompje met hetzelfde bedrag per ' +
      'persoon, en niemand is iets afgeschreven',
    /* GELD_BEWEGEN STAAT IN NOOIT, en dat is de hele reden dat dit pad een eigen contract
       heeft: verzoekMaak schrijft alleen klompje-rijen. Het geld beweegt pas bij
       /api/pay/verzoek/betaal hieronder, en daar staat het werkwoord dan ook.
       UITGAANDE_AANROEP ook: er komt geen aanbieder aan te pas -- zorgSaldo wordt hier niet
       aangeroepen, want er is niets te dekken. */
    veroorzaakt: ['VOORSTEL_MAKEN', 'SCHRIJVEN_EIGEN'],
    nooit: ['GELD_BEWEGEN', 'UITGAANDE_AANROEP', 'EXTERN_BEREIKEN', 'RECHT_VERLENEN',
      'IDENTITEIT_WIJZIGEN', 'DERDENCODE_UITVOEREN', 'ONVERTROUWDE_BYTES',
      'BEVEILIGING_VERZWAKKEN', 'BULK_UITVOER', 'PLAFOND_WIJZIGEN'],
    voorwaarden: [
      { wat: 'een ledensessie; een gast komt er niet in', bron: 'geenGast in routes/pay.js' },
      { wat: 'minstens een en hoogstens tien BESTAANDE codenamen, en niet de eigen',
        bron: 'kern/pay/verzoeken.js: de lijst wordt ontdubbeld, op 10 afgekapt, en elke naam ' +
          'langs bestaatLid() -- anders 404 met de naam erbij' },
      { wat: 'een bedrag per persoon tussen het minimum en het maximum',
        bron: 'per = perCenten, of het totaal gedeeld door het aantal (plus jezelf bij splitsMetMij)' }
    ],
    gevolgen: [
      { soort: 'direct', graad: 'gemeten', collectie: 'payVerzoeken',
        wat: 'er komt per genoemd lid een open klompje bij, met een gedeelde groepscode',
        reden: 'de idempotentieproef zag deze collectie veranderen' },
      { soort: 'direct', graad: 'gemeten', collectie: 'payIdem',
        wat: 'de sleutel wordt vastgelegd zodat twee klompjes van hetzelfde bedrag niet ' +
          'allebei ontstaan',
        reden: 'gemeten in dezelfde ronde. De afdruk draagt de ONTVANGERS en het bedrag per ' +
          'persoon en niet de omschrijving, zodat vrije tekst geen 409 veroorzaakt' },
      { soort: 'direct', graad: 'gemeten', collectie: 'payIdemAfdruk',
        wat: 'de afdruk van het antwoord wordt bewaard voor een tweede tik',
        reden: 'gemeten in dezelfde ronde' },
      { soort: 'afgeleid', graad: 'vermoed',
        wat: 'elk gevraagd lid ziet in zijn app dat er iets veranderd is, zonder te zien wat',
        reden: 'seintje() per naam: een SSE-tik met alleen `{scope:\'pay\'}`; de inhoud haalt zijn ' +
          'app zelf op, en zonder open sessie gebeurt er niets' },
      { soort: 'afgeleid', graad: 'vermoed',
        wat: 'de lijst klompjes wordt op 5000 afgekapt, dus heel oude rijen verdwijnen',
        reden: 'kern/pay/verzoeken.js kapt na het toevoegen af; dat is geen bewaartermijn maar een plafond' },
      { soort: 'buiten', graad: 'onbekend',
        wat: 'of de gevraagde mensen het klompje ook echt betalen, en wanneer',
        reden: 'dat is hun handeling en niet deze; dit pad zet alleen klaar' },
      { soort: 'mislukking', graad: 'vermoed',
        wat: 'is een van de namen onbekend, dan ontstaat er GEEN enkel klompje -- ook niet voor de ' +
          'namen die wel bestaan',
        reden: 'de lus met bestaatLid() staat VOOR metIdem, dus de 404 valt voordat er iets wordt ' +
          'geschreven' }
    ],
    onzeker: [
      { wat: 'of dit de gegevens van iemand anders VERANDERT',
        reden: 'het klompje is een nieuwe rij en geen wijziging van iets dat de ander al had, maar hij ' +
          'verschijnt wel in zijn beeld en vraagt iets van hem. SCHRIJVEN_ANDERMANS staat daarom in ' +
          'GEEN van beide lijsten: `nooit` zou een garantie zijn die ik niet kan geven, en ' +
          '`veroorzaakt` een bewering die de woordenlijst niet dekt. vergelijk() meldt dat als GAT, ' +
          'en dat is hier het eerlijke antwoord' }
    ],
    raakt: { objecten: ['eigen klompjeslijst', 'de klompjeslijst van maximaal tien andere leden'] },
    herstel: { bron: 'HERSTELPROEF.json',
      reden: 'niet verklaard maar gemeten; /api/pay/verzoek/intrek zet een open klompje op ' +
        'ingetrokken, en dat is een compensatie en geen wissen -- de rij blijft staan' },
    nagekeken: 'Claude (Opus 5), 2026-09-13: drie gemeten collecties uit kern/stuur/gevolg.js, de ' +
      'poorten en de afkapgrens uit kern/pay/verzoeken.js; niet door een mens nagelezen'
  },

  /* ------------------------------------------------------------------------
     VOLDOEN: een klompje betalen dat iemand anders heeft gevraagd.
     ---------------------------------------------------------------------- */
});

module.exports = { KLOMPJE };
