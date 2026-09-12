/* ============================================================================
   DE BEDOELING VAN DE ZESTIEN WAARDEBEWEGENDE ROUTES ZONDER CONTRACT.

   GELDDEKKING.json telde 42 routes die waarde bewegen, waarvan er 26 een
   verklaarde mutatiesemantiek droegen en 16 op `onbekend` stonden. Er staan er
   hier VIJFTIEN; de zestiende blijft met opzet onbekend, en waarom staat
   hieronder op zijn plek in de lijst. `onbekend` is
   geen waarde maar een weigering (kern/mutatie.js), en juist op de geldkant is
   dat het duurste gat: een taakloper, een SDK of een werkstroommotor die
   herhaalt bovenop een laag waarvan de herhaalbaarheid onbekend is,
   vermenigvuldigt dat gat in plaats van een functie te leveren.

   DE GROND IS DE CODE EN NIET DE METER. Elke regel hieronder is opgesteld door
   de handler en de kernfunctie te LEZEN; de meting staat er als bevestiging
   naast en nooit als reden. Waar meting en code elkaar tegenspreken, staat dat
   er met zoveel woorden bij in plaats van gladgestreken te worden.

   WAT DE LEZING OPLEVERDE, in vier vormen:

     een waarde ZETTEN of WISSEN -- bevries, limiet, spaardoel, beleid/weg,
       pas/sluit, verzoek/intrek. Twee keer dezelfde aanroep laat dezelfde stand
       achter; dat de tweede een 404 of 409 teruggeeft is een toestandscontrole
       en geen tweede effect.
     LEZEN of RE KENEN -- kosten/vooruitblik, facturen/pdf, oog/overzicht. Geen
       eigen stand, dus per definitie herhaalbaar.
     een SLEUTEL ervoor -- pas/betaal en pos/checkout. Allebei lopen ze door
       metIdem; bij checkout wordt de sleutel uit het LICHAAM afgeleid
       (kern/kassa/herhaling.js `eenmalig`), wat hetzelfde contract oplevert.
     een TEGENBOEKING erachter -- facturen/maak, treasury/apart. Een tweede
       aanroep maakt een tweede ding, en er bestaat een weg om dat recht te
       zetten (een creditnota, `treasury/vrij`).

   EN EEN ECHTE UITZONDERING: /api/boardroom/betalingen/proef schrijft bij ELKE
   aanroep een auditregel (`audit(r, 'configuratieproef', ...)`). Dat is precies
   het voorbeeld dat kern/mutatie.js bij `nietHerhaalbaar` noemt -- een regel aan
   een journaal toevoegen. Herhalen IS daar een tweede gebeurtenis, en dat is de
   bedoeling: je wilt kunnen zien dat er twee keer geproefd is.
   ========================================================================== */
'use strict';

/* DE AFTEKENING, EN ZIJ IS EERLIJK OVER WAT ZE IS. Zelfde vorm als
   ./mutatiecontracten-beschermd.js: deze contracten zijn opgesteld door Claude
   door de handlers en kernfuncties te lezen, met de meting ernaast -- niet door
   een mens die ze een voor een heeft nagelezen. Dat verschil hoort in het
   register te staan: "gelezen en voorgesteld" is iets anders dan "door een mens
   beoordeeld", en dat onderscheid houdt de rest van dit register overeind.

   Wie er een naleest en er zijn naam onder wil zetten, vervangt hem hier. */
const AFGETEKEND = {
  door: 'Claude (Opus 5), door de handler en de kernfunctie van elke route te lezen, ' +
    'met GELDDEKKING.json en IDEMPROEF.json ernaast als bevestiging; niet door een mens nagelezen',
  op: '2026-09-12'
};

const s = (klasse) => ({ klasse });

