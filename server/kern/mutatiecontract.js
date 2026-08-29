/* ============================================================================
   HET MUTATIECONTRACT -- wat dit huis van elke schrijfroute WEET.

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

const mutatie = require('./mutatie');

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

/* ---------------------------------------------------------------------------
   DE KEURING VAN EEN CONTRACT.

   Elke stand eist iets anders, en dat is de hele reden dat deze functie bestaat.
   Zou hij alleen controleren of de velden bestaan, dan was het een formulier;
   nu is het een lat. De strengste eis staat op de twee standen die TOESTEMMING
   geven om niets te doen: INTENTIONALLY_NON_IDEMPOTENT en NOT_APPLICABLE. Wie
   daar mag landen zonder bewijs, heeft een knop gevonden waarmee elke route in
   een middag "geclassificeerd" is.
   ------------------------------------------------------------------------- */
function keur(c) {
  const fouten = [];
  const naam = (c && (c.mutatieId || c.route)) || '(naamloos)';

  if (!c || typeof c !== 'object') return ['(geen contract)'];
  if (!c.mutatieId) fouten.push(naam + ': geen mutatieId. Een contract zonder naam is niet te bespreken.');
  if (!c.route) fouten.push(naam + ': geen route.');

  /* AS 1 -- de semantiek komt uit kern/mutatie.js en wordt hier NIET opnieuw
     gedefinieerd, alleen gecontroleerd. */
  if (!c.semantiek || !c.semantiek.klasse) {
    fouten.push(naam + ': geen semantiek.klasse. De klassen staan in kern/mutatie.js: ' + mutatie.NAMEN.join(', ') + '.');
  } else if (!mutatie.isKlasse(c.semantiek.klasse)) {
    fouten.push(naam + ': semantiek.klasse "' + c.semantiek.klasse + '" bestaat niet in kern/mutatie.js.');
  }

  /* AS 4 */
  if (!c.toegang || !c.toegang.klasse) {
    fouten.push(naam + ': geen toegang.klasse. De klassen zijn: ' + TOEGANGNAMEN.join(', ') + '.');
  } else if (!TOEGANGNAMEN.includes(c.toegang.klasse)) {
    fouten.push(naam + ': toegang.klasse "' + c.toegang.klasse + '" bestaat niet.');
  } else {
    if (c.toegang.klasse === 'CAPABILITY_GATED' && !c.toegang.bevoegdheid) {
      fouten.push(naam + ': CAPABILITY_GATED zonder de NAAM van de bevoegdheid. Dan praat dit contract ' +
        'over iets anders dan kern/bevoegdheid/lijst.js, en dat verschil valt nooit op.');
    }
    if (c.toegang.klasse === 'OBJECT_SCOPED' && !c.toegang.objectVeld) {
      fouten.push(naam + ': OBJECT_SCOPED zonder objectVeld. Zonder te weten welk veld het object ' +
        'aanwijst kan geen enkele proefopstelling de toestand bouwen.');
    }
    if (c.toegang.klasse === 'PUBLIC' && !c.toegang.waarom) {
      fouten.push(naam + ': PUBLIC zonder reden. Open is een besluit; zonder reden is het een gat ' +
        'dat toevallig nog niemand heeft gedicht.');
    }
  }

  /* AS 5 */
  if (!c.stand) {
    fouten.push(naam + ': geen stand. De standen zijn: ' + STATUSNAMEN.join(', ') + '.');
  } else if (!STATUSNAMEN.includes(c.stand)) {
    fouten.push(naam + ': stand "' + c.stand + '" bestaat niet.');
  } else {
    const bewijs = c.bewijs || {};
    const heeftMeting = !!(bewijs.gemeten && bewijs.op);
    if (c.stand === 'PROTECTED' && !heeftMeting) {
      fouten.push(naam + ': PROTECTED zonder meting. Deze stand betekent "vastgesteld"; zonder ' +
        'bewijs.gemeten en bewijs.op is het een vermoeden met een geruststellende naam.');
    }
    if (c.stand === 'INTENTIONALLY_NON_IDEMPOTENT') {
      if (!c.waarom) fouten.push(naam + ': INTENTIONALLY_NON_IDEMPOTENT zonder waarom. Deze stand geeft ' +
        'toestemming om niets te doen; zonder reden is hij een ontsnapping.');
      if (!heeftMeting) fouten.push(naam + ': INTENTIONALLY_NON_IDEMPOTENT zonder meting. "Het hoort zo" ' +
        'en "het gebeurt ook zo" zijn twee beweringen, en juist hier moeten ze allebei waar zijn.');
    }
    if (c.stand === 'NOT_APPLICABLE') {
      if (!heeftMeting) fouten.push(naam + ': NOT_APPLICABLE zonder meting.');
      if (!c.nagekeken) fouten.push(naam + ': NOT_APPLICABLE zonder `nagekeken`. De meter ziet alleen ' +
        'de collecties in de database -- een bestand, een externe dienst of een teller daarbuiten ziet ' +
        'hij niet. Een mens moet de handler hebben gelezen.');
    }
    if (c.stand === 'UNTESTABLE_WITH_JUSTIFIED_REASON' && !c.waarom) {
      fouten.push(naam + ': UNTESTABLE zonder reden. De reden IS de rechtvaardiging; zonder haar is ' +
        'dit LEGACY_PENDING_CLASSIFICATION met een net gezicht.');
    }
    if (c.stand === 'BLOCKED_BY_TEST_FIXTURE' && !c.watErMoetKomen) {
      fouten.push(naam + ': BLOCKED_BY_TEST_FIXTURE zonder `watErMoetKomen`. Deze stand is een OPDRACHT; ' +
        'zonder adres is het een wachtkamer.');
    }
  }

  return fouten;
}

/* DE POORT. Aanroepen bij het OPBOUWEN, net als mutatie.poort() -- een contract
   dat niet deugt hoort de bouw te laten zakken en niet een verzoek van een lid. */
function poort(contracten, waar) {
  const plek = String(waar || 'een verzameling contracten');
  const fouten = [];
  for (const c of Array.isArray(contracten) ? contracten : Object.values(contracten || {})) {
    for (const f of keur(c)) fouten.push(f);
  }
  if (fouten.length) {
    throw new Error('Mutatiecontracten deugen niet in ' + plek + ':\n  - ' + fouten.join('\n  - '));
  }
  return true;
}

/* De telling waarop het dashboard rust. Eén plek, zodat het scherm, de toets en
   de release-poort niet elk hun eigen optelling maken. */
function telling(contracten) {
  const uit = { totaal: 0, perStand: {}, perToegang: {}, perSemantiek: {},
    zonderEindstand: 0, naarNul: 0 };
  for (const c of Array.isArray(contracten) ? contracten : Object.values(contracten || {})) {
    uit.totaal++;
    const s = c.stand || 'LEGACY_PENDING_CLASSIFICATION';
    uit.perStand[s] = (uit.perStand[s] || 0) + 1;
    const t = (c.toegang && c.toegang.klasse) || '(geen)';
    uit.perToegang[t] = (uit.perToegang[t] || 0) + 1;
    const m = (c.semantiek && c.semantiek.klasse) || '(geen)';
    uit.perSemantiek[m] = (uit.perSemantiek[m] || 0) + 1;
    const d = STATUS[s];
    if (d && !d.eindstand) uit.zonderEindstand++;
    if (d && d.naarNul) uit.naarNul++;
  }
  return uit;
}

module.exports = { STATUS, TOEGANG, STATUSNAMEN, TOEGANGNAMEN, keur, poort, telling };
