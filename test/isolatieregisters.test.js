/* DE TWEE ISOLATIEREGISTERS DRAGEN EEN TAND -- en dat was de reden dat
   `metingenZonderRatel` van 33 naar 35 ging.

   scripts/lib/metingen.js zegt het scherp: een meetbestand dat aan geen enkele
   ratel hangt, groeit stilletjes de verkeerde kant op -- niet omdat er een tand
   brak, maar omdat er nooit een tand was. Het getal hoort te dalen doordat er
   RATELS bijkomen, niet doordat er regels in het register bijkomen. Dit bestand
   is die twee ratels.

   ISOLATIESCHADUW.json -- GEWOGEN MAG NOOIT NAAR NUL.
   Dat is geen willekeurige grens maar exact de regressie die hier is gevonden.
   De isolatiepoort woog NUL verzoeken van een lid met een stand op `identiteit`,
   want de middleware staat voor `auth` en kende de identiteitssleutel niet. De
   laag stond aan, telde netjes, en keek langs de gewoonste beschermstand heen --
   en niets klaagde, want er was niets dat klaagde. Deze tand klaagt.

   Bewust NIET ook `zouSluiten` vastgepind: dat getal beweegt mee met elke nieuwe
   route in de allowlist, en een tand die rammelt om redenen die niets met de
   poort te maken hebben, wordt weggeklikt en daarna genegeerd.

   ISOLATIEPROEF.json -- ELK SCHULDPUNT HOUDT ZIJN VORM.
   Een schuldenlijst wordt waardeloos zodra er punten in staan zonder reden of
   zonder uitweg; dan is het een klaagzang in plaats van werk. Zelfde eis als
   test/bewijsschuld.test.js aan BEWIJSSCHULD.json stelt.

   MUTATIES, allebei gedraaid en allebei zag ik de juiste toets zakken:
     - `gewogen` van een ronde op 0 zetten          -> toets 1 zakt
     - de `waarom` van een schuldpunt leegmaken     -> toets 3 zakt */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const lees = (naam) => JSON.parse(fs.readFileSync(path.join(WORTEL, naam), 'utf8'));

test('1. de schaduwproef heeft ECHT gewogen: nul is geen uitslag', () => {
  const s = lees('ISOLATIESCHADUW.json');
  const rondes = (s.rondes || []).filter(r => !r.fout);
  assert.ok(rondes.length >= 1,
    'geen enkele ronde is gelukt; dan zegt dit register niets over de poort');

  for (const r of rondes) {
    assert.ok(r.gewogen > 0,
      'de poort woog NUL verzoeken in de stand "' + r.stand + '". Dat is precies de ' +
      'regressie waar deze tand voor bestaat: een stand die de handhaving niet ziet. ' +
      'Draai npm run isolatieschaduw en kijk waar de drager zijn sleutel verliest.');
  }
});

test('2. de proef zegt WAAROVER hij gaat, en dus ook waarover niet', () => {
  const s = lees('ISOLATIESCHADUW.json');
  assert.ok(s.grens && s.grens.length > 40,
    'een meting zonder uitgeschreven grens leest als een uitspraak over alles');
  assert.ok(s.paden > 0, 'het aantal beproefde paden hoort in de uitslag te staan');
});

test('3. elk schuldpunt van de isolatieproef draagt een reden', () => {
  const p = lees('ISOLATIEPROEF.json');
  const schuld = p.schuld || [];
  assert.ok(schuld.length >= 1, 'de schuldenlijst is leeg; dat is verdacht, niet goed');
  for (const s of schuld) {
    assert.ok(s.punt && s.punt.length > 10, 'een schuldpunt zonder omschrijving: ' + JSON.stringify(s).slice(0, 120));
    assert.ok(s.waarom && s.waarom.length > 40,
      'schuldpunt "' + s.punt + '" zegt niet waarom hij open staat. Een schuldenlijst ' +
      'zonder redenen is een klaagzang.');
  }
});

test('4. de proef telt per noemer en maakt er geen samengesteld cijfer van', () => {
  const p = lees('ISOLATIEPROEF.json');
  assert.ok(p.geenSamengesteldCijfer,
    'het register hoort zelf te zeggen dat het geen samengesteld cijfer maakt; ' +
    'een percentage tussen twee verschillende noemers is fictie');
  assert.ok(Object.keys(p.noemers || {}).length >= 5, 'de noemers staan apart');
});
