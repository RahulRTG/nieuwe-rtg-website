/* DE EENHEID VAN GELD -- en de naam die drie dingen betekende.

   DEZE TOETS KOMT UIT EEN METING. COMMERCE.md hield "de optellingen" overeind
   als de duurste post. Bij het natellen bleek het risico ergens anders te
   zitten: er stonden ZEVEN functies met de naam `centen` en ze deden drie
   verschillende dingen met een bedrag.

     kern/util.js         centen(n) = round(n * 100) / 100      -> euro's blijven euro's
     school/financien.js  centen(v) = round(v * 100)            -> euro's worden centen
     kern/labfonds.js     centen(euro) = round(euro * 100)      -> euro's worden centen
     bedrijf/klant.js     centen(x) = ... * 100                 -> euro's worden centen
     bedrijf/project.js   centen(x) = ... * 100                 -> euro's worden centen
     kern/rtfos/basis.js  centen(v) = ... * 100                 -> euro's worden centen
     kern/horeca.js       centen(v) = round(v)                  -> ongewijzigd

   Er stonden er VIER in dit lijstje toen het werd geschreven. De laatste drie
   zijn erbij gekomen door te tellen in plaats van te kijken, en de zevende werd
   pas door toets 7b hieronder gevonden -- nadat zijn aanroepers al hernoemd
   waren. Dat is precies waar deze toets voor is.

   EN ER WAS EEN ACHTSTE, aan de andere kant van de lijn: `Geld.centen` in
   public/apps/geld/hulp.js zette euro's om naar centen. De wachten hieronder
   lezen daarom server/ EN public/ -- een huisregel die bij de servergrens stopt,
   is een halve huisregel. Wat public/ met opzet WEL mag houden is een losse
   `var centen = ...` die een bedrag vasthoudt; die zegt wat hij is.

   `centen(x)` LEEST als "maak er centen van" en doet dat in kern/util.js juist
   niet. Er was niets kapot -- nagelopen -- maar dat was geluk: dezelfde familie
   fout kostte deze laag al een keer een factor honderd (`bedrag` in euro's dat
   als centen werd gelezen, zie kern/commerce/koopbaarlijst.js).

   DE ZWAARSTE TOETS IS 7. Die telt hoeveel functies met de naam `centen` er nog
   staan die van EENHEID veranderen, en houdt dat getal op nul. Zonder die toets
   groeit de verwarring gewoon weer aan -- dezelfde afspraak als de BEKEND-lijst
   in scripts/check.js: hij mag krimpen en nooit groeien.

   Draai los: node --test test/geldeenheid.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const G = require('../server/kern/geld/eenheid');

const WORTEL = path.join(__dirname, '..');

test('1. naarCenten gaat van euro naar cent, en weigert wat geen getal is', () => {
  assert.equal(G.naarCenten(10), 1000);
  assert.equal(G.naarCenten(0), 0, 'nul is een bedrag');
  assert.equal(G.naarCenten(12.345), 1235, 'op de cent afgerond');
  assert.equal(G.naarCenten(-5), -500, 'een tegenboeking is ook een bedrag');
  for (const raar of [null, undefined, 'veel', {}, NaN, Infinity]) {
    assert.equal(G.naarCenten(raar), null, String(raar) + ' hoort null te geven en geen 0');
  }
  assert.equal(G.naarCenten(99999999), null, 'boven de grens is het een invoerfout');
});

test('2. naarEuro is om te TONEN, en rondEuro verandert de eenheid niet', () => {
  assert.equal(G.naarEuro(1000), 10);
  assert.equal(G.naarEuro(1235), 12.35);
  assert.equal(G.rondEuro(12.345), 12.35);
  assert.equal(G.rondEuro(12.3), 12.3, 'geen eenheidswissel: dit is wat kern/util.js centen() doet');
  assert.notEqual(G.rondEuro(10), G.naarCenten(10), 'en dat is precies het verschil dat de naam verborg');
});

test('3. een regelbedrag is stuk maal aantal, in HELE centen', () => {
  assert.equal(G.regelCenten(78000, 3), 234000);
  assert.equal(G.regelCenten(1, 0), 0);
  assert.equal(G.regelCenten(100, 2.9), 200, 'naar beneden: twee en negen tiende stuks bestaat niet');
  assert.equal(G.regelCenten(12.5, 2), null, 'een halve cent is geen cent -- dan is de eenheid al mis');
  assert.equal(G.regelCenten(100, -1), null);
  assert.equal(G.regelCenten('veel', 2), null);
});

test('4. somCenten weigert een lijst waar een euro-bedrag tussen zit', () => {
  assert.equal(G.somCenten([100, 250, 3]), 353);
  assert.equal(G.somCenten([]), 0);
  assert.equal(G.somCenten([100, 12.5]), null,
    'een lijst met een euro ertussen geeft een totaal dat plausibel oogt en honderd keer te laag is');
  assert.equal(G.somCenten([100, null]), null);
  assert.equal(G.somCenten('geen lijst'), null);
});

test('5. de grens houdt een som tegen die wegloopt', () => {
  assert.equal(G.somCenten([G.REKENGRENS, 1]), null);
  assert.equal(G.regelCenten(G.REKENGRENS, 2), null);
});

test('6. geen van de drie heet `centen` -- dat is de hele bedoeling', () => {
  assert.deepEqual(Object.keys(G).sort(),
    ['REKENGRENS', 'naarCenten', 'naarEuro', 'regelCenten', 'rondEuro', 'somCenten']);
});

/* ---- en de wacht op de naam zelf ---- */

