/* ============================================================================
   MUTATIECONTRACT -- DE OUDERKANT VAN DE KINDEROPVANG.

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm en de
   regels. De routes staan onderin server/routes/verzorging.js, de laag in
   server/kern/verzorging/opvangleden.js.

   VIER ROUTES, EN ZE ZIJN MET OPZET NIET ALLE VIER HETZELFDE. Twee lezen (het
   aanbod, en wat er op uw eigen codenaam staat); een zet een aanvraag klaar; een
   trekt hem in. Die derde is de enige die iets nieuws maakt, en juist daar is de
   tweede aanroep GEEN dubbeltik maar een tweede aanvraag: een ouder die twee
   dagdelen wil, vraagt twee keer. Wie daar idempotentie op plakt, gooit de
   tweede aanvraag weg en noemt dat een verbetering.

   DE INTREKKING IS HET SPIEGELBEELD: twee keer intrekken laat dezelfde stand
   achter als een keer. Zie daar de aantekening waarom die op PROTECTED staat en
   /api/pay/verzoek/betaal niet, terwijl ze allebei een herhaling weigeren.
   ========================================================================== */
'use strict';

const { AFGETEKEND, OP } = require('./mutatiecontracten-beschermzaak-op');

/* De aftekening die deze vier delen. Uitgeschreven omdat de meting voor alle
   vier in een ronde is gedaan, tegen dezelfde nagebouwde partnerlijst. */
const NAGEKEKEN = 'Claude, 2026-09-02: handler gelezen in server/kern/verzorging/opvangleden.js, ' +
  'plus de twee functies in ./opvang.js die het schrijven doen (nannyVraag, nannyWeg). De ' +
  'ouderkant schrijft zelf NIETS: db.data.opvang heeft een eigenaar en die is ./opvang.js ' +
  '(keuringsregel 63). Getoetst in test/opvangleden.test.js, zeven toetsen met zeven mutaties.';

const CONTRACTEN = {
  /* ---- de twee die alleen lezen ---- */
  'POST /api/opvang': {
    mutatieId: 'opvangwijzer.overzicht', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    nagekeken: NAGEKEKEN + ' Deze route projecteert de opvangbak en schrijft niet; de projectie ' +
      'noemt elk veld met de hand, zodat `aanwezig` (voornamen van kinderen met de naam van hun ' +
      'ouder) er niet vanzelf uit kan komen.',
    bewijs: { gemeten: 'twee identieke oproepen gaven hetzelfde antwoord; er is geen save() in ' +
      'het pad van deze route.', op: OP },
    afgetekend: AFGETEKEND
  },
  'POST /api/opvang/mijn': {
    mutatieId: 'opvangwijzer.mijn', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    nagekeken: NAGEKEKEN + ' Leest de aanvragen die op de codenaam van de sessie staan, over alle ' +
      'opvangpartners heen; schrijft niet.',
    bewijs: { gemeten: 'twee identieke oproepen gaven hetzelfde antwoord; geen save() in het pad.', op: OP },
    afgetekend: AFGETEKEND
  },

  /* ---- de twee die schrijven ---- */
  'POST /api/opvang/vraag': {
    mutatieId: 'opvangwijzer.vraag', herkomst: 'mens',
    /* MET OPZET EEN TWEEDE HANDELING. Een ouder die twee dagdelen nodig heeft,
       zet twee aanvragen klaar. De aanvragen zijn niet gelijk te stellen op hun
       inhoud (datum en tijdvak mogen dezelfde zijn: een tweede kind, een tweede
       wens), en het samenvoegen ervan zou een aanvraag stil laten verdwijnen.
       MUTATIECONTRACT.md: zo'n route is KLAAR zodra dat vaststaat en bewezen is,
       en wordt niet verbouwd om een percentage. */
    semantiek: { klasse: 'compenseerbaar' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Twee keer aanvragen is twee aanvragen. Een ouder vraagt een tweede dagdeel of een ' +
      'tweede kind aan met dezelfde datum en hetzelfde tijdvak; wie die twee samenvoegt tot een, ' +
      'gooit een aanvraag weg zonder het te zeggen. De aanvraag heeft bovendien geen enkel gevolg ' +
      'tot een mens bij de opvang hem bevestigt (opvang.nannyZet), dus een dubbele aanvraag kost ' +
      'niemand iets behalve een regel die de opvang zelf kan wegzetten.',
    bewijs: { gemeten: 'twee identieke oproepen leverden twee aanvragen met een eigen id op, beide ' +
      'op stand "aangevraagd" -- gemeten in test/opvangleden.test.js en met de hand nagelopen in ' +
      'de bak.', op: OP },
    afgetekend: AFGETEKEND
  },
  'POST /api/opvang/weg': {
    mutatieId: 'opvangwijzer.weg', herkomst: 'mens',
    /* WAAROM HIER PROTECTED STAAT EN BIJ /api/pay/verzoek/betaal NIET, terwijl
       ze allebei een herhaling weigeren. Dat verschil is met opzet en het is de
       moeite van het uitschrijven waard, want de volgende lezer komt langs
       MUTATIECONTRACT.md par. 5o en denkt dat hier een fout staat.

       Par. 5o gaat over een GELDroute waar PROTECTED zou hebben gesuggereerd dat
       de idempotentielaag een dubbeltik opving. Dat deed zij niet: de 409 kwam
       uit een toestandscontrole, en de bescherming aan de idem-laag toeschrijven
       zou een mechanisme claimen dat er niet was. Vandaar dat die route bewust
       bleef liggen.

       Hier ligt geen idem-laag in het pad en gaat er geen geld om. De claim is
       alleen wat er GEMETEN is, en dat is precies wat de stand zegt: een
       herhaling doet het werk niet nog een keer -- de aanvraag verdwijnt een
       keer, niet twee keer. Het mechanisme is een toestandscontrole en dat staat
       hieronder met zoveel woorden, zodat niemand deze stand later leest als
       bewijs van dubbeltikbescherming die er niet is. */
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    hoe: 'De tweede intrekking van dezelfde aanvraag geeft 404 en niet nogmaals ok. De stand achter ' +
      'twee oproepen is dus gelijk aan die achter een, maar het MECHANISME is een toestandscontrole ' +
      'en geen idempotentiesleutel -- lees deze PROTECTED niet als dubbeltikbescherming door de ' +
      'idem-laag. De eigendomscontrole staat VOOR de wijziging: een id van iemand anders is een 404 ' +
      'en geen geslaagde intrekking.',
    bewijs: { gemeten: 'intrekken lukt een keer; de tweede oproep geeft 404, een id op een andere ' +
      'codenaam geeft 404, en een al bevestigde aanvraag geeft 409 met de reden erbij. Alle drie ' +
      'in test/opvangleden.test.js.', op: OP },
    afgetekend: AFGETEKEND
  }
};

module.exports = { CONTRACTEN };
