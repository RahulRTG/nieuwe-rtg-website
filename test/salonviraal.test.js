/* De Salon-gate (kern/salonviraal.js): vreemden zien alleen wat viraal gaat of
   maatschappelijk belangrijk is; van een vriend of iemand die je volgt zie je
   een bericht altijd; partner-etalage en RTG-uitgelichte posts staan er los van.
   Pure module, geen server nodig. Draai: node --test test/salonviraal.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const sv = require('../server/kern/salonviraal');

const laag = (extra) => Object.assign({ baseLikes: 5, likedBy: {}, comments: [], text: 'Lekker geluncht' }, extra);
const viraalPost = (extra) => Object.assign({ baseLikes: 200, likedBy: {}, comments: [], reward: 8, text: 'x' }, extra);

test('1. een gewone, weinig-betrokken post ziet een vreemde niet', () => {
  assert.equal(sv.toonInSalon(laag(), null), false);
  assert.equal(sv.reden(laag(), null), null);
});

test('2. viraal: iedereen ziet je', () => {
  const p = viraalPost();
  assert.equal(sv.isViraal(p), true);
  assert.equal(sv.toonInSalon(p, null), true);
  assert.equal(sv.reden(p, null), 'viraal');
});

test('3. maatschappelijk belangrijk komt door de heuristiek binnen', () => {
  const p = laag({ text: 'Inzameling voor de RTFoundation en de buurt' });
  assert.equal(sv.isBelangrijk(p), true);
  assert.equal(sv.toonInSalon(p, null), true);
  assert.equal(sv.reden(p, null), 'belangrijk');
});

test('4. partner-etalage en uitgelichte posts blijven altijd zichtbaar, zonder chip', () => {
  assert.equal(sv.toonInSalon(laag({ partner: true }), null), true);
  assert.equal(sv.toonInSalon(laag({ featured: true }), null), true);
  assert.equal(sv.reden(laag({ partner: true }), null), null);
  assert.equal(sv.reden(laag({ featured: true }), null), null);
});

test('5. van een vriend zie je een niet-virale post sowieso', () => {
  const p = laag({ authorKey: 'lid-anna' });
  const vreemd = { bevriend: () => false, volgt: () => false };
  const vriend = { bevriend: (x) => x.authorKey === 'lid-anna', volgt: () => false };
  assert.equal(sv.toonInSalon(p, vreemd), false, 'een vreemde ziet het niet');
  assert.equal(sv.toonInSalon(p, vriend), true, 'een vriend wel');
  assert.equal(sv.reden(p, vriend), 'vriend');
});

test('6. iemand die je volgt zie je sowieso', () => {
  const p = laag({ authorKey: 'lid-bram' });
  const volger = { bevriend: () => false, volgt: () => true };
  assert.equal(sv.toonInSalon(p, volger), true);
  assert.equal(sv.reden(p, volger), 'volgend');
});

test('7. de persoonlijke band gaat vóór op de drempel-labels', () => {
  // een post die én belangrijk is én van een vriend: het label toont de band
  const p = laag({ text: 'Donatie voor de foundation', authorKey: 'lid-cato' });
  const vriend = { bevriend: () => true, volgt: () => false };
  assert.equal(sv.isBelangrijk(p), true);
  assert.equal(sv.reden(p, vriend), 'vriend');
});

test('8. zonder kijker gedraagt de gate zich als het openbare feed', () => {
  assert.equal(sv.toonInSalon(laag({ authorKey: 'lid-x' })), false, 'geen kijker = geen persoonlijke uitzondering');
  assert.equal(sv.toonInSalon(viraalPost()), true);
});
