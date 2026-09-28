/* HET GEVOLGCONTRACT VAN DE KASCODE -- contactloos afrekenen bij een partner.

   APART VAN ./register-pay-tik.js om het scherpste verschil dat deze laag kent, en het is
   hetzelfde verschil als tussen ./register-pay-klompje.js en -klompje-betaal.js: deze
   handeling VERPLAATST GEEN GELD. Zij geeft een kassa toestemming om tot een maximum te
   komen halen; het geld beweegt pas bij /api/supplier/pay/in. Daarom staat GELD_BEWEGEN
   hier in `nooit` en is dit het enige pay-contract met RECHT_VERLENEN.

   EN DAAROM IS `PLAFOND_WIJZIGEN` GEEN VAN BEIDE. De code draagt zijn eigen maximum, en
   dat maximum wordt door KASCODE_MAX hard afgekapt (`Math.min` in kern/pay/kassa.js): er
   bestaat geen invoer waarmee dit pad een bestaande grens ruimer maakt.

   SINDS 27 SEPTEMBER 2026 is de code een credential (kern/pay/kasbak.js): 128 bits,
   hash-only in payKasToegang. De idempotentieproef mat nog de oude lijst payCodes;
   tot hij opnieuw draait staat de nieuwe collectie hier op `vermoed`.
   ========================================================================== */
'use strict';

const KASCODE = Object.freeze({
  '/api/pay/kascode': {
    capability: '/api/pay/kascode',
    classificatie: 'persoonsgegeven',
    streefstand: 'er is precies EEN geldige kascode voor dit lid, met een eigen maximum en ' +
      'vijf minuten geldigheid; de vorige is daarmee waardeloos',
    veroorzaakt: ['SCHRIJVEN_EIGEN', 'RECHT_VERLENEN'],
    nooit: ['GELD_BEWEGEN', 'EXTERN_BEREIKEN', 'SCHRIJVEN_ANDERMANS', 'IDENTITEIT_WIJZIGEN',
      'PLAFOND_WIJZIGEN', 'UITGAANDE_AANROEP', 'DERDENCODE_UITVOEREN', 'ONVERTROUWDE_BYTES',
      'BEVEILIGING_VERZWAKKEN', 'BULK_UITVOER'],
    voorwaarden: [
      { wat: 'een echt account; een demo-sessie komt er niet in',
        bron: 'geenEchtAccount in routes/pay-tegoed.js' },
      { wat: 'een idem-sleutel die nog geen code heeft gemaakt; een herhaling krijgt 409 zonder code',
        bron: 'uitgeven in kern/pay/kasbak.js' }
    ],
    gevolgen: [
      { soort: 'direct', graad: 'vermoed', collectie: 'payKasToegang',
        wat: 'er komt een rij bij met alleen de hash van de code, en de vorige open code van dit lid ' +
          'wordt ingetrokken',
        reden: 'kern/pay/kasbak.js#uitgeven doet beide in een collectietransactie; beproefd in ' +
          'test/kascode-credential.test.js, nog niet door de idempotentieproef gemeten' },
      { soort: 'afgeleid', graad: 'vermoed',
        wat: 'een kaart of token dat naar de VORIGE code verwijst, wijst na dit verzoek naar niets',
        reden: 'kern/pay/kassa.js#kasStand bestaat juist hiervoor: RTG Pay houdt per lid EEN code ' +
          'actief, dus wie een verse maakt maakt zijn vorige waardeloos terwijl het token ervan nog ' +
          'prima ondertekend is' },
      { soort: 'buiten', graad: 'onbekend',
        wat: 'of een kassa de code ook werkelijk gebruikt, voor hoeveel, en of hij binnen vijf ' +
          'minuten langskomt',
        reden: 'dat is de handeling van de zaak (/api/supplier/pay/in) en niet deze; dit pad zet ' +
          'alleen het recht klaar' },
      { soort: 'mislukking', graad: 'vermoed',
        wat: 'een herhaling met dezelfde idem-sleutel maakt geen code en trekt de vorige niet in',
        reden: 'kasbak.js#uitgeven weigert VOOR de lus die open codes intrekt; beproefd in ' +
          'test/kascode-credential.test.js toets 2' }
    ],
    onzeker: [],
    raakt: { objecten: ['de eigen kascodes'] },
    herstel: { bron: 'HERSTELPROEF.json',
      reden: 'niet verklaard maar gemeten; een code intrekken is een NIEUWE handeling -- en de ' +
        'goedkoopste terugweg bestaat al: vijf minuten wachten' },
    nagekeken: 'Claude (Opus 5), 2026-09-14, bijgewerkt 2026-09-27 na de migratie naar ' +
      'kern/pay/kasbak.js; niet door een mens nagelezen'
  }
});

module.exports = { KASCODE };
