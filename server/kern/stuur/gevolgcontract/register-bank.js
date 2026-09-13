/* DE GEVOLGCONTRACTEN VAN DE GELDWEG VAN HET KANTOOR.

   Twee contracten op EEN keten, en ze staan hier samen omdat het verschil ertussen
   het punt is: `/incasso` zet klaar en verplaatst geen euro, `/handtekening/bevestig`
   voert uit. Wie alleen naar de namen kijkt, verwacht het omgekeerde.

   De keuring staat in ../gevolgcontract.js; wat hier staat moet daar door. Het
   samengestelde register is ./register.js -- dat is de enige plek die deze bestanden
   bij elkaar legt, en hij gooit zodra twee bestanden hetzelfde pad claimen.
   ========================================================================== */
'use strict';

const BANK = Object.freeze({
  /* ------------------------------------------------------------------------
     DE GOUDEN WEG: de AANVRAAG van een incassoronde.
     ---------------------------------------------------------------------- */
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
  '/api/office/bank/handtekening/bevestig': {
    capability: '/api/office/bank/handtekening/bevestig',
    handeling: 'TWEEDE_HANDTEKENING_ZETTEN',
    classificatie: 'intern',
    streefstand: 'de aangevraagde geldhandeling is uitgevoerd door een ANDERE mens dan wie hem ' +
      'aanvroeg, en de openstaande aanvraag bestaat niet meer',
    /* DE WERKWOORDEN GELDEN VOOR BEIDE gedelegeerde handelingen -- anders is de lijst
       onwaar zodra de andere wordt bevestigd. Nagelezen: de incassoronde roept alleen
       boekAsync aan en bank.rood zet een limiet; geen van beide bericht iemand of
       laadt code van buiten. Bij een DERDE handeling zakt de uitkomsttoets. */
    veroorzaakt: ['GELD_BEWEGEN', 'SCHRIJVEN_ANDERMANS'],
    nooit: ['EXTERN_BEREIKEN', 'DERDENCODE_UITVOEREN', 'ONVERTROUWDE_BYTES'],
    voorwaarden: [
      { wat: 'een kantoorsessie op naam', bron: 'kluisAuth (kern/kantoor/kluispoort.js)' },
      { wat: 'een andere mens dan de aanvrager', bron: 'kern/appstore/vierogen.js -- een sleutelvergelijking, ' +
        'met opzet niet op naam: de naam-tak zou een zwakkere vergelijking toelaten waar een harde bestaat' },
      { wat: 'een openstaande, niet-verlopen aanvraag', bron: 'kern/kantoor/tweedehandtekening.js: opruimen()' }
    ],
    gevolgen: [
      { soort: 'direct', graad: 'vermoed', collectie: 'kantoorHandtekeningen',
        wat: 'de openstaande aanvraag verdwijnt uit de bak',
        reden: 'b.splice(i, 1); save() in bevestig(). NIET gemeten: de proef komt hier niet, ' +
          'want de tweede mens kan geen script zijn' },
      { soort: 'afgeleid', graad: 'vermoed',
        wat: 'de aangevraagde geldhandeling wordt uitgevoerd, met het lijf dat bij de AANVRAAG is bevroren',
        uitkomsten: ['bank.rood', 'bank.incasso'],
        reden: 'uitvoerders.get(a.actie) -- een gesloten set van twee geregistreerde handelingen ' +
          '(routes/kantoren/bank-tweedehand.js). Wat elk van die twee veroorzaakt, staat in HUN ' +
          'contract en niet in dit; deze route bezit dat gevolg niet' },
      { soort: 'afgeleid', graad: 'vermoed',
        wat: 'er komt een auditregel bij op naam van de bevestiger, met de aanvrager erin',
        reden: 'afdelingen.audit() in de route; een spoor dat eindigt bij een gedeelde code is geen spoor' },
      { soort: 'buiten', graad: 'onbekend',
        wat: 'of de geldbeweging de rekening van het lid werkelijk bereikt',
        reden: 'de incassoronde boekt binnen dit huis, maar of een boeking lukt beslist boekAsync ' +
          '(saldo, bevroren rekeningen, limieten) en daar is geen meting van deze weg' },
      /* DE BELANGRIJKSTE REGEL VAN DIT CONTRACT, en hij staat als beleid in de kop
         van de module: een nee wordt geen ja door het nog eens te vragen. */
      { soort: 'mislukking', graad: 'vermoed',
        wat: 'faalt de uitvoering, dan is de handtekening OPGEBRUIKT en is er niets uitgevoerd: ' +
          'de aanvraag moet opnieuw worden gedaan',
        reden: 'b.splice() staat VOOR u.voerUit() in bevestig(), met zoveel woorden ' +
          '("de handtekening wordt opgebruikt, ook als de uitvoering hierna faalt")' }
    ],
    onzeker: [
      { wat: 'wat er precies verandert', reden: 'dat hangt aan de bevestigde handeling en aan het ' +
        'bevroren lijf; deze route weet het niet en verzint het niet' }
    ],
    raakt: { objecten: ['openstaande handtekening', 'de bevestigde geldhandeling', 'het kantoorjournaal'] },
    herstel: { bron: 'HERSTELPROEF.json',
      reden: 'niet verklaard maar gemeten; er is geen beproefde tegenhanger. /handtekening/intrek ' +
        'keert de AANVRAAG terug en niet de uitvoering -- na een bevestiging is er niets in te trekken' },
    nagekeken: 'Claude (Opus 5), 2026-09-13: gelezen tegen kern/kantoor/tweedehandtekening.js en ' +
      'routes/kantoren/bank-tweedehand.js; niet door een mens nagelezen'
  }
});

module.exports = { BANK };
