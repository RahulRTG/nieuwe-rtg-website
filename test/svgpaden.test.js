/* De pad-keuring zelf toetsen.

   Een keuring die "niets gevonden" zegt is pas iets waard als vaststaat dat hij
   het echte defect ziet en geldige paden met rust laat. Beide kanten staan
   hieronder: de gevallen die MOETEN afvallen, en de gevallen die er juist
   doorheen moeten -- vooral de samengeperste booghelling-vlaggen, want daar
   loopt een naieve keuring op vast en keurt hij goede paden af. */
const { test } = require('node:test');
const assert = require('node:assert');
const { keurPad, scan } = require('../scripts/svgpaden');

test('keurt het defect af dat dit bestand heeft opgeleverd', () => {
  // het vingerafdruk-icoon op de passkey-knop: een curve met 2 van de 6 getallen
  const fout = keurPad('M5.5 8a7 7 0 0 1 12 3c0 1');
  assert.ok(fout, 'het afgekapte pad moet afvallen');
  assert.match(fout, /mist 4 van 6/);
});

test('keurt paden af die getallen missen', () => {
  assert.match(keurPad('M0 0C1 2 3'), /commando "C" mist 3 van 6/);
  assert.match(keurPad('M0 0L1'), /commando "L" mist 1 van 2/);
  assert.match(keurPad('M0 0H'), /commando "H" mist 1 van 1/);
  assert.match(keurPad('M0'), /commando "M" mist 1 van 2/);
});

test('keurt paden af die niet met een verplaatsing beginnen', () => {
  assert.match(keurPad('L10 10'), /begint niet met M of m/);
  assert.match(keurPad(''), /leeg/);
});

test('keurt een onbekend commando af', () => {
  assert.match(keurPad('M0 0X5 5'), /onbekend commando "X"/);
});

test('keurt een booghelling af met een vlag die geen 0 of 1 is', () => {
  assert.match(keurPad('M0 0a5 5 0 2 1 10 0'), /large-arc-vlag/);
  assert.match(keurPad('M0 0a5 5 0 1 7 10 0'), /sweep-vlag/);
});

test('laat samengeperste booghelling-vlaggen met rust', () => {
  // "0 100 72" is rotatie 0, large-arc 1, sweep 0, x 0, y 72 -- geldig SVG.
  // Wie die 100 als een getal leest, keurt dit ten onrechte af.
  assert.equal(keurPad('M62 14a38 38 0 100 72 30 30 0 010-72z'), null);
  assert.equal(keurPad('M40 8a26 26 0 100 48 20 20 0 010-48z'), null);
  assert.equal(keurPad('M20 44a11 11 0 010-22 14 14 0 0126-4 10 10 0 012 26z'), null);
});

test('laat geldige paden met rust', () => {
  assert.equal(keurPad('M5.5 8a7 7 0 0 1 12 3c0 3.4-.5 6.4-1.5 9'), null);  // het gerepareerde pad
  assert.equal(keurPad('M50 12l11 26 28 3-21 19 6 28-24-14z'), null);       // herhaalde paren, negatieve getallen
  assert.equal(keurPad('M0 0C.5 1e-2 -.5 2 3 4z'), null);                   // losse decimaal, exponent
  assert.equal(keurPad('M0 0 10 10 20 20'), null);                          // extra paren na M gelden als lineto
  assert.equal(keurPad('  M0 0 L1 1  '), null);                             // witruimte eromheen
});

test('de bron bevat geen ontekenbare paden', () => {
  const path = require('node:path');
  const kapot = scan(path.join(__dirname, '..'), ['public', 'server', 'scripts', 'test']);
  assert.deepEqual(kapot.map(t => t.bestand + ':' + t.regel + ' ' + t.fout), []);
});
