/* WIE BEZIT DIT REGISTER?

   DE AANLEIDING IS EEN FOUT VAN 13 SEPTEMBER 2026. Er kwam een nieuwe meter bij
   die zijn uitslag naar BEREIK.json schreef. Dat bestand bestond al sinds
   652f76b2 en is het SCHERMBEREIK-register: "schermen zonder zichtbare klikroute
   vanaf /apps/app.html, mag alleen krimpen", gelezen door test/bereikbaar.test.js
   en genoemd in scripts/check.js. Het werd stil overschreven -- de nieuwe inhoud
   was geldige JSON, alleen over iets anders.

   NIETS HIELD DAT TEGEN, en dat is het gat dat dit bestand dicht doet.
   scripts/versheid.js kent de lijst registers en scripts/lib/metingen.js kent hun
   ratels, maar geen van beide vraagt WIE er schrijft. En de scan die er wel op
   lijkt (`schrijvers()` in test/versheidsdekking.test.js) vindt VERMELDINGEN en
   geen schrijfacties: hij telt ook elke lezer mee, en hij mist elk register dat
   met de hand wordt onderhouden. BEREIK.json is allebei -- geen enkel script
   schrijft hem programmatisch.

   TWEE DINGEN, EN ZE ZIJN MET OPZET GESCHEIDEN

     EIGENAAR   een VERKLARING: wie bezit dit register? Een besluit van een mens,
                zoals WETTEN.json en scripts/lib/ijking.js dat ook zijn.
     detecteer  een MEETING: welk script schrijft aantoonbaar naar een register?

   De toets legt die twee naast elkaar. Schrijft een script naar een register dat
   iemand anders bezit, dan is dat rood -- ongeacht of het bestand er al stond.

   DE DETECTIE IS EEN ONDERGRENS, en dat hoort hier te staan (LAT.md regel 13).
   Zij vindt `writeFileSync` met een doel dat als letterlijke artefactnaam in de
   aanroep staat of via een `const`, `let` of `var` in hetzelfde bestand te
   herleiden is. Een script dat zijn pad over drie regels opbouwt of via een
   helper schrijft, valt erbuiten.

   HET BEREIK IS .json EN .md, en dat is een uitbreiding van 16 september 2026.
   Afgeleide waarheid woont in dit huis in twee bestandssoorten: ARCHITECTUUR.md,
   BEWIJS.md en FUNCTIES.md worden net zo goed gegenereerd als DEKKING.json. Bij
   de samenvoeging met main van 15 september waren 5 van de 19 conflicten precies
   zulke documenten, en ze vielen buiten elk eigenaarsysteem omdat
   `wortelregisters()` op .json filtert. Gemeten: 25 van de 137 wortelregisters hebben zo'n herleidbare
   schrijver. Daarom is de VERKLARING leidend en de detectie de controle erop --
   niet andersom.

   WAT ONBEKEND BETEKENT. Een register dat hier niet staat, heeft geen verklaarde
   eigenaar. Dat is een open post en geen fout: niemand heeft het opgeschreven, en
   het getal hoort te dalen doordat er eigenaren bijkomen. test/registereigenaar.test.js
   houdt die vloer vast. */
'use strict';
const fs = require('fs');
const path = require('path');
const { zonderCommentaar } = require('./bron');

const WORTEL = path.join(__dirname, '..', '..');

/* De verklaarde eigenaren. `schrijver` is een scriptpad; `handmatig` betekent dat
   er geen programma is en dat een mens of een keuring hem onderhoudt -- dan hoort
   er een LEZER bij te staan, want een register dat niemand leest is geen register. */
