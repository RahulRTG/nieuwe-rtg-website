/* ============================================================================
   DE HEAPPROEF ALS INSTRUMENT -- en HEAPPROEF.json als ratel.

   scripts/heapproef.js meet of deze server geheugen vasthoudt. Dit bestand
   bewaakt het instrument en zijn register; de proef zelf draait tegen een
   wegwerpserver en duurt een half uur.

   DE SCHERPSTE TOETS HIER IS NUMMER 4: het oordeel in het register wordt
   OPNIEUW UITGEREKEND uit de opgeslagen bloktempo's. Zonder die controle is een
   groen register een tekstbestand -- iemand hoeft er alleen "STABIEL" in te
   typen. Dezelfde regel als bij EXECUTION_MAP.json: met de hand gewijzigd is
   rood.

   Draai los:  node --test test/heapproef.test.js
   De proef:   npm run heapproef        (de ijking: npm run heapproef:ijk) */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { oordeel, tempos } = require('../scripts/lib/heapstat');

const WORTEL = path.join(__dirname, '..');
const bron = fs.readFileSync(path.join(WORTEL, 'scripts', 'heapproef.js'), 'utf8');
const hookBron = fs.readFileSync(path.join(WORTEL, 'scripts', 'gc-hook.js'), 'utf8');
const PAD = path.join(WORTEL, 'HEAPPROEF.json');
/* GEEN ZELFPOORT. Deze drie toetsen sloegen zichzelf over zolang HEAPPROEF.json
   ontbrak, en dat is precies de vorm waar `zelfpoortendeToetsen` voor bestaat:
   acht pg-toetsen telden zo maandenlang mee als dekking zonder ooit te draaien.
   Het register hoort in de repo te staan zoals de andere registers; ontbreekt
   het, dan is dat een bevinding en geen reden om te zwijgen. */
const reg = JSON.parse(fs.readFileSync(PAD, 'utf8'));

test('1. verkeer en stilte lopen VERWEVEN, niet na elkaar', () => {
  /* De oude FASE F deed eerst alle stiltes en daarna al het verkeer. Elke
     drift in de tijd landde daarmee volledig op het verkeer. A B B A houdt de
     twee condities gelijk verdeeld over de eenheid. */
  assert.match(bron, /const EENHEID = \['verkeer', 'stilte', 'stilte', 'verkeer'\]/,
    'de blokvolgorde hoort verweven en symmetrisch te zijn');
});

test('2. de stilte krijgt dezelfde tijdsopbouw als het verkeer', () => {
  /* Zou de stilte de aanloop overslaan, dan verschillen de condities in de VORM
     van de meting en niet alleen in de belasting -- en dan meet het verschil
     deels het meetschema. */
  assert.match(bron, /await draai\(AANLOOP_MS\);[\s\S]{0,120}const begin = await vloer\(\);[\s\S]{0,120}await draai\(BLOK_MS\);[\s\S]{0,120}const eind = await vloer\(\);/,
    'elk blok hoort aanloop -> meetpunt -> stabiel venster -> meetpunt te zijn');
});

