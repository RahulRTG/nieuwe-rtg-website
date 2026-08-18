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

/* HET MODULE-GAT, en het kostte een hele e2e-ronde.

   Hier stond `require.resolve('playwright')` en verder niets. Op 18 augustus
   2026 lukte dat prima -- de module lag er -- terwijl de omgeving chromium 1194
   had staan en playwright bouw 1234 vroeg. Alle 122 browsertoetsen vielen om op
   een installatiebanner, en deze wacht bleef groen. Hij bewaakte de VERPAKKING
   en niet wat erin moet zitten.

   Nu vraagt hij het aan dezelfde plek als de toetsen zelf (test/helper.js).
   Zegt die "hier start geen browser", dan zakt deze wacht -- want dan bewijzen
   de schermtoetsen niets, precies zoals wanneer de module ontbreekt.

   MUTATIEBEWIJS (LAT.md regel 2 en 10), met een omgeving waarin de aanwijzing
   nergens heen wijst (RTG_BROWSER_PATH=/bestaat/niet):

     deze wacht                       -> ZAKT   "playwright is er, maar geen
                                                 enkele chromium start hier"
     de oude, alleen require.resolve  -> groen  en dat is precies het gat: de
                                                module lag er die dag ook. */
const { laadPlaywright, geenBrowser } = require('./helper');

test('de browser is er EN hij start, anders bewijzen de schermtoetsen niets', () => {
  const reden = geenBrowser(laadPlaywright());
  assert.equal(reden, false,
    reden + ' -- alle schermtoetsen slaan zichzelf over of vallen om, en de ronde ' +
    'bewijst NIETS over of een scherm werkt. Installeer hem (npm i -D playwright && ' +
    'npx playwright install chromium) of wijs er een aan met RTG_BROWSER_PATH.');
});

test('en er zijn nog evenveel schermtoetsen als afgesproken', () => {
  const bestanden = fs.readdirSync(path.join(WORTEL, 'test')).filter((f) => f.endsWith('.e2e.js'));
  /* De ondergrens staat op de stand van 18 augustus 2026 en mag ALLEEN OMHOOG.
     Verdwijnt er een schermtoets, dan zakt deze regel -- en dat is precies het
     geval waarin niemand iets merkt, want een verdwenen toets meldt zichzelf
     nooit. */
  assert.ok(bestanden.length >= 126,
    'er zijn schermtoetsen verdwenen: ' + bestanden.length + ' gevonden, 126 of meer verwacht');
});
