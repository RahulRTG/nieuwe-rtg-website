#!/usr/bin/env node
/* ============================================================================
   DE WACHTSCHULD -- hoeveel schermtoetsen wachten nog op de klok?

   WAT DIT MEET. `page.waitForTimeout(2500)` in een schermtoets is een gok, en
   een gok die twee kanten op fout gaat: op een rustige machine te lang (de
   suite duurt minuten langer dan nodig) en onder belasting te kort. Dat tweede
   is het ergste, want dan is de uitslag rood zonder dat er iets stuk is -- en
   een suite die af en toe rood geeft zonder dat iemand weet waarop, wordt binnen
   een maand genegeerd. Dat is precies het pad waar TAKEN.md 6.5 over gaat: twee
   keer een halve dag zoeken naar een fout die er niet was.

   WAT ER IN PLAATS VAN KOMT staat in test/helper.js: wachten op een TOESTAND
   (wachtTot, wachtOpTekst, wachtOpZichtbaar, wachtOpVerandering), op het
   ANTWOORD van de server (klikEnWacht), of tot het scherm STIL is
   (wachtOpRust -- geen lopend verzoek en geen hertekening meer). Dat laatste is
   geen verkapte klok: duurt het langer, dan wacht hij langer.

   DE RATEL. KLOKWACHT.json houdt de stand vast. Meer wachten dan opgeschreven:
   de poort gaat dicht (test/klokwacht.test.js). Minder: leg het vast met
   --vastleggen. Zo kan er geen nieuwe klok bij komen zonder dat iemand er iets
   van vindt.

   WAAROM HIJ NIET OP NUL STAAT, en dat hoort hier te staan in plaats van in een
   voetnoot: de drie zwaarste bestanden zijn omgezet (92 van de 162 wachten), en
   dat waren geen zoek-vervang-rondes. Elk ervan legde een echte race bloot die
   de vaste wachttijd toedekte -- twee bladen tegelijk in de DOM, een paneel dat
   ingetypte velden wist bij het hertekenen, een lijst die na het antwoord nog
   een keer opnieuw werd opgehaald. De rest staat er nog, geteld en met naam.

   Draai:  node scripts/klokwacht.js
           node scripts/klokwacht.js --vastleggen
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const TESTMAP = path.join(WORTEL, 'test');
const DOEL = path.join(WORTEL, 'KLOKWACHT.json');
const VASTLEGGEN = process.argv.includes('--vastleggen');

/* Alleen de echte wachten tellen: `waitForTimeout(` in de bron. Een verwijzing
   in een commentaarblok telt niet mee -- anders zou het opschrijven waarom een
   wacht wegging de schuld laten stijgen. */
function zonderCommentaar(bron) {
  return String(bron)
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
}

function meet() {
  const perBestand = {};
  let totaal = 0;
  for (const naam of fs.readdirSync(TESTMAP).sort()) {
    if (!/\.(e2e|test)\.js$/.test(naam)) continue;
    const bron = zonderCommentaar(fs.readFileSync(path.join(TESTMAP, naam), 'utf8'));
    const n = (bron.match(/waitForTimeout\s*\(/g) || []).length;
    if (n) { perBestand[naam] = n; totaal += n; }
  }
  return { totaal, bestanden: Object.keys(perBestand).length, perBestand };
}

function leesVastgelegd() {
  try { return JSON.parse(fs.readFileSync(DOEL, 'utf8')); } catch (e) { return null; }
}

const nu = meet();
const oud = leesVastgelegd();

console.log('\n=== DE WACHTSCHULD IN DE SCHERMTOETSEN ===\n');
console.log('  wachten op de klok : ' + nu.totaal);
console.log('  verdeeld over      : ' + nu.bestanden + ' bestanden');
if (oud && oud.gemeten) {
  const verschil = nu.totaal - oud.gemeten.totaal;
  console.log('  vastgelegd         : ' + oud.gemeten.totaal +
    (verschil === 0 ? ' (gelijk)' : verschil < 0 ? ' (' + (-verschil) + ' minder -- leg vast met --vastleggen)'
      : ' (' + verschil + ' MEER; de poort gaat dicht)'));
}
console.log('');
for (const [naam, n] of Object.entries(nu.perBestand).sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log('  ' + String(n).padStart(4) + '  ' + naam);
}
if (nu.bestanden > 12) console.log('  ... en nog ' + (nu.bestanden - 12) + ' bestanden');

if (VASTLEGGEN) {
  if (oud && oud.gemeten && nu.totaal > oud.gemeten.totaal) {
    console.error('\nNIET vastgelegd: de schuld is gestegen van ' + oud.gemeten.totaal + ' naar ' + nu.totaal +
      '. Een ratel legt geen verslechtering vast; haal de nieuwe wacht eruit of verantwoord hem met de hand.');
    process.exit(1);
  }
  fs.writeFileSync(DOEL, JSON.stringify({
    uitleg: 'Schermtoetsen die op een vaste tijd wachten in plaats van op een toestand. MAG ALLEEN KRIMPEN -- ' +
      'zie test/klokwacht.test.js. Wat ervoor in de plaats komt staat in test/helper.js (wachtTot, wachtOpTekst, ' +
      'wachtOpZichtbaar, wachtOpVerandering, wachtOpRust, klikEnWacht).',
    hoe: 'node scripts/klokwacht.js',
    gemeten: { totaal: nu.totaal, bestanden: nu.bestanden },
    schuld: nu.perBestand
  }, null, 1) + '\n');
  console.log('\n  vastgelegd in KLOKWACHT.json');
}

module.exports = { meet };
