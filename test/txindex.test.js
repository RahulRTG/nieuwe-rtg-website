/* Transactie-index: bewijs dat de O(1)-helpers exact hetzelfde antwoorden als de
   naieve scans die ze vervangen, ook na mutaties, vervanging van de array
   (archief/venster/pg-sync) en schrijven BUITEN de helpers om (zelfherstel).
   Dit test de db.js-laag rechtstreeks, zonder server: de index werkt in alle
   opslagmodi en dit is de gedeelde kern ervan.
   Draai: node --experimental-sqlite --test test/txindex.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.RTG_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-txidx-'));
const { db, orderMetRef, ordersVanKlant, ordersVanZaak, ordersVoegToe,
  boekingMetRef, boekingenVanKlant, boekingenVanZaak, boekingenVoegToe } = require('../server/db');

const ZAKEN = ['KIKUNOI', 'PONTO', 'HOSHI'];
function maakOrder(i) {
  return { ref: 'RTG-O-' + i, supplierCode: ZAKEN[i % 3], customerKey: 'user-' + (i % 7),
    customerTier: 'rtg', pickup: 'P' + i, total: 10 + i, paid: i % 2 === 0, status: i % 3 ? 'geserveerd' : 'nieuw', at: new Date(Date.now() - i * 1000).toISOString() };
}
const klantVan = t => t.customerKey || t.customerTier;
const scanRef = (arr, ref) => arr.find(x => x.ref === ref);
const scanKlant = (arr, k) => arr.filter(x => klantVan(x) === k);
const scanZaak = (arr, z) => arr.filter(x => x.supplierCode === z);

function eqAlles() {
  for (const ref of ['RTG-O-0', 'RTG-O-5', 'RTG-O-999', 'bestaat-niet'])
    assert.equal(orderMetRef(ref), scanRef(db.data.orders, ref), 'ref ' + ref);
  for (const k of ['user-0', 'user-3', 'user-999'])
    assert.deepEqual(ordersVanKlant(k), scanKlant(db.data.orders, k), 'klant ' + k);
  for (const z of ZAKEN)
    assert.deepEqual(ordersVanZaak(z), scanZaak(db.data.orders, z), 'zaak ' + z);
}

test('index == naieve scan, ook na toevoegen, muteren, vervangen en omzeilen', () => {
  db.data = { orders: [], boekingen: [] };

  // leeg: alles leeg
  assert.equal(orderMetRef('x'), undefined);
  assert.deepEqual(ordersVanKlant('user-1'), []);

  // toevoegen via de helper (vooraan, zoals unshift)
  for (let i = 0; i < 50; i++) ordersVoegToe(maakOrder(i));
  assert.equal(db.data.orders.length, 50);
  assert.equal(db.data.orders[0].ref, 'RTG-O-49', 'nieuwste staat vooraan');
  eqAlles();

  // in-place mutatie (statuswissel) is direct zichtbaar via de index
  orderMetRef('RTG-O-10').status = 'bezorgd';
  assert.equal(scanRef(db.data.orders, 'RTG-O-10').status, 'bezorgd');
  eqAlles();

  // achteraan toevoegen (de kassaroute met push-gedrag)
  ordersVoegToe(maakOrder(100), { achteraan: true });
  assert.equal(db.data.orders[db.data.orders.length - 1].ref, 'RTG-O-100');
  eqAlles();

  // BUITEN de helpers om schrijven (zoals oude/nieuwe code zou kunnen doen):
  // de lengte klopt niet meer met de index -> zelfherstel bij de volgende lezing
  db.data.orders.unshift(maakOrder(200));
  eqAlles();

  // de array VERVANGEN (archief laat 'blijven' achter; pg-sync overschrijft)
  db.data.orders = db.data.orders.filter(o => o.status !== 'bezorgd');
  eqAlles();
  assert.equal(orderMetRef('RTG-O-10'), undefined, 'gearchiveerde order is ook uit de index');

  // volledige verwisseling van db.data (zoals bij het laden van een snapshot)
  db.data = { orders: [maakOrder(1), maakOrder(2)], boekingen: [] };
  eqAlles();
});

test('boekingen: zelfde semantiek + de 50000-cap knipt zonder kopie per toevoeging', () => {
  db.data = { orders: [], boekingen: [] };
  const maakB = i => ({ ref: 'RTG-B-' + i, kind: i % 2 ? 'ticket' : 'huur', supplierCode: ZAKEN[i % 3],
    customerKey: 'user-' + (i % 5), code: 'C' + i, status: 'bevestigd', at: new Date().toISOString() });
  for (let i = 0; i < 40; i++) boekingenVoegToe(maakB(i));
  assert.equal(boekingMetRef('RTG-B-7'), scanRef(db.data.boekingen, 'RTG-B-7'));
  assert.deepEqual(boekingenVanKlant('user-2'), scanKlant(db.data.boekingen, 'user-2'));
  assert.deepEqual(boekingenVanZaak('PONTO'), scanZaak(db.data.boekingen, 'PONTO'));
  // dubbele refs: .find-semantiek (eerste = nieuwste wint), net als de oude scans
  const dubbel = { ...maakB(7), status: 'nieuwer' };
  boekingenVoegToe(dubbel);
  assert.equal(boekingMetRef('RTG-B-7'), dubbel, 'de nieuwste met die ref wint, zoals .find op nieuwste-eerst');
});
