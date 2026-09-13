/* ============================================================================
   MUTATIECONTRACTEN -- DE TWEEDE HANDTEKENING.

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm en de
   regels. Vijf routes: twee die een aanvraag MAKEN en drie die het loket zijn.

   WAAROM DEZE VIJF EEN EIGEN BESTAND KRIJGEN. Ze delen geen bewijsvorm met de
   andere registers maar wel met ELKAAR, en het interessante zit in het verschil
   tussen de twee helften -- daar is een herhaling namelijk niet hetzelfde ding:

     aanvragen    een tweede aanroep maakt een TWEEDE AANVRAAG. Dat is geen
                  dubbeltik-bug: twee rekeningen rood zetten is twee aanvragen,
                  en de aanvraag zelf verandert nog niets aan de bank. Wie hier
                  `idempotent` van maakt, moet uitleggen hoe je dan ooit twee
                  keer iets kunt aanvragen.
     bevestigen   een tweede aanroep met hetzelfde kenmerk doet NIETS, en dat is
                  een toestandscontrole en geen idempotentie -- MUTATIECONTRACT.md
                  is daar expliciet over. De aanvraag is na de eerste bevestiging
                  weg (de handtekening wordt opgebruikt, ook als de uitvoering
                  faalde), dus de tweede krijgt 404. Het verschil doet ertoe: bij
                  idempotentie krijg je hetzelfde antwoord, hier een ander.

   DE TOEGANGSKLASSE IS OVERAL DEZELFDE, EN HET IS `AUTHENTICATED`. Alle vijf
   staan achter `kluisAuth`, en dat is hier geen extra RECHT maar een NAAM --
   zonder twee bewezen sleutels is de vergelijking tussen aanvrager en
   bevestiger een vergelijking van twee lege waarden.

   Er stond eerst `CAPABILITY_GATED`, en dat las beter dan het klopte: die klasse
   EIST de naam van een bevoegdheid, zodat kern/bevoegdheid/lijst.js en de route
   over hetzelfde ding praten. Die naam is er niet, want `kluisAuth` vraagt geen
   bevoegdheid maar een identiteit. De router zei dat ook (`AUTHENTICATED`), en
   die had gelijk. Een zwaardere klasse opschrijven dan er staat, maakt het
   register een verlanglijst.
   ========================================================================== */
'use strict';

const AFGETEKEND = {
  door: 'Claude (Opus 5), op grond van de bron van kern/kantoor/tweedehandtekening.js ' +
    'plus test/tweedehandtekening.test.js (11 toetsen, 9 mutaties gezakt); niet door een mens nagelezen',
  op: '2026-09-09'
};

