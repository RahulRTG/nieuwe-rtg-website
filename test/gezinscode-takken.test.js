'use strict';
/* DE GEZINSCODE (server/foundation/gezinscode.js), de takken die
   test/gezinscode.test.js niet langsloopt: het normaliseren van wat een mens
   overtypt, de opslag zonder collectietransactie (buiten productie de eigen
   collectie, in productie een weigering), een collectie met de verkeerde vorm,
   de idempotente rotatie, een eerste code zonder beheerder, intrekken en
   vergeten van wat er niet is, en de redenen in het publieke beeld. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const C = require('../server/foundation/gezinscode');

const T0 = Date.parse('2026-10-04T12:00:00.000Z');
function gezinnen() {
  return { ABC234: { id: 'g1', code: 'ABC234' }, XYZ789: { id: 'g2', code: 'XYZ789' } };
}
function wereld(o = {}) {
  const db = { data: { foundation: { gezinnen: gezinnen() } } };
  const bewerkCollectie = o.zonderTransactie ? undefined : (sleutel, werk) => {
    const kopie = o.vorm !== undefined ? o.vorm : JSON.parse(JSON.stringify(db.data[sleutel] == null ? {} : db.data[sleutel]));
    const uit = werk(kopie); db.data[sleutel] = kopie; return uit;
  };
  const G = o.G !== undefined ? o.G : () => db.data.foundation.gezinnen;
  const code = C.maak({ db, crypto, bewerkCollectie, G, productie: !!o.productie, nu: () => new Date(T0).toISOString() });
  return { db, code, G };
}

test('normaliseren: hoofdletters, zonder spaties en streepjes, en GC. ervoor bij kale hex', () => {
  const hex = 'ab'.repeat(16);
  assert.equal(C.normaliseer(hex), 'GC.' + hex.toUpperCase());
  assert.equal(C.normaliseer(' gc.' + hex.slice(0, 8) + '-' + hex.slice(8) + ' '), 'GC.' + hex.toUpperCase());
  assert.equal(C.normaliseer(null), null);
  assert.equal(C.normaliseer(undefined), null);
  assert.equal(C.normaliseer('GC.' + 'G'.repeat(32)), null, 'geen hex');
  assert.equal(C.normaliseer('ABC234'), null, 'de oude zes-tekencode heeft de verkeerde vorm');
  assert.ok(C.VORM.test('GC.' + '0'.repeat(32)));
});

test('de constanten staan ook op de gemaakte instantie', () => {
  const { code } = wereld();
  assert.equal(code.COLLECTIE, 'foundationGezinscode');
  assert.equal(code.DOEL, 'gezin-inloggen');
  assert.deepEqual(code.SCOPE, ['foundation.gezin.inloggen']);
  assert.equal(code.MAX_GEBRUIK, 10000);
  assert.equal(code.normaliseer, C.normaliseer);
});

test('zonder collectietransactie: buiten productie de eigen collectie, in productie een weigering', async () => {
  const buiten = wereld({ zonderTransactie: true });
  const raw = await buiten.code.geef(buiten.G().ABC234, 'b');
  assert.match(raw, /^GC\.[0-9A-F]{32}$/);
  assert.equal(buiten.code.vind(raw), 'ABC234');
  assert.match(buiten.db.data[C.COLLECTIE].ABC234.code_hash, /^[0-9a-f]{64}$/);
  const binnen = wereld({ zonderTransactie: true, productie: true });
  await assert.rejects(binnen.code.geef(binnen.G().ABC234, 'b'), /geen collectietransactie in productie/);
  await assert.rejects(binnen.code.intrek('ABC234', 'b'), /geen collectietransactie/);
  assert.equal(binnen.db.data[C.COLLECTIE], undefined, 'er is niets geschreven');
});

test('een collectie die geen kaart is, wordt geweigerd', async () => {
  for (const vorm of [null, [], 'tekst']) {
    const w = wereld({ vorm });
    await assert.rejects(async () => w.code.geef(w.G().ABC234, 'b'), /hoort een kaart te zijn/);
  }
});

test('een gezin zonder adres krijgt geen code', async () => {
  const w = wereld();
  await assert.rejects(w.code.geef(null, 'b'), /vereist een gezin/);
  await assert.rejects(w.code.geef({ id: 'g9' }, 'b'), /vereist een gezin/);
});

test('roteren met dezelfde sleutel is een herhaling, zonder kale code en zonder tweede rotatie', async () => {
  const w = wereld();
  const eerste = await w.code.geef(w.G().ABC234, 'b');
  const a = await w.code.geef(w.G().ABC234, 'b', { idem: '  sleutel-1  ' });
  assert.match(a, /^GC\./);
  assert.notEqual(a, eerste);
  const weer = await w.code.geef(w.G().ABC234, 'b', { idem: 'sleutel-1' });
  assert.deepEqual(weer, { herhaald: true });
  assert.equal(w.code.vind(a), 'ABC234', 'de gedeelde code leeft nog');
  assert.equal(w.code.publiek('ABC234').rotatie, 2);
  /* een andere beheerder met dezelfde sleutel is een nieuwe opdracht */
  const ander = await w.code.geef(w.G().ABC234, 'c', { idem: 'sleutel-1' });
  assert.match(ander, /^GC\./);
  assert.equal(w.code.vind(a), null);
  /* zonder sleutel wordt er geen laatste rotatie onthouden bij een nieuw gezin */
  const x = await w.code.geef(w.G().XYZ789, 'b', { idem: '   ' });
  assert.match(x, /^GC\./);
  assert.equal(w.db.data[C.COLLECTIE].XYZ789.laatste_rotatie, undefined);
  assert.ok(w.db.data[C.COLLECTIE].ABC234.laatste_rotatie.idem_hash);
});

