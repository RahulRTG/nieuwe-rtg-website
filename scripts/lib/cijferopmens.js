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
      const treffer = code.match(PATROON);
      if (treffer) gevonden.push(path.basename(map) + '/' + naam + ': ' + treffer[0]);
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
