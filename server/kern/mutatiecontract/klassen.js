/* ============================================================================
   DE WOORDENLIJSTEN VAN HET MUTATIECONTRACT -- de twee assen die dit huis mist.

   De keuring staat in ./index.js; hier alleen WAT de standen en de toegangsklassen
   betekenen en welk bewijs ze eisen. Twee bestanden, want een woordenlijst wordt
   gelezen door mensen die een route indelen, en een keuring door de bouw -- en die
   twee horen niet in elkaars weg te staan.

   HET VERSCHIL MET ./mutatie.js, EN WAAROM ER TWEE BESTANDEN ZIJN.

   `kern/mutatie.js` beantwoordt: WAT IS DEZE MUTATIE? (idempotent,
   sleutelVereist, hooguitEens, compenseerbaar, nietHerhaalbaar, onbekend). Dat
   is een uitspraak over de handeling zelf, en die blijft daar staan -- er komt
   hier geen tweede woordenlijst voor hetzelfde. Dat is precies de fout die
   SEMANTIEK.json in dit huis 78 keer heeft gevonden, en waar twee bestanden met
   allebei een `VERMOGENS` het duurste voorbeeld van zijn.

   Dit bestand beantwoordt een ANDERE vraag: WAT WETEN WIJ ERVAN, EN HOE HARD IS
   DAT? Een route kan `nietHerhaalbaar` zijn omdat iemand dat heeft vastgesteld,
   of omdat niemand ooit heeft gekeken. Voor een taakloper, een SDK en een
   release-poort is dat verschil alles, en geen enkele klasse in mutatie.js kan
   het uitdrukken.

   DE VIJF ASSEN, EN WAAR ELK VAN ZE WOONT. Dit lijstje is de kern van het
   ontwerp: elke as heeft precies EEN huis, en dit bestand voegt er twee toe en
   herhaalt de andere drie nooit.

     1. SEMANTIEK        wat is deze mutatie          -> kern/mutatie.js
     2. DUPLICAATGEDRAG  wat is "hetzelfde verzoek"   -> lib/idemsleutels.js
     3. BEWIJS           wat is er gemeten            -> IDEMPROEF.json
     4. TOEGANG          wie mag hier binnen          -> HIER (TOEGANG)
     5. STAND            hoe hard is onze kennis      -> HIER (STATUS)

   As 4 stond nergens. scripts/lib/bewakers.js kent zeven SOORTEN deur, maar dat
   is een waarneming aan de router -- "hier staat officeAuth" -- en geen uitspraak
   over wat de bedoeling was. Een route zonder bewakerslaag is daar een restpost;
   hier is het een BESLUIT (PUBLIC, of SYSTEM_INTERNAL, of een gat).

   DE REGEL DIE HET GEHEEL DRAAGT: alleen LEGACY_PENDING_CLASSIFICATION moet naar
   nul. De andere vijf standen zijn eindstanden. Een route die met opzet niet
   idempotent is, is KLAAR zodra dat is vastgesteld en bewezen -- niet zodra hij
   idempotent is gemaakt. Wie dat omdraait, verbouwt de architectuur om een
   percentage mooi te krijgen, en dat is duurder dan het gat dat hij dicht.
   ========================================================================== */
'use strict';


/* ---------------------------------------------------------------------------
   AS 5: DE STAND VAN ONZE KENNIS.

   Zes standen. Bij elke staat wat hij BETEKENT, welk BEWIJS hij eist, en of hij
   een eindstand is. Die middelste kolom is het hele verschil met een lijstje
   etiketten: een stand zonder bewijseis is een etiket dat iedereen erop kan
   plakken, en dan zegt 100% niets.
   ------------------------------------------------------------------------- */
