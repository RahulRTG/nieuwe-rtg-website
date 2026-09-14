/* HET GEVOLGCONTRACT VAN HET KLOMPJE VOLDOEN -- betalen wat iemand anders vroeg.

   APART VAN ./register-pay-klompje.js omdat dat pad geen geld verplaatst en dit wel; zie de
   kop daar voor de naad en voor waarom /api/pay/verzoek/intrek nergens staat.
   ========================================================================== */
'use strict';

const KLOMPJE_BETAAL = Object.freeze({
  '/api/pay/verzoek/betaal': {
    capability: '/api/pay/verzoek/betaal',
    classificatie: 'persoonsgegeven',
    streefstand: 'het klompje staat op betaald en het bedrag is van de betaler naar de vrager ' +
      'gegaan -- of het klompje staat nog open en er is niets verplaatst',
    /* SCHRIJVEN_ANDERMANS HOORT HIER WEL, en zonder de twijfel van hierboven: dit boekt naar
       rekLid(v.van) (het saldo van de vrager) EN zet de status op een rij die de vrager heeft
       aangemaakt. Twee keer andermans gegevens. */
    veroorzaakt: ['GELD_BEWEGEN', 'SCHRIJVEN_EIGEN', 'SCHRIJVEN_ANDERMANS', 'UITGAANDE_AANROEP'],
    nooit: ['VOORSTEL_MAKEN', 'EXTERN_BEREIKEN', 'RECHT_VERLENEN', 'IDENTITEIT_WIJZIGEN',
      'DERDENCODE_UITVOEREN', 'ONVERTROUWDE_BYTES', 'BEVEILIGING_VERZWAKKEN', 'BULK_UITVOER',
      'PLAFOND_WIJZIGEN'],
    voorwaarden: [
      { wat: 'een ledensessie en eenmalig het paspoort', bron: 'geenGast + onboarding.payGate' },
      { wat: 'een klompje dat OP JOUW NAAM staat en nog open is',
        bron: 'kern/pay/verzoeken.js zoekt op id EN `aan === codenaam` -- anders 404 "staat niet voor ' +
          'jou open"; een al afgehandeld klompje geeft 409' },
      { wat: 'dekking, of ruimte om bij te laden', bron: 'zorgSaldo' }
    ],
    gevolgen: [
      { soort: 'direct', graad: 'gemeten', collectie: 'paySaldi',
        wat: 'het saldo van de betaler daalt en dat van de vrager stijgt',
        reden: 'de idempotentieproef zag deze collectie veranderen' },
      { soort: 'direct', graad: 'gemeten', collectie: 'payBoekingen',
        wat: 'er komt een grootboekregel bij met soort `klompje` en het klompje-id als ref',
        reden: 'gemeten in dezelfde ronde; die ref maakt de boeking terug te leiden naar het verzoek' },
      { soort: 'direct', graad: 'gemeten', collectie: 'payVerzoeken',
        wat: 'het klompje gaat van open naar betaald, met het moment erbij',
        reden: 'gemeten in dezelfde ronde' },
      { soort: 'direct', graad: 'gemeten', collectie: 'payIdem',
        wat: 'de sleutel wordt vastgelegd zodat dubbeltikken niet twee keer betaalt',
        reden: 'gemeten in dezelfde ronde' },
      { soort: 'direct', graad: 'gemeten', collectie: 'payIdemAfdruk',
        wat: 'de afdruk van het antwoord wordt bewaard voor die tweede tik',
        reden: 'gemeten in dezelfde ronde' },
      { soort: 'afgeleid', graad: 'vermoed',
        wat: 'de vrager ziet in zijn app dat er iets veranderd is',
        reden: 'seintje(v.van): een SSE-tik met alleen `{scope:\'pay\'}`' },
      { soort: 'buiten', graad: 'vermoed',
        wat: 'is er te weinig saldo, dan wordt er eerst bijgeladen langs de betaalaanbieder',
        uitkomsten: ['niet bijgeladen', 'bijgeladen', 'bijladen mislukt'],
        reden: 'zorgSaldo roept laadOp aan; het antwoord draagt `bijgeladen`' },
      { soort: 'mislukking', graad: 'vermoed',
        wat: 'mislukt het bijladen of het boeken, dan blijft het klompje OPEN staan: de status gaat ' +
          'pas na de boeking om',
        reden: 'de volgorde in kern/pay/verzoeken.js: `if (z.error) return z;` en `if (b.error) return b;` ' +
          'staan allebei VOOR `v.status = betaald`' }
    ],
    onzeker: [
      { wat: 'of de vrager het merkt', reden: 'het seintje is best effort en hangt aan een open sessie' }
    ],
    raakt: { objecten: ['eigen wallet', 'wallet van de vrager', 'het klompje van de vrager'] },
    herstel: { bron: 'HERSTELPROEF.json',
      reden: 'niet verklaard maar gemeten; een betaald klompje kan niet terug -- geld terug naar de ' +
        'betaler is een nieuwe handeling van de vrager' },
    nagekeken: 'Claude (Opus 5), 2026-09-13: vijf gemeten collecties uit kern/stuur/gevolg.js, de ' +
      'volgorde en de poorten uit kern/pay/verzoeken.js; niet door een mens nagelezen'
  }
});

module.exports = { KLOMPJE_BETAAL };
