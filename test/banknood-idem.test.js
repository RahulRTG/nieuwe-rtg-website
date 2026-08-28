/* DEZELFDE MISLUKTE CLEARING TWEE KEER MELDEN MAG DE BANK NIET IN NOOD ZETTEN.

   `bankClearingMislukt()` is een teller, en bij NOOD_DREMPEL trekt hij
   automatisch de noodstop: de clearing valt dan terug op de kaart-rails. Elke
   oproep telde een op. Een monitoring die dezelfde mislukking twee keer meldt
   -- een retry, een dubbele webhook -- kon de bank daarmee onterecht in nood
   zetten (TAKEN.md 4.61).

   Er is op dit moment nog geen aanroeper: geen scherm en geen interne code
   roept deze route aan. Juist daarom ligt het contract nu vast, voor er een is.
   Wie een sleutel meegeeft die aan de MISLUKKING hangt, telt een keer.

   Draai los: node --experimental-sqlite --test test/banknood-idem.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakBankregie } = require('../server/kern/bankregie');

// een minimale opslag: bankregie vraagt alleen db.data en save()
function verseRegie() {
  const db = { data: {} };
  return maakBankregie({ db, save() {} });
}

test('dezelfde sleutel telt EEN keer, ook al meld je drie keer', () => {
  const r = verseRegie();
  const een = r.bankClearingMislukt('gateway time-out', 'clearing-abc');
  assert.equal(een.mislukt, 1, 'de eerste melding telt');
  assert.equal(een.herhaald, undefined, 'en is geen herhaling');

  for (let i = 0; i < 2; i++) {
    const nog = r.bankClearingMislukt('gateway time-out', 'clearing-abc');
    assert.equal(nog.mislukt, 1, 'de teller blijft op een staan');
    assert.equal(nog.herhaald, true, 'en de herhaling wordt gemeld');
    assert.equal(nog.getript, false, 'de noodstop gaat hier niet af');
  }
  assert.equal(r.bankOverzicht ? r.bankOverzicht().nood.actief : false, false, 'de bank staat niet in nood');
});

test('DRIE VERSCHILLENDE mislukkingen trekken de noodstop wel -- de drempel blijft werken', () => {
  const r = verseRegie();
  assert.equal(r.bankClearingMislukt('a', 'c1').getript, false);
  assert.equal(r.bankClearingMislukt('b', 'c2').getript, false);
  const derde = r.bankClearingMislukt('c', 'c3');
  assert.equal(derde.mislukt, 3, 'drie echte mislukkingen');
  assert.equal(derde.getript, true, 'en dan valt de noodstop, zoals bedoeld');
});

test('zonder sleutel telt elke oproep op -- dat blijft kunnen, maar dan is het een keuze', () => {
  const r = verseRegie();
  assert.equal(r.bankClearingMislukt('zonder sleutel').mislukt, 1);
  assert.equal(r.bankClearingMislukt('zonder sleutel').mislukt, 2, 'geen sleutel, geen ontdubbeling');
});

test('een geslaagde clearing wist de teller EN de sleutels', () => {
  /* Zonder dit zou een sleutel van voor het herstel een LATERE echte mislukking
     tegenhouden -- dan telt de bank te weinig in plaats van te veel, en dat is
     de gevaarlijke kant op. De sleutel geldt binnen een reeks, niet eeuwig. */
  const r = verseRegie();
  assert.equal(r.bankClearingMislukt('x', 'c1').mislukt, 1);
  r.bankClearingGelukt();
  const opnieuw = r.bankClearingMislukt('x', 'c1');
  assert.equal(opnieuw.mislukt, 1, 'na een geslaagde clearing telt dezelfde sleutel weer mee');
  assert.equal(opnieuw.herhaald, undefined, 'en geldt hij niet als herhaling');
});