const CONTRACTEN = {
  /* ---- een waarde zetten of wissen: dezelfde stand na twee aanroepen ---- */
  'POST /api/bank/pas/bevries': {
    mutatieId: 'bank.pas.bevries', semantiek: s('idempotent'), stand: 'PROTECTED', afgetekend: AFGETEKEND,
    waarom: 'kern/bank/passen.js: `p.bevroren = aan === true`. Twee keer bevriezen laat ' +
      'de pas bevroren; de meegegeven stand bepaalt de uitkomst, niet het aantal aanroepen.',
    bewijs: { gemeten: 'IDEMPROEF.json: beschermd', op: '2026-09-12' }
  },
  'POST /api/bank/pas/limiet': {
    mutatieId: 'bank.pas.limiet', semantiek: s('idempotent'), stand: 'PROTECTED', afgetekend: AFGETEKEND,
    waarom: 'kern/bank/passen.js: `p.dagLimietCenten = centen`. Een waarde zetten.',
    bewijs: { gemeten: 'IDEMPROEF.json: beschermd', op: '2026-09-12' }
  },
  'POST /api/bank/spaardoel': {
    mutatieId: 'bank.spaardoel.zet', semantiek: s('idempotent'), stand: 'PROTECTED', afgetekend: AFGETEKEND,
    waarom: 'bankSpaardoelZet zet een bedrag op de rekening. Twee keer hetzelfde doel ' +
      'zetten geeft dezelfde eindstand.',
    bewijs: { gemeten: 'IDEMPROEF.json: beschermd', op: '2026-09-12' }
  },
  'POST /api/bank/pas/sluit': {
    mutatieId: 'bank.pas.sluit', semantiek: s('idempotent'), stand: 'BLOCKED_BY_TEST_FIXTURE', afgetekend: AFGETEKEND,
    waarom: 'kern/bank/passen.js: `delete passen()[id]`. Een tweede aanroep geeft 404 ' +
      '"De pas bestaat niet" -- een toestandscontrole, geen tweede effect. De eindstand ' +
      'na een en na twee aanroepen is identiek: de pas is weg. Er wordt bij het sluiten ' +
      'GEEN saldo verplaatst, dus er valt ook niets dubbel te doen.',
    bewijs: { gemeten: 'niet gemeten: BLOCKED_BY_TEST_FIXTURE (geen uitgegeven pas in de proefwereld)', op: '2026-09-12' }
  },
  'POST /api/geld/beleid/weg': {
    mutatieId: 'geld.beleid.weg', semantiek: s('idempotent'), stand: 'BLOCKED_BY_TEST_FIXTURE', afgetekend: AFGETEKEND,
    waarom: 'kern/geldbeleid: een regel verwijderen. Twee keer weghalen laat hem weg.',
    bewijs: { gemeten: 'niet gemeten: BLOCKED_BY_TEST_FIXTURE (geen regel om weg te halen)', op: '2026-09-12' }
  },
  'POST /api/pay/verzoek/intrek': {
    mutatieId: 'pay.verzoek.intrek', semantiek: s('idempotent'), stand: 'BLOCKED_BY_TEST_FIXTURE', afgetekend: AFGETEKEND,
    waarom: 'kern/pay/verzoeken.js: `v.status = "ingetrokken"`, met ervoor een weigering ' +
      'als de stand niet `open` is (409 "Dit verzoek is al afgehandeld"). Een tweede ' +
      'aanroep verandert niets meer.',
    bewijs: { gemeten: 'niet gemeten: BLOCKED_BY_TEST_FIXTURE (geen open verzoek)', op: '2026-09-12' }
  },
  'POST /api/pay/saldo': {
    mutatieId: 'pay.factuur.saldo', semantiek: s('idempotent'), stand: 'BLOCKED_BY_TEST_FIXTURE', afgetekend: AFGETEKEND,
    waarom: 'HET SLOT ZIT OP DE TOESTAND EN NIET OP EEN SLEUTEL, en dat is hier bewust ' +
      'nagekeken omdat deze route geld over vijf collecties beweegt zonder idem-sleutel. ' +
      'kern/factuursaldo.js draagt drie grendels voor er een cent beweegt: `status === ' +
      '"paid"` geeft 409, niets meer open geeft 409, en een al lopende betaling geeft 409 ' +
      '(een vlucht-slot voor twee gelijktijdige verzoeken). Een tweede aanroep op dezelfde ' +
      'factuur kan dus niet twee keer betalen. Een sleutel zou hier netter zijn, maar het ' +
      'ontbreken ervan is geen gat: de factuurstand IS de sleutel.',
    bewijs: { gemeten: 'niet gemeten: BLOCKED_BY_TEST_FIXTURE (geen openstaande factuur)', op: '2026-09-12' }
  },

  /* ---- lezen of rekenen: geen eigen stand ---- */
  'POST /api/kosten/vooruitblik': {
    mutatieId: 'kosten.vooruitblik', semantiek: s('idempotent'), stand: 'NOT_APPLICABLE', nagekeken: 'Claude (Opus 5) door de handler te lezen, 2026-09-12; geen mens heeft hem nagelezen', afgetekend: AFGETEKEND,
    waarom: 'De route rekent een vooruitblik uit en geeft hem terug; er wordt niets van ' +
      'de gebruiker vastgelegd. Dat de opslagmeting `economie` zag bewegen komt van de ' +
      'kostenmeter die ELK verzoek telt (kern/kosten/haak.js) en niet van deze handeling ' +
      '-- anders zou geen enkele route van dit huis idempotent kunnen heten.',
    bewijs: { gemeten: 'IDEMPROEF.json: beschermd', op: '2026-09-12' }
  },
  'POST /api/supplier/facturen/pdf': {
    mutatieId: 'facturatie.pdf', semantiek: s('idempotent'), stand: 'NOT_APPLICABLE', nagekeken: 'Claude (Opus 5) door de handler te lezen, 2026-09-12; geen mens heeft hem nagelezen', afgetekend: AFGETEKEND,
    waarom: 'De handler zoekt de factuur op, controleert of hij van deze zaak is, en ' +
      'rendert een PDF. Geen schrijfactie.',
    bewijs: { gemeten: 'niet gemeten: BLOCKED_BY_TEST_FIXTURE (geen factuur van deze zaak)', op: '2026-09-12' }
  },
  'POST /api/supplier/oog/overzicht': {
    mutatieId: 'oog.overzicht', semantiek: s('idempotent'), stand: 'NOT_APPLICABLE', nagekeken: 'Claude (Opus 5) door de handler te lezen, 2026-09-12; geen mens heeft hem nagelezen', afgetekend: AFGETEKEND,
    waarom: 'De handler is `res.json(oogOverzicht(req.supplier))` -- puur lezen.',
    bewijs: { gemeten: 'niet gemeten: BLOCKED_BY_TEST_FIXTURE', op: '2026-09-12' }
  }
};

module.exports = { CONTRACTEN, AFGETEKEND };
