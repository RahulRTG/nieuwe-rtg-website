/* AI-CONTEXT-01: EEN POSITIEVE VELDLIJST, NOOIT EEN OBJECT MET GATEN ERIN.

   MN-02-AI (test/mn02ai-contextbesmetting.test.js) bewijst dat er vandaag niets
   overloopt van de ene hoedanigheid naar de andere. Deze toets bewaakt iets
   anders en het is de duurzamere helft: dat de VORM waarin de context wordt
   opgebouwd niet omslaat naar een die morgen vanzelf lekt.

   HET VERSCHIL IS RICHTING EN GEEN STIJL. Twee manieren om hetzelfde resultaat
   te krijgen:

       const context = { ...md };  delete context.bewaarVerzoek;   // NEE
       const context = { trip: md.trip, invoices: md.invoices };   // JA

   Bij de eerste passeert elk NIEUW veld de grens vanzelf en moet iemand eraan
   denken het te verwijderen. Bij de tweede blijft elk nieuw veld buiten tot
   iemand het er bewust bij zet. Dat is precies het verschil tussen een grens die
   werkt als niemand oplet en een die alleen werkt als iedereen oplet.

   WAAROM DIT EEN EIGEN TOETS IS EN GEEN ASSERTIE IN MN-02-AI. Die proef meet een
   GEDRAG (verandert de context na een kantoorhandeling) en kan per definitie
   alleen zien wat er vandaag in de ledenstaat staat. Deze toets meet een VORM en
   valt ook als er een leeg veld bij komt dat morgen gevuld raakt. Een gedragsproef
   en een vormproef vangen andere dingen; ze vervangen elkaar niet.

   HET ONDERWERP KOMT UIT HET REGISTER en staat hier niet als pad. AICONTEXT.json
   noemt de samensteller, `scripts/aicontext.js` schrijft hem daar, en als deze
   toets zijn eigen pad zou dragen konden die twee uit elkaar lopen zonder dat
   iemand het merkt (LAT.md regel 4). Verhuist de samensteller, dan verhuist deze
   toets mee -- of hij zakt, en dan is dat het goede antwoord.

   GEMETEN MET DE MUTATIE (13 september 2026), vier stuks:
     a. `const md2 = { ...md }` in de samensteller           -> toets 2 zakt
     b. `delete ctx.bewaarVerzoek` erbij                      -> toets 3 zakt
     c. `md.bewaarVerzoek` lezen zonder de lijst bij te werken -> toets 1 zakt
     d. een veld UIT de lijst halen dat wel gelezen wordt      -> toets 1 zakt

   CODE EN COMMENTAAR WORDEN GESCHEIDEN, en dat is hier geen formaliteit: de kop
   van de samensteller bevat het woord `...md` letterlijk, als voorbeeld van wat
   NIET mag. Een toets die zijn onderwerp met commentaar en al leest, zakt op de
   uitleg van de regel die hij bewaakt -- precies de fout uit BEWIJSMACHINE.md
   par. 6a.1, hier een keer bijna herhaald.

   Draai los: node --test test/aicontext-allowlist.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { zonderCommentaar } = require('../scripts/lib/bron');

const WORTEL = path.join(__dirname, '..');
const REGISTER = path.join(WORTEL, 'AICONTEXT.json');

function samensteller() {
  const j = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));
  const rel = j.samensteller && j.samensteller.bestand;
  assert.ok(rel, 'AICONTEXT.json noemt de samensteller; zonder dat weet deze toets niet wat hij bewaakt');
  const vol = path.join(WORTEL, rel);
  assert.ok(fs.existsSync(vol), 'de samensteller uit het register bestaat: ' + rel);
  return { rel, ruw: fs.readFileSync(vol, 'utf8'), code: zonderCommentaar(fs.readFileSync(vol, 'utf8')), register: j };
}

/* De naam waaronder de ledenstaat in de samensteller rondgaat. Uit de code en
   niet uit een aanname: `const md = ledenInhoudVan ? ...`. */
function staatNaam(code) {
  const m = /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*ledenInhoudVan\s*\?/.exec(code);
  assert.ok(m, 'de samensteller bindt de ledenstaat aan een naam; zonder die binding meet deze toets niets');
  return m[1];
}

