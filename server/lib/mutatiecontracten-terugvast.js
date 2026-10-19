/* ============================================================================
   MUTATIECONTRACTEN -- EEN VASTGELOPEN TERUGBETALING AFHANDELEN.

   Deel van server/lib/mutatiecontracten.js (via ./mutatiecontracten-teruggave.js);
   zie de kop daar voor de vorm. Een route (routes/kantoren/betaalproviders.js):
   een mens op naam legt vast wat hij bij de provider zag over een terugbetaling
   die de veegronde (kern/betaalwaarheid/terugveeg.js) na zes navragen zonder
   uitsluitsel escaleerde. Eigenaarsbesluit van 19 oktober 2026. De deur is
   naamAuth: een identiteit en geen bevoegdheid, dus `AUTHENTICATED` (de
   redenering staat in ./mutatiecontracten-tweedehand.js).
   ========================================================================== */
'use strict';

const CONTRACTEN = {
  'POST /api/office/betalingen/terug/afhandel': {
    mutatieId: 'betaalwaarheid.terugbetaling.afhandelen',
    herkomst: 'mens',
    semantiek: { klasse: 'hooguitEens' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Een vastgelopen terugbetaling wordt een keer afgehandeld: de eerste mens legt naam, uitkomst en ' +
      'reden vast voordat er iets geboekt wordt, en een tweede afhandeling geeft 409 -- een TOESTANDSCONTROLE ' +
      'en geen idempotentie (MUTATIECONTRACT.md). De boeking zelf loopt via providerTerugbetaling, die op het ' +
      'refund-id van de provider precies een keer telt, ook als de webhook daarna alsnog komt.',
    bewijs: {
      gemeten: 'test/terugvastgelopen.test.js: zonder naam 403, een te korte reden 400, de eerste afhandeling ' +
        'telt de terugbetaling een keer en een tweede geeft 409; "niet terug" boekt niets en zet controle; via de ' +
        'echte route krijgt de gedeelde kantoorcode 403 en een kantoormens op naam komt erdoor.',
      op: '2026-10-19'
    },
    afgetekend: { door: 'Claude, op grond van kern/betaalwaarheid/terugveeg.js, routes/kantoren/betaalproviders.js ' +
      'en test/terugvastgelopen.test.js; niet door een mens nagelezen', op: '2026-10-19' }
  }
};

module.exports = { CONTRACTEN };