const EIGENAAR = {
  'WORLD-DESKTOP.md': { soort: 'BRON',
    waarom: 'Handmatig onderhouden ontwerp- en bereikbeschrijving van de desktopwerelden; uitvoerbare toetsen leveren het afzonderlijke bewijs.' },
  'WEBSITE-STORYLINE.md': { soort: 'BRON',
    waarom: 'Handmatig onderhouden ontwerp en inhoudelijke grenzen van de publieke websites; geen automatisch gegenereerde meting.' },
  /* De taalproef schrijft alle drie rapporten via dezelfde begrensde namenlijst,
     pas na geslaagde tests en een vergelijking van de bronafdrukken. De lexicale
     schrijverscan kan die dynamische writeFileSync niet tot een naam herleiden. */
  'LANGUAGECAPABILITY.json': { schrijver: 'scripts/language-proof.js',
    waarom: 'language-proof.js schrijft de namenlijst pas na browserbewijs; --check weigert afwijkende bronafdrukken. Dit is werkboombewijs, geen productieattest.' },
  'MEANINGPARITY.json': { schrijver: 'scripts/language-proof.js',
    waarom: 'language-proof.js schrijft de namenlijst pas na geslaagde betekenisproeven; --check bewaakt de bronafdrukken en de gemeten reikwijdte blijft expliciet.' },
  'LANGUAGEFAILOVER.json': { schrijver: 'scripts/language-proof.js',
    waarom: 'language-proof.js schrijft de namenlijst pas na de geisoleerde HTTP-uitvalproef; --check bewaakt de bronafdrukken. Dit simuleert geen productiebewijs.' },
  'WORLD-HOMES.md': { soort: 'BRON',
    waarom: 'Handmatig onderhouden ontwerp- en implementatienotitie voor de drie goedgekeurde homes, met de daadwerkelijk uitgevoerde proeven en hun grenzen.' },
  'LANGUAGE.md': { soort: 'BRON',
    waarom: 'Handmatig onderhouden architectuur- en bereikbeschrijving; de drie taalrapporten dragen het afzonderlijke uitvoerbare bewijs.' },
  'AUTHORITY.md': { soort: 'BRON',
    waarom: 'Handmatig geschreven richtingsdocument (RTG Authority Engine); de bronverwijzingen zijn met de hand nagelopen, er is geen generator die het schrijft.' },
  'BENOEMING.md': { soort: 'BRON',
    waarom: 'Handmatig geschreven richtingsdocument (RTFoundation Roles & Governance 2.0); de bronverwijzingen erin zijn met de hand nagelopen, er is geen generator die het schrijft.' },
  'POLITIEK.md': { soort: 'BRON',
    waarom: 'Handmatig geschreven richtingsdocument (DemocratieOS en de partij); de bronverwijzingen erin zijn met de hand nagelopen, er is geen generator die het schrijft.' },
  'BEWIJSLUS.md': { soort: 'BRON',
    waarom: 'Handmatig geschreven richtingsdocument (de terugweg van productie naar bewijs); de namen en bronverwijzingen erin zijn met de hand gemeten, er is geen generator die het schrijft.' },
  'LANGUAGE-AUDIT.md': { soort: 'BRON',
    waarom: 'Handmatig beoordeelde bevindingen en resterende taalgrenzen; geen automatisch gegenereerd register.' },
  /* De aanleiding zelf. Er is geen schrijvend script: de lijst wordt met de hand
     onderhouden en mag alleen krimpen. */
  /* De consolidatieronde van 23 september 2026: de meting (welke schermen
     roepen dezelfde paden aan) en het besluit (wie is eigenaar per capability)
     zijn twee bestanden, en alleen de eerste heeft een schrijver. */
  'SCHERMFUNCTIE.json': { schrijver: 'scripts/schermfunctie.js' },
  'SCHERMEIGENAAR.json': { handmatig: true, lezer: 'test/schermeigenaar.test.js',
    waarom: 'het eigenaarsregister is een BESLUIT per capability en per overlappend paar; de toets houdt het ' +
      'tegen een verse meting van scripts/schermfunctie.js, en wie het uit die meting genereert laat de toets ' +
      'met zichzelf vergelijken' },
  'BEREIK.json': { handmatig: true, lezer: 'test/bereikbaar.test.js',
    waarom: 'schuldlijst van schermen zonder klikroute; wordt met de hand bijgehouden en mag alleen krimpen. ' +
      'Precies daarom kon een nieuw script hem stil overschrijven zonder dat een schrijverscan iets zag.' },

  /* De internationale laag. Beide hebben een eigen ratel (scripts/lib/metingen.js)
     en worden door precies een script geschreven; ze staan hier zodat het getal
     van toets 4 daalt doordat er eigenaren bijkomen, en niet stijgt doordat er
     registers bijkomen zonder dat iemand zegt wie ze bezit. */
  /* HET VERANDERBEREIK. Een schrijver, een ratel (veranderbereikZonderBereik in
     scripts/lib/metingen.js) en een ijkproef in test/meterijk.test.js. Hij staat
     hier om dezelfde reden als de twee hieronder: het getal van toets 4 hoort te
     dalen doordat er eigenaren bijkomen, niet te stijgen doordat er registers
     bijkomen zonder dat iemand zegt wie ze bezit. */
  'VERANDERBEREIK-KENNIS.json': { schrijver: 'scripts/veranderbereik.js' },
  'VERANDERBEREIK-RONDE.json': { schrijver: 'scripts/veranderbereik.js' },
  /* DE EDGE (EDGE.md par. 9). Twee meters en elk zijn eigen bestand: de kaart
     leest de BRON (wie schrijft, beslist en leest), de dekking een echte
     BROWSER (welk veld heeft elk scherm, en waar komt het vandaan). Hun ratels
     staan in scripts/norm.js; dat de meters kunnen uitslaan in test/meterijk.test.js. */
  'EDGEKAART.json': { schrijver: 'scripts/edgekaart.js' },
  'EDGEDEKKING.json': { schrijver: 'scripts/edgedekking.js' },
  'LANDDEKKING.json': { schrijver: 'scripts/landdekking.js' },
  'SOEVEREIN.json': { schrijver: 'scripts/soeverein.js' },
  'DOORBELASTING.json': { schrijver: 'scripts/doorbelasting.js' },
  'STEMPELVEILIGHEID.json': { schrijver: 'scripts/stempelveiligheid.js' },

  /* De persoonlijke laag (NEIGING.md par. 0). Eén schrijver, en hij draagt twee
     ratels in scripts/lib/metingen.js -- staat hij hier niet, dan stijgt het
     getal van toets 4 doordat er een register bijkomt zonder dat iemand zegt wie
     het bezit, en dat is precies wat die toets moet tegenhouden. */
  'NEIGINGVORM.json': { schrijver: 'scripts/neigingvorm.js' },

  /* De planvorm: delen de plandomeinen een datavorm en een planlus? Eén
     schrijver, één ratel in scripts/lib/metingen.js (`planDomeinenGemeten`, het
     BEREIK) met een ijking in test/meterijk.test.js, en een regel in de
     versheidslijst van scripts/versheid.js. Hij staat hier om precies de reden
     die bij NEIGINGVORM.json hierboven staat -- en dat is hier geen theorie: hij
     is er bij het bouwen op omgevallen. Toets 4 ging van 146 naar 147 en zei
     erbij wat de bedoeling is: het getal hoort te dalen doordat er eigenaren
     bijkomen, niet te stijgen doordat er registers bijkomen zonder eigenaar. De
     vloer oprekken zou die zin precies omdraaien. */
  'PLANVORM.json': { schrijver: 'scripts/planvorm.js' },

  /* De officevorm: is er een `RTGObject` onder document, taak, betaling en de
     andere subtypen die het voorstel voor RTG Office Next noemt (OFFICE.md par.
     0)? Zelfde vorm als de planvorm hierboven: een schrijver, een ratel op het
     BEREIK, een ijking en een regel in de versheidslijst. */
  'OFFICEVORM.json': { schrijver: 'scripts/officevorm.js' },

  /* De spiegel van STILSPOOR: lezers die een onleesbaar bewijs als een afwezig
     bewijs behandelen. Vier tanden in scripts/lib/metingen.js, en de detectie
     hieronder vindt hem niet (het doel staat in een `const DOEL` die via
     path.join is opgebouwd) -- precies de ondergrens die de kop beschrijft. */
  'STILLEZING.json': { schrijver: 'scripts/stillezing.js' },

  /* Foundation Connect (CONNECT.md par. 1). Hij meet of de ontdekkingsdomeinen
     de lus DELEN, en op die nul rust het besluit dat kern/connect/ een
     projectie wordt en geen gedeeld inhoudstype. Een eigen ratel in
     scripts/lib/metingen.js (`connectDomeinenGemeten`, het BEREIK) met een
     ijking in test/meterijk.test.js. */
  'CONNECTLUS.json': { schrijver: 'scripts/connectlus.js' },
  /* De classificatie van afgeleide waarheid zelf. Hij leest EIGENAAR hierboven,
     dus hij hoort er ook zelf in te staan -- een register dat anderen indeelt
     en zichzelf overslaat, is de eerste plek waar het contract scheurt. */
  'AFGELEID.json': { schrijver: 'scripts/afgeleid.js' },

  /* De proef die bij dat eigenaarschap hoort: draai die eigenaar, en komt er
     hetzelfde uit? Hij hoort hier om dezelfde reden als AFGELEID.json hierboven
     -- een laag die over eigenaarschap gaat en haar eigen uitvoer niet verklaart,
     is de eerste plek waar het contract scheurt. Toets 4 van
     test/registereigenaar.test.js ving dat binnen een CI-ronde: het getal ging
     van 146 naar 147 doordat er een register bijkwam zonder dat iemand zei wie
     het bezit -- precies wat die tand moet vangen, nu op mijn eigen werk. */
  'HERBOUWPROEF.json': { schrijver: 'scripts/herbouwproef.js' },

  /* DE EERSTE MOMENTOPNAME, en die stand bestond tot nu toe alleen op papier.

     BEWIJSKOSTEN.json meet wat een correcte verandering kost over een BEREIK
     (standaard het aftakpunt van main tot HEAD). Opnieuw draaien op een ander
     bereik geeft terecht een andere uitslag, dus "loopt achter" is er geen
     zinnig oordeel over -- en een ratel eroverheen zou verbeteren door het
     bereik te verkleinen, precies de faalvorm waar `afgeleidMetEigenaar` voor
     bestaat. Daarom MOMENTOPNAME en niet AFGELEID: hij heeft wel een eigenaar
     en geen versheid. */
  'BEWIJSKOSTEN.json': { soort: 'MOMENTOPNAME', schrijver: 'scripts/bewijskosten.js' },

  /* De lagen die in deze tak zijn gebouwd. */
  'IDEMIDENTITEIT.json': { schrijver: 'scripts/idemidentiteit.js' },
  'DOCTRINE.json': { schrijver: 'scripts/doctrine.js' },
  'VERBAND.json': { schrijver: 'scripts/verband.js' },
  'GELDING.json': { schrijver: 'scripts/gelding.js' },

  /* De dragende registers van de bewijsmachine. */
  'WETTEN.json': { handmatig: true, lezer: 'scripts/wetten.js',
    waarom: 'een wet is een BESLUIT en geen berekening; scripts/wetten.js leest en keurt, hij schrijft niet' },
  'SABOTAGE.json': { schrijver: 'scripts/sabotage.js' },
  'MUTATIES.json': { schrijver: 'scripts/mutatie.js',
    waarom: 'de detectie ziet hem NIET, en dat is een eigenschap van de meter en niet van de motor: ' +
      'scripts/mutatie.js schrijft via een eigen helper (`schrijf(UITSLAG)`) en niet met een ' +
      'writeFileSync waar de naam bij staat. Precies de ondergrens die in de kop hierboven staat. ' +
      'De verklaring is hier dus leidend, en het bestand zelf noemt MUTATIES.json op vier plekken ' +
      'in zijn kop als de uitslag die het bijhoudt.' },
  'GRENZEN.json': { schrijver: 'scripts/grenslijst.js',
    waarom: 'scripts/grensmeld.js schrijft er ook naar, maar alleen om een geknelde naam BIJ te schrijven; ' +
      'de lijst zelf is een besluit dat grenslijst.js opstelt' },
  /* MIJN EIGEN VERKLARING WAS FOUT, en deze wachter betrapte hem binnen een
     minuut: BEWIJSSCHULD.json wordt wel degelijk geschreven, door
     scripts/bewijsschuld.js. Ik had hem als handmatig opgeschreven omdat
     test/versheidsdekking.test.js hem zo noemt -- en dat gaat over de VERSHEID,
     niet over de schrijver. Twee registers met bijna dezelfde vraag geven bijna
     hetzelfde antwoord, en dat is precies waarom de meting naast de verklaring
     staat. */
  'BEWIJSSCHULD.json': { schrijver: 'scripts/bewijsschuld.js' },

  /* NORM.json is met OPZET gedeeld: elke meter schrijft zijn eigen getal in de
     ratel. Dat is geen botsing maar de vorm van dat register. */
  'NORM.json': { schrijver: 'scripts/norm.js',
    waarom: 'de ratel is gedeeld bezit: elke meter schrijft zijn eigen getal erin (dekking, samenhang, ' +
      'schermen, wetten). norm.js is de eigenaar van de VORM, niet van elke waarde.' },

  /* DEZE WACHTER BETRAPTE ZIJN EIGEN BOUWER, en dat is het punt van de vloer.
     NAMENSVORM.json kwam er op 14 september bij zonder verklaring, en toets 4
     zakte op 147 terwijl de vloer op 146 staat -- terwijl `npm run check`,
     `npm run registerklopt` en `npm run norm` alle drie lokaal groen stonden.
     LAT.md regel 17 in het klein: een poort bewijst alleen zijn eigen bereik. */
  'NAMENSVORM.json': { schrijver: 'scripts/namensvorm.js',
    waarom: 'de meting achter REPRESENTATIE.md par. 0: delen de zeven manieren van ' +
      'namens-iemand-handelen een vorm en een woordenschat? Geschreven met --vastleggen, ' +
      'gelezen door test/namensvorm.test.js, scripts/norm.js (de ratel namensMechanismenGemeten) ' +
      'en scripts/getallen.js (zeven levende getallen in het document).' },
  'SPOORVORM.json': { schrijver: 'scripts/spoorvorm.js',
    waarom: 'de convergentiematrix achter REPRESENTATIE.md par. 8.1: hoeveel van de zeven ' +
      'mechanismen halen de vier spoor-eigenschappen die kern/vertegenwoordiging/handelen.js ' +
      'definieert? Geschreven met --vastleggen, gelezen door test/spoorvorm.test.js en ' +
      'scripts/norm.js (de ratel spoorConvergent, die alleen omhoog mag).' },
  /* DE ONDERNEMERSLUS. Hij staat hier omdat toets 4 dat zo bedoelt: het aantal
     registers zonder eigenaar hoort te dalen doordat er eigenaren bijkomen, en
     niet te stijgen doordat er registers bijkomen. Een nieuw register zonder
     regel hier zou die vloer optillen, en dat is precies de beweging die de
     ratel moet tegenhouden -- ook (juist) als het je eigen register is. */
  'ONDERNEMERSLUS.json': { schrijver: 'scripts/ondernemerslus.js' },

  /* Om dezelfde reden als hierboven: dit register komt met de tak die hem meet,
     dus de vloer optillen zou hier het goedkoopst zijn en het minst verdiend. */
  'KETENBEREIK.json': { schrijver: 'scripts/ketenbereik.js' },
  'PAKTEBETEKENIS.json': { schrijver: 'scripts/paktebetekenis.js' },
  'MANDAATPROEF.json': { schrijver: 'scripts/mandaatproef.js' },
  /* De Magnaat-grondwet komt met de tak die hem meet; zie MAGNAAT.md. */
  'MAGNAATGRONDWET.json': { schrijver: 'scripts/magnaatgrondwet.js' },
};

