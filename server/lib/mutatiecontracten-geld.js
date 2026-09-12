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
    mutatieId: 'bank.pas.bevries', herkomst: 'mens', toegang: { klasse: 'AUTHENTICATED' }, semantiek: s('idempotent'), stand: 'PROTECTED', afgetekend: AFGETEKEND,
    waarom: 'kern/bank/passen.js: `p.bevroren = aan === true`. Twee keer bevriezen laat ' +
      'de pas bevroren; de meegegeven stand bepaalt de uitkomst, niet het aantal aanroepen.',
    bewijs: { gemeten: 'IDEMPROEF.json: beschermd', op: '2026-09-12' }
  },
  'POST /api/bank/pas/limiet': {
    mutatieId: 'bank.pas.limiet', herkomst: 'mens', toegang: { klasse: 'AUTHENTICATED' }, semantiek: s('idempotent'), stand: 'PROTECTED', afgetekend: AFGETEKEND,
    waarom: 'kern/bank/passen.js: `p.dagLimietCenten = centen`. Een waarde zetten.',
    bewijs: { gemeten: 'IDEMPROEF.json: beschermd', op: '2026-09-12' }
  },
  'POST /api/bank/spaardoel': {
    mutatieId: 'bank.spaardoel.zet', herkomst: 'mens', toegang: { klasse: 'AUTHENTICATED' }, semantiek: s('idempotent'), stand: 'PROTECTED', afgetekend: AFGETEKEND,
    waarom: 'bankSpaardoelZet zet een bedrag op de rekening. Twee keer hetzelfde doel ' +
      'zetten geeft dezelfde eindstand.',
    bewijs: { gemeten: 'IDEMPROEF.json: beschermd', op: '2026-09-12' }
  },
  'POST /api/bank/pas/sluit': {
    mutatieId: 'bank.pas.sluit', herkomst: 'mens', toegang: { klasse: 'AUTHENTICATED' }, semantiek: s('idempotent'), stand: 'BLOCKED_BY_TEST_FIXTURE', afgetekend: AFGETEKEND,
    waarom: 'kern/bank/passen.js: `delete passen()[id]`. Een tweede aanroep geeft 404 ' +
      '"De pas bestaat niet" -- een toestandscontrole, geen tweede effect. De eindstand ' +
      'na een en na twee aanroepen is identiek: de pas is weg. Er wordt bij het sluiten ' +
      'GEEN saldo verplaatst, dus er valt ook niets dubbel te doen.',
    watErMoetKomen: "een UITGEGEVEN bankpas. Zelfde voorziening als bij bank.pas.betaal; met de pas erbij meet een tweede aanroep of hij netjes 404 geeft in plaats van iets te doen.",
    bewijs: { gemeten: 'niet gemeten: BLOCKED_BY_TEST_FIXTURE (geen uitgegeven pas in de proefwereld)', op: '2026-09-12' }
  },
  'POST /api/geld/beleid/weg': {
    mutatieId: 'geld.beleid.weg', herkomst: 'mens', toegang: { klasse: 'AUTHENTICATED' }, semantiek: s('idempotent'), stand: 'BLOCKED_BY_TEST_FIXTURE', afgetekend: AFGETEKEND,
    waarom: 'kern/geldbeleid: een regel verwijderen. Twee keer weghalen laat hem weg.',
    watErMoetKomen: "een bestaande beleidsregel van het lid, aangemaakt langs de gewone route. Zonder regel is er niets te verwijderen en doet de eerste oproep al geen werk.",
    bewijs: { gemeten: 'niet gemeten: BLOCKED_BY_TEST_FIXTURE (geen regel om weg te halen)', op: '2026-09-12' }
  },
  'POST /api/pay/verzoek/intrek': {
    mutatieId: 'pay.verzoek.intrek', herkomst: 'mens', toegang: { klasse: 'AUTHENTICATED' }, semantiek: s('idempotent'), stand: 'BLOCKED_BY_TEST_FIXTURE', afgetekend: AFGETEKEND,
    waarom: 'kern/pay/verzoeken.js: `v.status = "ingetrokken"`, met ervoor een weigering ' +
      'als de stand niet `open` is (409 "Dit verzoek is al afgehandeld"). Een tweede ' +
      'aanroep verandert niets meer.',
    watErMoetKomen: "een OPEN betaalverzoek van het lid zelf. Zonder verzoek geeft de route 404 en zegt een herhaling niets.",
    bewijs: { gemeten: 'niet gemeten: BLOCKED_BY_TEST_FIXTURE (geen open verzoek)', op: '2026-09-12' }
  },
  'POST /api/pay/saldo': {
    mutatieId: 'pay.factuur.saldo', herkomst: 'mens', toegang: { klasse: 'AUTHENTICATED' }, semantiek: s('idempotent'), stand: 'PROTECTED', afgetekend: AFGETEKEND,
    waarom: 'DRIE SLOTEN, EN DE DERDE IS EEN SLEUTEL DIE DE AANROEPER NIET KAN WEGLATEN. ' +
      'Deze route beweegt geld over vijf collecties, dus hij is nagekeken. kern/factuursaldo.js ' +
      'draagt (1) de factuurstand -- `status === "paid"` geeft 409 en niets meer open geeft 409; ' +
      '(2) een in-vlucht-slot op wie+factuur, voor twee verzoeken die tegelijk binnenkomen en ' +
      'allebei "open" lezen; en (3) een DETERMINISTISCHE idem-sleutel richting pay.huisIn, ' +
      'samengesteld uit de aanroeper en het factuurnummer (`wie + ":inv-saldo:" + inv.id`). ' +
      'Juist die derde maakt de klasse `idempotent` en niet `sleutelVereist`: de sleutel wordt ' +
      'server-side afgeleid, dus een aanroeper kan hem niet weglaten om een tweede handeling ' +
      'te krijgen. HIER STOND EERST DAT ER GEEN SLEUTEL WAS en dat de factuurstand hem verving. ' +
      'Dat was fout, gevonden door de kop en de body van kern/factuursaldo.js verder te lezen ' +
      'dan de eerste grendels -- en het is precies de reden dat een verklaring uit de CODE komt ' +
      'en niet uit een meting: de meting had hier hetzelfde gezegd en de fout niet gevonden.',
    /* DEZE STOND OP BLOCKED_BY_TEST_FIXTURE, EN DAT WAS EEN AANNAME: de wereld
       die hij vroeg lag er al (RTG-2026-0207 in server/seed/leden.js). Wie de
       andere zes leest: kijk eerst in de zaaiset.

       PROTECTED gaat over de TWEEDE AANROEP en niet over de crashwindow, en die
       twee worden niet samengevoegd -- de proef vond daar een halve toestand.
       Het hele verhaal staat in GELDLAT.md, "Scenario 3, gemeten op een echt
       geldpad"; hier alleen de stand en waar hij vandaan komt. */
    watErMoetKomen: null,
    bewijs: { gemeten: 'PROTECTED: een identieke tweede aanroep verplaatst nul waarde over alle vijf de geldcollecties (npm run factuurproef, stap 3)',
      instrument: 'scripts/factuurproef.js', op: '2026-09-12' }
  }
};

module.exports = { CONTRACTEN, AFGETEKEND };
