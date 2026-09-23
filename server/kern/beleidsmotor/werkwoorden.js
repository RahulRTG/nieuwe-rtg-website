/* DE BELEIDSMOTOR, FASE 4 -- kamers en werkwoorden als GEGEVENS.

   AUTHORITY.md fase 4: de 26 kamers apart, en de boardroom een werkruimte in
   plaats van een superrol. Vandaag is `boardroomAuth` een vlag die instellingen,
   geld, kosten, toegang, partners, export en Magnaat in een keer openzet (115
   routes). Dit bestand trekt die vlag uit elkaar in WERKWOORDEN, en legt per
   kamer vast of zij ueberhaupt een bevoegdheid kan dragen.

   GEEN ZESDE VOCABULAIRE (besluit A1): dit zijn geen nieuwe rollen maar de
   onderwerpen waaronder de motor telt. Een werkwoord heeft de hoogste trede van
   de gezagsnoemer die het bereikt (geen / tonen / klaarzetten / uitvoeren), en
   die trede is VERKLAARD en niet uit de routenaam geraden.

   NOG IN DE SCHADUW. Er bestaat vandaag geen zetel per werkwoord en geen
   toewijzing van mensen aan kamers; wie welk werkwoord krijgt is een besluit van
   de eigenaar. De motor telt alleen HOE VAAK elk werkwoord en elke kamer wordt
   gebruikt -- een teller en geen journaal, zonder wie. Pas met dat getal is de
   verdeling een besluit in plaats van een gok. */
'use strict';

/* De boardroom in werkwoorden. Volgorde telt: het EERSTE voorvoegsel dat past
   wint, dus het specifieke (boardroom/toegang) staat voor het algemene
   (boardroom). test/beleidsmotor-werkwoorden.test.js zakt zodra een
   boardroomroute onder geen enkel werkwoord valt. */
const WERKWOORDEN = Object.freeze({
  toegang: { trede: 'uitvoeren', uitleg: 'wie mag het kantoor, de boardroom en de balie in, en wat de deuren zouden besluiten',
    voorvoegsels: ['/api/office/boardroom/toegang', '/api/office/balie/', '/api/office/beleidsmotor', '/api/office/mensdeur', '/api/office/ledenregister', '/api/office/kantoor/'] },
  kosten: { trede: 'uitvoeren', uitleg: 'kostprijs, tarieven, perioden sluiten en een rekening vrijgeven (KOSTEN.md)',
    voorvoegsels: ['/api/office/kosten/'] },
  geld: { trede: 'uitvoeren', uitleg: 'prijzen, commissie, de bank, voornemens tekenen en de economische werelden',
    voorvoegsels: ['/api/office/geld', '/api/office/bank/', '/api/office/commercie/', '/api/office/voornemen/',
      '/api/office/economie/', '/api/office/rtfwallet/', '/api/office/terugval/', '/api/rtfos/gift/'] },
  export: { trede: 'uitvoeren', uitleg: 'gegevens in bulk naar buiten', voorvoegsels: ['/api/office/aidata/'] },
  partners: { trede: 'uitvoeren', uitleg: 'partners, instellingen, foundationregistraties en hun papieren toelaten',
    voorvoegsels: ['/api/office/partner/', '/api/office/papieren', '/api/office/instelling/', '/api/office/foundation/'] },
  magnaat: { trede: 'uitvoeren', uitleg: 'de Magnaat-wereld en wat die leert',
    voorvoegsels: ['/api/office/magnaat/', '/api/office/boardroom/magnaat/'] },
  techniek: { trede: 'uitvoeren', uitleg: 'integraties, noodstop, lastafworp en quarantaine van capabilities',
    voorvoegsels: ['/api/office/techniek', '/api/office/gezondheid/'] },
  toezicht: { trede: 'tonen', uitleg: 'het journaal lezen', voorvoegsels: ['/api/office/journaal'] },
  salon: { trede: 'uitvoeren', uitleg: 'De Salon uitlichten en belangen beoordelen', voorvoegsels: ['/api/office/salon/'] },
  instellingen: { trede: 'uitvoeren', uitleg: 'het platform zelf: schakelaars, genres, fasen, de mall, paniek en Rahul',
    voorvoegsels: ['/api/office/boardroom', '/api/office/mall/', '/api/office/paniek/', '/api/office/wereld/',
      '/api/office/stuur/', '/api/office/handhaving/'] }
});

