/* DE MEETLAAG WORDT ZELF GEMETEN.

   Draai los: node --experimental-sqlite --test test/meetkeuring.test.js

   WAAROM DIT BESTAAT. Dit huis meet zijn product uitputtend. Wat er niet was, is
   een meting op de INSTRUMENTEN, en juist daar zijn deze maand de duurste fouten
   gevonden -- niet in het product maar in wat erover rapporteert:

     de poortwacht printte 484 KB en riep process.exit aan; door een pipe kwam er
       146 KB uit. Geldige tekst, kapotte JSON, exitcode 0.
     een laadcontrole startte de rolproef en schreef ROLPROEF.json van 3377
       beproefde routes terug naar 292.
     de outputproef had een toerekeningsregel die nooit kon vuren: nul bewezen op
       4185 routes, en de suite bleef groen.
     21 van de 24 registers droegen geen tijdstempel.

   Vier fouten, vier keer dezelfde vorm: een meter die iets beweert wat hij niet
   heeft gemeten. Elk ervan stond achteraf in commentaar, en commentaar handhaaft
   niets.

   DE RATEL: het aantal overtredingen mag alleen krimpen. Er staan er nu acht
   open; dat zijn geen nieuwe fouten maar oude die voor het eerst zichtbaar zijn.

   DE MUTATIES (LAT.md regel 2), beide gedaan en beide zag ik de juiste toets
   zakken:
     - de wacht-regel weer alleen de negatieve schrijfwijze laten herkennen
       -> toets 3 zakt (drie valse alarmen erbij)
     - een regel zijn `waarom` afnemen -> toets 2 zakt */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const keuring = require('../scripts/meetkeuring');

/* De stand op het moment van schrijven. MAG ALLEEN KRIMPEN. */
const OPEN_MAX = 8;

test('1. elke regel komt uit een echte fout en is na te trekken', () => {
  assert.ok(keuring.REGELS.length >= 4, 'er zijn regels');
  for (const r of keuring.REGELS) {
    assert.ok(r.id && r.wat && typeof r.keur === 'function', r.id + ' is geen bruikbare regel');
  }
});

test('2. elke regel zegt WAAROM hij bestaat, met het geval erbij', () => {
  /* Een regel zonder herkomst wordt bij de eerste hindernis weggeklikt. Elke
     regel hier hoort te kunnen zeggen welke fout hem heeft veroorzaakt. */
  for (const r of keuring.REGELS) {
    assert.ok(r.waarom && r.waarom.length > 60,
      r.id + ' zegt niet waarom hij bestaat; dan is het een stijlvoorkeur');
  }
});

test('3. de keuring geeft geen vals alarm op een bestaande wacht', () => {
  /* Dit ging echt mis: de regel herkende alleen `require.main !== module` en
     meldde mutatie.js en sabotage.js als overtreding, terwijl die de wacht
     dragen als `if (require.main === module) { ... }`. Een keuring die onterecht
     aanslaat wordt binnen een week genegeerd, en handhaaft dan niets meer. */
  const uit = keuring.meet();
  const vals = uit.bevindingen.filter(b => b.regel === 'wacht' &&
    /mutatie|sabotage|bewijsmatrix|rolproef|staatproef|invoerproef|idemproef/.test(String(b.script)));
  assert.deepEqual(vals.map(b => b.script), [],
    'deze scripts dragen de wacht wel, in de vorm `if (require.main === module)`: ' +
    vals.map(b => b.script).join(', '));
});

test('4. het aantal overtredingen mag alleen krimpen', () => {
  const uit = keuring.meet();
  assert.ok(uit.telling.gezakt <= OPEN_MAX,
    'de meetlaag houdt zich op ' + uit.telling.gezakt + ' punten niet aan zijn eigen regels ' +
    '(was ' + OPEN_MAX + '). Repareer ze, of verlaag OPEN_MAX met de hand en zet in de ' +
    'commit waarom dat een bewuste keuze is. Open nu: ' +
    uit.bevindingen.map(b => b.register + '/' + b.regel).join(', '));
});

test('5. een instrument zonder register krijgt geen oordeel', () => {
  /* Niet-van-toepassing is geen goedkeuring. Een register dat nog niet bestaat
     mag niet als "in orde" tellen -- dat is precies de stilte waar deze hele
     laag tegen is gebouwd. */
  const uit = keuring.meet();
  assert.ok(uit.telling.nvt > 0, 'er zijn regels die op iets niet van toepassing zijn');
  assert.equal(uit.telling.ok + uit.telling.gezakt + uit.telling.nvt, uit.telling.gekeurd,
    'elk oordeel valt in precies een bak; er verdwijnt niets');
});
