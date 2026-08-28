/* Het salongesprek: twee Rahuls die over de dag van hun mens kletsen.

   De leuke kant toetst zich vanzelf; het gaat hier om de drie sloten, want
   die maken het verschil tussen een gimmick en een lek:

     1. alleen tussen vrienden
     2. alleen als BEIDEN het aan hebben staan
     3. altijd verzonnen plaatsnamen -- er mag geen echte naam in wat er
        bewaard wordt of naar het model gaat

   Zuivere functietoetsen op een nagebouwde db; er is geen server nodig, want
   de hele module draait op meegegeven lezers. Draai los:
   node --test test/klets.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { maakNamen, NAMEN } = require('../server/kern/kletspraat/namen');
const { dagbeeld, verhul, omvang, soortVanType } = require('../server/kern/kletspraat/dagbeeld');
const { leesBeurten, demoGesprek } = require('../server/kern/kletspraat/gesprek');
const maakKlets = require('../server/kern/kletspraat');

/* ---------------- een nagebouwde omgeving ---------------- */
const VANDAAG = new Date().toISOString();
function omgeving(opties) {
  const o = opties || {};
  const db = { data: {} };
  const orders = {
    'user-1': [{ at: VANDAAG, supplierName: 'Maison Sakura', type: 'restaurant', items: [{ qty: 2 }] }],
    'user-2': [{ at: VANDAAG, supplierName: 'Hotel Bellini', type: 'hotel', items: [{ qty: 7 }] }]
  };
  const boekingen = {
    'user-1': [{ at: VANDAAG, kind: 'ticket', supplierName: 'Duikcentrum Vega', type: 'activiteiten', service: { name: 'Ochtendduik' } }],
    'user-2': []
  };
  return {
    db,
    kern: maakKlets({
      db, save: () => {}, crypto,
      sociaal: {
        codenaamVan: (h) => ({ 'user-1': 'ORION', 'user-2': 'VESPER' })[h] || h,
        zijnVrienden: () => o.vrienden !== false
      },
      ordersVanKlant: (h) => orders[h] || [],
      boekingenVanKlant: (h) => boekingen[h] || [],
      anthropic: null,                       // demogesprek: geen sleutel nodig
      dagContext: () => ({ zin: 'Het is zondagmiddag in de zomer.' }),
      sseToCustomer: () => {}
    }),
    echteNamen: ['Maison Sakura', 'Hotel Bellini', 'Duikcentrum Vega', 'Ochtendduik']
  };
}

/* ---------------- de verzonnen namen ---------------- */
test('verzonnen namen: kloppend binnen een gesprek, anders daarbuiten', async (t) => {
  await t.test('binnen een gesprek heet dezelfde zaak altijd hetzelfde', () => {
    const n = maakNamen('zout-a');
    const eerst = n.voor('horeca', 'Maison Sakura');
    assert.equal(n.voor('horeca', 'Maison Sakura'), eerst);
    assert.equal(n.voor('horeca', 'maison sakura'), eerst, 'hoofdletters mogen niets uitmaken');
    assert.ok(eerst.length > 3);
  });

  await t.test('tussen gesprekken heet dezelfde zaak anders', () => {
    const a = maakNamen('zout-a').voor('horeca', 'Maison Sakura');
    const b = maakNamen('zout-b').voor('horeca', 'Maison Sakura');
    // niet gegarandeerd verschillend bij toeval, maar over tien zouten wel
    const verschillend = Array.from({ length: 10 }, (_, i) => maakNamen('z' + i).voor('horeca', 'Maison Sakura'));
    assert.ok(new Set(verschillend).size > 1, 'elk gesprek hoort een eigen namenboek te hebben');
    assert.ok(typeof a === 'string' && typeof b === 'string');
  });

  await t.test('twee zaken krijgen nooit dezelfde verzonnen naam', () => {
    const n = maakNamen('zout-c');
    const gezien = new Set();
    for (let i = 0; i < NAMEN.length; i++) {
      const v = n.voor('horeca', 'Zaak nummer ' + i);
      assert.ok(!gezien.has(v), 'botsing bij ' + v);
      gezien.add(v);
    }
  });

  await t.test('de soort bepaalt de vorm: een hotel wordt geen bistro', () => {
    const n = maakNamen('zout-d');
    assert.match(n.voor('hotel', 'Iets'), /^(Hotel|Villa|Residenza|Palazzo|Maison) /);
    assert.match(n.voor('horeca', 'Iets anders'), /^(Cafe|Bistro|Brasserie|Taverna|Trattoria|Osteria) /);
  });

  await t.test('niets erin geeft niets eruit', () => {
    const n = maakNamen('zout-e');
    assert.equal(n.voor('horeca', ''), '');
    assert.equal(n.voor('horeca', null), '');
  });
});

