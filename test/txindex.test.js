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

/* DOET DE INDEX NOG WERK, OF GEEFT HIJ ALLEEN HET JUISTE ANTWOORD?

   De toetsen hierboven vergelijken de index met een naieve scan. Dat is de
   goede vraag voor CORRECTHEID, maar hij kan niet zakken op de vraag waar deze
   index voor bestaat. txZorg() in server/db/tx/index.js herbouwt namelijk de
   HELE index zodra de gecachete lengte niet meer klopt -- dat zelfherstel is er
   met opzet, want code buiten de helpers om mag db.data ook aanraken.

   Gevolg: sloop je het incrementele bijhouden in txVoegToe (de st.len++, het
   byRef.set, de byKlant-lijst), dan merkt txZorg de scheefstand en bouwt hij
   alles opnieuw op. De antwoorden blijven exact goed en elke bewering hierboven
   blijft groen -- terwijl elke lezing voortaan O(n) is over een grootboek dat
   tot vijftigduizend regels draagt. Precies wat de index moest voorkomen, stil
   weg, met een groene suite erboven.

   Dat is LAT.md regel 9: een toets die niet kan zakken op zijn eigen onderwerp.
   De mutatiemotor zag het ook -- txindex.test.js overleefde zeventien mutaties
   in zijn eigen module.

   HOE DIT HET WEL MEET. Een herbouw loopt de hele array langs en leest van elk
   item `ref`. Een spion met een teller op die eigenschap maakt dus zichtbaar
   OF er herbouwd is, zonder op tijd of geheugen te meten -- deterministisch,
   geen klok, geen drempel.

   MUTATIE-BEWIJS: haal `st.len++` uit txVoegToe en deze toets zakt op de
   spionteller, terwijl alle beweringen hierboven groen blijven. Precies het
   verschil dat hij moet vangen. */
test('de index werkt incrementeel: toevoegen bouwt hem niet opnieuw op', () => {
  let gelezen = 0;
  const spion = {
    get ref() { gelezen++; return 'RTG-O-SPION'; },
    supplierCode: 'KIKUNOI', customerKey: 'user-spion', customerTier: 'rtg', at: new Date().toISOString()
  };
  db.data = { orders: [spion], boekingen: [] };
  for (let i = 0; i < 200; i++) ordersVoegToe(maakOrder(i));

  // eerste lezing: de index staat (of wordt gebouwd); daarna is de teller stil
  assert.equal(orderMetRef('RTG-O-SPION'), spion, 'de spion zit gewoon in de index');
  const na = gelezen;
  assert.ok(na > 0, 'de index is echt opgebouwd -- anders meet deze toets niets');

  /* Nu het punt: nog eens toevoegen en lezen mag de spion NIET opnieuw
     aanraken. Doet hij dat wel, dan is er herbouwd en werkt het incrementele
     pad niet meer. */
  for (let i = 200; i < 210; i++) ordersVoegToe(maakOrder(i));
  assert.equal(orderMetRef('RTG-O-205').ref, 'RTG-O-205', 'het nieuwe ticket is gewoon vindbaar');
  assert.deepEqual(ordersVanKlant('user-spion'), [spion], 'en de klantlijst klopt nog');
  assert.equal(gelezen, na,
    'de index is opnieuw opgebouwd na een toevoeging (' + (gelezen - na) + ' extra herbouw-lezingen) -- ' +
    'het incrementele pad werkt niet meer en elke lezing wordt O(n)');

  /* En de tegenkant, zodat dit geen toets is die alleen maar stil kan blijven:
     raakt db.data BUITEN de helpers om aan, dan HOORT hij juist wel te
     herbouwen. Zonder deze helft zou "de teller staat stil" ook groen zijn als
     de index helemaal niets meer deed. */
  db.data.orders.unshift(maakOrder(999));
  assert.equal(orderMetRef('RTG-O-999').ref, 'RTG-O-999', 'buitenom geschreven werk wordt alsnog gevonden');
  assert.ok(gelezen > na, 'en daarvoor is de index wel degelijk opnieuw opgebouwd -- het zelfherstel leeft');
});
