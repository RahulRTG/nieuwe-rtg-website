/* EEN REGEX KLEINER MAKEN, VOOR DE MUTATIEMOTOR.

   De negen operatoren van scripts/mutatie.js zijn tekstvervangingen op code
   (=== wordt !==, && wordt ||, return true wordt return false). Geen van
   negenen raakt een REGEX, en een regex is wel degelijk gedrag: hij beslist wat
   er matcht.

   Dat werd zichtbaar bij test/strenge-poort.test.js. Die toets hangt volledig
   aan een regex -- FATAAL in test/helper.js, de detectie van een crashregel --
   en overleefde 28 mutaties. Met de hand kapotgemaakt zakt hij netjes op alle
   beweringen. "Overleefd" gaf daar de TOETS de schuld voor een gat in de MOTOR,
   en dat is precies de omkering waar de kop van mutatie.js zelf voor waarschuwt.

   DE MUTATIE IS KLEIN EN BETEKENISVOL: laat het laatste alternatief van een
   regex met een top-niveau | vallen.

     /"bron":"(uncaughtException|unhandledRejection)"|"serverfout":true/
     ->  /"bron":"(uncaughtException|unhandledRejection)"/

   Daarmee mist hij precies de 500-regel die de toets als derde geval noemt. Een
   regex zonder top-niveau | levert geen mutatie op; dat is geen fout maar een
   plek waar deze operator niets te zeggen heeft.

   TOP-NIVEAU, EN DAAROM IS DIT MEER DAN EEN SPLIT OP |. Een | binnen (...) of
   [...] hoort bij dat stuk; die eruit halen geeft onbalans en een regex die
   niet meer compileert -- en dan zakt de toets omdat het bestand stuk is, niet
   omdat de bewering ergens op leunt. Dat zou een "bewezen gevoelig" opleveren
   dat niets bewijst. Vandaar de haakjes- en klasse-telling, en vandaar dat de
   uitkomst nog een keer door new RegExp() gaat voordat hij wordt teruggegeven. */
'use strict';

/* Het lijf en de vlaggen van een regex-literal, of null als het er geen is.

   MET DE HAND EN NIET MET EEN REGEX. Hier stond er wel een:

     \/^\\/((?:\\\\.|\\[(?:\\\\.|[^\\]])*\\]|[^/])+)\\/([a-z]*)$\/

   en die is katastrofaal traag op invoer die NET niet past. De drie
   alternatieven overlappen -- een teken binnen [...] wordt ook door [^/]
   gedekt -- dus bij een literal zonder sluitende slash probeert de motor elke
   verdeling van de tekens over die alternatieven. CodeQL zag het (regel
   js/redos, bevindingen 120 en 121) en het is geen theorie: deze functie krijgt
   tokentekst uit WILLEKEURIGE bronbestanden, dus een regel als /[][][][]...
   zonder afsluiting zet de mutatiemotor stil.

   Een regex die de overlap weghaalt kan ook, maar dan staat dezelfde kennis --
   wat telt als klasse, wat als ontsnapping -- twee keer in dit bestand: hier in
   patroonvorm en hieronder in laatsteTopNiveauPijp als lus. Dus hier dezelfde
   lus. Een keer lezen, geen terugkrabbelen, en de twee functies kunnen niet
   meer uit de pas lopen. */
function ontleed(tekst) {
  const s = String(tekst);
  if (s[0] !== '/') return null;
  let i = 1, klasse = false;
  for (; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') { i++; continue; }
    if (klasse) { if (c === ']') klasse = false; continue; }
    if (c === '[') { klasse = true; continue; }
    if (c === '/') break;
  }
  if (klasse || i >= s.length || s[i] !== '/' || i === 1) return null;
  const vlaggen = s.slice(i + 1);
  if (!/^[a-z]*$/.test(vlaggen)) return null;
  return { lijf: s.slice(1, i), vlaggen };
}

/* De positie van het LAATSTE | dat op het hoogste niveau staat, of -1. */
function laatsteTopNiveauPijp(lijf) {
  let diep = 0, klasse = false, laatste = -1;
  for (let i = 0; i < lijf.length; i++) {
    const c = lijf[i];
    if (c === '\\') { i++; continue; }
    if (klasse) { if (c === ']') klasse = false; continue; }
    if (c === '[') { klasse = true; continue; }
    if (c === '(') diep++;
    else if (c === ')') diep--;
    else if (c === '|' && diep === 0) laatste = i;
  }
  return laatste;
}

function laatsteAlternatiefWeg(tekst) {
  const d = ontleed(tekst);
  if (!d) return null;
  const pijp = laatsteTopNiveauPijp(d.lijf);
  if (pijp < 1) return null;                       // niets om te laten vallen
  const korter = d.lijf.slice(0, pijp);
  try { new RegExp(korter, d.vlaggen); } catch (e) { return null; }
  return '/' + korter + '/' + d.vlaggen;
}

module.exports = { ontleed, laatsteTopNiveauPijp, laatsteAlternatiefWeg };
