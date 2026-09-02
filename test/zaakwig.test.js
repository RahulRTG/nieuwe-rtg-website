/* DE ZAAKWIG -- de pure kant, en waarom die er is.

   scripts/zaakwig.js draait EEN scenario met een echte server: een lid vindt een
   zaak, bestelt, betaalt, de zaak ziet hem, de kassa haalt hem op. Dat hoort niet
   in een toetssuite. Wat hier staat is het OORDEEL over een invariant, en dat
   staat apart om dezelfde reden als bij de tredeproef: wat in de scenariofunctie
   zit, zit achter een server en is niet te toetsen.

   Draai los: node --test test/zaakwig.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const Z = require('../scripts/zaakwig');

test('1. een invariant die niet kon draaien is geen geslaagde invariant', () => {
  /* De gevaarlijkste uitkomst van een scenario: een stap die is overgeslagen en
     als groen meetelt. Dan meldt de wig dat de keten klopt terwijl hij hem nooit
     heeft gelopen. */
  assert.deepEqual(Z.oordeelInvariant({ gedraaid: true, geslaagd: true }), { uitkomst: 'ok', goed: true });
  assert.deepEqual(Z.oordeelInvariant({ gedraaid: true, geslaagd: false }), { uitkomst: 'GEZAKT', goed: false });
  assert.deepEqual(Z.oordeelInvariant({ gedraaid: false, geslaagd: true }), { uitkomst: 'niet-gedraaid', goed: false });
  assert.deepEqual(Z.oordeelInvariant({ gedraaid: false, geslaagd: false }), { uitkomst: 'niet-gedraaid', goed: false });
});

test('2. de wig draait op de treden waar de semantiek verandert', () => {
  /* Trede 3 hoort het ZONDER geld te kunnen, trede 4 met, en trede 6 is alles
     open. Draait hij er maar een, dan bewijst hij niets over het verschil -- en
     juist dat verschil is waar de wig over gaat. */
  const { FASES } = require('../server/functies/register');
  assert.deepEqual(Z.TREDEN, ['bestellen', 'fundament', 'alles']);
  for (const t of Z.TREDEN) assert.ok(FASES.some(f => f.id === t), 'de trede bestaat: ' + t);
  const nrs = Z.TREDEN.map(t => FASES.findIndex(f => f.id === t));
  assert.deepEqual(nrs, [...nrs].sort((a, b) => a - b), 'en ze staan in oplopende volgorde');
  const geld = FASES.findIndex(f => f.id === 'fundament');
  assert.ok(nrs[0] < geld, 'de eerste trede ligt VOOR het geld -- anders wordt de fail-closed-kant nooit beproefd');
});

test('3. de kassa die een bon ophaalt telt als betaalactie', () => {
  /* De vondst van deze wig, en de reden dat hij bestaat. /api/supplier/pos/redeem
     zet een bon administratief op betaald; zonder betaalrail hoort dat te
     weigeren. De regel staat in de kop van server/opzet/betaalstop.js: er mag
     nergens een betaling worden gesimuleerd of alleen administratief als voldaan
     gemarkeerd. */
  const { isBetaalactie } = require('../server/opzet/betaalstop');
  assert.equal(isBetaalactie('POST', '/api/supplier/pos/redeem'), true);
  /* En de buur die bewust WEL open blijft: checkout beweegt zijn geld door de
     poort van RTG Pay, en die heeft zijn eigen stop (kern/pay/stand.js). */
  assert.equal(isBetaalactie('POST', '/api/supplier/pos/checkout'), false);
});
