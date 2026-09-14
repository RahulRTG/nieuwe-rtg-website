/* ============================================================================
   CAR-05 -- ER KOMT GEEN CIJFER OP EEN MENS.

   Deze grens staat in VIER documenten en stond in NUL toetsen:

     KANTOORMACHT.md  een score op een mens draagt altijd zijn opbouw, en wordt
                      nooit een sorteersleutel -- niet op klanten, niet op
                      medewerkers.
     HDI.md           de meeteenheid is nooit de mens; een voortgangsmaat mag
                      over een cohort en nooit per persoon, OOK NIET INTERN als
                      sorteersleutel.
     ONTMOETEN.md     er komt geen cijfer op een mens.
     LIFE.md par. 4   een relatie is geen trechter.

   CARRIERE.md par. 4.1 zegt erbij wanneer hij gebouwd hoort te worden: *als
   toets VOOR de eerste carrieremeter, niet erna*. Vandaar dit bestand, en
   vandaar dat het een GEDEELDE grens is en geen derde kopie van een regexp.

   WAAROM GEDEELD EN NIET PER LAAG. De eerste handhaver stond inline in
   test/vertegenwoordiging.test.js en dekte precies een map. Toen kern/rugdekking
   erbij kwam gold de grens daar even hard en hield hem niets tegen. Drie kopieen
   van een woordenlijst zijn binnen een maand drie verschillende woordenlijsten
   (LAT.md regel 4) -- en dan is de strengste lijst de enige die iets zegt,
   terwijl niemand weet welke dat is.

   WAT HIJ MEET: tokens in CODE. Commentaar gaat eraf, want dit bestand en de
   lagen zelf MOETEN de woorden kunnen noemen om uit te leggen waarom ze er niet
   zijn. Dezelfde vorm als keuringsregel 53.

   WAT HIJ NIET MEET, en waarvoor elke laag zijn eigen toets houdt: of de laag
   in zijn ANTWOORD een getal op een mens plakt. Dat is gedrag en geen tekst --
   een veld `gewicht: 0.87` op een mens heet geen `score` en komt hier dus
   ongezien langs. De lexicale helft is een ONDERgrens; `mensVrij()` hieronder
   is de gedragshelft, en beide horen te draaien.

   DE GRAAD IS DUS `vermoed` EN NIET `gemeten`, en dat is met opzet niet
   weggepoetst: wie deze scan groen ziet en denkt dat de grens bewezen is, leest
   hem verkeerd.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { zonderCommentaar } = require('./bron');

/* Elk woord met de reden waarom het hier staat. Een lijst zonder redenen groeit
   met woorden die iemand ooit verdacht vond, en krimpt bij de eerste valse
   treffer -- want dan is er niets om tegen af te wegen. */
const WOORDEN = [
  ['score', 'het samengestelde cijfer zelf'],
  ['rating', 'hetzelfde in het Engels; komt binnen via een bibliotheek of een schermnaam'],
  ['ranking', 'een cijfer waarvan de ORDE het product is'],
  ['ranglijst', 'de Nederlandse vorm daarvan; RUGDEKKING.md verbiedt hem expliciet voor jeugd'],
  ['puntenaantal', 'een score die zich voordoet als een telling'],
  ['beoordelingscijfer', 'een oordeel dat zich voordoet als een meting'],
  ['reputatiecijfer', 'CARRIERE.md punt 30 noemt reputatie als kapitaal -- als VOORRAAD met opbouw, nooit als getal'],
  ['betrouwbaarheidsscore', 'kern/betrouwbaarheid.js kent NIVEAUS met een grond; een score ernaast zou die opbouw wegvegen']
];

const PATROON = new RegExp('\\b(' + WOORDEN.map(([w]) => w).join('|') + ')\\b', 'i');
const PATROON_ALLE = new RegExp(PATROON.source, 'gi');

