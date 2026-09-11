/* ============================================================================
   DE MUTATIECONTRACTEN VAN HET CARRIERE LEDGER (kern/carriereledger).

   EERST HET BEWIJS, DAN HET CONTRACT. Er is een dubbeltik-ronde gedraaid op alle
   tien de wegen -- elke weg twee keer met hetzelfde lijf, en tellen wat er in de
   reeks bij kwam. De uitkomst staat per route in `bewijs.gemeten`.

   EN DIE RONDE VOND TWEE DINGEN, allebei dezelfde fout op een andere plek:
   `zet` liet na twee identieke aanroepen TWEE feiten achter (0 -> 2), en
   `bevestig` twee identieke bevestigingen (0 -> 2, aan de kantoorkant en aan de
   zaakkant). In een LEDGER weegt dat zwaarder dan elders: een regel kan alleen
   worden ingetrokken en nooit verdwijnen, dus een dubbeltik vervuilt voorgoed --
   en juist de lijst die een mens naar buiten toont. Gerepareerd VOORDAT dit
   bestand werd geschreven, en pas daarna opnieuw gemeten.

   VIJF VAN DE ACHT SCHRIJFWEGEN ZIJN EEN TOESTANDSCONTROLE EN GEEN DUPLICAATLAAG
   (par. 5o). Dat verschil wordt hier niet weggepoetst: wat vaststaat is dat er
   geen tweede effect KAN ontstaan, niet dat een dubbeltik wordt herkend.

   EN TWEE ZIJN MET OPZET NIET IDEMPOTENT, met de reden erbij. `deel` slaat een
   geheim; twee keer slaan geeft twee geheimen, en hetzelfde geheim teruggeven
   zou erger zijn. `toon` telt een gebruik; een teller die niet telt, telt niet.
   Zulke wegen zijn KLAAR zodra dat vaststaat en bewezen is (MUTATIECONTRACT.md).
   ========================================================================== */
'use strict';

const OP = '2026-09-11';

/* DE AFTEKENING IS EERLIJK OVER WAT ZE IS -- zie ./mutatiecontracten-rugdekking.js
   voor waarom die regel er staat. */
const AFGETEKEND = {
  door: 'Claude (Opus 5), op grond van een gedraaide dubbeltik-ronde op kern/carriereledger; ' +
    'niet door een mens nagelezen',
  op: OP
};

const LID = { klasse: 'AUTHENTICATED', deur: 'auth' };
/* `kluisAuth` vraagt een IDENTITEIT en geen BEVOEGDHEID; een zwaardere klasse
   opschrijven dan er staat, maakt het register een verlanglijst. */
const KANTOOR = { klasse: 'AUTHENTICATED', deur: 'kluisAuth' };
const ZAAK = { klasse: 'AUTHENTICATED', deur: 'supplierAuth' };
/* /toon heeft met OPZET geen bewakerslaag, en de klasse is daarom `PUBLIC` en
   niet `OBJECT_SCOPED` -- de volle afweging staat in de kop van
   server/routes/carriereledger.js, bij de route zelf, want daar woont het
   besluit. Kort: de router leidt `PUBLIC` af omdat er geen deur voor hangt, en
   scripts/lib/publiek.js noemt hem al zo. Een verklaarde klasse die strenger is
   dan wat de deur afdwingt, maakt dit register een verlanglijst; twee registers
   die iets anders zeggen over dezelfde route is nog erger. */
const CODE = { klasse: 'PUBLIC', deur: 'geen bewakerslaag; het veld `code` in het lijf is het geheim, 128 bits en alleen als hash bewaard',
  /* Het veld heet `waarom` en niet `waaromOpen`: kern/mutatiecontract/keuring.js
     leest precies deze naam, en een eigen variant ernaast is een reden die de
     poort niet ziet -- dus geen reden. */
  waarom: 'een deelbewijs wordt getoond aan iemand zonder RTG-account; dat is de hele functie. ' +
    'De rem die deze klasse eist hangt ervoor: 300 verzoeken per IP per minuut (middleware/remmen.js).' };

const leest = (route, mutatieId, toegang, hoe) => [route, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  toegang,
  stand: 'NOT_APPLICABLE',
  bewijs: { gemeten: 'dubbeltik-ronde ' + OP + ': twee keer 200 met een byte-voor-byte gelijk ' +
    'antwoord. ' + hoe, op: OP },
  nagekeken: 'de handler is herleid en leest via reeksKijk()/kijk(), dat een ontbrekende collectie ' +
    'niet aanmaakt -- zie de kop van kern/eigencollectie.js',
  afgetekend: AFGETEKEND
}];

const toestand = (route, mutatieId, toegang, gemeten) => [route, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  toegang,
  stand: 'PROTECTED',
  bewijs: { gemeten: 'dubbeltik-ronde ' + OP + ': ' + gemeten + ' Een toestandscontrole en geen ' +
    'duplicaatlaag (par. 5o): wat vaststaat is dat er geen tweede identiek effect kan ontstaan.',
    op: OP },
  afgetekend: AFGETEKEND
}];

