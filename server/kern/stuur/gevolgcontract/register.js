/* ============================================================================
   DE EERSTE GEVOLGCONTRACTEN -- met opzet twee, en met opzet DEZE twee.

   Dit register vult zich zoals server/lib/mutatiecontracten.js dat doet: langzaam,
   per regel door een mens nagekeken, en nooit door een script aangevuld. De
   keuring staat in ../gevolgcontract.js; wat hier staat moet daar door.

   WAAROM TWEE EN NIET ZEVENTIG. Een register dat in een middag vol wordt gezet,
   is precies het valse groen dat deze laag moest voorkomen -- dat is letterlijk de
   les uit de kop van server/lib/mutatiecontracten.js. Deze twee zijn gekozen omdat
   ze de twee moeilijke gevallen zijn:

     /api/office/bank/incasso  de gouden weg. De meting zag hier EEN collectie:
       `kantoorHandtekeningen`. Geen geld. Dat is geen tekort van de meting maar de
       waarheid van deze route -- het geld beweegt achter de tweede handtekening,
       en het contract zegt dat met zoveel woorden. Wie alleen naar de naam kijkt
       ("incasso") verwacht hier een geldbeweging; de meting en het contract zijn
       het erover eens dat die er niet is.

     /api/bank/sepa            een betaling NAAR BUITEN, en daarmee het geval waar
       de tweede as voor bestaat. Het interne gevolg is gemeten, de bevestiging van
       de provider heeft een GESLOTEN uitkomstruimte, en wat de bank van de
       ontvanger doet weet niemand tot het is waargenomen. Drie keer een ander soort
       zekerheid op EEN handeling, zonder een nieuw woord voor "bounded".
   ========================================================================== */
'use strict';

const CONTRACTEN = Object.freeze({

  /* ------------------------------------------------------------------------
     DE GOUDEN WEG: de AANVRAAG van een incassoronde.
     ---------------------------------------------------------------------- */
  '/api/office/bank/incasso': {
    capability: '/api/office/bank/incasso',
    handeling: 'GELD_INNEN',
    classificatie: 'intern',
    streefstand: 'er staat een gewogen voornemen klaar dat een tweede mens kan aftekenen; ' +
      'er is nog geen euro verplaatst',
    /* De voorwaarden staan hier met hun HANDHAVER erbij, want een voorwaarde
       zonder adres is een wens. Alle drie zijn na te lopen in de route. */
    voorwaarden: [
      { wat: 'een kantoorsessie op naam', bron: 'kluisAuth (kern/kantoor/kluispoort.js)' },
      { wat: 'een passkey onder deze handeling, of de gemelde terugval', bron: 'kern/zwaarbewijs.js' },
      { wat: 'er staat minstens een vaste betaling aan de beurt', bron: 'bankIncassoVooruitblik' }
    ],
    gevolgen: [
      { soort: 'direct', graad: 'gemeten', collectie: 'kantoorHandtekeningen',
        wat: 'er komt een openstaande aanvraag voor een tweede mens bij',
        reden: 'de idempotentieproef zag deze collectie veranderen; het is de ENIGE die zij hier zag' },
      { soort: 'afgeleid', graad: 'vermoed',
        wat: 'er wordt een voornemen vastgelegd met een bevroren totaal en een besluit',
        reden: 'kern/commercie/voornemen.js schrijft dat weg, maar de proef kwam niet tot die stap ' +
          '(zij tekent niet af) -- dus verklaard en niet gemeten' },
      { soort: 'afgeleid', graad: 'vermoed',
        wat: 'het dossier van de geldketen krijgt zeven assen met een uitslag en een graad',
        reden: 'kern/kantoor/geldketen/klaarzet.js legt ze vast; zelfde reden als hierboven' },
      /* DE BELANGRIJKSTE REGEL VAN DIT CONTRACT. Wat hier NIET gebeurt, staat er
         even groot bij -- anders leest "incasso" als een geldbeweging. */
      { soort: 'buiten', graad: 'vermoed',
        wat: 'GEEN enkel gevolg buiten de opslag: geen boeking, geen mail, geen provider',
        reden: 'de aanvraag zet klaar en voert niets uit; de ronde hangt aan ' +
          '/api/office/bank/handtekening/bevestig en beweegt daar het geld (MACHINE.md par. 5a)' },
      { soort: 'mislukking', graad: 'vermoed',
        wat: 'bij een afgewezen keuring blijft er geen aanvraag en geen voornemen staan',
        reden: 'de invoerkeuring zit bij de AANVRAAG en niet bij de bevestiging; ' +
          'test/tweedehandtekening.test.js toets 7 houdt vast dat er niets blijft hangen' }
    ],
    onzeker: [
      { wat: 'hoeveel er werkelijk geind wordt', reden: 'de vooruitblik is een BOVENgrens: hij ' +
        'spiegelt de lus zonder te boeken, en of een boeking lukt beslist boekAsync (saldo, ' +
        'bevroren rekeningen, limieten)' }
    ],
    raakt: { objecten: ['vaste betaling', 'bankrekening van het lid', 'openstaande handtekening'] },
    herstel: { bron: 'HERSTELPROEF.json',
      reden: 'niet verklaard maar gemeten; deze route heeft daar geen beproefde tegenhanger, ' +
        'en intrekken van de aanvraag loopt via /api/office/bank/handtekening/intrek' },
    nagekeken: 'Claude (Opus 5), 2026-09-13: gelezen tegen de route, de vooruitblik en het dossier; ' +
      'niet door een mens nagelezen'
  },

  /* ------------------------------------------------------------------------
     EEN UITGAANDE SEPA: drie soorten zekerheid op een handeling.
     ---------------------------------------------------------------------- */
  '/api/bank/sepa': {
    capability: '/api/bank/sepa',
    classificatie: 'persoonsgegeven',
    streefstand: 'het bedrag staat van de eigen rekening af en er ligt een betaalopdracht ' +
      'die het kantoor kan volgen tot hij is bevestigd of teruggekomen',
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

module.exports = { CONTRACTEN };