/* ---------------- het dagbeeld ---------------- */
test('het dagbeeld: wel wat er gebeurde, geen bedragen', async (t) => {
  const lezers = {
    ordersVanKlant: () => [
      { at: VANDAAG, supplierName: 'Maison Sakura', type: 'restaurant', items: [{ qty: 2 }], total: 187.5 },
      { at: '2020-01-01T10:00:00.000Z', supplierName: 'Oud Cafe', type: 'restaurant', items: [{ qty: 1 }] }
    ],
    boekingenVanKlant: () => []
  };

  await t.test('alleen vandaag telt mee', () => {
    const f = dagbeeld(lezers, 'user-1', new Date());
    assert.equal(f.length, 1);
    assert.equal(f[0].zaak, 'Maison Sakura');
  });

  await t.test('GEEN bedragen, ook niet bij benadering', () => {
    const f = dagbeeld(lezers, 'user-1', new Date());
    const tekst = JSON.stringify(f);
    assert.doesNotMatch(tekst, /187/, 'het bedrag lekte mee');
    assert.equal(f[0].wat, 'iets kleins');
    assert.equal(omvang(1), 'iets kleins');
    assert.equal(omvang(4), 'een normale ronde');
    assert.equal(omvang(9), 'uitgebreid');
  });

  await t.test('de soort zaak wordt herkend', () => {
    assert.equal(soortVanType('restaurant'), 'horeca');
    assert.equal(soortVanType('hotel'), 'hotel');
    assert.equal(soortVanType('retail-mode'), 'winkel');
    assert.equal(soortVanType('iets onbekends'), 'dienst');
  });

  await t.test('verhullen haalt de echte naam eruit', () => {
    const n = maakNamen('zout-f');
    const regels = verhul(dagbeeld(lezers, 'user-1', new Date()), n).join(' ');
    assert.doesNotMatch(regels, /Maison Sakura/i, 'de echte naam stond in de regels');
    assert.match(regels, /besteld bij/);
  });
});

/* ---------------- het gesprek zelf ---------------- */
test('het gesprek', async (t) => {
  await t.test('zonder sleutel komt er een demogesprek dat over de feiten gaat', () => {
    const b = demoGesprek('ORION', ['vanmiddag besteld bij Bistro Solene (iets kleins)'], 'VESPER', []);
    assert.ok(b.length >= 6);
    assert.equal(b[0].wie, 'a');
    assert.equal(b[1].wie, 'b');
    assert.match(b[0].tekst, /Bistro Solene/, 'het eerste feit hoort erin terug te komen');
  });

  await t.test('een rommelig modelantwoord wordt geweigerd in plaats van half getoond', () => {
    assert.equal(leesBeurten('geen json hier'), null);
    assert.equal(leesBeurten('[{"wie":"a"}]'), null, 'zonder tekst is het geen beurt');
    const goed = leesBeurten('wat gebabbel [{"wie":"a","tekst":"Hoi."},{"wie":"b","tekst":"Ha."}] en nog wat');
    assert.deepEqual(goed, [{ wie: 'a', tekst: 'Hoi.' }, { wie: 'b', tekst: 'Ha.' }]);
  });
});

