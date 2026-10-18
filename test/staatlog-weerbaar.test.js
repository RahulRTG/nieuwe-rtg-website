/* DE STAATMETER (server/staatlog.js) op een kapotte of halve kop.

   De idempotentieproef leest de kop X-RTG-Staat terug en trekt twee standen
   van elkaar af. Een kop die half binnenkomt (afgekapt door een proxy, een
   naam zonder waarde, een getal dat geen getal is) mag daar geen verzonnen
   beweging van maken, en een tweede end() op hetzelfde antwoord mag de uitgang
   niet breken.

   Wat hier niet mag sneuvelen:
   1. een deel zonder naam ("=5") of zonder "=" wordt overgeslagen en geen
      collectie met een lege naam;
   2. een waarde die geen getal is telt als 0, met of zonder afdruk, en wordt
      niet NaN (NaN - NaN zou een verschil verbergen);
   3. verschil() neemt ook standen als map, en een ontbrekende stand is leeg;
      een collectie die verdween telt als afname;
   4. de haak zet geen kop meer na de eerste verzending, en een setHeader die
      gooit laat het antwoord gewoon door.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in lees() `if (i <= 0) continue;` vervangen door `if (i < 0) continue;`
     -> "1. een deel zonder naam" ZAKT (RAAK)
   - in lees() `Number(waarde) || 0` vervangen door `Number(waarde)`
     -> "2. een waarde die geen getal is" ZAKT (RAAK)
   - in de haak de try/catch om setHeader weggehaald
     -> "4. de haak" ZAKT (RAAK)

   Draai: node --test test/staatlog-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const staatlog = require('../server/staatlog');

test('1. een deel zonder naam of zonder "=" wordt overgeslagen', () => {
  assert.deepEqual(staatlog.lees('=5,orders=2,zonderwaarde,,'), { orders: { n: 2, h: null } });
});

test('2. een waarde die geen getal is telt als 0, niet als NaN', () => {
  assert.deepEqual(staatlog.lees('a=x,b=y:abcd1234'), { a: { n: 0, h: null }, b: { n: 0, h: 'abcd1234' } });
  assert.deepEqual(staatlog.verschil('a=x', 'a=3'), { a: 3 }, 'van onleesbaar naar 3 is een beweging van 3');
});

test('3. verschil() neemt ook maps, en een ontbrekende stand is leeg', () => {
  assert.deepEqual(staatlog.verschil({ a: { n: 2, h: null } }, null), { a: -2 }, 'verdwenen telt als afname');
  assert.deepEqual(staatlog.verschil(undefined, { b: { n: 1, h: 'x' } }), { b: 1 });
  assert.deepEqual(staatlog.verschil({ c: { n: 1, h: 'aa' } }, { c: { n: 1, h: 'bb' } }), { c: 'gewijzigd' });
});

test('4. de haak: geen kop na verzending, en een gooiende setHeader breekt niets', () => {
  staatlog.begin('1');
  try {
    let mw = null;
    staatlog.haak({ use(fn) { mw = fn; } });
    const gezet = [];
    const res = { headersSent: true, setHeader: (k, v) => gezet.push(k), end: () => 'eerste' };
    mw({}, res, () => {});
    assert.equal(res.end(), 'eerste');
    assert.deepEqual(gezet, [], 'na verzending wordt er niets meer overschreven');

    const kapot = { headersSent: false, setHeader() { throw new Error('ERR_HTTP_HEADERS_SENT'); }, end: (b) => 'door:' + b };
    mw({}, kapot, () => {});
    assert.equal(kapot.end('lijf'), 'door:lijf', 'het antwoord gaat toch door');
    assert.equal(staatlog.haak(null), false, 'zonder app geen haak');
  } finally { staatlog.begin(''); }
});
