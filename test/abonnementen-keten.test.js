'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { keten } = require('./abonnementen-keten-fixture.cjs');
const { body } = require('./abonnementsaanbod-fixture.cjs');

test('aanbod, ondertekening, hosted betaling en bevestiging activeren exact eenmaal', async () => {
  const f = keten(), id = await f.getekend();
  assert.equal(f.users.get(1).tier, 'guest');
  const p = await f.service.betaal(1, { contractId: id });
  assert.equal(p.status, 'WACHT_OP_KLANT'); assert.match(p.checkoutUrl, /^https:/);
  assert.equal(f.dossiers.get(1).invoices.length, 1); assert.equal(f.users.get(1).tier, 'guest');
  assert.equal(f.service.mijn(1).contracten[0].betaalstand.checkoutUrl, p.checkoutUrl);
  f.stand.at = '2026-11-13T10:02:00.000Z'; f.bevestig();
  assert.equal((await f.service.herstel(1, { contractId: id })).ok, true);
  const c = f.db.data.contracten[0];
  assert.equal(c.status, 'ACTIEF'); assert.equal(c.startAt, f.stand.at);
  assert.equal(f.users.get(1).tier, 'rtg'); assert.ok(c.activering.rechtenAt);
  assert.equal(f.dossiers.get(1).invoices[0].status, 'paid');
  assert.ok(Object.values(f.db.data.betaalWaarheid)[0].afgehandeldAt);
  await f.service.herstel(1, { contractId: id });
  assert.equal(f.stand.providerCalls, 1); assert.equal(f.dossiers.get(1).invoices.length, 1);
});

test('onbekend providerantwoord bewaart oorspronkelijke opdracht en hergebruikt sleutel', async () => {
  const f = keten(), id = await f.getekend(); f.stand.providerFout = true;
  await assert.rejects(f.service.betaal(1, { contractId: id }), /Providerantwoord/);
  assert.equal(f.providers.size, 1); assert.equal(f.users.get(1).tier, 'guest');
  f.stand.providerFout = false; await f.service.herstel(1, { contractId: id });
  assert.equal(f.providers.size, 1); assert.equal(f.dossiers.get(1).invoices.length, 1);
});

test('onzekere accountcommit wordt hervat voordat de provider wordt benaderd', async () => {
  const f = keten(), id = await f.getekend(); f.stand.accountAntwoordFout = true;
  await assert.rejects(f.service.betaal(1, { contractId: id }), /accountcommit/);
  assert.equal(f.dossiers.get(1).invoices.length, 1); assert.equal(f.stand.providerCalls, 0);
  await f.service.betaal(1, { contractId: id });
  assert.equal(f.dossiers.get(1).invoices.length, 1); assert.equal(f.stand.providerCalls, 1);
});

test('rechtenfout na betaalde factuur laat activatie herstelbaar zonder tweede betaling', async () => {
  const f = keten(), id = await f.getekend(); await f.service.betaal(1, { contractId: id });
  f.bevestig(); f.stand.rechtenFout = true;
  await assert.rejects(f.service.herstel(1, { contractId: id }));
  assert.equal(f.dossiers.get(1).invoices[0].status, 'paid');
  assert.equal(f.users.get(1).tier, 'guest');
  f.stand.rechtenFout = false;
  await f.service.herstel(1, { contractId: id });
  assert.equal(f.users.get(1).tier, 'rtg'); assert.equal(f.stand.providerCalls, 1);
});

test('de maandronde int de volgende termijn op dezelfde toestemming; geen vroege of dubbele termijn', async () => {
  const f = keten(), id = await f.getekend();
  await f.service.betaal(1, { contractId: id }); f.bevestig(); await f.service.herstel(1, { contractId: id });
  await f.service.ronde(); assert.equal(f.providers.size, 1);
  f.stand.at = '2026-12-13T10:00:00.000Z';
  const r = await f.service.ronde(); assert.deepEqual(r.fouten, []);
  assert.equal(f.providers.size, 2); assert.equal(f.dossiers.get(1).invoices.length, 2);
  const w = Object.values(f.db.data.betaalWaarheid).find(w => w.context.termijn === 2);
  assert.equal(w.start.terugkerend.modus, 'innen'); assert.equal(w.start.terugkerend.customerId, 'cus_fixture');
  await f.service.ronde(); assert.equal(f.providers.size, 2);
});

test('vervalsen, andermans contract en alleen tekenen beginnen geen provideropdracht', async () => {
  const f = keten(), id = await f.getekend();
  await f.service.ronde(); assert.equal(f.providers.size, 0);
  assert.equal((await f.service.betaal(2, { contractId: id })).status, 404);
  f.db.data.contracten[0].aanbod.prijs.termijn.brutoCenten = 1;
  await assert.rejects(f.service.betaal(1, { contractId: id }), /ondertekening/);
  assert.equal(f.providers.size, 0);
});

