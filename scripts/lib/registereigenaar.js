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
   Zij vindt `writeFileSync` met een doel dat als letterlijke registernaam in de
   aanroep staat of via een `const` in hetzelfde bestand te herleiden is. Een
   script dat zijn pad over drie regels opbouwt of via een helper schrijft, valt
   erbuiten. Gemeten: 25 van de 137 wortelregisters hebben zo'n herleidbare
   schrijver. Daarom is de VERKLARING leidend en de detectie de controle erop --
   niet andersom.

   WAT ONBEKEND BETEKENT. Een register dat hier niet staat, heeft geen verklaarde
   eigenaar. Dat is een open post en geen fout: niemand heeft het opgeschreven, en
   het getal hoort te dalen doordat er eigenaren bijkomen. test/registereigenaar.test.js
   houdt die vloer vast. */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..', '..');

/* De verklaarde eigenaren. `schrijver` is een scriptpad; `handmatig` betekent dat
   er geen programma is en dat een mens of een keuring hem onderhoudt -- dan hoort
   er een LEZER bij te staan, want een register dat niemand leest is geen register. */
const EIGENAAR = {
  /* De aanleiding zelf. Er is geen schrijvend script: de lijst wordt met de hand
     onderhouden en mag alleen krimpen. */
  'BEREIK.json': { handmatig: true, lezer: 'test/bereikbaar.test.js',
    waarom: 'schuldlijst van schermen zonder klikroute; wordt met de hand bijgehouden en mag alleen krimpen. ' +
      'Precies daarom kon een nieuw script hem stil overschrijven zonder dat een schrijverscan iets zag.' },

  /* De internationale laag. Beide hebben een eigen ratel (scripts/lib/metingen.js)
     en worden door precies een script geschreven; ze staan hier zodat het getal
     van toets 4 daalt doordat er eigenaren bijkomen, en niet stijgt doordat er
     registers bijkomen zonder dat iemand zegt wie ze bezit. */
  'LANDDEKKING.json': { schrijver: 'scripts/landdekking.js' },
  'SOEVEREIN.json': { schrijver: 'scripts/soeverein.js' },
  'DOORBELASTING.json': { schrijver: 'scripts/doorbelasting.js' },

  /* De lagen die in deze tak zijn gebouwd. */
  'DOCTRINE.json': { schrijver: 'scripts/doctrine.js' },
  'VERBAND.json': { schrijver: 'scripts/verband.js' },
  'GELDING.json': { schrijver: 'scripts/gelding.js' },

  /* De dragende registers van de bewijsmachine. */
  'WETTEN.json': { handmatig: true, lezer: 'scripts/wetten.js',
    waarom: 'een wet is een BESLUIT en geen berekening; scripts/wetten.js leest en keurt, hij schrijft niet' },
  'SABOTAGE.json': { schrijver: 'scripts/sabotage.js' },
  'MUTATIES.json': { schrijver: 'scripts/mutatie.js' },
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
};

/* MEETING: welk script schrijft aantoonbaar naar een wortelregister? Ondergrens,
   zie de kop. */
function detecteer() {
  const uit = new Map();
  const loop = (map) => {
    for (const n of fs.readdirSync(map, { withFileTypes: true })) {
      const p = path.join(map, n.name);
      if (n.isDirectory()) { loop(p); continue; }
      if (!n.name.endsWith('.js')) continue;
      const code = fs.readFileSync(p, 'utf8');
      for (const m of code.matchAll(/writeFileSync\(\s*([^,]{0,80}?)\s*,/g)) {
        const doel = m[1].trim();
        let naam = null;
        const letterlijk = doel.match(/'([A-Z][A-Z0-9_.-]*\.json)'/);
        if (letterlijk) naam = letterlijk[1];
        else if (/^[A-Z_]+$/.test(doel)) {
          const c = code.match(new RegExp('const\\s+' + doel + '\\s*=[^;]*?\'([A-Z][A-Z0-9_.-]*\\.json)\''));
          if (c) naam = c[1];
        }
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
