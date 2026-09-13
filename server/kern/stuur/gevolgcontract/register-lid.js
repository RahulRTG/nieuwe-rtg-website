/* HET GEVOLGCONTRACT VAN EEN UITGAANDE BETALING DOOR EEN LID.

   Apart van ./register-bank.js omdat het een andere LEZER heeft: dit pad staat in de
   AI-allowlist (kern/stuur/beleid.js) en de kantoorpaden niet, dus dit contract telt
   mee in de noemer van scripts/gevolgdekking.js en die twee niet. Ze bij elkaar
   zetten zou die noemer onzichtbaar maken.

   De keuring staat in ../gevolgcontract.js; het samengestelde register in ./register.js.
   ========================================================================== */
'use strict';

const LID = Object.freeze({
  /* ------------------------------------------------------------------------
     EEN UITGAANDE SEPA: drie soorten zekerheid op een handeling.
     ---------------------------------------------------------------------- */
  '/api/bank/sepa': {
    capability: '/api/bank/sepa',
    classificatie: 'persoonsgegeven',
    streefstand: 'het bedrag staat van de eigen rekening af en er ligt een betaalopdracht ' +
      'die het kantoor kan volgen tot hij is bevestigd of teruggekomen',
    /* DE WERKWOORDEN. `UITGAANDE_AANROEP` staat er wel bij en dat is het verschil met
       de kantoorweg hierboven: deze betaling gaat achter de betaal-naad langs een
       provider (kern/bank/overboeken.js, payout). `EXTERN_BEREIKEN` staat in NOOIT en
       niet in veroorzaakt: het geld gaat naar buiten, maar dit huis stuurt er geen
       bericht over -- nagelezen, er staat geen notify of mail in dat pad. */
    veroorzaakt: ['GELD_BEWEGEN', 'SCHRIJVEN_EIGEN', 'UITGAANDE_AANROEP'],
    nooit: ['EXTERN_BEREIKEN', 'DERDENCODE_UITVOEREN', 'ONVERTROUWDE_BYTES', 'IDENTITEIT_WIJZIGEN'],
    voorwaarden: [
      { wat: 'een ledensessie en een eigen rekening met dekking', bron: 'auth + bankSaldi' },
      { wat: 'een idempotentiesleutel', bron: 'lib/idem.js weigert een geldhandeling zonder sleutel' }
    ],
    gevolgen: [
      { soort: 'direct', graad: 'gemeten', collectie: 'bankSaldi',
        wat: 'het saldo van de eigen rekening daalt',
        reden: 'de idempotentieproef zag deze collectie veranderen' },
      { soort: 'direct', graad: 'gemeten', collectie: 'bankBoekingen',
        wat: 'er komt een boeking bij die het lid op zijn afschrift ziet',
        reden: 'gemeten in dezelfde ronde' },
      { soort: 'direct', graad: 'gemeten', collectie: 'betaalOpdrachten',
        wat: 'er ligt een betaalopdracht met een stand die het kantoor kan volgen',
        reden: 'gemeten in dezelfde ronde' },
      { soort: 'direct', graad: 'gemeten', collectie: 'capGezondheid',
        wat: 'de gezondheidsmeter van de betaalrail beweegt',
        reden: 'gemeten in dezelfde ronde; het is een teller en geen geld' },
      { soort: 'direct', graad: 'gemeten', collectie: 'bankIdem',
        wat: 'de sleutel wordt vastgelegd zodat een tweede tik niet dubbel boekt',
        reden: 'gemeten in dezelfde ronde' },
      { soort: 'direct', graad: 'gemeten', collectie: 'bankIdemAfdruk',
        wat: 'de afdruk van het antwoord wordt bewaard voor die tweede tik',
        reden: 'gemeten in dezelfde ronde' },
      { soort: 'direct', graad: 'gemeten', collectie: 'betaalIdem',
        wat: 'dezelfde bescherming aan de betaalkant',
        reden: 'gemeten in dezelfde ronde' },
      { soort: 'afgeleid', graad: 'vermoed',
        wat: 'het bedrag is niet meer beschikbaar voor een volgende betaling',
        reden: 'volgt uit het gedaalde saldo; geen eigen collectie' },
      /* HIER ZIT DE TWEEDE AS. Twee gevolgen buiten de opslag, en ze verschillen
         niet in GRAAD maar in of hun uitkomstruimte BENOEMD is. */
      { soort: 'buiten', graad: 'vermoed',
        wat: 'de provider bevestigt de opdracht, weigert hem, of boekt hem terug',
        uitkomsten: ['bevestigd', 'geweigerd', 'teruggeboekt'],
        reden: 'een gesloten set: server/betaal.js kent geen vierde afloop, en de synthetische ' +
          'rail beproeft er drie van (MAGNAATLAB.md). Welke het wordt, weet niemand vooraf' },
      { soort: 'buiten', graad: 'onbekend',
        wat: 'of de bank van de ONTVANGER het geld bijschrijft, en wanneer',
        reden: 'daar komt geen enkel signaal van terug in dit huis; wij zien de opdracht en de ' +
          'bevestiging van onze provider, nooit de bijschrijving aan de andere kant' },
      { soort: 'mislukking', graad: 'vermoed',
        wat: 'een mislukte uitbetaling komt via de webhook terug en brengt het geld terug op de rekening',
        reden: 'test/bank.test.js: "een mislukte payout komt via de webhook binnen en brengt het geld terug"' }
    ],
    onzeker: [
      { wat: 'de doorlooptijd', reden: 'die hangt aan de provider en aan de bank van de ontvanger; ' +
        'dit huis meet hem niet en toont hem daarom niet als getal' }
    ],
    raakt: { objecten: ['eigen bankrekening', 'betaalopdracht', 'begunstigde buiten RTG'] },
    herstel: { bron: 'HERSTELPROEF.json',
      reden: 'niet verklaard maar gemeten; een uitgaande betaling heeft geen `exact` terugweg -- ' +
        'wat er bestaat is een compensatie (het geld komt terug via de webhook of een terugboeking)' },
    nagekeken: 'Claude (Opus 5), 2026-09-13: de zeven gemeten collecties komen uit IDEMPROEF.json, ' +
      'de afloop van de provider uit server/betaal.js; niet door een mens nagelezen'
  }
});

module.exports = { LID };
