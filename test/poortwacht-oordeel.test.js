/* ============================================================================
   EEN DEUR DIE STRANDDE OP ZIJN VALIDATIE, IS GEEN DEUR ZONDER SLOT.

   HET GEVAL. De poortwacht klopt bij elke route aan ZONDER token en kijkt wat
   eruit komt. Hij deed dat met een leeg lijf (`{}`), en dat is voor 300 routes
   te vroeg: wie eerst zijn invoer valideert antwoordt 400 of 404, en dan is de
   autorisatie nooit aan de beurt geweest. Die routes heetten `stil` -- eerlijk,
   en onbeslist. Ze stonden als eigen post in BEWIJSSCHULD.json, soort
   `instrument`, met precies deze reparatie erbij: een sonde die een PLAUSIBEL
   lichaam stuurt.

   Dat is nu de tweede klop. Zelfde plausibele lijf als de rolproef, nog steeds
   geen token. Wie dan 401 of 403 geeft, is dicht. Wie dan 2xx geeft, gaat open
   voor een vreemde -- en dat is een bevinding die de eerste klop niet zag.

   WAAROM DEZE TOETS EEN PURE FUNCTIE PAKT. `oordeelVan()` stond eerst als
   if-keten in de meetlus. Dan is er geen manier om na te gaan of de regel wel
   ooit kan vuren zonder een hele ronde te draaien -- en precies dat gebeurde bij
   de OUTPUT-as: een toerekeningsregel die nooit kon vuren, nul bewezen op 4185
   routes, en de suite bleef groen (LAT.md regel 9).

   MUTATIEBEWIJS (LAT.md regel 2 en 10). Drie keer gebroken:

     de tweede klop weglaten (tweede telt niet mee) -> 3 gezakt (2, 4, 5)
     `stil` bij een onbesliste klop `dicht` noemen  -> 1 gezakt (1)
     pasNaLijf altijd false                         -> 1 gezakt (5)
     de PUBLIEK-lijst negeren na de tweede klop     -> 1 gezakt (4)
   ========================================================================== */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { oordeelVan, afsluitcode } = require('../scripts/poortwacht.js');

test('1. onbeslist blijft onbeslist -- niet weten is geen slot', () => {
  /* De verleiding is om 400/404 als "dicht genoeg" te tellen: er komt immers
     niets uit. Dat is precies de stilte waar LAT.md regel 3 over gaat. Een
     route die op zijn validatie strandt heeft niets over zijn slot gezegd. */
  assert.strictEqual(oordeelVan(400, null, false).oordeel, 'stil');
  assert.strictEqual(oordeelVan(404, null, false).oordeel, 'stil');
  assert.strictEqual(oordeelVan(500, 500, false).oordeel, 'stil');
});

test('2. een tweede klop met een lijf beslist wat de eerste openliet', () => {
  assert.strictEqual(oordeelVan(400, 401, false).oordeel, 'dicht');
  assert.strictEqual(oordeelVan(404, 403, false).oordeel, 'dicht');
  /* En de andere kant, die zwaarder weegt: zonder token toch 2xx. */
  assert.strictEqual(oordeelVan(404, 200, false).oordeel, 'open');
  assert.strictEqual(oordeelVan(404, 204, false).oordeel, 'open');
});

test('3. de eerste klop wint als hij al iets zei', () => {
  /* Een route die meteen 401 geeft, hoeft geen tweede klop -- en mag er ook geen
     ander oordeel van krijgen. Anders hangt de uitslag af van wat een tweede,
     zwaarder verzoek toevallig doet. */
  assert.strictEqual(oordeelVan(401, 200, false).oordeel, 'dicht');
  assert.strictEqual(oordeelVan(200, 401, false).oordeel, 'open');
  assert.strictEqual(oordeelVan(0, 200, false).oordeel, 'onbereikbaar');
});

test('4. publiek is een KEUZE en geen bevinding, ook na de tweede klop', () => {
  /* PUBLIEK in scripts/poortwacht.js is de lijst paden die met opzet open
     staan. Zou de tweede klop die lijst negeren, dan komt /api/health als
     bevinding in de uitslag en leert iedereen de uitslag te wantrouwen. */
  assert.strictEqual(oordeelVan(200, null, true).oordeel, 'publiek');
  assert.strictEqual(oordeelVan(404, 200, true).oordeel, 'publiek');
  assert.strictEqual(oordeelVan(404, 200, false).oordeel, 'open');
});

test('5. de winst van de tweede klop is apart te tellen', () => {
  /* Zonder eigen getal is niet te zien of die tweede klop nog iets oplevert.
     Een sonde die je niet kunt afrekenen op zijn opbrengst, blijft draaien
     lang nadat hij niets meer vindt. */
  assert.strictEqual(oordeelVan(404, 403, false).pasNaLijf, true);
  assert.strictEqual(oordeelVan(404, 200, false).pasNaLijf, true);
  assert.strictEqual(oordeelVan(401, null, false).pasNaLijf, false);
  assert.strictEqual(oordeelVan(404, null, false).pasNaLijf, false);
  assert.strictEqual(oordeelVan(404, 500, false).pasNaLijf, false);
});

test('6. het requiren van de poortwacht start geen ronde', () => {
  /* Deze toets pakt de sonde beet. Zonder de require.main-wacht zou dat een
     volledige ronde starten -- server, routekaart, tweeduizend kloppen -- en
     ROLPROEF.json is ooit precies zo van 3377 beproefde routes teruggezet naar
     292 door een onschuldige laadcontrole. */
  const p = require('../scripts/poortwacht.js');
  assert.deepStrictEqual(Object.keys(p), ['oordeelVan', 'afsluitcode']);
});

test('7. een onbereikbare route maakt de volledige meting ongeldig', () => {
  assert.equal(afsluitcode({ open: [], fout: 0 }), 0, 'compleet en dicht is groen');
  assert.equal(afsluitcode({ open: [{ pad: '/api/fout' }], fout: 0 }), 1,
    'een aantoonbaar open deur is een beveiligingsbevinding');
  assert.equal(afsluitcode({ open: [], fout: 1 }), 2,
    'één onbereikbare route is geen groen bewijs');
  assert.equal(afsluitcode({ open: [{ pad: '/api/fout' }], fout: 1 }), 2,
    'een gedeeltelijke meting blijft ongeldig, ook als zij al een opening vond');
  assert.equal(afsluitcode(null), 2, 'een ontbrekende uitslag faalt dicht');
});