const STATUS = {
  PROTECTED: {
    uitleg: 'Een herhaling doet het werk niet nog een keer. Vastgesteld, niet aangenomen.',
    eist: 'bewijs: een gemeten ronde waarin de tweede oproep GEEN tweede effect had, ' +
      'plus een duplicaatregel in lib/idemsleutels.js of een eigen afhandeling in de route.',
    eindstand: true
  },
  INTENTIONALLY_NON_IDEMPOTENT: {
    uitleg: 'Een herhaling IS een tweede handeling, en dat hoort zo. De worp, de teller, ' +
      'het bericht dat je twee keer verstuurt.',
    eist: 'een REDEN (waarom een tweede aanroep een tweede handeling is) en bewijs dat het ' +
      'gedrag ook werkelijk zo is -- een bewering zonder meting is hier het gevaarlijkst, ' +
      'want zij geeft toestemming om niets te doen.',
    eindstand: true
  },
  NOT_APPLICABLE: {
    uitleg: 'Deze route verandert niets. Een POST die rekent of opzoekt.',
    eist: 'bewijs dat er niets verandert: een gemeten ronde zonder spoor in de opslag, ' +
      'en een mens die de handler heeft nagekeken op wat de meter NIET ziet ' +
      '(een bestand, een externe dienst, een teller buiten de gemeten collecties).',
    eindstand: true
  },
  UNTESTABLE_WITH_JUSTIFIED_REASON: {
    uitleg: 'Van buiten niet te beproeven, en de reden is structureel -- geen gebrek aan tijd.',
    eist: 'een reden die zegt WAAROM het niet kan, en wat er waar zou moeten worden om het ' +
      'wel te kunnen. "Nog niet aan toegekomen" is hier geen reden maar de stand eronder.',
    eindstand: true
  },
  BLOCKED_BY_TEST_FIXTURE: {
    uitleg: 'Wel beproefbaar, maar de proefopstelling kan de toestand nog niet bouwen: ' +
      'een bestaand object, een sleutel in het lijf, een zaak van een bepaald genre.',
    eist: 'wat er in de wereld moet worden gebouwd om hem wel te bereiken. Dat is werk met ' +
      'een adres, en daarom een eigen stand en geen restpost.',
    eindstand: false,
    /* Niet nul, maar wel eindig: elke regel hier hoort een opdracht te zijn die
       iemand kan uitvoeren. Blijft hij jaren staan, dan was het in werkelijkheid
       UNTESTABLE en hoort de reden dat te zeggen. */
    hoortTeSlinken: true
  },
  LEGACY_PENDING_CLASSIFICATION: {
    uitleg: 'Nog niet ingedeeld. Niet veilig, niet onveilig -- ONBEKEND.',
    eist: 'niets, en dat is het probleem. Dit is de enige stand die naar nul moet.',
    eindstand: false,
    hoortTeSlinken: true,
    naarNul: true
  }
};

/* ---------------------------------------------------------------------------
   AS 4: WIE MAG HIER BINNEN.

   Ook hier zes, en ook hier is de bedoeling dat "geen rol" ophoudt een restpost
   te zijn. scripts/lib/bewakers.js ziet WAT ER STAAT; deze lijst zegt WAT DE
   BEDOELING WAS. Die twee horen overeen te komen, en waar ze dat niet doen is
   dat een bevinding -- dat is precies wat scripts/mutatiecontract.js vergelijkt.
   ------------------------------------------------------------------------- */
const TOEGANG = {
  PUBLIC: {
    uitleg: 'Met opzet open, zonder enige sleutel. Een aanmelding, een inlog, een activatie.',
    eist: 'een reden waarom open hier moet, en een rem -- open en scheppend zonder rem is een ' +
      'uitnodiging. scripts/poortwacht.js kent deze routes als PUBLIEK.'
  },
  AUTHENTICATED: {
    uitleg: 'Een ingelogde identiteit, verder niets: elk lid, elke zaak, elke medewerker van die soort.',
    eist: 'een bewakerslaag die de identiteit vaststelt (auth, supplierAuth, officeAuth).'
  },
  CAPABILITY_GATED: {
    uitleg: 'Een identiteit PLUS een bevoegdheid die zij kan hebben of niet.',
    eist: 'de naam van de bevoegdheid, zodat kern/bevoegdheid/lijst.js en deze route ' +
      'over hetzelfde ding praten.'
  },
  OBJECT_SCOPED: {
    uitleg: 'De toegang hangt aan een OBJECT uit het verzoek: uw gezin, uw werkruimte, uw zaak. ' +
      'Twee mensen met dezelfde rol krijgen hier een ander antwoord.',
    eist: 'welk veld het object aanwijst. Zonder dat is de route niet te beproeven zonder ' +
      'een tweede eigenaar, en dat is een IDOR-proef en geen idempotentieproef.'
  },
  SERVICE_TO_SERVICE: {
    uitleg: 'Geen mens. Een koppeling met een eigen geheim: SCIM, een provider die terugbelt, een sonde.',
    eist: 'waar dat geheim vandaan komt en hoe het te roteren is.'
  },
  SYSTEM_INTERNAL: {
    uitleg: 'Niet bedoeld voor een aanroeper van buiten. De opstelling beslist, niet de bezoeker.',
    eist: 'de omgevingsvoorwaarde die hem opent of sluit -- en het bewijs dat hij van buiten dicht is.'
  }
};

const STATUSNAMEN = Object.keys(STATUS);
const TOEGANGNAMEN = Object.keys(TOEGANG);


module.exports = { STATUS, TOEGANG, STATUSNAMEN, TOEGANGNAMEN };
