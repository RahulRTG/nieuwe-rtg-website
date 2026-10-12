/* EEN SLEUTEL IS EEN SLEUTEL, GEEN EIGENSCHAPSNAAM (server/lib/idem.js).

   De idem-laag bewaart antwoorden in een gewoon object, met de ring van
   sleutels onder `_keys` ernaast. Tot 12 oktober 2026 keek hij met `in`, en
   dat leest ook het prototype: een sleutel `constructor` of `toString` gaf een
   "herhaald" antwoord zonder dat het werk ooit draaide. `_keys` werd bij de
   herhaalcheck overgeslagen maar daarna wel weggeschreven, over de ring heen,
   en `__proto__` verving het prototype van de opslag.

   Vandaag zetten alle aanroepers een voorvoegsel voor de sleutel van de
   client, dus van buiten komt zo'n naam niet binnen. Deze laag is gedeeld door
   Pay, Bank, de kassa en directpay; de volgende aanroeper die het voorvoegsel
   vergeet, hoort niet de deur te vinden. Draai los:
   node --test test/idem-sleutelnaam.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const maakIdem = require('../server/lib/idem');

function opzet() {
  const data = {};
  const idem = maakIdem({ d: () => data, save: () => {}, naam: 'proefIdem' });
  let gedaan = 0;
  const werk = async () => { gedaan++; return { ok: true, n: gedaan }; };
  return { idem, data, werk, gedaan: () => gedaan };
}

test('een naam van het prototype is een gewone nieuwe sleutel: het werk draait', async () => {
  for (const naam of ['constructor', 'toString', 'hasOwnProperty', 'valueOf']) {
    const { idem, werk, gedaan } = opzet();
    const r = await idem(naam, 'a', werk);
    assert.deepEqual(r, { ok: true, n: 1 }, naam + ' mag geen vals herhaald antwoord geven');
    assert.equal(gedaan(), 1, naam);
    const weer = await idem(naam, 'a', werk);
    assert.equal(weer.herhaald, true, naam + ': de tweede keer is wel een herhaling');
    assert.equal(gedaan(), 1, naam);
  }
});

test('de gereserveerde namen worden geweigerd, en de ring blijft heel', async () => {
  for (const naam of ['_keys', '__proto__']) {
    const { idem, data, werk, gedaan } = opzet();
    await idem('a:1', 'a', werk);
    const r = await idem(naam, 'a', werk);
    assert.equal(r.status, 400, naam);
    assert.equal(gedaan(), 1, naam + ': het werk draait niet');
    assert.deepEqual(data.proefIdem._keys, ['a:1'], naam + ': de ring is niet overschreven');
    assert.equal(Object.getPrototypeOf(data.proefIdem), Object.prototype, naam + ': het prototype blijft');
    assert.equal((await idem('a:1', 'a', werk)).herhaald, true, naam + ': de bewaarde sleutel werkt nog');
  }
});
