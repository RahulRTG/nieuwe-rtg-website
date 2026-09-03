/* HET EIGENAARSHERSTEL: de ceremonie, met een klok die ik zelf vooruit zet.

   Waarom hier een neppe klok en geen echte server: de hele belofte van deze weg
   is een WACHTTIJD van zeven dagen, en een toets die zeven dagen duurt is geen
   toets. De klok gaat er daarom als functie in (`nu`), precies zodat dit
   meetbaar is -- dat is geen testhulpje maar de reden dat die parameter bestaat.

   De vier beweringen die moeten zakken als iemand ze sloopt:
   1. zonder ingericht quorum bestaat deze weg niet (fail-closed);
   2. een geldig quorum levert WACHTTIJD op en geen toegang;
   3. afbreken werkt, en daarna is er niets meer te voltooien;
   4. het venster gaat een keer op.

   Draai los: node --test test/eigenaarherstel.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const maakHerstel = require('../server/kern/eigenaarherstel');

const DAG = 24 * 60 * 60 * 1000;

function opzet() {
  const db = { data: {} };
  const meldingen = [];
  const mails = [];
  let t = Date.parse('2026-09-03T12:00:00Z');
  const h = maakHerstel({
    db, save: () => {}, log: null,
    beveiligVan: () => ({ meld: (code, niveau) => meldingen.push({ code, niveau }) }),
    mailVan: () => ({ send: (naar, onderwerp) => mails.push({ naar, onderwerp }) }),
    eigenaarEmail: () => 'eigenaar@x.nl',
    nu: () => t
  });
  return { h, db, meldingen, mails, verzet: (ms) => { t += ms; }, nu: () => t };
}

test('1. zonder ingericht quorum bestaat de weg niet', () => {
  const { h } = opzet();
  assert.equal(h.ingericht(), false);
  assert.equal(h.start('RTGH1-1-x', 'RTGH1-2-y').status, 404,
    'fail-closed: een half ingerichte herstelweg is gevaarlijker dan geen');
  assert.equal(h.voltooi('a', 'b').status, 404);
  assert.equal(h.herstelvensterOpen(), false);
});

test('2. inrichten geeft drie delen en bewaart alleen de verifier', () => {
  const { h, db, meldingen } = opzet();
  const r = h.richtIn();
  assert.equal(r.delen.length, 3);
  assert.equal(r.wachttijdDagen, 7);
  assert.equal(h.ingericht(), true);
  const bewaard = JSON.stringify(db.data.eigenaarHerstel);
  for (const d of r.delen) assert.ok(!bewaard.includes(d), 'geen enkel deel staat in de database');
  assert.ok(meldingen.some(m => m.code === 'eigenaarherstel-ingericht' && m.niveau === 'kritiek'));
});

test('3. een geldig paar levert WACHTTIJD op, geen toegang', () => {
  const { h, mails, meldingen } = opzet();
  const { delen } = h.richtIn();
  const r = h.start(delen[0], delen[1]);
  assert.equal(r.status, 200);
  assert.ok(r.klaarOp, 'er staat een moment waarop het bruikbaar wordt');
  assert.ok(Date.parse(r.klaarOp) > Date.now() - DAG, 'en dat ligt in de toekomst');
  assert.equal(h.herstelvensterOpen(), false, 'starten opent NIETS');
  assert.equal(mails.length, 1, 'en het is luid: er gaat een mail naar de eigenaar');
  assert.equal(mails[0].naar, 'eigenaar@x.nl');
  assert.ok(meldingen.some(m => m.code === 'eigenaarherstel-gestart' && m.niveau === 'kritiek'));
});

test('4. een fout paar telt, en na vijf valt het slot dicht', () => {
  const { h } = opzet();
  const { delen } = h.richtIn();
  const ander = maakAnder();
  for (let i = 0; i < 4; i++)
    assert.equal(h.start(ander[0], ander[1]).status, 401, 'poging ' + (i + 1) + ' is gewoon fout');
  assert.equal(h.start(ander[0], ander[1]).status, 401, 'de vijfde ook');
  const na = h.start(delen[0], delen[1]);
  assert.equal(na.status, 429, 'en daarna is het dicht, ook voor een GOED paar');
});

test('5. voltooien kan niet voordat de wachttijd om is', () => {
  const { h, verzet } = opzet();
  const { delen } = h.richtIn();
  h.start(delen[0], delen[1]);
  assert.equal(h.voltooi(delen[0], delen[1]).status, 425, 'de wachttijd loopt nog');
  verzet(6 * DAG);
  assert.equal(h.voltooi(delen[0], delen[1]).status, 425, 'zes dagen is niet genoeg');
  verzet(2 * DAG);
  const r = h.voltooi(delen[0], delen[1]);
  assert.equal(r.status, 200, 'na zeven dagen wel');
  assert.equal(h.herstelvensterOpen(), true, 'en dan staat het venster open');
});

test('6. afbreken maakt het lopende herstel waardeloos -- de kern van het ontwerp', () => {
  const { h, verzet, meldingen } = opzet();
  const { delen } = h.richtIn();
  h.start(delen[0], delen[1]);
  assert.equal(h.breekAf().status, 200);
  assert.ok(meldingen.some(m => m.code === 'eigenaarherstel-afgebroken'));
  verzet(30 * DAG);
  assert.equal(h.voltooi(delen[0], delen[1]).status, 409,
    'de dief heeft nog steeds twee delen, en er valt niets te voltooien');
  assert.equal(h.herstelvensterOpen(), false);
});

test('7. het venster gaat een keer op', () => {
  const { h, verzet } = opzet();
  const { delen } = h.richtIn();
  h.start(delen[0], delen[1]);
  verzet(8 * DAG);
  h.voltooi(delen[0], delen[1]);
  assert.equal(h.herstelvensterOpen(), true);
  h.herstelvensterGebruikt();
  assert.equal(h.herstelvensterOpen(), false, 'anders is een geslaagd herstel een kwartier lang een open deur');
});

test('8. het venster verloopt vanzelf', () => {
  const { h, verzet } = opzet();
  const { delen } = h.richtIn();
  h.start(delen[0], delen[1]);
  verzet(8 * DAG);
  h.voltooi(delen[0], delen[1]);
  verzet(16 * 60 * 1000);
  assert.equal(h.herstelvensterOpen(), false, 'na een kwartier is het dicht, ook zonder gebruik');
});

test('9. opnieuw inrichten breekt een lopend herstel af en maakt de oude delen dood', () => {
  const { h, verzet } = opzet();
  const eerste = h.richtIn();
  h.start(eerste.delen[0], eerste.delen[1]);
  const tweede = h.richtIn();
  verzet(8 * DAG);
  assert.equal(h.voltooi(eerste.delen[0], eerste.delen[1]).status, 401,
    'de oude delen kloppen niet meer bij de nieuwe verifier');
  assert.equal(h.voltooi(tweede.delen[0], tweede.delen[1]).status, 409,
    'en met de nieuwe delen loopt er niets: inrichten heeft het herstel afgebroken');
});

test('10. de stand vertelt wat er speelt zonder iets te verraden', () => {
  const { h } = opzet();
  const { delen } = h.richtIn();
  h.start(delen[0], delen[1]);
  const s = h.stand();
  assert.equal(s.ingericht, true);
  assert.equal(s.wachttijdDagen, 7);
  assert.ok(s.lopend && s.lopend.klaarOp, 'een lopend herstel is zichtbaar');
  const tekst = JSON.stringify(s);
  for (const d of delen) assert.ok(!tekst.includes(d), 'en de delen staan er niet in');
});

/* Twee delen uit een ANDER quorum: geldig van vorm, fout van inhoud. */
function maakAnder() {
  const q = require('../server/kern/herstelquorum');
  return q.munt().delen;
}