/* EEN ONTKENNING IS GEEN SCORE, en dat is geen versoepeling maar het uitvoeren
   van wat de kop hierboven al belooft: *de lagen zelf MOETEN de woorden kunnen
   noemen om uit te leggen waarom ze er niet zijn*. Dat werkte alleen in
   COMMENTAAR, en precies daar hoort die uitleg NIET te staan -- een lid leest
   geen commentaar. Twee schoolmodules schrijven hem daarom in het antwoord:

     analyse-signalen.js  'Er is bewust geen score en geen volgorde op zwaarte.'
     hr-verlof.js         'Er staat bewust geen cijfer of ranglijst in.'

   Allebei werden ze GEMELD. De scan bestrafte dus de twee modules die hun eigen
   grens het duidelijkst nakomen, en dat is de gevaarlijkste vorm van een valse
   treffer: hij leert je de uitleg weg te laten.

   DE ONTKENNING LOOPT OVER EEN LIJSTJE, en daarom staat er geen vast rijtje
   woorden tussen: "geen cijfer of ranglijst" ontkent allebei, en wie alleen
   `geen\s+$` accepteert vangt de eerste wel en de tweede niet.

   DE GRENS IS TWEE WOORDEN, en dat is geen afgeronde smaak maar het verschil
   tussen een NAAMWOORDGROEP en een BIJZIN. Een ontkenning regeert een kort
   rijtje zelfstandige naamwoorden ("geen cijfer of ranglijst"); zodra er een
   bijzin achter komt, gaat zij niet meer over het laatste woord. Een venster op
   TEKENS in plaats van woorden viel daarop om: `geen aparte weging maar wel een
   echte score` is 33 tekens en dus binnen elk redelijk tekenvenster, terwijl
   het een score AANKONDIGT. Met twee woorden blijft dat een treffer.

   Leestekens tellen niet als woord, dus `{ uitleg: 'geen oordeel', score: 9 }`
   blijft ook een treffer: tussen de ontkenning en `score` staat `',` en dat is
   geen `[\w-]+`. */
const ONTKEND = /\b(geen|zonder|nooit)\b(\s+[\w-]+){0,2}\s+$/i;

/* De lexicale helft. Geeft een lijst treffers als 'bestand: woord'; leeg is
   goed. Een map die niet bestaat geeft leeg terug EN meldt dat -- een grens die
   over een verdwenen map zwijgt, staat groen zonder iets te bewaken. */
function grensScan(mappen) {
  const lijst = Array.isArray(mappen) ? mappen : [mappen];
  const gevonden = [];
  const ontbreekt = [];
  for (const map of lijst) {
    if (!fs.existsSync(map)) { ontbreekt.push(map); continue; }
    for (const naam of fs.readdirSync(map).filter(n => n.endsWith('.js'))) {
      const code = zonderCommentaar(fs.readFileSync(path.join(map, naam), 'utf8'));
      /* ALLE treffers en niet de eerste. `code.match(PATROON)` zonder /g gaf er
         een, dus een bestand dat vroeg "geen score" schrijft en laat een ECHTE
         score bouwt, meldde de onschuldige -- en wie de melding naleest, ziet
         een valse treffer en kijkt niet verder. */
      for (const m of code.matchAll(PATROON_ALLE)) {
        if (ONTKEND.test(code.slice(Math.max(0, m.index - 24), m.index))) continue;
        gevonden.push(path.basename(map) + '/' + naam + ': ' + m[0]);
        break;                                   // een melding per bestand is genoeg om te gaan kijken
      }
    }
  }
  return { gevonden, ontbreekt };
}

/* De gedragshelft: staat er in dit antwoord een GETAL op een mens?

   `uitgezonderd` is geen ontsnapping maar een verklaring: een bedrag, een
   plafond of een jaartal is een getal over GELD of TIJD en niet over een mens.
   Wie hier iets toevoegt, schrijft erbij waarom het geen maat op een mens is.
   Een lege naam accepteren we niet -- dan is de uitzondering onbenoembaar. */
function mensVrij(rijen, uitgezonderd) {
  const vrij = new Set(Object.keys(uitgezonderd || {}));
  for (const naam of vrij) {
    if (!String((uitgezonderd || {})[naam] || '').trim()) {
      throw new Error('de uitzondering ' + naam + ' draagt geen reden; CAR-05 kent geen naamloze uitzondering');
    }
  }
  const fout = [];
  for (const rij of [].concat(rijen || [])) {
    for (const [veld, waarde] of Object.entries(rij || {})) {
      if (vrij.has(veld)) continue;
      if (typeof waarde === 'number') fout.push(veld + ' = ' + waarde);
    }
  }
  return fout;
}

module.exports = { WOORDEN, PATROON, grensScan, mensVrij };
