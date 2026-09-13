/* HET GEVOLGCONTRACT VAN DE INCASSO-AANVRAAG -- het kantoor VRAAGT een tweede paar ogen.

   APART VAN ./register-bank-bevestig.js om de naad die deze geldweg zelf trekt: aanvragen zet
   klaar en beweegt geen cent, bevestigen voert uit. Dezelfde scheiding als bij het klompje
   (./register-pay-klompje.js), en samen gingen ze door de omvangband van keuringsregel 13.

   Geen van beide paden staat in de AI-allowlist (KANTOORMACHT.md par. 9 -- beleid.js kent geen
   enkel /api/office-pad), dus ze tellen niet mee in de noemer van scripts/gevolgdekking.js; die
   meldt ze apart als `contractenBuitenBereik`.
   ========================================================================== */
'use strict';

const BANK = Object.freeze({
  '/api/office/bank/incasso': {
    capability: '/api/office/bank/incasso',
    handeling: 'GELD_INNEN',
    classificatie: 'intern',
    streefstand: 'er staat een gewogen voornemen klaar dat een tweede mens kan aftekenen; ' +
      'er is nog geen euro verplaatst',
    /* ALLEEN `nooit`, en dat is geen luiheid: de geleende woordenlijst heeft geen
       werkwoord voor "een verzoek klaarzetten voor een tweede mens" (zie
       ./vergelijk.js). Wat vaststaat is wat deze route NIET doet -- en dat is exact
       de bewering die de naam "incasso" tegenspreekt. Nagelezen in de route. */
    nooit: ['GELD_BEWEGEN', 'EXTERN_BEREIKEN', 'UITGAANDE_AANROEP'],
    /* De voorwaarden staan hier met hun HANDHAVER erbij, want een voorwaarde
       zonder adres is een wens. Alle drie zijn na te lopen in de route. */
    voorwaarden: [
      { wat: 'een kantoorsessie op naam', bron: 'kluisAuth (kern/kantoor/kluispoort.js)' },
      { wat: 'een passkey onder deze handeling, of de gemelde terugval', bron: 'kern/zwaarbewijs.js' },
      { wat: 'er staat minstens een vaste betaling aan de beurt', bron: 'bankIncassoVooruitblik' }
    ],
    gevolgen: [
      /* STOND OP `gemeten`, GECORRIGEERD OP 13 SEPTEMBER 2026: die meting was voorwerk van de
         proef. Na de herijking (scripts/lib/idemproef.js) is `opslag.a` van dit pad LEEG en staat
         de route op `ongemeten` -- *de eerste oproep deed geen werk (status 400)*. Een delta bij
         een oproep die niets deed, kwam van buiten. Dat de keten ROND is hangt niet hieraan maar
         aan test/tweedehandtekening.test.js toets 6 (echt geld door de hele baan) en aan de assen
         die kern/kantoor/geldketen.js tijdens die uitvoering vastlegt; die staan los van
         IDEMPROEF.json. Alleen deze collectie-claim leunde erop. */
      { soort: 'direct', graad: 'vermoed', collectie: 'kantoorHandtekeningen',
        wat: 'er komt een openstaande aanvraag voor een tweede mens bij',
        reden: 'gelezen in kern/kantoor/tweedehandtekening.js en uitgevoerd in ' +
          'test/tweedehandtekening.test.js toets 6. NIET gemeten door de idempotentieproef: die ' +
          'krijgt op dit pad een 400 en komt niet bij de muterende code' },
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
     DE GOUDEN WEG, DEEL TWEE: hier beweegt het geld werkelijk.

     DIT IS HET GEVAL WAARVOOR DE TWEEDE AS BESTAAT. De meting staat op
     `onbekend` met een eerlijke reden ("de proef kwam niet bij de muterende
     code"), en dat is geen tekort dat op te lossen is: deze route eist TWEE
     kantoormensen op naam, en een automatische proef kan de tweede niet zijn.
     Wat hier staat is dus zuiver verklaring -- en juist daarom staat er bij elk
     gevolg waar het in de code te lezen valt.

     EN ZIJN GEVOLG IS GEDELEGEERD. Deze route voert geen eigen handeling uit: hij
     voert UIT WAT ER IS AANGEVRAAGD (`uitvoerders.get(a.actie)`). Wat hij
     veroorzaakt is dus wat de bevestigde handeling veroorzaakt, en dat staat in
     het contract van DIE capability. Die uitkomstruimte is gesloten en klein:
     twee geregistreerde handelingen.
     ---------------------------------------------------------------------- */
});

module.exports = { BANK };