test('directe upgrade verrekent betaalde halve maand en sluit alleen het juiste broncontract', async () => {
  const f = keten(), oud = await f.getekend();
  await f.service.betaal(1, { contractId: oud }); f.bevestig(); await f.service.herstel(1, { contractId: oud });
  f.stand.at = '2026-11-28T10:00:00.000Z';
  f.db.data.aanmeldingen.unshift({ id: 'lifestyle-1', pas: 'lifestyle', accountId: 1, status: 'geaccepteerd',
    besluit: { besluit: 'geaccepteerd', door: 'Bevoegd medewerker', at: f.stand.at } });
  const id = await f.getekend({ pas: 'lifestyle', aanmeldingId: 'lifestyle-1' });
  assert.equal(f.db.data.contracten.find(c => c.id === id).aanbod.verrekening.creditCenten, 12500);
  await f.service.betaal(1, { contractId: id });
  const w = Object.values(f.db.data.betaalWaarheid).find(w => w.context.contractId === id);
  assert.equal(w.centen, 1987500); assert.equal(f.users.get(1).tier, 'rtg');
  f.bevestig(); await f.service.herstel(1, { contractId: id });
  assert.equal(f.db.data.contracten.find(c => c.id === oud).status, 'GEEINDIGD');
  assert.equal(f.db.data.contracten.find(c => c.id === id).status, 'ACTIEF');
  assert.equal(f.users.get(1).tier, 'lifestyle');
  await f.service.afgewikkeld(1, oud, 1);
  assert.equal(f.users.get(1).tier, 'lifestyle');
  const aantal = f.db.data.contracten.length;
  const lager = await f.service.aanbod(1, body({ pas: 'rtg', frequentie: 'maand' }));
  assert.equal(lager.status, 409); assert.match(lager.error, /lagere pas/);
  assert.equal(f.db.data.contracten.length, aantal);
  assert.equal(f.db.data.contracten.find(c => c.id === id).status, 'ACTIEF');
});

test('volledig verrekende eerste termijn gebruikt setup zonder fakecent en bewaart overschot', async () => {
  const f = keten(), oud = await f.getekend({ frequentie: 'jaar' });
  await f.service.betaal(1, { contractId: oud }); f.bevestig(); await f.service.herstel(1, { contractId: oud });
  f.stand.at = '2026-11-14T10:00:00.000Z';
  const id = await f.getekend(), c = f.db.data.contracten.find(c => c.id === id);
  assert.ok(c.aanbod.verrekening.overCenten > 25000);
  await f.service.betaal(1, { contractId: id });
  assert.equal(f.providers.size, 1); assert.equal(f.stand.setupCalls, 1);
  assert.equal(Object.keys(f.db.data.betaalWaarheid).length, 1);
  await f.service.herstel(1, { contractId: id });
  assert.equal(f.db.data.contracten.find(c => c.id === id).status, 'ACTIEF');
  const factuur = f.dossiers.get(1).invoices.find(i => i.abonnement.contractId === id);
  assert.equal(factuur.bijdrage, 0); assert.equal(factuur.status, 'paid');
  assert.equal(factuur.betaalBewijzen, undefined); assert.equal(factuur.verrekend.creditCenten, 25000);
  f.stand.at = '2026-12-14T10:00:00.000Z';
  assert.deepEqual((await f.service.ronde()).fouten, []); assert.equal(f.providers.size, 1);
  assert.equal(f.db.data.lidmaatschapBetalingen.find(r => r.contractId === id).termijnen[1].status, 'voldaan');
});

test('verlate upgradebetaling blijft betaalbewijs maar activeert geen versleten verrekenofferte', async () => {
  const f = keten(), oud = await f.getekend();
  await f.service.betaal(1, { contractId: oud }); f.bevestig(); await f.service.herstel(1, { contractId: oud });
  f.stand.at = '2026-11-28T10:00:00.000Z'; const id = await f.getekend();
  await f.service.betaal(1, { contractId: id });
  f.stand.at = '2026-11-28T10:16:00.000Z'; f.bevestig();
  await assert.rejects(f.service.herstel(1, { contractId: id }));
  assert.equal(f.db.data.contracten.find(c => c.id === oud).status, 'ACTIEF');
  assert.equal(f.db.data.contracten.find(c => c.id === id).status, 'GEACCEPTEERD');
  assert.equal(f.dossiers.get(1).invoices.find(i => i.abonnement.contractId === id).status, 'paid');
  assert.equal(f.providers.size, 2);
});