/* EEN CONSTANTE NAAR DE ARTEFACTNAAM HERLEIDEN, HOOGUIT TWEE SCHAKELS DIEP.

   Een schakel was niet genoeg, en scripts/executionmap.js laat zien waarom:

       const UIT = 'EXECUTION_MAP.json';
       const pad = path.join(WORTEL, UIT);
       fs.writeFileSync(pad, nieuw);

   `pad` draagt geen letterlijke naam, dus de detector gaf op -- en meldde het
   register als "geen aanwijsbare schrijver" terwijl de naam twee regels hoger
   letterlijk staat. Dat is precies de faalvorm die deze hele meting aan het
   licht bracht: een generator die bestaat en die de machine niet kan aanwijzen.

   Twee schakels en niet meer, met opzet: dieper wordt het een halve
   interpreter, en dan bewijst een treffer niets meer over wat er werkelijk
   gebeurt. Wat daarbuiten valt, hoort een VERKLARING te krijgen. */
function herleid(code, naam, diepte) {
  if (diepte <= 0) return null;
  const m = code.match(new RegExp('\\b(?:const|let|var)\\s+' + naam + '\\s*=([^;\\n]{0,200})'));
  if (!m) return null;
  const rechts = m[1];
  const letterlijk = rechts.match(/'([A-Z][A-Z0-9_.-]*\.(?:json|md))'/);
  if (letterlijk) return letterlijk[1];
  for (const v of rechts.matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
    if (v[1] === naam || ['path', 'join', 'require', 'process', 'env'].includes(v[1])) continue;
    const dieper = herleid(code, v[1], diepte - 1);
    if (dieper) return dieper;
  }
  return null;
}

