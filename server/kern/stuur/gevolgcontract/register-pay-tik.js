/* HET GEVOLGCONTRACT VAN DE TIK -- twee mensen die naast elkaar staan.

   APART VAN ./register-pay-stuur.js, en de naad is de CODE. Sturen wijst een ontvanger
   aan met zijn codenaam; tikken doet dat met een code van zes tekens die vijf minuten
   leeft en die ALLEEN de ontvanger aanwijst. Daar hangt een eigen voorwaarde aan (een
   geldige, niet-eigen tik) en een eigen mislukking (de tik is verlopen) -- en dat zijn
   precies de twee velden waar een gevolgcontract over gaat.

   APART VAN ./register-pay-kascode.js om het scherpste verschil dat deze laag kent: een
   tik VERPLAATST geld, een kascode verleent alleen het RECHT om het te komen halen.
   ========================================================================== */
'use strict';

const TIK = Object.freeze({
  '/api/pay/tik': {
    capability: '/api/pay/tik',
    classificatie: 'persoonsgegeven',
    streefstand: 'het bedrag staat van de eigen wallet af en op de wallet van de getikte ' +
      'ontvanger bij, in een grootboek dat na de handeling nog sluit',
    /* DE CODE WIJST ALLEEN DE ONTVANGER AAN, en dat is de reden dat RECHT_VERLENEN hier in
       `nooit` staat: wie een tik afkijkt kan de eigenaar hooguit BETALEN, nooit iets bij hem
       ophalen. UITGAANDE_AANROEP staat er wel bij, en niet omdat tikken zelf naar buiten
       gaat: bij een tekort laadt zorgSaldo eerst bij, en dat loopt langs de betaal-naad. */
    veroorzaakt: ['GELD_BEWEGEN', 'SCHRIJVEN_EIGEN', 'SCHRIJVEN_ANDERMANS', 'UITGAANDE_AANROEP'],
    nooit: ['EXTERN_BEREIKEN', 'RECHT_VERLENEN', 'IDENTITEIT_WIJZIGEN', 'DERDENCODE_UITVOEREN',
      'ONVERTROUWDE_BYTES', 'BEVEILIGING_VERZWAKKEN', 'BULK_UITVOER', 'PLAFOND_WIJZIGEN'],
    voorwaarden: [
      { wat: 'een ledensessie; een gast komt er niet in', bron: 'geenGast in routes/pay-tegoed.js' },
      { wat: 'eenmalig het paspoort', bron: 'kyc in routes/pay-tegoed.js' },
      { wat: 'een GELDIGE tik die niet de eigen is -- anders 404 of "Dit is je eigen tik"',
        bron: 'kern/pay/tik.js#tikBetaal' },
      { wat: 'een idempotentiesleutel: de geldpoort weigert deze route zonder',
        bron: 'GEMETEN, niet verklaard: een kale oproep gaf 400 "Deze opdracht verplaatst geld ' +
          'en vraagt een idempotentiesleutel"' },
      { wat: 'dekking, of ruimte om bij te laden', bron: 'zorgSaldo in kern/pay/verzoeken.js' }
    ],
    gevolgen: [
      { soort: 'direct', graad: 'gemeten', collectie: 'paySaldi',
        wat: 'het eigen saldo daalt en dat van de getikte ontvanger stijgt',
        reden: 'de idempotentieproef zag deze collectie veranderen; beide kanten wonen erin' },
      { soort: 'direct', graad: 'gemeten', collectie: 'payBoekingen',
        wat: 'er komt een grootboekregel bij met soort `tik`, die bij beide leden in de ' +
          'tikgeschiedenis staat',
        reden: 'gemeten in dezelfde ronde; `soort: tik` is waar kern/pay/tik.js#tikFeed op filtert' },
      { soort: 'direct', graad: 'gemeten', collectie: 'payIdem',
        wat: 'de sleutel wordt vastgelegd zodat een tweede tik met dezelfde sleutel niet dubbel boekt',
        reden: 'gemeten in dezelfde ronde; tikBetaal geeft hem door als `tik:<sleutel>`' },
      { soort: 'direct', graad: 'gemeten', collectie: 'payIdemAfdruk',
        wat: 'de afdruk van het antwoord wordt bewaard voor die tweede tik',
        reden: 'gemeten in dezelfde ronde' },
      /* TWEE COLLECTIES DIE ALLEEN OP DE EERSTE OPROEP BEWEGEN, en die horen er juist
         daarom bij. Ze stonden er niet toen de meting alleen de tweede en derde oproep
         zag: de idempotentieproef herijkte na haar pasladder-oproep, en die eerste
         oproep is nu meegeteld (zie de kop bij de pasladder in
         scripts/lib/idemproef.js). Wat er eenmalig ontstaat is niet minder een gevolg
         dan wat er elke keer bijkomt. */
      { soort: 'direct', graad: 'gemeten', collectie: 'betaalOpdrachten',
        wat: 'moest er worden bijgeladen, dan komt er een betaalopdracht bij de aanbieder ' +
          'in de eigen opslag te staan',
        reden: 'gemeten op de eerste oproep, toen de wallet nog leeg was; op de derde niet meer, ' +
          'want dan is er saldo. Zie het gevolg `buiten` hieronder -- dit is de binnenkant ervan' },
      { soort: 'direct', graad: 'gemeten', collectie: 'capGezondheid',
        wat: 'de stand van deze capability wordt bijgehouden: hoe gaat het met betalen',
        reden: 'gemeten op de eerste oproep; kern/commercie/capgezondheid.js houdt een stand PER ' +
          'capability en legt die bij het eerste gebruik vast. Groen is daar niet "geen nieuws", ' +
          'dus een capability die gebruikt wordt, schrijft' },
      { soort: 'afgeleid', graad: 'vermoed',
        wat: 'de tik blijft geldig: hij wordt NIET verbruikt, dus dezelfde code kan binnen zijn ' +
          'vijf minuten door meer mensen gebruikt worden',
        reden: 'kern/pay/tik.js zet `geldigTot` niet op 0 na een betaling -- met opzet, want de code ' +
          'wijst alleen de ontvanger aan en er kan dus enkel geld naar hem toe' },
      { soort: 'buiten', graad: 'vermoed',
        wat: 'is er te weinig saldo, dan wordt er eerst bijgeladen langs de betaalaanbieder',
        uitkomsten: ['niet bijgeladen', 'bijgeladen', 'bijladen mislukt'],
        reden: 'zorgSaldo roept laadOp aan; het antwoord draagt `bijgeladen` zodat het lid ziet dat ' +
          'er meer is gebeurd dan tikken' },
      { soort: 'mislukking', graad: 'gemeten',
        wat: 'ZONDER idempotentiesleutel gebeurt er niets: de geldpoort weigert met 400 voordat de ' +
          'tik wordt opgezocht -- een kale dubbeltik kan hier dus niet twee keer betalen',
        reden: 'GEMETEN, niet verklaard: de kale ronde van de idempotentieproef gaf tweemaal 400 en ' +
          'een leeg verschil in de opslag' },
      { soort: 'mislukking', graad: 'vermoed',
        wat: 'is de tik verlopen of van de aanroeper zelf, dan gaat er niets van de wallet af',
        reden: 'de twee controles in kern/pay/tik.js#tikBetaal staan VOOR de aanroep van `stuur`, ' +
          'dus de 404 en de 400 vallen voordat er geboekt wordt' }
    ],
    onzeker: [
      { wat: 'of de ontvanger het merkt', reden: 'het seintje is best effort en hangt aan een open ' +
        'sessie; dit huis meet niet of het is aangekomen' }
    ],
    raakt: { objecten: ['eigen wallet', 'wallet van de getikte ontvanger', 'het grootboek'] },
    herstel: { bron: 'HERSTELPROEF.json',
      reden: 'niet verklaard maar gemeten; geld terugtikken is een NIEUWE handeling en geen ' +
        'terugweg -- de ontvanger moet die zelf doen' },
    nagekeken: 'Claude (Opus 5), 2026-09-14: de vier gemeten collecties uit kern/stuur/gevolg.js, de ' +
      'kale ronde uit IDEMPROEF.json, de volgorde en de codebehandeling uit kern/pay/tik.js; niet ' +
      'door een mens nagelezen'
  }
});

module.exports = { TIK };
