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

test('een map die zichzelf uitleest telt ook als dynamisch geladen', () => {
  /* De tweede vorm. server/kern/spellen/register.js leest zijn eigen map met
     fs.readdirSync en laadt wat hij vindt met require(path.join(map, naam)).
     Er staat dan geen padtekst in de bron om op te matchen, en de Keuring
     meldde daardoor vijftien spellen als dode code terwijl ze bij elke start
     geladen worden. Vijftien valse meldingen is niet wat ruis: het is de reden
     dat niemand de zestiende nog gelooft. */
  const dood = uitslag.bevindingen.filter(b => b.groep === 'dode code').map(b => b.waar);
  const spellen = dood.filter(p => /kern\/spellen\//.test(p));
  assert.deepEqual(spellen, [], 'het spelregister laadt deze modules bij elke start');
});

test('en die uitzondering is geen blinddoek: echt losgekoppelde code wordt nog gemeld', () => {
  /* De keerzijde van de regel hierboven. Een uitzondering die te breed wordt,
     verbergt precies waar de check voor is -- en dat merk je niet, want er
     verschijnt gewoon niets. Deze toets legt er een module neer die door
     niemand wordt aangeroepen en eist dat de Keuring hem vindt.

     Buiten een dynamisch geladen map, want binnen zo'n map hoort hij juist
     NIET gevonden te worden; dat staat als beperking in de kop van de check.

     In een APART PROCES, want de Keuring bouwt haar bestandslijst een keer op
     bij het laden: een bestand dat daarna ontstaat ziet ze niet, en dan zou
     deze toets groen staan om de verkeerde reden. */
  const pad = path.join(WORTEL, 'server', 'kern', 'zz-keuringproef-dood.js');
  assert.equal(fs.existsSync(pad), false, 'het proefbestand mag er nog niet staan');
  fs.writeFileSync(pad, '/* tijdelijk proefbestand van test/keuring.test.js */\nmodule.exports = () => ({});\n');
  try {
    const uit = require('child_process').execFileSync(process.execPath,
      [path.join(WORTEL, 'scripts', 'keuring.js'), '--json'],
      { cwd: WORTEL, maxBuffer: 1e9, encoding: 'utf8' });
    const dood = JSON.parse(uit).bevindingen.filter(b => b.groep === 'dode code').map(b => b.waar);
    assert.ok(dood.some(p => p.includes('zz-keuringproef-dood')),
      'een module die niemand aanroept hoort gemeld te worden; gevonden: ' + dood.join(', '));
  } finally {
    fs.unlinkSync(pad);
  }
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
