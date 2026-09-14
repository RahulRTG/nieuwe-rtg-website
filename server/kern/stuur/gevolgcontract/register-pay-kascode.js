/* HET GEVOLGCONTRACT VAN DE KASCODE -- contactloos afrekenen bij een partner.

   APART VAN ./register-pay-tik.js om het scherpste verschil dat deze laag kent, en het is
   hetzelfde verschil als tussen ./register-pay-klompje.js en -klompje-betaal.js: deze
   handeling VERPLAATST GEEN GELD. Zij geeft een kassa toestemming om tot een maximum te
   komen halen; het geld beweegt pas bij /api/supplier/pay/in. Daarom staat GELD_BEWEGEN
   hier in `nooit` en is dit het enige pay-contract met RECHT_VERLENEN.

   EN DAAROM IS `PLAFOND_WIJZIGEN` GEEN VAN BEIDE. De code draagt zijn eigen maximum, en
   dat maximum wordt door KASCODE_MAX hard afgekapt (`Math.min` in kern/pay/kassa.js): er
   bestaat geen invoer waarmee dit pad een bestaande grens ruimer maakt.
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
      { wat: 'de geldvergunningpoort staat open voor pay.kascode_en_vooraf',
        bron: 'moneyCredentialBlokkade in kern/pay/kassa.js' }
    ],
    gevolgen: [
      { soort: 'direct', graad: 'gemeten', collectie: 'payCodes',
        wat: 'er komt een code bij, en de vorige ongebruikte code van dit lid gaat op `gebruikt`',
        reden: 'de idempotentieproef zag deze collectie veranderen; beide bewegingen wonen erin' },
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
        wat: 'staat de geldvergunningpoort dicht, dan gebeurt er niets: geen nieuwe code, en de ' +
          'vorige blijft geldig',
        reden: 'moneyCredentialBlokkade staat in kern/pay/kassa.js als EERSTE regel van kasCode, ' +
          'dus voor de lus die de oude codes op `gebruikt` zet' }
    ],
    onzeker: [],
    raakt: { objecten: ['de eigen kascodes'] },
    herstel: { bron: 'HERSTELPROEF.json',
      reden: 'niet verklaard maar gemeten; een code intrekken is een NIEUWE handeling -- en de ' +
        'goedkoopste terugweg bestaat al: vijf minuten wachten' },
    nagekeken: 'Claude (Opus 5), 2026-09-14: de gemeten collectie uit kern/stuur/gevolg.js, de ' +
      'volgorde en het plafond uit kern/pay/kassa.js, de deur uit routes/pay-tegoed.js; niet door ' +
      'een mens nagelezen'
  }
});

module.exports = { KASCODE };
