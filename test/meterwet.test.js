/* ============================================================================
   LAT.md REGEL 13 -- een meter kent zijn eigen grens.

   De regel: een meter die uitspraken doet over onbekend terrein wordt eerst
   geijkt tegen beschikbare bekende waarheid; is er geen grondwaarheid, dan zegt
   de meter dat expliciet en beperkt hij zijn conclusies tot wat hij werkelijk
   heeft waargenomen.

   Deze toets is de handhaver, en hij vangt drie overtredingen:

     1. een register met een DEKKINGSCLAIM dat geen grondwaarheid verklaart
     2. een `GEEN` of `ONBEPAALD` zonder reden, of met een dekkingsclaim ernaast
     3. een verklaarde grondwaarheid waarvan de ijkUITSLAG in het register ontbreekt

   WAAROM DE DERDE ER IS. Een grondwaarheid opschrijven is goedkoop. De regel
   gaat over geijkt ZIJN, niet over beloofd hebben te ijken -- precies het
   verschil tussen een handhaver die bestaat en een handhaver die draait
   (LAT.md regel 10).

   Draai los: node --test test/meterwet.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const { METERS, CLAIMSLEUTELS, GEEN_CLAIM } = require('../scripts/lib/ijking.js');

/* Welke registers in de wortel dragen een dekkingsclaim? Afgeleid uit de
   bestanden zelf en niet uit een lijst -- anders groeit de blinde vlek mee met
   wat iemand vergat op te schrijven. */
function registersMetClaim() {
  const uit = [];
  for (const f of fs.readdirSync(WORTEL)) {
    if (!f.endsWith('.json') || f.startsWith('package')) continue;
    let j;
    try { j = JSON.parse(fs.readFileSync(path.join(WORTEL, f), 'utf8')); } catch (e) { continue; }
    let raak = null;
    (function loop(o, diep) {
      if (raak || !o || typeof o !== 'object' || diep > 3) return;
      for (const [k, v] of Object.entries(o)) {
        if (CLAIMSLEUTELS.test(k) && (typeof v === 'number' || typeof v === 'string')) { raak = k; return; }
        if (v && typeof v === 'object') loop(v, diep + 1);
      }
    })(j, 0);
    if (raak) uit.push({ bestand: f, sleutel: raak, inhoud: j });
  }
  return uit;
}

/* MUTATIE GEZIEN ZAKKEN: DOCTRINE.json uit METERS gehaald; zakte met de naam
   erbij. En andersom nagetrokken: de ijklijst leeggemaakt -> twaalf namen rood. */
test('1. elk register met een dekkingsclaim verklaart zijn grondwaarheid', () => {
  const claims = registersMetClaim();
  assert.ok(claims.length >= 5, 'de scan vindt bijna geen registers met een dekkingsclaim; dan meet deze ' +
    'toets zijn eigen sleutellijst en niet het huis (zelfijking van dezelfde vorm als test/getallen.test.js)');

  const onverklaard = claims
    .filter(c => !METERS[c.bestand] && !GEEN_CLAIM[c.bestand])
    .map(c => c.bestand + ' (sleutel: ' + c.sleutel + ')');

  assert.deepEqual(onverklaard, [],
    'deze registers dragen een dekkingsclaim zonder dat iemand heeft vastgelegd waartegen zij geijkt zijn. ' +
    'Zet ze in scripts/lib/ijking.js -- met een grondwaarheid, of met ONBEPAALD en de vraag die beantwoord ' +
    'moet worden. LAT.md regel 13: ' + onverklaard.join(', '));
});