/* ---------------- de drie sloten ---------------- */
test('de sloten op het salongesprek', async (t) => {
  await t.test('standaard staat het UIT', async () => {
    const { kern } = omgeving();
    assert.equal(kern.kletsAan('user-1'), false);
    const r = await kern.kletsStart('user-1', 'user-2');
    assert.equal(r.status, 403);
    assert.match(r.error, /zelf aan/i);
  });

  await t.test('SLOT 2: ook de ander moet het aan hebben staan', async () => {
    const { kern } = omgeving();
    kern.kletsZet('user-1', true);
    const r = await kern.kletsStart('user-1', 'user-2');
    assert.equal(r.status, 403);
    assert.match(r.error, /de ander/i);
  });

  await t.test('SLOT 1: geen connectie, geen gesprek', async () => {
    const { kern } = omgeving({ vrienden: false });
    kern.kletsZet('user-1', true); kern.kletsZet('user-2', true);
    const r = await kern.kletsStart('user-1', 'user-2');
    assert.equal(r.status, 403);
    assert.match(r.error, /verbonden/i);
  });

  await t.test('met alles open komt er een gesprek, en het is van allebei te lezen', async () => {
    const { kern } = omgeving();
    kern.kletsZet('user-1', true); kern.kletsZet('user-2', true);
    const r = await kern.kletsStart('user-1', 'user-2');
    assert.ok(r.ok, JSON.stringify(r));
    assert.ok(r.beurten.length >= 6);
    assert.equal(r.metCodenaam, 'VESPER');
    assert.equal(r.echt, false, 'zonder sleutel hoort hij eerlijk te zeggen dat het demo is');
    // de ander ziet hetzelfde gesprek, met de kanten omgedraaid
    const bij2 = kern.kletsHaal('user-2', r.id);
    assert.ok(bij2.ok);
    assert.equal(bij2.metCodenaam, 'ORION');
    assert.equal(bij2.beurten[0].mij, false, 'de eerste beurt was van de Rahul van de ander');
    assert.equal(r.beurten[0].mij, true);
  });

  await t.test('SLOT 3: er staat geen enkele echte naam in wat bewaard wordt', async () => {
    const { kern, db, echteNamen } = omgeving();
    kern.kletsZet('user-1', true); kern.kletsZet('user-2', true);
    await kern.kletsStart('user-1', 'user-2');
    const opgeslagen = JSON.stringify(db.data.klets);
    for (const naam of echteNamen) {
      assert.ok(opgeslagen.indexOf(naam) < 0, 'echte naam in de opslag: ' + naam);
    }
  });

  await t.test('een derde kan een gesprek van anderen niet opvragen', async () => {
    const { kern } = omgeving();
    kern.kletsZet('user-1', true); kern.kletsZet('user-2', true);
    const r = await kern.kletsStart('user-1', 'user-2');
    assert.equal(kern.kletsHaal('user-9', r.id).status, 404);
  });

  await t.test('hooguit een gesprek per paar per dag', async () => {
    const { kern } = omgeving();
    kern.kletsZet('user-1', true); kern.kletsZet('user-2', true);
    assert.ok((await kern.kletsStart('user-1', 'user-2')).ok);
    const tweede = await kern.kletsStart('user-1', 'user-2');
    assert.equal(tweede.status, 429);
    // en ook niet andersom, want het slot zit op het PAAR
    assert.equal((await kern.kletsStart('user-2', 'user-1')).status, 429);
  });

  await t.test('uitzetten stopt het meteen, ook voor de ander', async () => {
    const { kern } = omgeving();
    kern.kletsZet('user-1', true); kern.kletsZet('user-2', true);
    kern.kletsZet('user-2', false);
    const r = await kern.kletsStart('user-1', 'user-2');
    assert.equal(r.status, 403);
  });

  await t.test('met jezelf kletsen heeft geen zin', async () => {
    const { kern } = omgeving();
    kern.kletsZet('user-1', true);
    assert.equal((await kern.kletsStart('user-1', 'user-1')).status, 400);
  });
});
