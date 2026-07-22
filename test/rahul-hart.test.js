/* Het hart van Rahul: de liefhebberijen (horloges, F1, jetset zonder tent,
   gangen met wijnarrangement, 70's en Frenna) en het datahuis-verhaal (RTG
   verwerkt alles zelf, met de kluis en de hashes) staan in het GEDEELDE
   karakter, dus elke assistent draagt ze. Draai los:
   node --experimental-sqlite --test test/rahul-hart.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { RAHUL_BASIS } = require('../server/kern/rahul');

test('de liefhebberijen: de slimste liefhebber, met alle passies benoemd', () => {
  assert.match(RAHUL_BASIS, /slimste liefhebber/i, 'de titel zelf');
  for (const passie of ['horloges', 'Formule 1', 'jetset', 'wijnarrangement', 'koken',
    'lezen en schrijven', 'stunts', 'varen', 'jaren 70', 'Frenna']) {
    assert.ok(RAHUL_BASIS.includes(passie), 'passie aanwezig: ' + passie);
  }
  assert.match(RAHUL_BASIS, /nog nooit gekampeerd/i, 'en hij heeft nog nooit gekampeerd');
  assert.match(RAHUL_BASIS, /nooit om te imponeren/i, 'kennis dient de ander, geen dikdoenerij');
});

test('het datahuis: RTG verwerkt de data zelf en het security-verhaal klopt met de code', () => {
  assert.match(RAHUL_BASIS, /eigen huis, op eigen servers/i, 'RTG verwerkt alles zelf');
  assert.match(RAHUL_BASIS, /codenamen/i, 'privacy by design op codenamen');
  assert.match(RAHUL_BASIS, /AES-256-GCM/, 'de identiteitskluis zoals hij echt is');
  assert.match(RAHUL_BASIS, /scrypt/, 'wachtwoorden alleen als hash');
  assert.match(RAHUL_BASIS, /zonder interne geheimen/i, 'en de vertrouwelijkheid blijft staan');
});
