#!/usr/bin/env node
/* ============================================================================
   WIE ZET WELKE NAAM OP DE KERN? -- gemeten tijdens een opstart, niet geraden.

   WAAROM DIT BESTAAT. scripts/grenzen.js zegt hoeveel kern-namen door meer dan
   een domein worden aangeraakt (kernGedeeld). Om te weten wat je daaraan KUNT
   doen, moet je weten welke module welke naam erop zet. Dat heb ik drie keer
   statisch geprobeerd en drie keer was het fout:

     1. Een regex over `return {` in server/kern/*.js pakte ook de returns van
        routehandlers, dus dezelfde naam werd aan tien modules toegeschreven.
        Uitkomst: "101 modules, kernGedeeld naar 3" -- onmogelijk.
     2. "Eerste treffer wint" gaf een nettere uitkomst (146 -> 92) en was net zo
        goed een gok.
     3. De stack van een onderschepte Object.assign geeft het KERNLAAG-bestand
        waar de aanroep staat, niet de module: tien bestanden voor zeshonderd
        sleutels.

   De vierde keer klopte het, en het verschil is het REGELNUMMER: met (bestand,
   regel) is de require-module van precies die aanroep uit de bron te lezen. Dat
   is exact.

   WAT HET MEET, EN WAT HET NIET MEET. Elke Object.assign(kern, ...) wordt
   onderschept: welke sleutels komen erbij, en op welke regel. Daarnaast dumpt
   het de sleutels die na het opstarten ECHT op de kern staan -- want dat is de
   controle op de meter zelf. (Die controle heeft ook iets opgeleverd: 142 van de
   146 gedeelde namen staan werkelijk op de kern, dus grenzen.js meet wat hij
   belooft; mijn vermoeden dat het om subcontexten ging, was fout.)

   NIET gemeten: losse toewijzingen (kern.x = ...) en het grote objectliteraal
   waarmee server.js de kern bouwt. Dat laatste is waar de massa vandaan komt --
   102 van de 142 gedeelde namen -- en dat is precies waarom namespacen van
   kernmodules maar 11 punten oplevert en niet de 47 die 5.14 vraagt. Een Proxy
   over de kern zou die twee wel zien en verandert het gedrag van de opstart, dus
   dat is bewust niet gedaan.

   Draai:  node --experimental-sqlite scripts/kernbron.js
           RTG_KERNBRON_UIT=/pad/naar.json node --experimental-sqlite scripts/kernbron.js
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const UIT = process.env.RTG_KERNBRON_UIT || path.join(require('os').tmpdir(), 'rtg-kernbron.json');

/* De onderschepping. We hebben de KERN nodig om te weten of een assign op hem
   gaat, en die kennen we niet vooraf -- dus geldt: het eerste argument dat een
   object is en al een `app` heeft, is de kern. Dat is niet elegant en het is wel
   waar: de kern krijgt express als eerste. */
const echt = Object.assign;
const per = new Map();          // bestand -> Set(sleutels)
let kern = null;

Object.assign = function (doel) {
  const bronnen = Array.prototype.slice.call(arguments, 1);
  if (doel && typeof doel === 'object') {
    if (!kern && doel.app && doel.db) kern = doel;
    if (kern && doel === kern) {
      /* Welk bestand doet deze aanroep? De eerste regel in de stack die in
         server/ staat en niet dit script is. */
      /* HET REGELNUMMER ERBIJ, en dat is het hele punt. De eerste versie nam
         alleen het BESTAND uit de stack, en dat is altijd de kernlaag waar de
         Object.assign staat -- tien bestanden voor zeshonderd sleutels, dus geen
         antwoord op "welke MODULE zet deze naam". Met het regelnummer kan de
         require-module van precies die regel achteraf uit de bron worden gelezen,
         en dat is exact in plaats van geraden. */
      const stack = new Error().stack.split('\n').slice(2);
      let waar = 'onbekend';
      for (const r of stack) {
        const m = /\((\/[^)]+\.js):(\d+)/.exec(r) || /at (\/[^\s:]+\.js):(\d+)/.exec(r);
        if (m && m[1].startsWith(path.join(WORTEL, 'server')) && !m[1].includes('kernbron')) {
          waar = path.relative(WORTEL, m[1]).replace(/\\/g, '/') + ':' + m[2];
          break;
        }
      }
      const sleutels = [];
      for (const b of bronnen) if (b && typeof b === 'object') sleutels.push(...Object.keys(b));
      if (sleutels.length) {
        if (!per.has(waar)) per.set(waar, new Set());
        for (const s of sleutels) per.get(waar).add(s);
      }
    }
  }
  return echt.apply(Object, arguments);
};

/* Ook de directe toewijzingen (kern.x = ...) tellen mee voor het beeld, maar die
   zijn niet te onderscheppen zonder een Proxy over de kern -- en een Proxy erover
   verandert het gedrag van de opstart. Ze staan dus NIET in deze meting, en dat
   is een bekend gat: wat hier ontbreekt, hangt met een losse toewijzing. */

process.on('exit', () => {
  const uit = {};
  for (const [f, s] of per) uit[f] = [...s].sort();
  /* OOK DE KERN ZELF, en dat is de beslissende vraag. De onderschepping ziet wat
     er via Object.assign LANGSKOMT; deze lijst zegt wat er na het opstarten
     werkelijk OP de kern staat. Verschilt dat van wat scripts/grenzen.js
     "kern-eigenschappen" noemt, dan meet die meter iets anders dan zijn naam
     belooft -- en dan is een doel dat op dat getal staat, deels op iets anders
     gericht. */
  try {
    fs.writeFileSync(UIT, JSON.stringify({ perPlek: uit,
      kernSleutels: kern ? Object.keys(kern).sort() : [] }, null, 2) + '\n');
  } catch (e) {}
});

process.env.RTG_STIL = '1';
require(path.join(WORTEL, 'server', 'server.js'));
setTimeout(() => process.exit(0), 15000);