const CONTRACTEN = {
  /* ---- de twee die een aanvraag maken ---- */
  'POST /api/office/bank/rekening/rood': {
    mutatieId: 'bank.rood.aanvragen',
    herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Een tweede aanroep maakt een TWEEDE aanvraag, en dat hoort zo: twee rekeningen rood ' +
      'zetten zijn twee aanvragen. De aanvraag verandert zelf niets aan de bank -- de limiet ' +
      'beweegt pas als een ander mens tekent -- dus een dubbele aanvraag kost hooguit een tweede ' +
      'regel in de lijst en nooit een tweede geldbeweging. Het gevaar dat idempotentie hier zou ' +
      'afdekken (twee keer uitvoeren) is verplaatst naar de bevestiging, en die is eenmalig.',
    bewijs: {
      gemeten: 'test/tweedehandtekening.test.js toets 1: na een aanvraag is de rood-staan-ruimte ' +
        'onveranderd. Mutatie "route voert toch uit" laat die toets zakken.',
      op: '2026-09-09'
    },
    afgetekend: AFGETEKEND
  },
  'POST /api/office/bank/incasso': {
    mutatieId: 'bank.incasso.aanvragen',
    herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Zelfde vorm als hierboven: een tweede aanroep is een tweede aanvraag en de ronde ' +
      'draait er niet van. De ronde zelf is wel gevoelig voor herhaling -- zij int geld -- maar ' +
      'die gevoeligheid zit achter de bevestiging, en een bevestiging werkt precies een keer.',
    bewijs: {
      gemeten: 'test/tweedehandtekening.test.js toets 6: de aanvraag draagt `needsAuth` en geen ' +
        '`uitgevoerd`; de ronde draait pas na de tweede handtekening.',
      op: '2026-09-09'
    },
    afgetekend: AFGETEKEND
  },

  /* HET DOSSIER VAN DE GOUDEN WEG (MACHINE.md par. 5a). Een POST die LEEST: hij
     geeft per as terug wat er gebeurde en welke verplichte as nog open staat. Hij
     staat achter de gedeelde code en niet achter de kluis, en dat is een besluit:
     het dossier gaat over de HANDELING en niet over een mens, en de namen erin
     stonden al in het auditjournaal. */
  'POST /api/office/bank/incasso/dossier': {
    mutatieId: 'bank.incasso.dossier.lezen',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: {
      gemeten: 'niet gemeten door de idempotentieproef: de route is nieuw. Wat er WEL over bewezen ' +
        'is: test/geldketen.test.js toets 1 en 5 lezen het dossier twee keer en vergelijken de assen, ' +
        'en de leeslaag (kern/kantoor/geldketen/dossier.js) schrijft nergens.',
      op: '2026-09-13'
    },
    nagekeken: 'Claude (Opus 5), 2026-09-13: de handler roept `dossier(id)` of `lijst()` aan plus ' +
      '`journaalTop`/`journaalVerifieer`. Alle vier zijn lezers; de enige schrijver van het journaal ' +
      'is de baan zelf (klaarzetten, tekenen, uitvoeren). Twee keer lezen laat dezelfde stand achter.',
    afgetekend: AFGETEKEND
  },

  /* ---- het loket ---- */
  'POST /api/office/bank/handtekening/open': {
    mutatieId: 'bank.handtekening.lezen',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: {
      gemeten: 'niet gemeten: de route is nieuw en heeft nog geen proefronde gehad. Dat staat hier ' +
        'als afwezigheid en niet als een nul.',
      op: '2026-09-09'
    },
    nagekeken: 'Claude (Opus 5), 2026-09-09: de handler geeft `open()` terug. Die roept `opruimen()` ' +
      'aan, en DAAR zit een schrijfactie -- verlopen aanvragen worden verwijderd. Dat is met opzet ' +
      'geen mutatie in de zin van dit register: het is verval dat door de klok is bepaald en niet ' +
      'door de aanroeper, en het gebeurt bij elke aanraking van de laag. Twee keer lezen laat ' +
      'dezelfde stand achter als een keer.',
    afgetekend: AFGETEKEND
  },
  'POST /api/office/bank/handtekening/bevestig': {
    mutatieId: 'bank.handtekening.bevestigen',
    herkomst: 'mens',
    semantiek: { klasse: 'hooguitEens' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Een tweede aanroep met hetzelfde kenmerk geeft 404 en voert niets uit -- maar dat is ' +
      'een TOESTANDSCONTROLE en geen idempotentie, en die twee mogen hier niet door elkaar lopen ' +
      '(MUTATIECONTRACT.md). Bij idempotentie krijgt de tweede aanroep hetzelfde antwoord; hier ' +
      'een ander, want de handtekening is opgebruikt. Dat opbruiken is zelf de bescherming: een ' +
      'nee wordt geen ja door het nog eens te vragen, ook niet nadat de uitvoering faalde.',
    bewijs: {
      gemeten: 'test/tweedehandtekening.test.js toets 5: dezelfde bevestiging geeft de tweede keer ' +
        '404. Mutatie "handtekening niet opgebruikt" laat die toets zakken.',
      op: '2026-09-09'
    },
    afgetekend: AFGETEKEND
  },
  'POST /api/office/bank/handtekening/intrek': {
    mutatieId: 'bank.handtekening.intrekken',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Intrekken is naar zijn aard herhaalbaar -- weg is weg -- maar de tweede aanroep geeft ' +
      '404 in plaats van hetzelfde antwoord, en dat is opnieuw een toestandscontrole. De klasse ' +
      'staat daarom op `idempotent` (de STAND na twee aanroepen is gelijk) terwijl de stand eerlijk ' +
      'zegt dat het ANTWOORD dat niet is. Wie die twee gelijkschakelt, verbergt precies het verschil ' +
      'waar dit register voor bestaat.',
    bewijs: {
      gemeten: 'test/tweedehandtekening.test.js toets 1: na intrekken staat er niets meer open.',
      op: '2026-09-09'
    },
    afgetekend: AFGETEKEND
  }
};

module.exports = { CONTRACTEN };
