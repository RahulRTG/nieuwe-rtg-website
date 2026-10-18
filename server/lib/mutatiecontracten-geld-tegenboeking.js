/* ============================================================================
   DE BEDOELING VAN DE WAARDEBEWEGENDE ROUTES -- de tegenboekingen.

   Vervolg van ./mutatiecontracten-geld-b.js. Daar staan de routes waar een
   SLEUTEL ervoor de herhaling vangt; hier de routes waar een TEGENBOEKING
   erachter de correctie is (`compenseerbaar`): een tweede aanroep is een
   tweede ding, en wat fout ging wordt ernaast rechtgezet in plaats van gewist.
   Dat is de regel van HERSTELBESLUIT.json (append-only economische
   geschiedenis), en daarom een eigen groep. Zelfde ronde, herkomst en
   aftekening als deel A (./mutatiecontracten-geld.js).
   ========================================================================== */
'use strict';

const { AFGETEKEND } = require('./mutatiecontracten-geld');

const s = (klasse) => ({ klasse });

const CONTRACTEN = {
  'POST /api/supplier/facturen/maak': {
    mutatieId: 'facturatie.maak', herkomst: 'mens', toegang: { klasse: 'AUTHENTICATED' }, semantiek: s('compenseerbaar'), stand: 'PROTECTED', afgetekend: AFGETEKEND,
    waarom: 'Een tweede aanroep maakt een TWEEDE factuur: kern/facturatie/motor.js kent geen ' +
      'idem-sleutel en geen ontdubbeling (nagekeken). Dat is te herstellen met een creditnota, ' +
      'en daarmee is dit compenseerbaar en niet onherstelbaar. LET OP EEN VERSCHIL DAT HIER ' +
      'NIET WEGGEPOETST MOET WORDEN: IDEMPROEF.json noemt deze route `beschermd`, terwijl de ' +
      'code geen slot draagt. De meting en de lezing spreken elkaar dus tegen; deze klasse ' +
      'volgt de CODE, en wie hem naleest hoort eerst uit te zoeken waar die `beschermd` ' +
      'vandaan komt.',
    bewijs: { gemeten: 'IDEMPROEF.json: beschermd -- in tegenspraak met de code, zie waarom', op: '2026-09-12' }
  },
  'POST /api/supplier/pay/treasury/apart': {
    mutatieId: 'pay.treasury.apart', herkomst: 'mens', toegang: { klasse: 'AUTHENTICATED' }, semantiek: s('compenseerbaar'), stand: 'PROTECTED', afgetekend: AFGETEKEND,
    waarom: 'Geld apart zetten maakt een oormerk (WAARDE.md: een oormerk is u die uw eigen ' +
      'geld apart zet, en dat blijft). Twee keer apart zetten geeft twee oormerken. Er is een ' +
      'uitgeschreven tegenhanger -- /api/supplier/pay/treasury/vrij -- dus het is recht te ' +
      'zetten zonder dat er geld verdwenen is.',
    watErMoetKomen: null,
    bewijs: { gemeten: 'PROTECTED: gemeten in de idempotentieronde van 12 september 2026. De route was niet geblokkeerd door een ontbrekende wereld maar door een onderwerp dat op was voordat de meting begon -- de pasladder-ijkoproep doet echt werk. Een voorziening (scripts/lib/idemwereld.js) maakt het onderwerp nu vers, na die ijkoproep en voor de eerste gemeten oproep.', op: '2026-09-12' }
  },

  'POST /api/office/pay/factuurcorrectie': {
    mutatieId: 'pay.factuur.correctie', herkomst: 'mens', toegang: { klasse: 'AUTHENTICATED' }, semantiek: s('idempotent'), stand: 'PROTECTED', afgetekend: AFGETEKEND,
    waarom: 'DE TERUGWEG VAN /api/pay/saldo, en hij draagt TWEE sloten die verschillend werk doen. ' +
      '(1) Een toestandscontrole: staat er al een regel in `inv.correcties`, dan komt er geen ' +
      'tweede bij en het antwoord meldt `herhaald`. (2) Een DETERMINISTISCHE idem-sleutel richting ' +
      'pay.huisUit, samengesteld uit het factuurnummer (`inv-correctie:` + id). Juist die tweede ' +
      'maakt de klasse `idempotent` en niet `sleutelVereist`: de sleutel wordt server-side afgeleid, ' +
      'dus een aanroeper kan hem niet weglaten om een tweede terugboeking te krijgen. ' +
      'DAT DIE TWEE VERSCHILLEND WERK DOEN IS GEMETEN EN NIET GEREDENEERD: met alleen het ' +
      'toestandsslot eruit bleef het saldo exact kloppen (de sleutel ving het), en pas toen ook de ' +
      'sleutel niet-deterministisch werd gemaakt boekte hij dubbel -- 15865 in plaats van 8000 cent. ' +
      'Het toestandsslot bewaakt dus het REGISTER en de sleutel bewaakt de EURO.',
    watErMoetKomen: null,
    bewijs: { gemeten: 'PROTECTED: een tweede aanroep verplaatst nul waarde, gemeten op de wallet van het lid tegen een echte server (test/factuurcorrectie.test.js, toets 7), met twee mutaties die de twee sloten los aantonen',
      instrument: 'test/factuurcorrectie.test.js', op: '2026-09-12' }
  },
};

module.exports = { CONTRACTEN };
