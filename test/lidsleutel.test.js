/* De ledensleutel (server/lib/lidsleutel.js): van `user-<id>` naar het
   account-id. Zeventien kopieen van dezelfde reguliere expressie zijn hier een
   functie geworden, en deze toets legt vast wat die functie belooft -- juist de
   randen, want daar liepen de kopieen uiteen.

   Draai los: node --experimental-sqlite --test test/lidsleutel.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { idVanKey } = require('../server/lib/lidsleutel');

test('een echte ledensleutel levert het id als getal', () => {
  assert.equal(idVanKey('user-1'), 1);
  assert.equal(idVanKey('user-8291'), 8291);
  assert.equal(typeof idVanKey('user-8291'), 'number', 'een getal, geen tekst: de kluis rekent ermee');
});

test('wie geen account heeft, levert null en geen fout', () => {
  /* Een gast of persona reist met een andere sleutel. Dat is het normale geval
     en geen storing: elke aanroeper hoort null als antwoord te lezen. */
  for (const k of ['guest', 'rtg', 'persona-3', 'supplier-12', 'user-', 'user-abc', '']) {
    assert.equal(idVanKey(k), null, k + ' hoort geen account-id te geven');
  }
});

test('rommel en leegte lopen niet stuk', () => {
  /* De kopieen deden dit niet allemaal hetzelfde: de een schreef
     String(key || ''), de ander String(key). Beide gaven null, maar dat was
     toeval en geen afspraak. Hier is het een afspraak. */
  for (const k of [null, undefined, 0, false, {}, [], NaN]) {
    assert.equal(idVanKey(k), null);
  }
});

test('de vorm zit vast: geen ruimte, geen aanhangsel, geen hoofdletters', () => {
  /* Zou de sleutel losser worden gelezen, dan zou ' user-1' of 'user-1x' bij
     hetzelfde dossier uitkomen als 'user-1'. Een sleutel die per ongeluk past,
     opent hier een echt ledendossier. */
  for (const k of [' user-1', 'user-1 ', 'User-1', 'USER-1', 'user-1x', 'xuser-1', 'user--1', 'user-1.0', 'user-+1']) {
    assert.equal(idVanKey(k), null, k + ' is geen ledensleutel');
  }
});

test('een id dat als getal niet meer klopt, telt niet', () => {
  /* De rand die er echt toe doet. Een reeks cijfers die op de vorm past maar
     buiten het veilige getalbereik valt, rondt af -- en een afgerond id wijst
     naar een ANDER dossier. Dan is null het enige goede antwoord. */
  assert.equal(idVanKey('user-9007199254740993'), null, 'voorbij Number.MAX_SAFE_INTEGER telt niet mee');
  assert.equal(idVanKey('user-' + Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER, 'de grens zelf mag nog wel');
});

test('de gedeelde accountlezing bewaart de juiste identiteit en blijft gesloten bij ongeldige sleutels of kluisfouten', () => {
  const lees = require('../server/lib/account-op-sleutel');
  const account = { id: 42 }; const ids = [];
  const kluis = { getUserById(id) { assert.equal(this, kluis); ids.push(id); return id === 42 ? account : null; } };
  assert.equal(lees(kluis, 'user-42'), account);
  assert.equal(lees(kluis, 'user-43'), null);
  for (const key of ['gast', '', null, 'user-42x', 'user-9007199254740992']) assert.equal(lees(kluis, key), null);
  assert.deepEqual(ids, [42, 43], 'ongeldige sleutels raken de kluis niet');
  assert.equal(lees({ getUserById() { throw Error('kluis niet beschikbaar'); } }, 'user-42'), null);
  assert.equal(lees(null, 'user-42'), null);
});
