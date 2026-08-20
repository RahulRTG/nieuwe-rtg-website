/* DE TAKENLIJST MOET AANWIJSBAAR ZIJN.

   LAT.md verwijst op drie plekken naar TAKEN.md ("die lijst staat in de
   takenlijst, niet in iemands hoofd"), en vijftien plekken in de code en de
   documenten halen een regel aan bij NUMMER: `TAKEN.md 5.22`, `TAKEN.md 4.21`.
   Zo'n verwijzing is alleen iets waard als dat nummer precies een ding aanwijst.

   Op 18 augustus 2026 deed het dat niet. Tien nummers stonden dubbel -- 4.22,
   4.23, 4.24 en 4.25 elk twee tot drie keer, over verschillende onderwerpen --
   doordat elke ronde onderaan zijn eigen nummering begon. `scripts/check.js`
   haalde 4.23 aan en bedoelde de omvang van `server/db/index.js`; een lezer die
   op het eerste 4.23 stuitte las over betaalopdrachten. Geen van beide partijen
   had ongelijk, en dat is het probleem.

   TWEE REGELS, EN DE TWEEDE IS DE BELANGRIJKSTE:

     1. Een nummer wijst een ding aan. Dubbel is fout.
     2. EEN NUMMER WORDT NOOIT HERGEBRUIKT. Een regel die af is blijft
        doorgestreept staan en HOUDT zijn nummer. Zou hij verdwijnen en zijn
        nummer opnieuw worden uitgedeeld, dan wijst een oude verwijzing in de
        code stilzwijgend naar iets anders -- erger dan een verwijzing die
        nergens op uitkomt, want die valt tenminste op.

   De zeef zelf woont in scripts/lib/takenlijst.js en niet hier: een toets zonder
   module om te muteren kan de mutatiemotor niet meten.

   Draai los: node --experimental-sqlite --test test/takenlijst.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { definities, dubbelingen, losseVerwijzingen } = require('../scripts/lib/takenlijst.js');

const WORTEL = path.join(__dirname, '..');
const LIJST = path.join(WORTEL, 'TAKEN.md');
const lees = () => fs.readFileSync(LIJST, 'utf8');

/* Nummers die ooit zijn uitgedeeld en NIET meer in de lijst staan. Vandaag is
   deze lijst leeg, en dat hoort zo te blijven: een afgeronde regel blijft
   doorgestreept staan en houdt zijn nummer, dus er valt niets te vergeven. Zet
   er alleen iets in als een regel echt uit het bestand is GEHAALD, met de plek
   die hem nog aanhaalt erbij. */
const VERGEVEN = {};

test('elk nummer in de takenlijst wijst precies een regel aan', () => {
  assert.deepEqual(dubbelingen(lees()), [],
    'deze nummers staan meer dan een keer in de lijst. Een verwijzing als ' +
    '"TAKEN.md 4.24" wijst dan niets aan. Geef de latere regel een nummer ' +
    'boven het hoogste dat ooit in die paragraaf is uitgedeeld.');
});

test('elke verwijzing uit de code komt uit bij een regel', () => {
  assert.deepEqual(losseVerwijzingen(lees(), WORTEL, VERGEVEN), [],
    'deze verwijzingen komen nergens uit. Staat de regel er niet meer, zet het ' +
    'nummer dan in VERGEVEN hierboven; anders klopt de verwijzing niet meer.');
});

test('een vergeven nummer wordt niet opnieuw uitgedeeld', () => {
  const bekend = definities(lees());
  assert.deepEqual(Object.keys(VERGEVEN).filter(n => bekend.has(n)), [],
    'deze nummers waren van de lijst af en staan er weer op, bij een ander ' +
    'onderwerp. Elke oude verwijzing wijst daarmee stilzwijgend naar iets anders.');
});

test('de lijst zegt wanneer hij is bijgewerkt', () => {
  const m = /Bijgewerkt:\s*(\d{4}-\d{2}-\d{2})/.exec(lees());
  assert.ok(m, 'TAKEN.md draagt geen "Bijgewerkt:"-datum');
  assert.ok(!Number.isNaN(Date.parse(m[1])), 'de datum is geen datum: ' + m[1]);
});

/* DE TEGENPROEVEN. Zonder deze zou de eerste toets ook slagen op een zeef die
   niets vindt -- een lege verzameling heeft nooit een dubbeling. */
test('DE TEGENPROEF: de zeef ziet echt regels, in beide vormen', () => {
  const bekend = definities(lees());
  assert.ok(bekend.size > 50, 'er zijn echt regels gevonden (' + bekend.size + ')');

  const namaak = [
    '## 4. Verzonnen',
    '| 4.1 | open regel |',
    '| ~~4.2~~ | ~~afgeronde regel~~ |',
    '| 4.1 | tweede regel met hetzelfde nummer |'
  ].join('\n');
  const gevonden = definities(namaak);
  assert.equal(gevonden.size, 2, 'een open en een afgeronde regel, allebei geteld');
  assert.ok(gevonden.has('4.2'), 'een DOORGESTREEPTE regel telt mee: hij is af, niet weg');
  assert.deepEqual(dubbelingen(namaak), ['4.1 (regels 2, 4)'], 'en de dubbeling wordt gezien');
});

test('DE TWEEDE TEGENPROEF: een tabel buiten een genummerde paragraaf telt niet mee', () => {
  /* De prioriteitstabel bovenaan TAKEN.md HAALT regels aan in dezelfde vorm.
     Telde de zeef die als definitie, dan stond elke aangehaalde regel per
     definitie dubbel en was deze toets voor eeuwig rood. */
  const namaak = [
    '## Hoe deze lijst gelezen hoort te worden',
    '| 4.1 | dit is een verwijzing, geen definitie |',
    '## 4. Verzonnen',
    '| 4.1 | de echte regel |'
  ].join('\n');
  assert.deepEqual(dubbelingen(namaak), [], 'de aanhaling bovenaan telt niet als tweede definitie');
  assert.equal(definities(namaak).get('4.1').length, 1);
});