/* ---------- 1. gelezen velden == verklaarde velden ---------- */
test('1. de samensteller leest precies de velden die hij verklaart', () => {
  const { code, rel } = samensteller();
  const naam = staatNaam(code);

  const verklaard = /const\s+LEDENVELDEN\s*=\s*\[([^\]]*)\]/.exec(code);
  assert.ok(verklaard, 'de samensteller draagt een LEDENVELDEN-verklaring (AI-CONTEXT-01)');
  const lijst = verklaard[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean).sort();

  const gelezen = [...new Set([...code.matchAll(
    new RegExp('\\b' + naam + '\\.([a-zA-Z_$][\\w$]*)', 'g'))].map(m => m[1]))].sort();

  assert.deepEqual(gelezen, lijst,
    'wat ' + rel + ' uit de ledenstaat leest wijkt af van wat het verklaart.\n' +
    '  gelezen:   ' + gelezen.join(', ') + '\n' +
    '  verklaard: ' + lijst.join(', ') + '\n' +
    'Zet een nieuw veld in LEDENVELDEN als het er hoort, of haal het uit de prompt. ' +
    'Deze twee gelijk houden IS de grens: negen van de velden in dezelfde ledenstaat ' +
    'worden door een kantoorroute geschreven, en deze tekst gaat naar een modelaanbieder.');
});

/* ---------- 2. geen spread van de ledenstaat ---------- */
test('2. de ledenstaat wordt nergens in zijn geheel gekopieerd', () => {
  const { code, rel } = samensteller();
  const naam = staatNaam(code);
  const verboden = [
    { patroon: new RegExp('\\.\\.\\.\\s*' + naam + '\\b'), wat: 'een spread (`...' + naam + '`)' },
    { patroon: new RegExp('Object\\.assign\\s*\\(\\s*\\{\\s*\\}\\s*,\\s*' + naam + '\\b'), wat: 'Object.assign({}, ' + naam + ')' },
    { patroon: new RegExp('JSON\\.parse\\s*\\(\\s*JSON\\.stringify\\s*\\(\\s*' + naam + '\\b'), wat: 'een diepe kopie van ' + naam },
    { patroon: new RegExp('Object\\.(?:keys|values|entries)\\s*\\(\\s*' + naam + '\\b'), wat: 'een loop over de velden van ' + naam }
  ];
  for (const v of verboden) {
    assert.ok(!v.patroon.test(code),
      rel + ' bevat ' + v.wat + '. Dat maakt van de veldselectie een serialisatie: ' +
      'elk veld dat er morgen bij komt, gaat dan vanzelf mee naar het model.');
  }
});

/* ---------- 3. geen redactie achteraf ---------- */
test('3. er wordt niets uit een context VERWIJDERD om hem veilig te maken', () => {
  const { code, rel } = samensteller();
  assert.ok(!/\bdelete\s+[a-zA-Z_$][\w$]*\s*[.[]/.test(code),
    rel + ' verwijdert een veld uit een object. Een context die veilig wordt door weglaten ' +
    'is precies de vorm die AI-CONTEXT-01 verbiedt: wie het volgende veld vergeet, lekt het.');
});

/* ---------- 4. de meter en de toets zijn het eens ---------- */
test('4. het register en de verklaring zeggen hetzelfde over de muur', () => {
  const { code, register } = samensteller();
  const verklaard = /const\s+LEDENVELDEN\s*=\s*\[([^\]]*)\]/.exec(code);
  const lijst = verklaard[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean).sort();
  const gemeten = [...(register.muur.gelezenVelden || [])].sort();
  assert.deepEqual(gemeten, lijst,
    'AICONTEXT.json en de LEDENVELDEN-verklaring lopen uiteen. Draai `npm run aicontext:vast`. ' +
    'Twee bronnen voor dezelfde waarheid lopen uit elkaar zodra iemand er een gebruikt (LAT.md regel 4); ' +
    'de meter voedt de ratel aiContextLek, dus een register dat achterloopt maakt die tand bot.');
});
