/* DE OBJECTPOOL, NAGETROKKEN. Oogsten is geen raden: de pool mag alleen leren
   uit wat een proef echt zag, en alleen verrijken binnen hetzelfde domein.
   Elk geval hieronder toetst ook de kant waarop hij zich NIET mag bemoeien --
   een pool die rommel of andermans domein doorgeeft, vervuilt de meting die
   hij juist mogelijk moet maken.

   Draai los: node --experimental-sqlite --test test/objectpool.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakPool, domeinVan, enkelvoud } = require('../scripts/lib/objectpool');

test('oogsten: id-achtige velden, diep en uit lijsten, onder hun lijstnaam', () => {
  const pool = maakPool();
  pool.leer({
    ok: true,
    klussen: [{ id: 'K-1', titel: 'lange tekst die geen id is en dus nooit geoogst mag worden. '.repeat(2) }],
    dossier: { ref: 'D-9', binnen: { orderId: 'O-3' } }
  }, '/api/werkplek/klussen');

  const { lijf, velden } = pool.verrijk({ id: 'proef-x', tekst: 'proef' }, '/api/werkplek/klus/rond');
  assert.equal(lijf.id, 'K-1', 'het verzonnen id wordt vervangen door een geoogst id uit het domein');
  assert.equal(lijf.ref, 'D-9');
  assert.equal(lijf.orderid, 'O-3');
  assert.equal(lijf.klus, 'K-1', 'een lijstnaam geeft zijn elementen een tweede veldnaam (klussen -> klus)');
  assert.equal(lijf.klusid, 'K-1');
  assert.equal(lijf.tekst, 'proef', 'niet-idvelden blijven van het basislijf');
  assert.ok(!('titel' in lijf), 'een tekstveld is geen verwijzing en wordt nooit geoogst');
  assert.ok(velden.length >= 4);
});

test('de domeingrens: andermans id verrijkt nooit', () => {
  const pool = maakPool();
  pool.leer({ id: 'K-1' }, '/api/werkplek/klussen');
  const { lijf, velden } = pool.verrijk({ id: 'proef-x' }, '/api/orders/sluit');
  assert.equal(lijf.id, 'proef-x', 'een klus-id in een order-route is dezelfde 404 met extra stappen');
  assert.deepEqual(velden, []);
});

test('rommel komt er niet in: lange teksten, lege strings, objecten', () => {
  const pool = maakPool();
  pool.leer({ id: '', code: 'x'.repeat(65), ref: { genest: 'object' }, sleutel: 'GOED-1' }, '/api/bank/lijst');
  const { lijf } = pool.verrijk({}, '/api/bank/betaal');
  assert.deepEqual(Object.keys(lijf), ['sleutel'], 'alleen de bruikbare scalar is geleerd');
  assert.equal(lijf.sleutel, 'GOED-1');
});

test('de eerste waarde wint en de pool blijft begrensd', () => {
  const pool = maakPool();
  for (let i = 0; i < 50; i++) pool.leer({ id: 'V-' + i }, '/api/mall/lijst');
  const { lijf } = pool.verrijk({}, '/api/mall/koop');
  assert.equal(lijf.id, 'V-0', 'de vroegst geoogste id komt uit de seed en is het stabielst');
});

test('hulpjes: domeinVan en enkelvoud', () => {
  assert.equal(domeinVan('/api/werkplek/klus/rond'), 'werkplek');
  assert.equal(domeinVan('/gezond'), '');
  assert.equal(enkelvoud('klussen'), 'klus', 'klussen -> klus (dubbele slotmedeklinker valt weg)');
  assert.equal(enkelvoud('dossiers'), 'dossier');
  assert.equal(enkelvoud('zaken'), 'zak', 'onregelmatig enkelvoud blijft een gok; een misser kost niets');
  assert.equal(enkelvoud('orders'), 'order');
  assert.equal(enkelvoud('les'), 'les', 'te kort om te strippen');
});