/* HET EERSTE ARGUMENT, GEBALANCEERD GELEZEN.

   Hier stond `([^,]{0,80}?)\s*,` -- alles tot de EERSTE komma. Dat werkt voor
   `writeFileSync(DOEL, ...)` en breekt op de vorm die dit huis het vaakst
   gebruikt:

       fs.writeFileSync(path.join(WORTEL, 'COMMERCE.json'), ...)

   Daar staat de eerste komma BINNEN het argument, dus de detector las
   `path.join(WORTEL` als doel en vond niets. Vier generatoren vielen daardoor
   volledig buiten beeld (COMMERCE, MAGNAATLAB, MUTATIESEMANTIEK, OBJECTMODEL) --
   en ze stonden alle vier in de uitslag als "artefact zonder aanwijsbare
   schrijver", wat iets heel anders betekent dan wat er aan de hand was.

   Deze lezer telt haakjes mee en stopt pas bij een komma op diepte nul. Zelfde
   vorm als `blokVanaf()` in scripts/stilspoor.js: een regex kan dit niet. */
function eersteArgument(code, haakIdx) {
  let d = 0;
  for (let i = haakIdx; i < code.length && i < haakIdx + 400; i++) {
    const c = code[i];
    if (c === '(' || c === '[' || c === '{') d++;
    else if (c === ')' || c === ']' || c === '}') { d--; if (d === 0) return code.slice(haakIdx + 1, i).trim(); }
    else if (c === ',' && d === 1) return code.slice(haakIdx + 1, i).trim();
  }
  return null;
}