const CONTRACTEN = Object.fromEntries([
  leest('POST /api/carriere/ledger/mijn', 'carriereledger.mijn', LID,
    'De eigen reeks als projectie: feiten op tijd, met hun bevestigingen, de zeven voorraden en ' +
    'de NOOIT-lijst. Er staat met opzet geen totaal onder.'),
  leest('POST /api/carriere/ledger/delen', 'carriereledger.mijnDelen', LID,
    'Welke deelcodes dit lid heeft uitgegeven, met hun verval en hun gebruik. Nooit de code zelf: ' +
    'die gaat precies eenmaal de deur uit.'),

  toestand('POST /api/carriere/ledger/zet', 'carriereledger.zet', LID,
    'de tweede oproep kwam terug met 409 ("Deze regel staat er al, woord voor woord, op dezelfde ' +
    'dag") en er bleef EEN feit staan (0 -> 1 -> 1). In de eerste ronde stond die controle er niet ' +
    'en bleven er TWEE staan (0 -> 1 -> 2). Een feit dat ergens van afwijkt -- ander woord, andere ' +
    'dag, ander kapitaal -- is een ander feit en gaat gewoon door. Een INGETROKKEN regel telt niet ' +
    'mee: hem opnieuw zetten is een correctie en moet kunnen.'),
  toestand('POST /api/carriere/ledger/intrek', 'carriereledger.intrek', LID,
    'de tweede oproep kwam terug met 409 ("Deze regel is al ingetrokken") en er kwam geen tweede ' +
    'intrekregel bij, dus ook geen tweede reden en geen tweede tijdstip. De oorspronkelijke regel ' +
    'blijft in beide gevallen staan -- intrekken stopt de toekomst en niet het verleden.'),
  toestand('POST /api/carriere/ledger/stopdelen', 'carriereledger.stopDelen', LID,
    'de tweede oproep kwam terug met 409 ("Deze deelcode is al gestopt") en het tijdstip van de ' +
    'eerste bleef ongewijzigd staan.'),
  toestand('POST /api/office/carriere/ledger/bevestig', 'carriereledger.bevestig.gezien', KANTOOR,
    'de tweede oproep kwam terug met 409 ("Deze bevestiging staat er al") en er bleef EEN ' +
    'bevestiging staan (0 -> 1 -> 1); in de eerste ronde waren dat er TWEE. Een andere medewerker, ' +
    'of dezelfde met een andere tekst, is een andere bevestiging en gaat gewoon door.'),
  toestand('POST /api/supplier/carriere/bevestig', 'carriereledger.bevestig.bevestigd', ZAAK,
    'gelijk aan de kantoorkant gemeten, met dezelfde uitkomst (1 -> 2 -> 2 over beide bronnen). ' +
    'De naam waaronder wordt bevestigd is die van de ZAAK met de medewerker erachter, dus twee ' +
    'verschillende medewerkers van dezelfde club zijn twee bevestigingen -- en dat is juist.'),
  toestand('POST /api/supplier/carriere/intrek', 'carriereledger.intrek.zaak', ZAAK,
    'de tweede oproep kwam terug met 409 ("Deze regel is al ingetrokken"). Een zaak trekt hier ' +
    'haar EIGEN bevestiging terug; de regel blijft staan en blijft leesbaar.'),

  ['POST /api/carriere/ledger/deel', {
    mutatieId: 'carriereledger.deel', herkomst: 'mens',
    /* `nietHerhaalbaar` uit kern/mutatie.js, en die woordenlijst is de enige --
       er stond eerst `nietIdempotent`, en dat woord bestaat daar niet. Zijn
       uitleg past hier woordelijk: *herhalen IS een tweede gebeurtenis, en dat
       is de bedoeling; er is niets recht te zetten omdat er niets fout ging.* */
    semantiek: { klasse: 'nietHerhaalbaar' },
    waarom: 'deze weg SLAAT een geheim van 128 bits en geeft het precies eenmaal terug. Twee ' +
      'oproepen horen twee codes te geven: dezelfde code teruggeven zou betekenen dat het geheim ' +
      'opnieuw over de lijn gaat, en een code per ontvanger is juist de bedoeling -- elk stopt ' +
      'apart. Gemeten ' + OP + ': twee keer 200, twee verschillende codes, twee rijen.',
    toegang: LID,
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    bewijs: { gemeten: 'dubbeltik-ronde ' + OP + ': codes gelijk? nee. Aantal deelcodes 0 -> 2.',
      op: OP },
    afgetekend: AFGETEKEND
  }],

  ['POST /api/carriere/regel/toon', {
    mutatieId: 'carriereledger.toon', herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    waarom: 'deze weg TELT een gebruik, en een teller die niet telt, telt niet. Het lid hoort te ' +
      'kunnen zien hoe vaak zijn bewijs is geopend; dat is de enige terugkoppeling die hij over ' +
      'een uitgegeven code heeft. Gemeten ' + OP + ': twee keer 200 met hetzelfde antwoord, ' +
      'gebruik 0 -> 2.',
    toegang: CODE,
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    bewijs: { gemeten: 'dubbeltik-ronde ' + OP + ': tweemaal 200; de INHOUD van het antwoord is ' +
      'beide keren gelijk (een feit, zijn bevestigingen, het voorbehoud), alleen de gebruiksteller ' +
      'liep op. Een verlopen, gestopte of onbekende code geeft 404 met de reden in `waarom` en ' +
      'nooit stilte -- een sponsor die niets vindt, denkt anders aan een storing.', op: OP },
    afgetekend: AFGETEKEND
  }]
]);

module.exports = { CONTRACTEN };