function werkwoordVan(pad) {
  const p = String(pad || '');
  for (const [naam, w] of Object.entries(WERKWOORDEN)) {
    /* een voorvoegsel met een slash is een map; zonder slash een route plus
       wat eronder hangt (dus /journaal niet /journaalbeeld) */
    if (w.voorvoegsels.some(v => v.endsWith('/') ? p.startsWith(v) : (p === v || p.startsWith(v + '/')))) return naam;
  }
  return null;
}

/* DE 26 KAMERS, zoals KANTOORMACHT.md par. 3 ze uitlas. Alleen een BESTUURLIJKE
   kamer kan een bevoegdheid dragen; de kantine is een menu en een chat, en de
   zeven productkamers zijn werelden van het platform en geen afdelingen van
   RTG. De toets houdt de sleutels gelijk aan het levende kamerregister. */
const B = 'bestuurlijk';
const KAMERSOORT = Object.freeze({
  sales: B, marketing: B, pr: B, hr: B, financien: B, inkoop: B, verkoop: B, juridisch: B, creatief: B,
  intern: B, onderzoek: B, klantenservice: B, support: B, ingenieurs: B, integraties: B, controleregister: B,
  consumentenAbo: B, partnerAbo: B,
  kantine: 'sociaal',
  reisbureau: 'product', atelier: 'product', studio: 'product', hardware: 'product', architect: 'product',
  regering: 'product', opvang: 'product'
});

/* Waar een kantoorroute zegt over WELKE kamer hij gaat. Het veld komt uit het
   lichaam; daarom telt de motor alleen een id die in KAMERSOORT staat -- een
   pad of veld van buiten mag de opslag niet laten groeien. */
const KAMERROUTES = Object.freeze({
  'POST /api/office/kamer': 'id', 'POST /api/office/kamer/taak': 'id', 'POST /api/office/kamer/taak-zet': 'id',
  'POST /api/office/kamer/ai': 'id', 'POST /api/office/inzage': 'kamer', 'POST /api/office/dienst/in': 'kamer',
  'POST /api/office/kachat': 'kamer', 'POST /api/office/kachat/stuur': 'kamer', 'POST /api/office/onboarding': 'kamer'
});

function kamerVan(sleutel, body) {
  const veld = KAMERROUTES[sleutel];
  if (!veld || !body) return null;
  const id = String(body[veld] || '');
  return Object.prototype.hasOwnProperty.call(KAMERSOORT, id) ? id : null;
}

/* FASE 6: LEZEN IS NIET EXPORTEREN. Een scherm dat een lijst toont blijft in
   het huis; een bestand dat wordt meegegeven gaat eruit en is daarna niet meer
   terug te halen. Elke kantoorroute die een bijlage meegeeft staat hier, met de
   poort die een MENS eist en het spoor dat vaststaat VOORDAT de bytes gaan.
   test/beleidsmotor-exporten.test.js zoekt de bijlagen zelf op in de bron en
   zakt bij een export die hier niet staat, of die er anders uitziet dan hier
   verklaard. Wat dit NIET dekt: een JSON-antwoord met een hele collectie is ook
   bulk, maar dat is aan de bron niet te onderscheiden van een scherm. */
const EXPORTEN = Object.freeze({
  'POST /api/office/export.csv': { poort: 'kluisAuth', spoor: 'inzagelog.noteerVast',
    wat: 'alle bestellingen, ritten en boekingen met de codenaam van de klant' },
  'POST /api/office/aidata/export': { poort: 'boardroomAuth', spoor: 'afdelingen.audit',
    wat: 'de complete AI-dataset (JSONL)' }
});

module.exports = { WERKWOORDEN, werkwoordVan, KAMERSOORT, KAMERROUTES, kamerVan, EXPORTEN };
