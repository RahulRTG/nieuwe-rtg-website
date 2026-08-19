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

/* Het lijf en de vlaggen van een regex-literal, of null als het er geen is. */
function ontleed(tekst) {
  const m = /^\/((?:\\.|\[(?:\\.|[^\]])*\]|[^/])+)\/([a-z]*)$/.exec(String(tekst));
  return m ? { lijf: m[1], vlaggen: m[2] } : null;
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
