'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { keten } = require('./abonnementen-keten-fixture.cjs');
const { termijn } = require('../server/kern/aanmeldingen/abonnementstermijn');

test('getekend jaar vooruit wordt na twaalf maanden een maandtermijn, niet opnieuw een jaar', async () => {
  const f = keten(), id = await f.getekend({ frequentie: 'jaar' });
  await f.service.betaal(1, { contractId: id }); f.bevestig(); await f.service.herstel(1, { contractId: id });
  const c = f.db.data.contracten[0];
  assert.equal(c.aanbod.voorwaarden.jaarVervolg, 'maand');
  assert.match(c.aanbod.tekst, /maandprijs/);
  assert.equal(termijn(c, 1).brutoCenten, 287500);
  f.stand.at = '2027-11-13T09:59:59.999Z';
  assert.deepEqual((await f.service.ronde()).fouten, []);
  assert.equal(Object.keys(f.db.data.betaalWaarheid).length, 1);
  f.stand.at = '2027-11-13T10:00:00.000Z';
  assert.deepEqual((await f.service.ronde()).fouten, []);
  const t = f.db.data.lidmaatschapBetalingen[0].termijnen[1];
  assert.equal(t.brutoCenten, 25000);
  assert.equal(t.tot, '2027-12-13T10:00:00.000Z');
  assert.equal(t.frequentie, 'maand');
  const i = f.dossiers.get(1).invoices.find(i => i.abonnement.termijn === 2);
  assert.match(i.desc, /^Maandbijdrage/);
  f.bevestig(); await f.service.herstel(1, { contractId: id });
  f.stand.at = '2027-12-13T10:00:00.000Z';
  assert.deepEqual((await f.service.ronde()).fouten, []);
  assert.equal(f.db.data.lidmaatschapBetalingen[0].termijnen[2].brutoCenten, 25000);
  assert.equal(f.db.data.contracten[0].minimumMaanden, 12);
  assert.equal(f.db.data.contracten[0].periode, 1);
});

test('jaarvervolg bewaart credit over de tariefgrens en annuleert geen bestaande rechten stilzwijgend', async () => {
  const f = keten(), id = await f.getekend({ frequentie: 'jaar' });
  const c = f.db.data.contracten.find(c => c.id === id);
  // Pure rekenprojectie: het krediet is al elders gecontroleerd en gereserveerd.
  c.verrekening.creditCenten = 300000;
  assert.equal(termijn(c, 1).brutoCenten, 0);
  assert.equal(termijn(c, 2).creditCenten, 12500);
  assert.equal(termijn(c, 2).brutoCenten, 12500);
  assert.equal(termijn(c, 3).brutoCenten, 25000);
  delete c.aanbod.voorwaarden.jaarVervolg;
  assert.throws(() => termijn(c, 2), /geen maandelijkse vervolgafspraak/);
});

test('providerbevestigde nieuwe betaalmethode wordt gebruikt voor de volgende termijn', async () => {
  const f = keten(), id = await f.getekend();
  await f.service.betaal(1, { contractId: id }); f.bevestig(); await f.service.herstel(1, { contractId: id });
  f.stand.at = '2026-12-13T10:00:00.000Z'; await f.service.ronde(); f.bevestig();
  const haal = f.betaal.haalBetaalafspraak;
  f.betaal.haalBetaalafspraak = async o => ({ ...await haal(o), paymentMethodId: 'pm_hersteld' });
  await f.service.herstel(1, { contractId: id });
  assert.equal(f.db.data.contracten[0].betaalafspraak.paymentMethodId, 'pm_hersteld');
  assert.equal(f.db.data.contracten[0].betaalafspraak.termijnNr, 2);
  f.stand.at = '2027-01-13T10:00:00.000Z'; await f.service.ronde();
  const w = Object.values(f.db.data.betaalWaarheid).find(w => w.context.termijn === 3);
  assert.equal(w.start.terugkerend.paymentMethodId, 'pm_hersteld');
});
