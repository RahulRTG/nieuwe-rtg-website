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
const { definities, dubbelingen, losseVerwijzingen, openPerParagraaf, gemeldeTelling } = require('../scripts/lib/takenlijst.js');

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

/* DE TELLING IN DE KOP KLOPT MET DE LIJST ZELF.

   Bovenaan TAKEN.md staat hoeveel regels er openstaan, per paragraaf. Dat is de
   eerste zin die een lezer gebruikt om te beslissen waar hij begint, en tot 23
   augustus 2026 was hij fout: er stond "zesentachtig" terwijl het er
   vierennegentig waren, en zes daarvan waren al af maar niet doorgestreept. Geen
   van beide fouten viel op, want niemand telde na.

   Deze toets telt na. Hij dwingt niets af over de INHOUD van de lijst -- alleen
   dat het getal in de kop hetzelfde zegt als de tabellen eronder. */
test('de telling in de kop klopt met wat er in de lijst staat', () => {
  const bron = lees();
  const gemeld = gemeldeTelling(bron);
  assert.ok(gemeld, 'TAKEN.md draagt geen telling in de vorm "**Open: 78** -- §1 11, §2 9, ..."');

  const werk = [...openPerParagraaf(bron)].filter(([sectie]) => sectie !== '6');
  assert.deepEqual([...gemeld.per], werk,
    'de telling bovenaan loopt uit de pas met de tabellen eronder. Tel opnieuw, ' +
    'of streep de regels door die af zijn -- een afgeronde regel die zijn ' +
    'doorstreping mist, telt mee als werk dat er niet meer is.');
  assert.equal(gemeld.totaal, werk.reduce((som, [, n]) => som + n, 0),
    'het totaal is niet de som van de paragrafen');
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

test('DE DERDE TEGENPROEF: de telling ziet het verschil tussen open en doorgestreept', () => {
  /* Zonder deze zou de telling-toets ook slagen op een teller die alles telt,
     of op een die niets telt: in beide gevallen zijn kop en lijst het eens. */
  const namaak = [
    '## 4. Verzonnen',
    '| 4.1 | open |',
    '| 4.2 | ook open |',
    '| ~~4.3~~ | ~~af, telt niet als werk~~ |',
    '## Tussenkop zonder nummer',
    '| 4.1 | een aanhaling, geen regel |',
    '## 6. Eerlijkheidspunten',
    '| 6.1 | een paragraaf zonder open regels mag ook bestaan |'
  ].join('\n');
  assert.deepEqual([...openPerParagraaf(namaak)], [['4', 2], ['6', 1]],
    'twee open in 4 (de doorgestreepte niet), en de aanhaling buiten een genummerde paragraaf telt niet mee');
});

test('DE VIERDE TEGENPROEF: de gemelde telling wordt echt gelezen', () => {
  const gelezen = gemeldeTelling('wat tekst\n**Open: 78** -- §1 11, §2 9, §3 4, §4 23, §5 31. En verder\n');
  assert.equal(gelezen.totaal, 78);
  assert.deepEqual([...gelezen.per], [['1', 11], ['2', 9], ['3', 4], ['4', 23], ['5', 31]]);
  assert.equal(gemeldeTelling('een lijst zonder telling'), null,
    'geen telling is null, zodat de toets zakt in plaats van stil nul te tellen');
});
