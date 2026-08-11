/* EEN OVERGESLAGEN SCHERMTOETS IS ROOD. Afspraak van Rahul, 11 augustus 2026.

   WAT ER MIS WAS. De schermtoetsen (test/*.e2e.js) beginnen alle met
   `{ skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }`.
   Zonder browser slaan ze zichzelf over, en node --test meldt dat als
   `pass 0 fail 0` -- een groene ronde. Gemeten op de dag dat dit werd
   geschreven: playwright ontbrak volledig en 114 van de 119 schermtoetsbestanden
   sloegen zichzelf over. Daarmee bewees de suite over vrijwel geen enkel scherm
   dat het werkt.

   HOE IK HET ZAG. Niet uit de uitslag -- die was groen -- maar door in een
   schermtoets met een mutatie een fout terug te zetten en hem gewoon groen te
   zien blijven. Twee keer achter elkaar. Een bewering in een overgeslagen
   bestand kan per definitie niet zakken (LAT.md regel 9), dus het waren geen
   toetsen maar tekst.

   WAT DEZE WACHT DOET. Hij faalt zodra de browser er niet is. Dat is met opzet
   hard: liever een rode ronde die zegt "er is niets bewezen" dan een groene die
   het tegenovergestelde suggereert. Wie de suite wil draaien, installeert de
   browser:

       npm i -D playwright && npx playwright install chromium

   En hij telt de bestanden, want de tweede manier waarop dit sluipt is dat er
   schermtoetsen VERDWIJNEN zonder dat iemand het merkt. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');

/* Dezelfde zoektocht als de schermtoetsen zelf doen (zie de kop van
   test/appmenu.e2e.js): eerst het project, dan de globale installatie. */
function browserAanwezig() {
  try { require.resolve('playwright', { paths: [WORTEL] }); return true; } catch (e) { /* volgende */ }
  try { require.resolve('playwright'); return true; } catch (e) { return false; }
}

test('de browser is er, anders bewijzen de schermtoetsen niets', () => {
  assert.ok(browserAanwezig(),
    'playwright ontbreekt, dus alle schermtoetsen slaan zichzelf over en de ronde bewijst ' +
    'NIETS over of een scherm werkt. Installeer hem: npm i -D playwright && npx playwright install chromium');
});

test('en er zijn nog evenveel schermtoetsen als afgesproken', () => {
  const bestanden = fs.readdirSync(path.join(WORTEL, 'test')).filter((f) => f.endsWith('.e2e.js'));
  /* De ondergrens staat op de stand van 11 augustus 2026 en mag ALLEEN OMHOOG.
     Verdwijnt er een schermtoets, dan zakt deze regel -- en dat is precies het
     geval waarin niemand iets merkt, want een verdwenen toets meldt zichzelf
     nooit. */
  assert.ok(bestanden.length >= 119,
    'er zijn schermtoetsen verdwenen: ' + bestanden.length + ' gevonden, 119 of meer verwacht');
});
