/* Het betrouwbaarheidsniveau (kern/betrouwbaarheid.js): hoe zeker weet RTG dat
   dit deze mens is. Deze module verzint niets -- hij geeft een naam aan wat de
   identiteitslaag al wist -- dus wat hier vastligt is de VERTALING: welke stand
   van het dossier hoort bij welke trede, en wanneer een eis gehaald is.

   Draai los: node --test test/betrouwbaarheid.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { NIVEAUS, niveauVan, voldoet, bestaat } = require('../server/kern/betrouwbaarheid');

const account = { id: 7 };

test('elke stand van het dossier hoort bij precies een trede', () => {
  assert.equal(niveauVan({}).id, 'A0', 'zonder account is er geen dossier');
  assert.equal(niveauVan({ account }).id, 'A1', 'een eigen account zonder bewijs');
  assert.equal(niveauVan({ account, verified: 'unverified' }).id, 'A1');
  assert.equal(niveauVan({ account, verified: 'pending' }).id, 'A2', 'het bewijs ligt er en wordt bekeken');
  assert.equal(niveauVan({ account, verified: 'verified' }).id, 'A3', 'goedgekeurd paspoort');
  assert.equal(niveauVan({ account, verified: 'verified', faceMatch: true }).id, 'A4', 'en het gezicht ernaast gelegd');
});

test('een afgewezen bewijs valt terug op A1, niet op A0', () => {
  /* Het account bestaat gewoon; alleen het bewijs deugde niet. Zou dit op A0
     uitkomen, dan verdween het lid uit elke lijst waar hij wel in hoort en kon
     hij het niet opnieuw proberen. */
  assert.equal(niveauVan({ account, verified: 'rejected' }).id, 'A1');
});

test('een gezichtscontrole zonder goedgekeurd paspoort telt niet mee', () => {
  /* faceMatch wordt alleen bij een goedkeuring gezet, maar een losse vlag mag
     nooit vanzelf een trede opleveren: A4 staat BOVEN A3 en veronderstelt hem. */
  assert.equal(niveauVan({ account, verified: 'pending', faceMatch: true }).id, 'A2');
  assert.equal(niveauVan({ account, verified: 'unverified', faceMatch: true }).id, 'A1');
});

test('de treden lopen op, en de volgorde is de rang en niet de letter', () => {
  const rangen = NIVEAUS.map(n => n.rang);
  assert.deepEqual(rangen, [...rangen].sort((a, b) => a - b), 'de lijst staat op volgorde');
  assert.equal(new Set(rangen).size, rangen.length, 'geen twee treden delen een rang');
  for (const n of NIVEAUS) assert.ok(n.naam && n.uitleg, 'elke trede zegt wat hij betekent');
});

test('een eis is gehaald vanaf de gevraagde trede, en hoger telt ook', () => {
  const a3 = niveauVan({ account, verified: 'verified' });
  assert.equal(voldoet(a3, 'A1'), true);
  assert.equal(voldoet(a3, 'A3'), true, 'precies de eis haalt hem');
  assert.equal(voldoet(a3, 'A4'), false, 'een trede hoger niet');
  assert.equal(voldoet(niveauVan({ account, verified: 'verified', faceMatch: true }), 'A3'), true, 'hoger telt mee');
});

test('geen eis laat alles door', () => {
  /* Een dienst die niets vraagt, hoort geen drempel te krijgen die hij niet
     heeft gesteld. */
  for (const m of [null, undefined, '', 0, false]) {
    assert.equal(voldoet(niveauVan({}), m), true, 'zonder eis mag zelfs A0 door');
  }
});

test('een onbekende of verkeerd gespelde eis haalt het NOOIT', () => {
  /* Dit is de belangrijkste regel van de twee hierboven. Zou een onbekende eis
     stilzwijgend doorlaten, dan is 'A9' of een typefout precies zo goed als
     geen eis -- en dan faalt de strengste eis in het huis het stilst. */
  const a4 = niveauVan({ account, verified: 'verified', faceMatch: true });
  for (const m of ['A9', 'a3', 'A', 'hoog', 'A3 ', '3']) {
    assert.equal(voldoet(a4, m), false, m + ' is geen bestaande trede');
  }
  assert.equal(bestaat('A3'), true);
  assert.equal(bestaat('A9'), false);
});

test('voldoet() neemt een trede of alleen zijn naam', () => {
  assert.equal(voldoet('A3', 'A3'), true, 'de kale id werkt ook');
  assert.equal(voldoet({ id: 'A3' }, 'A3'), true);
  assert.equal(voldoet('onzin', 'A1'), false, 'maar een onbekende trede haalt niets');
});
