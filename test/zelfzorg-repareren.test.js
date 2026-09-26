/* De reparatieknop van de zelfzorg mag klantdata en sporen niet legen
   (ARBEID.md par. 4 punt 9; BESTUUR.md 6.5). Hij zette `orders` en `boekingen`
   bij een verkeerd type terug op leeg, zonder dat de oude waarde ergens bleef,
   terwijl zijn kop beloofde dat die als bewijsstuk meeging. */
const test = require('node:test');
const assert = require('node:assert/strict');

function knop(data) {
  const db = { data };
  const journaal = [];
  const { herstel } = require('../server/kern/zelfzorg/repareren')({
    db, save() {}, schrijf: (wat, door, rep, adv) => { journaal.push({ wat, rep, adv }); return { at: 't' }; } });
  return { db, herstel, journaal };
}

test('een klantcollectie met het verkeerde type wordt NIET geleegd, maar een advies', () => {
  const kapot = { 'order-1': { bedrag: 40 } };      // een object waar een lijst hoort
  const { db, herstel } = knop({ orders: kapot, boekingen: [], zelfzorg: {} });
  const r = herstel('Testmens');
  assert.equal(db.data.orders, kapot, 'de klantdata staat er nog, precies zoals hij was');
  assert.ok(r.adviezen.some(a => /"orders"/.test(a.tekst)), 'een mens krijgt het te zien');
  assert.ok(!r.reparaties.some(x => /orders/.test(x.wat)), 'en het staat niet als reparatie');
});

test('ook een spoor (kantoorAudit) wordt niet stil leeggemaakt', () => {
  const { db, herstel } = knop({ kantoorAudit: 'kapot', zelfzorg: {} });
  herstel('Testmens');
  assert.equal(db.data.kantoorAudit, 'kapot');
});

test('een ONTBREKENDE collectie wordt wel aangelegd: daar gaat niets verloren', () => {
  const { db, herstel } = knop({ zelfzorg: {} });
  const r = herstel('Testmens');
  assert.deepEqual(db.data.orders, []);
  assert.ok(r.reparaties.some(x => /ontbrekende collectie "orders"/.test(x.wat)));
});