/* MUTATIE GEZIEN ZAKKEN: bij APPWERKT.json de `reden` weggehaald; zakte. */
test('2. zonder grondwaarheid is er een reden, en geen dekkingsclaim zonder grond', () => {
  for (const [naam, m] of Object.entries(METERS)) {
    assert.ok(m.claim === 'waarneming' || m.claim === 'dekking',
      naam + ' zegt niet wat hij mag beweren; "waarneming" en "dekking" zijn twee verschillende vergunningen');

    if (m.grondwaarheid === 'GEEN' || m.grondwaarheid === 'ONBEPAALD') {
      assert.ok(String(m.reden || '').trim().length > 20,
        naam + ' heeft geen grondwaarheid en geen reden. Zonder reden is een ontbrekende ijking niet te ' +
        'onderscheiden van vergeten, en dan wordt het een regel die niemand meer opzoekt');
    } else {
      assert.ok(String(m.hoe || '').trim().length > 20,
        naam + ' noemt een grondwaarheid zonder te zeggen HOE die als waarheid geldt; dan is het een naam ' +
        'en geen ijking');
    }
  }

  for (const [naam, reden] of Object.entries(GEEN_CLAIM)) {
    assert.ok(String(reden || '').trim().length > 20,
      naam + ' staat als "draagt geen claim" zonder reden; dat is een uitzondering zonder besluit');
  }
});

/* MUTATIE GEZIEN ZAKKEN: bij VERBAND.json het ijkveld op 'bestaatniet' gezet;
   zakte op "verklaart een grondwaarheid maar draagt de uitslag niet". */
test('3. een verklaarde grondwaarheid draagt ook een ijkUITSLAG in het register', () => {
  for (const [naam, m] of Object.entries(METERS)) {
    if (m.grondwaarheid === 'GEEN' || m.grondwaarheid === 'ONBEPAALD') continue;

    const pad = path.join(WORTEL, naam);
    assert.ok(fs.existsSync(pad), naam + ' staat als geijkt in het register maar bestaat niet; draai zijn meter');
    const j = JSON.parse(fs.readFileSync(pad, 'utf8'));

    assert.ok(m.ijkveld && j[m.ijkveld],
      naam + ' verklaart een grondwaarheid (' + m.grondwaarheid + ') maar draagt de uitslag daarvan niet in ' +
      'veld "' + m.ijkveld + '". Een grondwaarheid opschrijven is goedkoop; de regel gaat over geijkt ZIJN.');

    assert.ok(fs.existsSync(path.join(WORTEL, m.grondwaarheid)),
      naam + ' ijkt tegen ' + m.grondwaarheid + ', en die bron bestaat niet (meer)');
  }
});

/* MUTATIE GEZIEN ZAKKEN: een dertiende ONBEPAALD toegevoegd; zakte op de vloer.
   De vloer mag alleen OMLAAG: het getal hoort te dalen doordat er geijkt wordt,
   niet doordat er regels verdwijnen. */
test('4. het aantal ongeijkte meters mag dalen en niet stijgen', () => {
  const onbepaald = Object.entries(METERS).filter(([, m]) => m.grondwaarheid === 'ONBEPAALD');
  assert.ok(onbepaald.length <= 10,
    'er staan ' + onbepaald.length + ' meters als ONBEPAALD, en dat waren er 10 op 13 september 2026. ' +
    'Een nieuwe meter met een dekkingsclaim hoort geijkt te worden, niet bij de historie gezet: ' +
    onbepaald.map(([n]) => n).join(', '));
});

/* MUTATIE GEZIEN ZAKKEN: de zin uit LAT.md gehaald; zakte hier. Een wet die van
   zijn bron afdwaalt is de stilste vorm van uit elkaar lopen (LAT.md regel 6). */
test('5. de regel staat in de doctrine en niet alleen in deze toets', () => {
  const lat = fs.readFileSync(path.join(WORTEL, 'LAT.md'), 'utf8');
  assert.match(lat, /### 13\. Een meter kent zijn eigen grens/,
    'LAT.md draagt regel 13 niet meer; dan handhaaft deze toets iets wat nergens meer is afgesproken');
  assert.match(lat, /geijkt tegen\s+beschikbare bekende waarheid/,
    'de kernzin van regel 13 staat niet meer in LAT.md');
});