/* MEETING: welk script schrijft aantoonbaar naar een wortelregister? Ondergrens,
   zie de kop. */
function detecteer() {
  const uit = new Map();
  const loop = (map) => {
    for (const n of fs.readdirSync(map, { withFileTypes: true })) {
      const p = path.join(map, n.name);
      if (n.isDirectory()) { loop(p); continue; }
      if (!n.name.endsWith('.js')) continue;
      /* CODE EN COMMENTAAR ZIJN TWEE DINGEN (BEWIJSMACHINE.md par. 6a.1). Hier
         stond de ruwe bron, en dat was jarenlang onschadelijk tot dit bestand
         zelf een toelichting kreeg waarin 'COMMERCE.json' voorkomt: de detector
         meldde prompt dat scripts/lib/registereigenaar.js een tweede schrijver
         van COMMERCE.json was. Een meter die zijn eigen uitleg meet, vindt een
         botsing die niet bestaat -- en had net zo goed een echte kunnen missen
         doordat een uitgecommentarieerde oude schrijfactie meetelde.
         `regelsHeel` houdt de posities gelijk, wat hier niet nodig is maar ook
         niets kost en de vergelijking met de andere vormlezers bewaart. */
      const code = zonderCommentaar(fs.readFileSync(p, 'utf8'), { regelsHeel: true });
      for (const m of code.matchAll(/writeFileSync\(/g)) {
        const doel = eersteArgument(code, m.index + m[0].length - 1);
        if (doel === null) continue;
        let naam = null;
        const letterlijk = doel.match(/'([A-Z][A-Z0-9_.-]*\.(?:json|md))'/);
        if (letterlijk) naam = letterlijk[1];
        /* DE CONSTANTE HOEFT NIET IN HOOFDLETTERS. Hier stond `/^[A-Z_]+$/`, en
           dat is de huisconventie voor een moduleconstante -- maar niet iedereen
           volgt hem. scripts/capabilities.js schrijft naar `doel` (kleine
           letters, een lokale const in de functie) en viel daardoor volledig
           buiten de detectie, terwijl het bestand er twee regels boven letterlijk
           bij zegt dat het CAPABILITEIT.json schrijft. Een detector die alleen
           de nette helft ziet, meldt de slordige helft als "geen schrijver" --
           en dat is precies de uitslag die iemand zou lezen als "dit artefact
           heeft geen generator". */
        else if (/^[A-Za-z_$][\w$]*$/.test(doel)) naam = herleid(code, doel, 2);
        if (!naam) continue;
        if (!uit.has(naam)) uit.set(naam, new Set());
        uit.get(naam).add(path.relative(WORTEL, p));
      }
    }
  };
  loop(path.join(WORTEL, 'scripts'));
  return uit;
}

/* De registers in de wortel, zonder de twee die geen meting zijn. */
function wortelregisters() {
  return fs.readdirSync(WORTEL).filter(f => f.endsWith('.json') && !f.startsWith('package'));
}

/* GEMETEN BOTSINGEN DIE NIEMAND HEEFT VERKLAARD. Twee scripts schrijven naar
   hetzelfde register en er staat nergens waarom. Dat is een open post en geen
   fout -- maar hij mag niet groeien, want twee schrijvers op een bestand lopen
   een keer uiteen. Wie er een verklaart, haalt hem hier weg en zet de reden in
   EIGENAAR. Het getal hoort te dalen doordat er verklaringen bijkomen.

   Deze twee zijn NIET onderzocht: ik weet niet waarom er twee schrijvers zijn,
   en een reden verzinnen is precies wat regel 13 verbiedt. */
const ONVERKLAARDE_BOTSING = {
  'ENVELOP.json': 'scripts/actorvormen.js en scripts/envelopvelden.js schrijven er allebei naar',
  'OUTPUTPROEF.json': 'scripts/outputband.js en scripts/outputproef.js schrijven er allebei naar',
};

module.exports = { EIGENAAR, ONVERKLAARDE_BOTSING, detecteer, wortelregisters, WORTEL };
