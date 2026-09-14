/* HET GEVOLGCONTRACT VAN DE TWEEDE HANDTEKENING -- hier beweegt het geld werkelijk.

   APART VAN ./register-bank.js: zie de kop daar voor de naad (aanvragen zet klaar, bevestigen
   voert uit). Dit is het pad waar test/tweedehandtekening.test.js toets 6 met twee
   kantoormensen op naam echt geld door de hele baan van kern/kantoor/geldketen.js verplaatst.
   ========================================================================== */
'use strict';

const BANK_BEVESTIG = Object.freeze({
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

module.exports = { BANK_BEVESTIG };
