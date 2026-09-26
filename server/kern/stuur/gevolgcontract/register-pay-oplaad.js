/* HET GEVOLGCONTRACT VAN HET OPLADEN -- geld van een kaart naar de eigen wallet.

   APART VAN ./register-pay-stuur.js, en de naad is echt: opladen is het enige pad van de
   wallet waar een partij BUITEN RTG aan te pas komt (de betaalaanbieder), en sturen het
   enige dat de gegevens van een ANDER lid verandert. Dat zijn twee verschillende
   gevolgprofielen -- en samen gingen ze door de omvangband van keuringsregel 13.

   Naast deze twee: ./register-lid.js is de uitgaande SEPA (geld verlaat het huis naar een
   bank) en ./register-pay-factuur.js de maandfactuur uit het saldo (RTG als tegenpartij).

   ELKE `gemeten` COLLECTIE HIERONDER IS NAGEREKEND tegen kern/stuur/gevolg.js; de keuring in
   ./keuring.js weigert een `gemeten` claim die de proef nooit zag. Wat de proef NIET kon
   zien staat er met de graad `vermoed` en met de reden waarom -- niet weggelaten, want een
   gevolg dat je weglaat leest als een gevolg dat er niet is.
   ========================================================================== */
'use strict';

const OPLAAD = Object.freeze({
  '/api/pay/oplaad': {
    capability: '/api/pay/oplaad',
    classificatie: 'persoonsgegeven',
    streefstand: 'het opgegeven bedrag staat als saldo in de wallet van het lid, en de kaart ' +
      'is voor datzelfde bedrag belast -- of geen van beide',
    /* SCHRIJVEN_ANDERMANS staat in NOOIT: het geld komt van de kaart van het lid zelf en
       landt op zijn eigen walletrekening. Er is geen tweede lid in deze handeling.
       EXTERN_BEREIKEN ook: er gaat geen mail, sms of push uit -- nagelezen in
       kern/pay/opladen.js, en het enige seintje in de pay-kern (kern/pay/kijken.js) is een
       SSE-tik naar de eigen open app met alleen `{scope:'pay'}` erin. */
    veroorzaakt: ['GELD_BEWEGEN', 'SCHRIJVEN_EIGEN', 'UITGAANDE_AANROEP'],
    nooit: ['SCHRIJVEN_ANDERMANS', 'EXTERN_BEREIKEN', 'RECHT_VERLENEN', 'IDENTITEIT_WIJZIGEN',
      'DERDENCODE_UITVOEREN', 'ONVERTROUWDE_BYTES', 'BEVEILIGING_VERZWAKKEN', 'BULK_UITVOER'],
    voorwaarden: [
      { wat: 'een echt account (een anonieme demo-gast heeft geen wallet)', bron: 'geenEchtAccount in routes/pay.js' },
      { wat: 'eenmalig het paspoort voor een gratis account', bron: 'onboarding.payGate -- geeft kyc:true terug' },
      { wat: 'een bedrag tussen 1 en 5000 euro', bron: 'OPLAAD_MIN / MAX_CENTEN in kern/pay/opladen.js' },
      { wat: 'ruimte onder het walletplafond, GETOETST VOOR DE KAART WORDT BELAST',
        bron: 'plafondFout() staat boven metIdem -- een grens die je na de kassa ontdekt is een schadepost' }
    ],
    gevolgen: [
      { soort: 'direct', graad: 'gemeten', collectie: 'paySaldi',
        wat: 'het saldo van de eigen wallet stijgt met het bedrag',
        reden: 'de idempotentieproef zag deze collectie veranderen' },
      { soort: 'direct', graad: 'gemeten', collectie: 'payBoekingen',
        wat: 'er komt een grootboekregel bij die het lid in zijn overzicht ziet',
        reden: 'gemeten in dezelfde ronde' },
      { soort: 'direct', graad: 'gemeten', collectie: 'payIdem',
        wat: 'de sleutel wordt vastgelegd zodat een tweede tik niet dubbel oplaadt',
        reden: 'gemeten in dezelfde ronde' },
      { soort: 'direct', graad: 'gemeten', collectie: 'payIdemAfdruk',
        wat: 'de afdruk van het antwoord wordt bewaard voor die tweede tik',
        reden: 'gemeten in dezelfde ronde' },
      { soort: 'direct', graad: 'gemeten', collectie: 'betaalIdem',
        wat: 'dezelfde bescherming aan de kant van de betaal-naad',
        reden: 'gemeten in dezelfde ronde' },
      /* DE BETAALWAARHEID (MONEY-012). Opladen legt de betaling sinds 24 september
         2026 vast in kern/betaalwaarheid VOOR de aanroep; kaartWachtend krijgt geen
         nieuwe rij meer. `vermoed` en niet `gemeten`: de idempotentieproef heeft deze
         collectie nog niet opnieuw gemeten, en de keuring weigert terecht een
         `gemeten` claim die de proef nooit zag. */
      { soort: 'direct', graad: 'vermoed', collectie: 'betaalWaarheid',
        wat: 'de betaling staat vast VOOR de aanroep bij de aanbieder, met een vaste sleutel, ' +
          'zodat een verloren antwoord of een wachtende betaling niet zoekraakt',
        reden: 'kern/pay/opladen.js roept betaalWaarheid.maak en .begin aan; nog niet opnieuw gemeten' },
      { soort: 'buiten', graad: 'vermoed',
        wat: 'de aanbieder belast de kaart, weigert, of laat de betaling openstaan',
        uitkomsten: ['betaald', 'geweigerd', 'wacht-op-bevestiging'],
        reden: 'een gesloten set: de betaalwaarheid kent bevestigd, wachtend en geweigerd, en ' +
          'een 502 zonder uitsluitsel als de aanroep zelf stukloopt (dan zoekt de veegronde het na)' },
      { soort: 'afgeleid', graad: 'vermoed',
        wat: 'de ruimte onder het walletplafond krimpt met het opgeladen bedrag',
        reden: 'volgt uit het gestegen saldo; geen eigen collectie' },
      { soort: 'mislukking', graad: 'vermoed',
        wat: 'blijft de bevestiging van de aanbieder uit, dan is de kaart misschien belast en de ' +
          'wallet niet -- tot de webhook of de veegronde de betaling afmaakt, of hem na zes ' +
          'hervattingen escaleert naar een mens',
        reden: 'kern/betaalwaarheid/hervat.js; de bijschrijving gebeurt precies een keer in ' +
          'kern/pay/oplaadwaarheid.js' }
    ],
    onzeker: [
      { wat: 'hoe lang een openstaande betaling openstaat',
        reden: 'dat hangt aan de aanbieder; dit huis meet het niet en toont het daarom niet als getal' }
    ],
    raakt: { objecten: ['eigen wallet', 'eigen betaalkaart', 'de betaalaanbieder'] },
    herstel: { bron: 'HERSTELPROEF.json',
      reden: 'niet verklaard maar gemeten; een oplading heeft geen `exact` terugweg -- wat bestaat ' +
        'is de terugstorting (kern/pay/terug.js) en die is een eigen handeling' },
    nagekeken: 'Claude (Opus 5), 2026-09-13: vijf gemeten collecties uit kern/stuur/gevolg.js, de ' +
      'aflooplijst en de wachtrij-tak uit kern/pay/opladen.js; niet door een mens nagelezen'
  },

  /* ------------------------------------------------------------------------
     STUREN: geld naar een ANDER lid. De enige van de drie die de gegevens van
     iemand anders verandert.
     ---------------------------------------------------------------------- */
});

module.exports = { OPLAAD };
