/* Integratietest voor het transactie-grootboek (tx_ledger) tegen een ECHTE
   Postgres. Zonder DATABASE_URL skipt hij expliciet (geen valse groen): de
   json/sqlite-suite kan dit pad per definitie niet dekken, dus deze test
   bestaat juist om het Postgres-gedrag niet ongetest te laten.
   Draai lokaal: DATABASE_URL=postgres://... node --experimental-sqlite --test test/txledger.pg.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { execFileSync } = require('child_process');

const DB = process.env.DATABASE_URL || process.env.PG_URL;

test('grootboek: RAM-venster + verlies-vrij vegen + historie + mutatie-doorstroom',
  { skip: DB ? false : 'DATABASE_URL ontbreekt; deze integratietest vergt een echte Postgres' }, () => {
  const uit = execFileSync(process.execPath, [path.join(__dirname, 'txledger-rit.js')],
    { env: { ...process.env, DATABASE_URL: DB }, encoding: 'utf8', timeout: 120000 });
  const r = JSON.parse(uit.trim().split('\n').pop());

  // het venster: RAM houdt precies TX_RAM_* items, de rest leeft in het grootboek
  assert.equal(r.ramOrders, 10, 'orders-venster gekapt op TX_RAM_ORDERS');
  assert.equal(r.ramBoekingen, 8, 'boekingen-venster gekapt op TX_RAM_BOEKINGEN');
  // verlies-vrij: ALLES staat in het grootboek (venster + uitgerolde staart)
  assert.equal(r.ledgerOrders, 30, 'alle 30 orders in het grootboek');
  assert.equal(r.ledgerBoekingen, 15, 'alle 15 boekingen in het grootboek (niets stilletjes weg)');
  // historie voorbij het venster is gepagineerd leesbaar en betreft juist de oude items
  assert.equal(r.historieN, 20, 'de 20 uitgerolde orders zijn als historie leesbaar');
  assert.equal(r.historieIsOud, true, 'de historie-pagina bevat geen venster-items');
  // een statuswissel op een venster-item stroomt via de veegronde door naar het grootboek
  assert.equal(r.mutatieStatus, 'terugbetaald', 'statuswissel is in het grootboek geland');
  assert.equal(r.vensterNogVindbaar, true, 'het venster-item blijft via de index vindbaar');
});