test('3. het meetpunt is vast en gebruikt de mediaan, geen minimum', () => {
  assert.match(bron, /async function vloer\(\)/);
  assert.match(bron, /monsters\.push/, 'de vloer hoort meerdere monsters te nemen');
  assert.match(bron, /s\[s\.length >> 1\]/, 'de vloer hoort de mediaan te zijn -- een minimum daalt vanzelf als je vaker meet');
  assert.doesNotMatch(bron, /Math\.min\([\s\S]{0,40}heapUsed/, 'een minimum als vloerschatter is precies de oude fout');
});

test('4. de ijking bestaat, en zij keert de verwachting om', () => {
  /* Een geheugenmeter die je nooit hebt zien AANSLAAN meet niets. Met een
     ingebouwd lek MOET de proef LEK zeggen, en anders met een foutcode eindigen. */
  assert.match(bron, /if \(IJK > 0\) return uit\.stand === 'LEK' \? 0 : 1;/,
    'zonder deze omkering is de ijking geen controle maar een tweede meting');
  assert.match(hookBron, /RTG_LEK_MBMIN/, 'het ijklek hoort in de test-preload te zitten');
  assert.match(hookBron, /new Array\(131072\)/,
    'het ijklek hoort in de V8-heap te landen; Buffers staan erbuiten en zouden onzichtbaar zijn');
  assert.doesNotMatch(hookBron, /Buffer\.alloc[\s\S]{0,60}vast\.push/,
    'een ijklek van Buffers beweegt heapUsed niet en verklaart de meter ten onrechte blind');
});

test('5. het ijklek raakt de productieserver niet', () => {
  /* De preload doet niets zonder de omgevingsvariabele, en die staat nergens in
     server/. Zou hij daar wel staan, dan is dit geen testhulp meer maar een
     schakelaar in de productieserver waarmee je hem geheugen kunt laten
     opeten. */
  assert.match(hookBron, /const lekTempo = Number\(process\.env\.RTG_LEK_MBMIN \|\| 0\);/);
  const gevonden = [];
  const loop = (map) => {
    for (const naam of fs.readdirSync(map, { withFileTypes: true })) {
      const vol = path.join(map, naam.name);
      if (naam.isDirectory()) { if (naam.name !== 'node_modules' && naam.name !== 'data') loop(vol); }
      else if (naam.name.endsWith('.js') && fs.readFileSync(vol, 'utf8').includes('RTG_LEK_MBMIN')) gevonden.push(vol);
    }
  };
  loop(path.join(WORTEL, 'server'));
  assert.deepEqual(gevonden, [], 'RTG_LEK_MBMIN hoort nergens in server/ te staan');
});

test('5b. een achtergebleven server op de poort wordt geweigerd, niet gemeten', () => {
  /* Zonder deze wacht meet een halfuurronde het geheugen van een proces dat wij
     niet gestart zijn: onze eigen server valt om op de bezette poort en de
     gereedheidspoll krijgt het antwoord van de oude. scripts/beproeving.js
     heeft deze wacht om precies die reden. */
  assert.match(bron, /async function poortVrij\(\)/);
  assert.match(bron, /async function main\(\) \{\s*await poortVrij\(\);/,
    'de poortwacht hoort de EERSTE handeling van main te zijn, vóór het starten');
});

test('6. de proef zegt NIET_VAST_TE_STELLEN in plaats van een getal te verzinnen', () => {
  assert.match(bron, /NIET_VAST_TE_STELLEN/);
  /* De uitslag mag niet zwijgend PASS worden: alleen LEK geeft een foutcode,
     maar het register bewaart alle drie de standen zodat een onzekere ronde
     zichtbaar blijft. */
  assert.match(bron, /fs\.writeFileSync\(UIT/, 'de proef hoort altijd een verslag weg te schrijven');
});

/* ---- vanaf hier: het REGISTER, als het er is ---- */

test('7. HEAPPROEF.json rekent zijn eigen oordeel na', () => {
  const minuten = reg.opstelling.blokSeconden / 60;
  const per = tempos(reg.blokken.map(b => ({ soort: b.soort, begin: b.beginMB, eind: b.eindMB })), minuten);
  const opnieuw = oordeel({ verkeer: per.verkeer || [], stilte: per.stilte || [],
    drempel: reg.opstelling.drempelMBPerMin });
  assert.equal(opnieuw.stand, reg.oordeel.stand,
    'het opgeslagen oordeel komt niet terug uit de opgeslagen metingen -- met de hand gewijzigd?');
  assert.equal(opnieuw.verkeerslek.stand, reg.oordeel.verkeerslek.stand);
  assert.equal(opnieuw.verkeerslek.tempo, reg.oordeel.verkeerslek.tempo);
  assert.equal(opnieuw.grondlek.stand, reg.oordeel.grondlek.stand);
  assert.equal(opnieuw.grondlek.tempo, reg.oordeel.grondlek.tempo);
});

test('8. de laatste ronde vond geen lek en geen onverwachte 5xx', () => {
  assert.notEqual(reg.oordeel.stand, 'LEK', 'de laatste heapproef vond een lek: ' + reg.oordeel.reden);
  /* Beide vragen apart, zodat een groen totaal nooit een van de twee verbergt. */
  assert.notEqual(reg.oordeel.verkeerslek.stand, 'LEK', 'het verzoekpad lekt: ' + reg.oordeel.reden);
  assert.notEqual(reg.oordeel.grondlek.stand, 'LEK', 'de server lekt in rust: ' + reg.oordeel.reden);
  assert.equal(reg.verkeer.onverwachte5xx, 0,
    'onverwachte serverfouten tijdens de geheugenproef: ' + JSON.stringify(reg.verkeer.paden));
});

test('9. beide condities zijn even vaak gemeten -- anders is de verweving stuk', () => {
  const n = { verkeer: 0, stilte: 0 };
  for (const b of reg.blokken) n[b.soort]++;
  assert.equal(n.verkeer, n.stilte,
    'A B B A hoort evenveel verkeers- als stilteblokken te geven, was ' + JSON.stringify(n));
  assert.ok(n.verkeer >= 2, 'minder dan twee blokken per conditie draagt geen interval');
});