/* Elke plek die een functie `centen` DEFINIEERT en daarbij van eenheid
   verandert (maal honderd). Losse variabelen die een bedrag in centen
   vasthouden (`const centen = Math.round(Number(x))`) tellen niet mee: die
   veranderen niets, ze bewaren. */
function omzettersMetDeNaamCenten() {
  const uit = [];
  const loop = (map) => {
    for (const n of fs.readdirSync(map)) {
      const p = path.join(map, n);
      const st = fs.statSync(p);
      if (st.isDirectory()) { if (n !== 'node_modules' && n !== 'data') loop(p); continue; }
      if (!n.endsWith('.js')) continue;
      const bron = fs.readFileSync(p, 'utf8');
      for (const m of bron.matchAll(/(?:const|let|function)\s+centen\s*=?\s*(?:\(([^)]*)\)|\w+)\s*=>?[^\n]*/g)) {
        const regel = m[0];
        /* Van EENHEID veranderen is: maal honderd. Delen door honderd (naar
           euro) of alleen afronden telt hier niet -- die liegen niet over hun
           eenheid, ze rekenen er alleen mee. */
        if (/\*\s*100\b/.test(regel) && !/\/\s*100\b/.test(regel)) {
          uit.push(path.relative(WORTEL, p) + ': ' + regel.trim().slice(0, 90));
        }
      }
    }
  };
  loop(path.join(WORTEL, 'server'));
  loop(path.join(WORTEL, 'public'));
  return uit;
}

test('7. er is geen functie meer die `centen` heet en van eenheid verandert', () => {
  const gevonden = omzettersMetDeNaamCenten();
  assert.deepEqual(gevonden, [],
    'Deze functies heten `centen` en maken er centen van. Dat leest hetzelfde als\n' +
    'kern/util.js `centen`, die euro\'s afrondt en euro\'s LAAT. Gebruik naarCenten\n' +
    'uit kern/geld/eenheid.js:\n  ' + gevonden.join('\n  '));
});

/* En de tweede helft van dezelfde afspraak: er hoort helemaal geen FUNCTIE meer
   te zijn die `centen` heet. Een losse variabele die een bedrag vasthoudt mag
   zo heten -- dat is wat het is. Een functie niet: die zegt met zijn naam wat
   hij DOET, en `centen` heeft drie keer iets anders gedaan. */
function functiesMetDeNaamCenten() {
  const uit = [];
  const loop = (map) => {
    for (const n of fs.readdirSync(map)) {
      const p = path.join(map, n);
      const st = fs.statSync(p);
      if (st.isDirectory()) { if (n !== 'node_modules' && n !== 'data') loop(p); continue; }
      if (!n.endsWith('.js')) continue;
      const bron = fs.readFileSync(p, 'utf8');
      /* Een functie: `function centen(`, of een pijl/functie-toewijzing. Een
         gewone variabele (`const centen = Math.round(x)`) valt er buiten. */
      for (const m of bron.matchAll(/(?:function\s+centen\s*\(|(?:const|let)\s+centen\s*=\s*(?:\([^)]*\)|\w+)\s*=>|(?:const|let)\s+centen\s*=\s*function)/g)) {
        uit.push(path.relative(WORTEL, p) + ': ' + m[0].trim());
      }
    }
  };
  loop(path.join(WORTEL, 'server'));
  loop(path.join(WORTEL, 'public'));
  return uit;
}