test('zonder beheerder wordt een volgende code een verse code en geen vernieuwing', async () => {
  const w = wereld();
  await w.code.geef(w.G().ABC234, 'b');
  const vers = await w.code.geef(w.G().ABC234, '');
  assert.equal(w.code.vind(vers), 'ABC234');
  const rij = w.db.data[C.COLLECTIE].ABC234;
  assert.equal(rij.uitgegeven_door, '');
  assert.equal(w.code.publiek('ABC234').rotatie, 1, 'een verse code begint opnieuw te tellen');
});

test('intrekken en vergeten van wat er niet is, geeft false', async () => {
  const w = wereld();
  assert.equal(await w.code.intrek('GEEN00', 'b'), false);
  assert.equal(await w.code.intrek(null, 'b'), false);
  assert.equal(await w.code.vergeet('GEEN00'), false);
  assert.equal(await w.code.vergeet(undefined), false);
  await w.code.geef(w.G().ABC234, 'b');
  assert.equal(await w.code.intrek('ABC234', 'b'), true, 'zonder reden krijgt het intrekken de standaardreden');
  assert.equal(w.code.publiek('ABC234').stand, 'ongeldig');
  assert.ok(w.code.publiek('ABC234').ingetrokken);
});

test('het publieke beeld: actief, geen gezin, of een onderwerp dat niet meer klopt', async () => {
  const w = wereld();
  await w.code.geef(w.G().ABC234, 'b');
  const actief = w.code.publiek('ABC234');
  assert.equal(actief.stand, 'actief');
  assert.equal(actief.reden, null);
  assert.equal(actief.gebruikt, 0);
  assert.equal(actief.maxGebruik, C.MAX_GEBRUIK);
  w.G().ABC234.id = 'ander-gezin';
  assert.equal(w.code.publiek('ABC234').reden, 'onderwerp');
  delete w.G().ABC234;
  assert.equal(w.code.publiek('ABC234').reden, 'geen-gezin');
  assert.match(w.code.publiek(null).reden, /nog geen gezinscode/);
});

test('zonder gezinnenbron kent de code geen gezin en opent hij niets', async () => {
  const w = wereld({ G: null });
  const raw = await w.code.geef({ id: 'g1', code: 'ABC234' }, 'b');
  assert.equal(w.code.vind(raw), null);
  assert.equal(w.code.publiek('ABC234').reden, 'geen-gezin');
  assert.equal(await w.code.claim(raw, 'ABC234'), false);
  /* een gezin zonder id heeft een leeg id in het onderwerp, en dat klopt dan */
  const z = wereld({ G: () => ({ ZON000: { code: 'ZON000' } }) });
  const r = await z.code.geef({ code: 'ZON000' }, 'b');
  assert.equal(z.code.vind(r), 'ZON000');
  assert.equal(await z.code.claim(r, 'ZON000'), true);
  assert.equal(await z.code.claim(r, null), false);
});
