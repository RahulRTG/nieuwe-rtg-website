/* De Keuring keurt het systeem; deze test keurt de Keuring.

   Een oordeelsscript dat vals alarm slaat wordt genegeerd, en een script dat
   niets meer vindt wordt overbodig. Beide zijn erger dan geen script. Hier
   staat dus vast wat de Keuring moet blijven kunnen: haar harde regels echt
   hard maken, haar zachte regels eerlijk houden, en geen dode uitzonderingen
   meeslepen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const { keur } = require('../scripts/keuring.js');
const uitslag = keur();

test('de Keuring velt een volledig oordeel', () => {
  assert.ok(Array.isArray(uitslag.bevindingen), 'bevindingen is een lijst');
  for (const b of uitslag.bevindingen) {
    assert.ok(['stuk', 'scheef', 'beter'].includes(b.soort), 'onbekend oordeel: ' + b.soort);
    assert.ok(b.groep && b.tekst, 'elke bevinding noemt groep en tekst');
  }
  assert.equal(uitslag.stuk + uitslag.scheef + uitslag.beter, uitslag.bevindingen.length);
});

test('de acht checks draaien allemaal echt (geen stille nul)', () => {
  const c = uitslag.cijfers;
  assert.ok(c.dekking.routes > 500, 'de routekaart levert de echte routetabel: ' + c.dekking.routes);
  assert.ok(c.pariteit.genres > 20, 'de genres worden echt uitgelezen: ' + c.pariteit.genres);
  assert.ok(c.beloftes.gescand > 500, 'er worden echt teksten gescand: ' + c.beloftes.gescand);
  assert.ok(c.privacy.gescand > 20, 'er worden echt routes gescand: ' + c.privacy.gescand);
});

test('het huis staat: geen enkele STUK-bevinding', () => {
  const stuk = uitslag.bevindingen.filter(b => b.soort === 'stuk');
  assert.deepEqual(stuk.map(b => b.tekst + ' [' + b.waar + ']'), [],
    'de Keuring vond een harde fout; los die op voordat deze test weer groen mag zijn');
});

test('dynamisch geladen mappen gelden niet als dode code', () => {
  /* kern/fiscaal/wereld/*.js en kern/reis/*.js worden geladen met
     require('./map/' + naam). Wie dat patroon niet herkent, meldt tientallen
     levende modules als dood -- en dan gelooft niemand de melding meer. */
  const dood = uitslag.bevindingen.filter(b => b.groep === 'dode code').map(b => b.waar);
  for (const p of dood)
    assert.ok(!/kern\/(fiscaal\/wereld|reis)\//.test(p), 'dynamisch geladen module onterecht dood gemeld: ' + p);
});

test('bouwsels tellen niet mee, alleen bron', () => {
  for (const b of uitslag.bevindingen) {
    if (!b.waar) continue;
    assert.ok(!b.waar.includes('public/dist/'), 'een bevinding wijst naar geminificeerd bouwsel: ' + b.waar);
  }
});

test('de gewogen uitzonderingen leven nog allemaal', () => {
  /* Een uitzondering die naar een zin wijst die niet meer bestaat, is stille
     rommel: hij dekt niets meer af en verbergt dat iemand hem mag opruimen. */
  const bron = fs.readFileSync(path.join(WORTEL, 'scripts', 'keuring.js'), 'utf8');
  const blok = bron.slice(bron.indexOf('const GEWOGEN'), bron.indexOf('function beloftes'));
  const re = /\['([^']+) \| ([^']+)',/g;
  let m, n = 0;
  while ((m = re.exec(blok))) {
    n++;
    const doel = path.join(WORTEL, m[1]);
    assert.ok(fs.existsSync(doel), 'gewogen uitzondering wijst naar een bestand dat niet bestaat: ' + m[1]);
    assert.ok(fs.readFileSync(doel, 'utf8').includes(m[2]),
      'gewogen uitzondering wijst naar een zin die niet meer in ' + m[1] + ' staat: "' + m[2] + '"');
  }
  assert.ok(n >= 1, 'er hoort minstens een gewogen uitzondering te staan');
});