test('7b. er is helemaal geen FUNCTIE meer die `centen` heet', () => {
  const gevonden = functiesMetDeNaamCenten();
  assert.deepEqual(gevonden, [],
    'Een functie zegt met zijn naam wat hij doet, en `centen` deed drie dingen.\n' +
    'kern/util.js heet nu rondEuro, kern/horeca.js heleCenten, en de omzetters\n' +
    'naarCenten uit kern/geld/eenheid.js. Nog over:\n  ' + gevonden.join('\n  '));
});

/* En de derde vorm, die de eerste twee allebei missen: `iets.centen(bedrag)`.
   Een hernoemer moet namen na een punt overslaan -- anders sneuvelt elk VELD dat
   `centen` heet, en dat zijn er tientallen. Precies daardoor bleven bij de
   hernoeming twee AANROEPEN staan: kern/rtfos/steden.js deed `ctx.centen(...)`
   en kern/gast/beleid.js `horeca.centen(...)`. Allebei stil kapot -- undefined
   aanroepen geeft pas een TypeError als die regel draait -- en allebei op een
   route die geld aanneemt.

   Deze wacht kan bestaan omdat toets 7b hierboven de andere kant dichtzet: er is
   geen functie meer die `centen` heet, dus IEDERE aanroep `.centen(` is per
   definitie een aanroep van undefined. Een veld uitlezen (`b.centen`, zonder
   haakje) blijft gewoon goed en staat er honderden keren. */
function aanroepenViaEenPunt() {
  const uit = [];
  const loop = (map) => {
    for (const n of fs.readdirSync(map)) {
      const p = path.join(map, n);
      const st = fs.statSync(p);
      if (st.isDirectory()) { if (n !== 'node_modules' && n !== 'data') loop(p); continue; }
      if (!n.endsWith('.js')) continue;
      const bron = fs.readFileSync(p, 'utf8');
      for (const m of bron.matchAll(/([A-Za-z_$][A-Za-z0-9_$]*)\.centen\s*\(/g)) {
        uit.push(path.relative(WORTEL, p) + ': ' + m[0]);
      }
    }
  };
  loop(path.join(WORTEL, 'server'));
  loop(path.join(WORTEL, 'public'));
  return uit;
}

test('7c. niets roept `.centen(` nog aan -- dat is een aanroep van undefined', () => {
  const gevonden = aanroepenViaEenPunt();
  assert.deepEqual(gevonden, [],
    'Er bestaat geen functie `centen` meer (toets 7b), dus dit roept undefined aan\n' +
    'en geeft een TypeError zodra de regel draait. Gebruik naarCenten, heleCenten\n' +
    'of rondEuro -- welke, zegt de kop van kern/geld/eenheid.js. Gevonden:\n  ' +
    gevonden.join('\n  '));
});

test('8. de meter zelf slaat uit op een bekend-foute invoer', () => {
  /* Een toets die je niet hebt zien zakken is geen toets (LAT-regel 10). Deze
     schrijft het patroon dat hij moet vinden en controleert dat hij het vindt. */
  const proef = 'const centen = (euro) => Math.round(Number(euro) * 100);';
  assert.match(proef, /(?:const|let|function)\s+centen\s*=?\s*(?:\(([^)]*)\)|\w+)\s*=>?[^\n]*/);
  assert.ok(/\*\s*100\b/.test(proef) && !/\/\s*100\b/.test(proef), 'dit hoort een omzetter te heten');
  const geenOmzetter = 'const centen = (n) => Math.round(n * 100) / 100;';
  assert.ok(!(/\*\s*100\b/.test(geenOmzetter) && !/\/\s*100\b/.test(geenOmzetter)),
    'en dit niet: die rondt af en verandert de eenheid niet');
});
