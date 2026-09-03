#!/usr/bin/env node
/* ============================================================================
   HOEVEEL HANDELINGEN ZIJN ER WERKELIJK GECLASSIFICEERD?

   WAAROM DIT SCRIPT ER IS. server/kern/handelingsklasse.js geeft elke handeling
   een risicoklasse en een omkeerbaarheid, elk met een bron. Dat is de helft van
   het antwoord op TAKEN.md 4.71. De andere helft is dit: over HOEVEEL routes
   zegt die laag werkelijk iets?

   Zonder dat getal is de laag een gerust gevoel. Met een bord waarop "elke
   handeling heeft een risicoklasse" staat en waarop 90% `ongemarkeerd` en
   `onbekend` is, ziet een lezer een gedekt systeem terwijl er over de massa
   niets is vastgesteld -- en dat is precies de faalvorm die 4.71 twee ronden
   lang heeft tegengehouden.

   DE TWEE GETALLEN DIE ERTOE DOEN, en beide horen omhoog:

     risicoGemarkeerd  routes waarover een GRENS iets zegt (geen, verhoogd,
                       hoog). `ongemarkeerd` telt hier NIET mee -- dat is de
                       vaststelling dat er niets is vastgesteld.
     omkeerbaarGemeten routes waarvan de terugweg echt is uitgevoerd.

   `ongemarkeerd` en `onbekend` staan er als eigen getal naast, en ze zijn met
   opzet niet bij elkaar opgeteld: "geen grens wijst dit aan" en "geen bron kon
   worden gelezen" vragen ander werk.

   HIJ MEET OVER EXECUTION_MAP.json, de projectie van de echte routes. Dat is de
   enige lijst in dit huis die zegt welke paden er zijn; hem hier nabouwen zou
   een tweede routelijst maken (LAT.md regel 4).

   Draai: npm run handelingsklasse   (--vastleggen legt een betere stand vast)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const REGISTER = path.join(WORTEL, 'HANDELINGSKLASSE.json');
const { maakHandelingsklasse, RISICO, ONBEKEND } = require('../server/kern/handelingsklasse');

function meet() {
  const kaart = JSON.parse(fs.readFileSync(path.join(WORTEL, 'EXECUTION_MAP.json'), 'utf8'));
  const k = maakHandelingsklasse({});
  /* Per PAD en niet per rol-pad-paar: de klasse hangt aan de route en niet aan
     wie er belt, dus hetzelfde pad twee keer tellen zou de verdeling scheeftrekken
     naar de rollen met de meeste paden. */
  const paden = [...new Set((kaart.capabilities || []).map(c => c.pad).filter(Boolean))].sort();
  const risico = {};
  for (const r of RISICO) risico[r] = 0;
  risico[ONBEKEND] = 0;
  const omkeerbaar = {};
  for (const p of paden) {
    const uit = k.klasseVoor('POST', p);
    risico[uit.risicoklasse] = (risico[uit.risicoklasse] || 0) + 1;
    omkeerbaar[uit.omkeerbaarheid] = (omkeerbaar[uit.omkeerbaarheid] || 0) + 1;
  }
  const gemarkeerd = risico.geen + risico.verhoogd + risico.hoog;
  const gemeten = paden.length - (omkeerbaar[ONBEKEND] || 0);
  return { paden: paden.length, risico, omkeerbaar,
    risicoGemarkeerd: gemarkeerd, omkeerbaarGemeten: gemeten,
    beproefdePaden: k.beproefdePaden() };
}

function lees() { try { return JSON.parse(fs.readFileSync(REGISTER, 'utf8')); } catch (e) { return null; } }

function schrijf(nu) {
  fs.writeFileSync(REGISTER, JSON.stringify({
    uitleg: 'Gemeten door scripts/handelingsklasse.js (npm run handelingsklasse) over de paden in ' +
      'EXECUTION_MAP.json. `risicoGemarkeerd` en `omkeerbaarGemeten` zijn de ratels en mogen alleen ' +
      'OMHOOG; ze tellen alleen routes waarover een bron werkelijk iets zegt.',
    grens: '`ongemarkeerd` is geen laag risico maar de vaststelling dat geen grens in dit huis deze ' +
      'route aanwijst, en `onbekend` is geen onomkeerbaar maar een niet beproefde terugweg. Ze staan ' +
      'daarom apart en worden niet bij het gemarkeerde opgeteld.',
    gemeten: { paden: nu.paden, risicoGemarkeerd: nu.risicoGemarkeerd,
      omkeerbaarGemeten: nu.omkeerbaarGemeten, beproefdePaden: nu.beproefdePaden },
    risicoVerdeling: nu.risico, omkeerbaarVerdeling: nu.omkeerbaar
  }, null, 2) + '\n');
}

function draai(args) {
  const nu = meet();
  const oud = lees();
  console.log('\nDE CLASSIFICATIE VAN DE HANDELINGEN\n');
  console.log('  ' + nu.paden + ' paden uit EXECUTION_MAP.json\n');
  console.log('  RISICO');
  for (const [k, v] of Object.entries(nu.risico)) console.log('    ' + String(v).padStart(5) + '  ' + k);
  console.log('\n  OMKEERBAARHEID');
  for (const [k, v] of Object.entries(nu.omkeerbaar)) console.log('    ' + String(v).padStart(5) + '  ' + k);
  console.log('\n  gemarkeerd door een grens : ' + nu.risicoGemarkeerd +
    (oud ? '   (norm: ' + oud.gemeten.risicoGemarkeerd + ')' : ''));
  console.log('  terugweg echt gemeten    : ' + nu.omkeerbaarGemeten +
    (oud ? '   (norm: ' + oud.gemeten.omkeerbaarGemeten + ')' : ''));

  if (oud) {
    const zakt = [];
    if (nu.risicoGemarkeerd < oud.gemeten.risicoGemarkeerd) zakt.push('risicoGemarkeerd ' + oud.gemeten.risicoGemarkeerd + ' -> ' + nu.risicoGemarkeerd);
    if (nu.omkeerbaarGemeten < oud.gemeten.omkeerbaarGemeten) zakt.push('omkeerbaarGemeten ' + oud.gemeten.omkeerbaarGemeten + ' -> ' + nu.omkeerbaarGemeten);
    if (zakt.length) {
      console.log('\n  ZAKT: ' + zakt.join('; ') + '.');
      console.log('  Er is een grens of een gemeten terugweg verdwenen; dat hoort een besluit te zijn.\n');
      return 1;
    }
  }
  if (!oud || args.includes('--vastleggen')) { schrijf(nu); console.log('\n  HANDELINGSKLASSE.json bijgewerkt.\n'); return 0; }
  console.log('\n  Gelijk aan of beter dan de norm.\n');
  return 0;
}

module.exports = { meet, lees, schrijf, REGISTER };

if (require.main === module) process.exit(draai(process.argv.slice(2)));
