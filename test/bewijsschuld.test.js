/* DE BEWIJSSCHULD MAG ALLEEN KRIMPEN.

   Draai los: node --experimental-sqlite --test test/bewijsschuld.test.js

   WAAROM DIT BESTAAT. De bewijslaag staat op 36%. Die overige 64% is geen
   homogene berg: er zit achterstand in, ontbrekend gereedschap, en posten waar
   meten domweg de verkeerde vraag is. Zolang die drie als een getal "ongemeten"
   door het leven gaan, weet niemand of hij naar werk kijkt of naar een grens.

   Tot voor kort leefde die kennis in committeksten en NORM.json-notities. Daar
   kun je niet op ratelen: een post die stilletjes groeit valt niemand op. Dit is
   dezelfde vorm die BEREIK.json al had -- een register dat alleen mag krimpen.

   HET ONDERSCHEID DAT DEZE TOETS BEWAAKT: een post van soort "grens" SLUIT
   NOOIT, en dat is geen falen. Wie hem als achterstand telt, jaagt op een getal
   dat niet bestaat. Vandaar dat de poort alleen op meetwerk en instrument let.

   DE MUTATIES (LAT.md regel 2), beide gedaan en beide zag ik de juiste toets
   zakken:
     - een post van 'grens' naar 'meetwerk' zetten -> toets 3 zakt (de
       achterstand springt dan met honderden omhoog)
     - de `sluit`-tekst van een post leegmaken     -> toets 2 zakt */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const schuld = require('../scripts/bewijsschuld');

const WORTEL = path.join(__dirname, '..');
const VASTGELEGD = path.join(WORTEL, 'BEWIJSSCHULD.json');

test('1. elke post draagt een aantal dat uit een REGISTER komt', () => {
  const uit = schuld.meet();
  assert.ok(uit.posten.length >= 8, 'de bekende posten staan erin');
  for (const p of uit.posten) {
    assert.ok(p.id && p.soort && p.wat, 'een post heeft een id, een soort en een omschrijving');
    assert.ok(['meetwerk', 'instrument', 'grens'].includes(p.soort),
      p.id + ' heeft soort "' + p.soort + '"; alleen meetwerk, instrument en grens bestaan');
    /* null mag: dan ONTBREEKT het register nog. Een verzonnen getal mag niet --
       een schuldenlijst met overgeschreven cijfers loopt binnen een maand uit de
       pas met wat er werkelijk is (LAT.md regel 4). */
    assert.ok(p.aantal === null || typeof p.aantal === 'number',
      p.id + ' draagt geen aantal en geen expliciet "onbekend"');
  }
});

test('2. elke post zegt WAAROM hij open staat en WAT hem zou sluiten', () => {
  for (const p of schuld.meet().posten) {
    assert.ok(p.waarom && p.waarom.length > 40,
      p.id + ' zegt niet waarom hij open staat');
    assert.ok(p.sluit && p.sluit.length > 30,
      p.id + ' zegt niet wat hem zou sluiten. Een schuldpost zonder uitweg is een klaagzang.');
  }
});

test('3. de achterstand mag alleen krimpen', () => {
  let oud = null;
  try { oud = JSON.parse(fs.readFileSync(VASTGELEGD, 'utf8')); } catch (e) { oud = null; }
  if (!oud) return;   // nog niet vastgelegd: dan valt er niets te vergelijken

  const nu = schuld.meet();
  const achterstand = (u) => u.telling.meetwerk + u.telling.instrument;
  assert.ok(achterstand(nu) <= achterstand(oud),
    'de bewijsschuld groeit: ' + achterstand(oud) + ' -> ' + achterstand(nu) + '. ' +
    'Meet ze, of leg de groei met de hand vast in BEWIJSSCHULD.json met een reden, ' +
    'dan staat het als bewuste keuze in de historie.');

  /* En een post mag niet van soort veranderen om onder de poort uit te komen:
     iets van "meetwerk" naar "grens" verplaatsen laat de achterstand dalen
     zonder dat er iets is gemeten. Dat is precies hoe een ratel wordt omzeild. */
  const soortVan = (u) => Object.fromEntries(u.posten.map(p => [p.id, p.soort]));
  const was = soortVan(oud), is = soortVan(nu);
  for (const id of Object.keys(was)) {
    if (!is[id]) continue;
    if (was[id] !== 'grens' && is[id] === 'grens') {
      assert.fail(id + ' is van "' + was[id] + '" naar "grens" gezet. Daarmee daalt de ' +
        'achterstand zonder dat er iets is gemeten. Als het werkelijk de rand van de methode ' +
        'is, hoort dat met een reden in de historie te staan en niet stil in een tabel.');
    }
  }
});

test('4. de grens-posten sluiten nooit, en dat staat er ook', () => {
  const uit = schuld.meet();
  const grenzen = uit.posten.filter(p => p.soort === 'grens');
  assert.ok(grenzen.length >= 2, 'er zijn posten waar meten de verkeerde vraag is');
  assert.match(uit.uitleg, /sluit nooit/,
    'het register zegt zelf dat een grens-post nooit sluit; anders leest hij als achterstand');
});
