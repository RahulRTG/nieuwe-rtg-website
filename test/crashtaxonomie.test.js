/* DE CRASH-TAXONOMIE -- drie contracten, zes grenzen, en geen afronding.

   "Overleeft route X een crash?" geeft EEN antwoord op drie vragen die
   verschillende dingen beloven. De taxonomie houdt ze uit elkaar; deze toetsen
   houden vast dat de weging dat ook doet.

   De gevaarlijkste faalvorm van deze laag is een AFRONDING: deels bewezen dat
   als bewezen leest. Daar gaan de eerste drie toetsen over. */
const test = require('node:test');
const assert = require('node:assert');
const tax = require('../scripts/lib/crashtaxonomie.js');

test('een enkele bewezen grens is PROVEN_PARTIAL en nooit PROVEN', () => {
  const u = tax.weeg({ 'na-commit-voor-antwoord': 'PROVEN' });
  assert.equal(u.stand, 'PROVEN_PARTIAL');
  assert.deepEqual(u.bewezen, ['na-commit-voor-antwoord']);
  assert.equal(u.open.length, Object.keys(tax.GRENZEN).length - 1);
  /* En de open grenzen staan IN de uitslag. Een PROVEN_PARTIAL zonder de lijst
     ernaast leest als PROVEN. */
  assert.match(u.waarom, /open: /);
});

test('alle grenzen bewezen is pas PROVEN', () => {
  const alles = {};
  for (const g of Object.keys(tax.GRENZEN)) alles[g] = 'PROVEN';
  assert.equal(tax.weeg(alles).stand, 'PROVEN');
  assert.equal(tax.weeg(alles).open.length, 0);
});

/* EEN GEZAKTE GRENS WINT VAN ELKE HOEVEELHEID BEWEZEN GRENZEN. Vijf van de zes
   halen en op de zesde zakken is niet "bijna goed": er is een crashmoment
   waarop geld half blijft staan. */
test('een gezakte grens maakt het geheel FAILED, hoeveel er ook bewezen is', () => {
  const bijna = {};
  for (const g of Object.keys(tax.GRENZEN)) bijna[g] = 'PROVEN';
  bijna['in-de-opslag'] = 'FAILED';
  const u = tax.weeg(bijna);
  assert.equal(u.stand, 'FAILED');
  assert.deepEqual(u.gezakt, ['in-de-opslag']);
});

test('geen enkele grens beproefd is UNKNOWN en geen nul', () => {
  const u = tax.weeg({});
  assert.equal(u.stand, 'UNKNOWN');
  assert.match(u.waarom, /geen enkele crashgrens beproefd/);
});

/* DE LIJST IS GESLOTEN, en dat is het punt. Een open lijst laat "bewezen"
   groeien door grenzen weg te laten; wie er een bijzet maakt zichtbaar dat er
   meer ONbewezen is. Zakt deze toets, dan is er een grens verdwenen -- en dan
   stijgt er ergens een dekkingsgetal zonder dat iemand iets heeft bewezen. */
test('de zes crashgrenzen liggen vast', () => {
  assert.deepEqual(Object.keys(tax.GRENZEN).sort(), [
    'ambigu-extern-resultaat', 'in-de-opslag', 'na-commit-voor-antwoord',
    'na-commit-voor-bericht', 'providercommit-zonder-antwoord', 'voor-eerste-mutatie']);
  for (const [g, uitleg] of Object.entries(tax.GRENZEN))
    assert.ok(uitleg && uitleg.length > 20, g + ' heeft geen uitleg');
});

test('de drie contracten dragen elk hun eigen grond', () => {
  assert.deepEqual(Object.keys(tax.CONTRACTEN).sort(),
    ['ATOMIC', 'EXTERNALLY_RECONCILABLE', 'RECOVERABLE']);
  /* En ze zeggen waarom ze NIET hetzelfde zijn -- anders worden ze binnen een
     jaar tot een woord samengevoegd. */
  assert.match(tax.CONTRACTEN.RECOVERABLE, /ANDERS dan atomair/);
  assert.match(tax.CONTRACTEN.EXTERNALLY_RECONCILABLE, /buiten de deur/);
});

/* En de proef die eraan meet, raakt er precies EEN aan -- dat hoort zo, en het
   hoort zichtbaar te zijn. */
test('de factuurproef meet aan een grens en zegt welke', () => {
  const fp = require('../scripts/factuurproef.js');
  assert.equal(typeof fp.meet, 'function');
  const reg = require('../FACTUURPROEF.json');
  if (!reg.crash) return;   // een oudere ronde: dan valt er niets te toetsen
  assert.deepEqual(Object.keys(reg.crash.grenzen), ['na-commit-voor-antwoord']);
  assert.equal(reg.crash.uitslag.stand, 'PROVEN_PARTIAL');
  assert.equal(reg.crash.contracten.EXTERNALLY_RECONCILABLE, 'UNKNOWN',
    'zonder aanbieder valt er niets te verzoenen, en dat is geen nul');
});
