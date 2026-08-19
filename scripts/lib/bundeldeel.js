/* HET ONDERWERP VAN EEN BUNDELDEEL.

   Vijftig bundels in dit huis worden geserveerd als EEN bestand en bewerkt als
   losse delen; scripts/bundel.js kent de koppeling en test/bundeldelen.test.js
   bewaakt dat de twee niet uiteenlopen. Wat er niet was, is een manier om te
   zien WAT er in een deel zit. `app-main-04aa.js` en `app-main-09a2.js` dragen
   een volgnummer en verder niets, dus je moet drieentachtig bestanden openen om
   te vinden waar de contactpin woont.

   Hernoemen zou dat oplossen en is bewust NIET gedaan: vijftig mappen die van
   naam veranderen botst met elke tak die openstaat, en er gaan er hier dertien
   per anderhalve dag doorheen. In plaats daarvan draagt elk deel een
   ONDERWERPREGEL bovenin -- 227 van de 394 hadden die al, want zo schrijft dit
   huis toch al -- en scripts/deelindex.js maakt daar een index van.

   WAT ALS ONDERWERP TELT. De eerste regel van het eerste blok- of regelcommentaar
   van het bestand, ontdaan van streepjes en isgelijktekens waarmee koppen hier
   worden opgemaakt. Niet elke tekst telt: een regel van vier woorden waarvan er
   drie 'deel' en een cijfer zijn, zegt niets. Vandaar de ondergrens op het
   aantal LETTERS, want die telt streepjes, cijfers en haakjes niet mee. */
'use strict';

/* Genoeg letters om een onderwerp te zijn. Gemeten over de 227 delen die er al
   een hadden: de kortste is "de vlag en de balk" (15 letters). Vijftien is dus
   te krap om als grens te dienen; twaalf laat die staan en houdt "deel 4b"
   (zes) en "vervolg" (zeven) tegen. */
const MINIMUM_LETTERS = 12;

function onderwerpVan(bron) {
  const regels = String(bron).split('\n');
  let i = 0;
  while (i < regels.length && !regels[i].trim()) i++;          // lege regels bovenaan
  if (i >= regels.length) return null;
  let eerste = regels[i].trim();
  if (!eerste.startsWith('/*') && !eerste.startsWith('//')) return null;   // begint met code
  /* Een commentaar dat op DEZELFDE regel sluit, eerst afsluiten: anders eet de
     koppenzoeker hieronder de sluiter op (de ster staat in zijn tekenklasse) en
     komt de rest van de regel in het onderwerp terecht. */
  const sluiter = eerste.indexOf('*/');
  if (sluiter > -1) eerste = eerste.slice(0, sluiter).trim();

  /* EEN KOP TUSSEN STREEPJES IS ALTIJD HET ONDERWERP, ook als hij kort is.
     Dit huis schrijft `==== RTG Werk-OS ====` en dat is precies wat een lezer
     zoekt -- terwijl "RTG Werk-OS" negen letters heeft en dus onder de
     ondergrens voor lopende tekst valt. Zonder deze tak pakte de zeef de regel
     erna, en die eindigde midden in een zin ("...naar de werk-apps: het"). */
  const kop = /^(?:\/\*|\/\/)\s*[-=*]{3,}\s*(.+?)\s*[-=*]{3,}\s*$/.exec(eerste);
  if (kop && letters(kop[1]) >= 3) return kort(kop[1]);

  /* Anders: de eerste zin, en die mag over regels lopen. Een onderwerp dat
     midden in een bijzin ophoudt zegt minder dan geen onderwerp, want het
     leest als een fout in plaats van als een gat. */
  const regelcommentaar = eerste.startsWith('//');
  const stukken = [];
  for (let r = i; r < Math.min(i + 4, regels.length); r++) {
    const ruw = regels[r].trim();
    /* HET COMMENTAAR IS AFGELOPEN, DUS HET ONDERWERP OOK. Zonder deze twee
       regels liep de zeef door in de CODE eronder, en dan stond er in BUNDELS.md
       "mijn zorgprofiel el.innerHTML = '<div class=..." -- een onderwerp dat
       leest als een fout in plaats van als een wegwijzer. Gevonden doordat de
       index na een andere ronde opnieuw werd voortgebracht en er ineens code in
       stond. */
    if (r > i && regelcommentaar && !ruw.startsWith('//')) break;
    if (r > i && !regelcommentaar && !/^[*]|^[a-zA-Z(]/.test(ruw) && !ruw) break;
    let t = ruw;
    if (r === i) t = t.replace(/^(\/\*|\/\/)/, '');
    else if (regelcommentaar) t = t.replace(/^\/\//, '');
    const eind = t.indexOf('*/');                 // ook hier: de sluiter hoort niet in het onderwerp
    const sluit = eind > -1;
    if (sluit) t = t.slice(0, eind);
    t = t.replace(/^\*+/, '').replace(/[-=*]{3,}/g, ' ').trim();
    if (!t) { if (stukken.length) break; else if (sluit) break; else continue; }
    stukken.push(t);
    if (sluit || /\.(\s|$)/.test(t)) break;
  }
  let tekst = stukken.join(' ').replace(/\s+/g, ' ').trim();
  const punt = tekst.search(/\.(\s|$)/);
  if (punt > 15) tekst = tekst.slice(0, punt);
  if (letters(tekst) < MINIMUM_LETTERS) return null;
  return kort(tekst);
}

function kort(t) {
  t = String(t).replace(/\s+/g, ' ').trim();
  return t.length > 120 ? t.slice(0, 117).trimEnd() + '...' : t;
}

function letters(t) { return String(t).replace(/[^a-zA-ZÀ-ſ]/g, '').length; }

module.exports = { onderwerpVan, MINIMUM_LETTERS };
