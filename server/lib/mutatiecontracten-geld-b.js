/* ============================================================================
   DE BEDOELING VAN DE WAARDEBEWEGENDE ROUTES -- deel B.

   Vervolg van ./mutatiecontracten-geld.js, dat op 12,4 KB uitkwam en daarmee
   over de keuringsgrens van 10 KB. Dezelfde ronde, dezelfde herkomst, dezelfde
   aftekening; alleen de laatste drie vormen staan hier. De grens is een dakpan
   en geen wet -- maar de reden dat hij hier terecht aansloeg is dat dit bestand
   twee onderwerpen droeg: routes die een STAND zetten, en routes waar een
   tweede aanroep een tweede HANDELING is. Dat zijn precies de twee helften.

   Zie de kop van deel A voor hoe deze contracten tot stand zijn gekomen en wat
   de aftekening wel en niet betekent.
   ========================================================================== */
'use strict';

const { AFGETEKEND } = require('./mutatiecontracten-geld');

const s = (klasse) => ({ klasse });

const CONTRACTEN = {
  /* ---- een sleutel ervoor: herhalen mag, maar alleen met dezelfde ---- */
  'POST /api/bank/pas/betaal': {
    mutatieId: 'bank.pas.betaal', herkomst: 'mens', toegang: { klasse: 'AUTHENTICATED' }, semantiek: s('sleutelVereist'), stand: 'PROTECTED', afgetekend: AFGETEKEND,
    waarom: 'kern/bank/passen.js wikkelt de boeking in `metIdem`, en het commentaar erboven ' +
      'legt de fout vast die dat nodig maakte: "Een herhaling schreef het bedrag nog een keer ' +
      'af EN telde nog een keer mee voor de daglimiet". Zonder sleutel is een tweede aanroep ' +
      'dus een tweede betaling.',
    watErMoetKomen: null,
    bewijs: { gemeten: 'PROTECTED: gemeten in de idempotentieronde van 12 september 2026. De route was niet geblokkeerd door een ontbrekende wereld maar door een onderwerp dat op was voordat de meting begon -- de pasladder-ijkoproep doet echt werk. Een voorziening (scripts/lib/idemwereld.js) maakt het onderwerp nu vers, na die ijkoproep en voor de eerste gemeten oproep.', op: '2026-09-12' }
  },
  /* POST /api/pay/verzoek/betaal STOND HIER BEWUST NIET, tot 18 oktober 2026:
     de kale ronde mat met sleutel een 409 en dat is een TOESTANDSCONTROLE, geen
     idempotentie; ./mutatiecontracten-hindernis.js sloot af met "blijft liggen
     tot iemand haar leest". Gelezen: kern/pay/verzoeken.js wikkelt verzoekBetaal
     in metIdem(..., { geld }) uit lib/idem.js -- ZONDER sleutel 400
     IDEMPOTENTIESLEUTEL_VERPLICHT voordat er iets gebeurt, MET sleutel het
     eerdere antwoord op dezelfde afdruk (codenaam, verzoek-id, centen). Dat is
     per constructie `sleutelVereist`, dezelfde grond als /bank/pas/betaal, en
     geen uitspraak over de 409. De STAND blijft BLOCKED: PROTECTED vraagt een
     meting met en zonder sleutel (./mutatiecontracten-geldgrens.js) en de ronde
     zonder sleutel is hier nooit gedraaid. */
  'POST /api/pay/verzoek/betaal': {
    mutatieId: 'pay.verzoek.betaal', herkomst: 'mens', toegang: { klasse: 'AUTHENTICATED' }, semantiek: s('sleutelVereist'),
    stand: 'BLOCKED_BY_TEST_FIXTURE',
    afgetekend: { door: 'Claude (Fable 5.1), op grond van de gelezen handler (kern/pay/verzoeken.js, lib/idem.js metIdem met ' +
      'opties.geld); de stand blijft BLOCKED omdat de ronde zonder sleutel niet is gedraaid; niet door een mens nagelezen', op: '2026-10-18' },
    waarom: 'metIdem met { geld }: zonder sleutel weigert lib/idem.js met 400, met dezelfde sleutel en afdruk komt het ' +
      'eerdere antwoord terug. De 409 "al afgehandeld" erna is een toestandscontrole en telt hier niet als grond.',
    bewijs: { gemeten: 'kale ronde 30 augustus: de EERSTE oproep gaf al 409. Idemproef 29 september: met sleutel ' +
      '"beschermd", zonder sleutel niets gemeten -- genoeg voor de semantiek (die staat in de code), niet voor PROTECTED.', op: '2026-09-29' },
    watErMoetKomen: 'een openstaand betaalverzoek van een ANDER lid aan het proeflid, zodat de eerste oproep werk doet ' +
      'en de ronde zonder sleutel de 400 van lib/idem.js meet in plaats van de 409 van de toestand.'
  },

  'POST /api/supplier/pos/checkout': {
    mutatieId: 'kassa.checkout', herkomst: 'mens', toegang: { klasse: 'AUTHENTICATED' }, semantiek: s('sleutelVereist'), stand: 'PROTECTED', afgetekend: AFGETEKEND,
    waarom: 'De hele handler loopt door `herhaling.eenmalig`, die met `sleutelVan(body)` een ' +
      'sleutel UIT HET LICHAAM afleidt en daarmee `metIdem` aanroept. Dat levert hetzelfde ' +
      'contract als een meegegeven sleutel -- met een kanttekening die hier hoort: levert het ' +
      'lichaam geen sleutel op, dan draait het werk ONBESCHERMD (`if (!s) return werk()`). ' +
      'De bescherming hangt dus aan de bonvelden en niet aan de aanroeper.',
    watErMoetKomen: null,
    bewijs: { gemeten: 'PROTECTED: gemeten in de idempotentieronde van 12 september 2026. De route was niet geblokkeerd door een ontbrekende wereld maar door een onderwerp dat op was voordat de meting begon -- de pasladder-ijkoproep doet echt werk. Een voorziening (scripts/lib/idemwereld.js) maakt het onderwerp nu vers, na die ijkoproep en voor de eerste gemeten oproep.', op: '2026-09-12' }
  },

  /* ---- een tegenboeking erachter ---- */
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

  /* ---- en de uitzondering: een journaalregel per aanroep ---- */
  'POST /api/boardroom/betalingen/proef': {
    mutatieId: 'betaalregie.proef', herkomst: 'mens', toegang: { klasse: 'AUTHENTICATED' }, semantiek: s('nietHerhaalbaar'), stand: 'INTENTIONALLY_NON_IDEMPOTENT', afgetekend: AFGETEKEND,
    waarom: 'kern/betaalregie.js schrijft bij ELKE aanroep `audit(r, "configuratieproef", ...)`. ' +
      'Dat is letterlijk het voorbeeld dat kern/mutatie.js bij deze klasse noemt: een regel aan ' +
      'een journaal toevoegen. Herhalen IS hier een tweede gebeurtenis en dat is de bedoeling -- ' +
      'je wilt kunnen zien dat er twee keer geproefd is, en er is niets recht te zetten omdat ' +
      'er niets fout ging. Er beweegt geen geld: de proef leest de configuratie van een provider.',
    /* HIER STOND `niet gemeten: BLOCKED_BY_TEST_FIXTURE` NAAST EEN STAND DIE
       GEEN FIXTURE MIST, en dat is een tegenstrijdigheid die niemand ving: de
       stand zegt "herhalen hoort een tweede gebeurtenis te zijn" en het bewijs
       zei "er is een wereld nodig". De ronde van 12 september meet hem als
       `ongemeten` met de reden dat de eerste oproep 400 gaf -- die klopt, en die
       staat er nu. */
    bewijs: { gemeten: 'ongemeten: de eerste oproep gaf 400, dus er is geen werk gedaan om een herhaling op te beoordelen. Dat raakt deze stand niet: INTENTIONALLY_NON_IDEMPOTENT is een BESLUIT over wat een tweede aanroep hoort te doen, en geen meting.', op: '2026-09-12' }
  }
};

module.exports = { CONTRACTEN };
