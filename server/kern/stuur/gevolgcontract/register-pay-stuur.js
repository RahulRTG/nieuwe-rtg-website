/* HET GEVOLGCONTRACT VAN HET STUREN -- geld naar een ANDER lid.

   APART VAN ./register-pay-oplaad.js: zie de kop daar voor de naad. Dit is het enige
   walletpad dat de gegevens van iemand anders verandert, en dat is precies het werkwoord
   dat hieronder in `veroorzaakt` staat en daar niet.
   ========================================================================== */
'use strict';

const STUUR = Object.freeze({
  '/api/pay/stuur': {
    capability: '/api/pay/stuur',
    classificatie: 'persoonsgegeven',
    streefstand: 'het bedrag staat van de eigen wallet af en op de wallet van de ontvanger bij, ' +
      'in een grootboek dat na de handeling nog sluit',
    /* SCHRIJVEN_ANDERMANS HOORT HIER ECHT: boekAsync boekt `naar: rekLid(aan)`, dus het saldo
       van een ANDER lid verandert. Dat is iets anders dan hem bereiken -- daarom staat
       EXTERN_BEREIKEN in `nooit`: het seintje is een SSE-tik naar zijn open app met alleen
       `{scope:'pay'}`, en er gaat geen mail, sms of push uit (kern/pay/kijken.js).
       UITGAANDE_AANROEP staat er WEL bij, en niet omdat sturen zelf naar buiten gaat: bij
       een tekort laadt zorgSaldo eerst bij, en dat loopt langs de betaal-naad. */
    veroorzaakt: ['GELD_BEWEGEN', 'SCHRIJVEN_EIGEN', 'SCHRIJVEN_ANDERMANS', 'UITGAANDE_AANROEP'],
    nooit: ['EXTERN_BEREIKEN', 'RECHT_VERLENEN', 'IDENTITEIT_WIJZIGEN', 'DERDENCODE_UITVOEREN',
      'ONVERTROUWDE_BYTES', 'BEVEILIGING_VERZWAKKEN', 'BULK_UITVOER', 'PLAFOND_WIJZIGEN'],
    voorwaarden: [
      { wat: 'een ledensessie; een gast komt er niet in', bron: 'geenGast in routes/pay.js' },
      { wat: 'eenmalig het paspoort', bron: 'onboarding.payGate' },
      { wat: 'een BESTAANDE codenaam die niet de eigen is', bron: 'bestaatLid() -- anders 404' },
      { wat: 'dekking, of ruimte om bij te laden', bron: 'zorgSaldo in kern/pay/verzoeken.js' }
    ],
    gevolgen: [
      { soort: 'direct', graad: 'gemeten', collectie: 'paySaldi',
        wat: 'het eigen saldo daalt en dat van de ontvanger stijgt',
        reden: 'de idempotentieproef zag deze collectie veranderen; beide kanten wonen erin' },
      { soort: 'direct', graad: 'gemeten', collectie: 'payBoekingen',
        wat: 'er komt een grootboekregel bij die bij beide leden in het overzicht staat',
        reden: 'gemeten in dezelfde ronde' },
      { soort: 'direct', graad: 'gemeten', collectie: 'payIdem',
        wat: 'de sleutel wordt vastgelegd zodat dubbeltikken niet dubbel boekt',
        reden: 'gemeten in dezelfde ronde' },
      { soort: 'direct', graad: 'gemeten', collectie: 'payIdemAfdruk',
        wat: 'de afdruk van het antwoord wordt bewaard voor die tweede tik',
        reden: 'gemeten in dezelfde ronde' },
      { soort: 'afgeleid', graad: 'vermoed',
        wat: 'de ontvanger ziet in zijn app dat er iets veranderd is, zonder te zien wat',
        reden: 'seintje() stuurt via SSE alleen `{scope:\'pay\'}` naar zijn sessie; de inhoud haalt ' +
          'zijn app zelf op, en zonder open sessie gebeurt er niets (de app pollt sowieso)' },
      { soort: 'buiten', graad: 'vermoed',
        wat: 'is er te weinig saldo, dan wordt er eerst bijgeladen langs de betaalaanbieder',
        uitkomsten: ['niet bijgeladen', 'bijgeladen', 'bijladen mislukt'],
        reden: 'zorgSaldo roept laadOp aan; het antwoord draagt `bijgeladen` zodat het lid ziet ' +
          'dat er meer is gebeurd dan sturen' },
      { soort: 'mislukking', graad: 'vermoed',
        wat: 'mislukt het bijladen, dan gaat er niets van de eigen wallet af en komt er niets bij ' +
          'de ontvanger: zorgSaldo geeft zijn fout terug voordat er geboekt wordt',
        reden: 'de volgorde in kern/pay/verzoeken.js: `if (z.error) return z;` staat VOOR boekAsync' }
    ],
    onzeker: [
      { wat: 'of de ontvanger het merkt', reden: 'het seintje is best effort en hangt aan een open ' +
        'sessie; dit huis meet niet of het is aangekomen' }
    ],
    raakt: { objecten: ['eigen wallet', 'wallet van een ander lid', 'het grootboek'] },
    herstel: { bron: 'HERSTELPROEF.json',
      reden: 'niet verklaard maar gemeten; geld terug naar de afzender is een NIEUWE handeling en ' +
        'geen terugweg -- de ontvanger moet die zelf doen' },
    nagekeken: 'Claude (Opus 5), 2026-09-13: vier gemeten collecties uit kern/stuur/gevolg.js, de ' +
      'volgorde en het seintje uit kern/pay/verzoeken.js en kern/pay/kijken.js; niet door een mens nagelezen'
  }
});

module.exports = { STUUR };
