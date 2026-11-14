'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { fixture } = require('./organisatieabonnement-fixture.cjs');
const nieuw = { nieuweBetaaldeDienst: true };

test('één bewezen Business-overeenkomst bedient twee gebonden zaken zonder tenant-, zaak- of personeelsmutatie', async () => {
  const f = fixture(), tenants = f.kopie(f.db.data.tenants), suppliers = f.kopie(f.db.data.suppliers);
  assert.equal(f.org.vanOrganisatie('ORG-1'), null);
  const r = await f.motor.provisioneerAutomatisch(f.c().id);
  assert.equal(r.ok, true); assert.equal(r.organisatieCode, 'ORG-1'); assert.equal(r.staffId, undefined);
  assert.equal(f.c().organisatieCode, 'ORG-1'); assert.equal(f.c().zaakCode, undefined);
  assert.deepEqual(f.db.data.tenants, tenants); assert.deepEqual(f.db.data.suppliers, suppliers);
  assert.deepEqual(f.db.data.zaakAbonnement, {}); assert.equal(f.stand.staff, 0);
  for (const code of ['ZAAK-A', 'ZAAK-B']) {
    assert.equal(f.zaakAbonnement.van(code).herkomst, 'organisatie');
    assert.equal(f.zaakAbonnement.van(code).contractId, f.c().id);
    assert.equal(f.zaakAbonnement.mag(code, 'can_use_enterprise_governance'), true);
  }
  assert.equal(f.zaakAbonnement.van('BUUR').herkomst, 'voor-de-ladder');
  assert.equal(f.org.vanOrganisatie('ORG-2'), null);
  assert.equal(f.zaakAbonnement.zonderAbonnement(['ZAAK-A', 'ZAAK-B', 'BUUR']).aantal, 1);
  assert.equal((await f.motor.provisioneerAutomatisch(f.c().id)).ok, true);
  assert.equal(f.stand.saves, 1, 'retry verandert niets');
  assert.equal(f.zaakAbonnement.zet('ZAAK-A', 'business-lite', 'handmatig').status, 409);
});

test('zonder bewezen activering of exacte menselijke organisatiekeuze ontstaan geen rechten of mutaties', async () => {
  for (const wijzig of [f => { delete f.c().activering; }, f => { f.c().status = 'AANGEBODEN'; },
    f => { f.a().besluit.organisatie = 'ORG-2'; }, f => { f.a().besluit.door = 'AI'; },
    f => { f.c().aanbod.scope.code = 'ORG-2'; }, f => { f.c().organisatieCode = 'ORG-2'; },
    f => { f.db.data.tenants['ORG-1'].actief = false; }]) {
    const f = fixture(); wijzig(f); const voor = f.kopie(f.db.data);
    assert.ok((await f.motor.provisioneerAutomatisch(f.c().id)).error);
    assert.deepEqual(f.db.data, voor); assert.equal(f.stand.staff, 0);
  }
});

test('los zaakabonnement en tweede lopend orgcontract worden niet ongemerkt dubbel geïnd', async () => {
  for (const wijzig of [f => { f.db.data.zaakAbonnement['ZAAK-B'] = { pas: 'business-lite', door: 'oud' }; },
    f => { f.db.data.zaakAbonnement['ZAAK-B'] = { pas: 'business-lite', contractId: 'lite' };
      f.db.data.contracten.push({ id: 'lite', status: 'ACTIEF', accountId: 1 }); },
    f => { f.db.data.contracten.push({ ...f.kopie(f.c()), id: 'ander', organisatieCode: 'ORG-1' }); }]) {
    const f = fixture(); wijzig(f); const voor = f.kopie(f.db.data);
    assert.equal((await f.motor.provisioneerAutomatisch(f.c().id)).status, 409);
    assert.deepEqual(f.db.data, voor); assert.equal(f.org.controle(f.c(), { voorstel: true }).ok, false);
  }
});

test('organisatie-einde sluit nieuwe diensten voor beide zaken, niet basisrechten of bestaande rollen', async () => {
  const f = fixture(); await f.motor.provisioneerAutomatisch(f.c().id);
  f.c().status = 'OPZEGGEND'; f.c().eindigtOp = '2026-11-14T10:00:00.000Z';
  for (const code of ['ZAAK-A', 'ZAAK-B']) assert.equal(f.zaakAbonnement.magDienst(code, nieuw), true);
  f.stand.at = f.c().eindigtOp;
  assert.equal(f.diensten.organisatie('ORG-1', nieuw), false);
  for (const code of ['ZAAK-A', 'ZAAK-B']) {
    assert.equal(f.zaakAbonnement.magDienst(code, nieuw), false);
    assert.equal(f.zaakAbonnement.mag(code, 'can_use_pos'), true, 'nominale pas blijft voor afhandeling');
    for (const basisrecht of ['facturen', 'betalen', 'opzeggen', 'nazorg'])
      assert.equal(f.zaakAbonnement.magDienst(code, { ...nieuw, basisrecht }), true);
  }
  assert.equal(f.diensten.organisatie('ORG-2', nieuw), true);
  assert.equal(f.zaakAbonnement.magDienst('BUUR', nieuw), true);
});

test('gewijzigde of dubbel geclaimde tenantbinding geeft nooit buurtrechten', async () => {
  const f = fixture(); await f.motor.provisioneerAutomatisch(f.c().id);
  f.db.data.tenants['ORG-2'].zaken.push('ZAAK-A');
  assert.equal(f.zaakAbonnement.mag('ZAAK-A', 'can_use_enterprise_governance'), false);
  assert.equal(f.zaakAbonnement.magDienst('ZAAK-A', nieuw), false);
  assert.equal(f.zaakAbonnement.magDienst('ZAAK-A', { ...nieuw, basisrecht: 'betalen' }), true);
  const lees = require('../server/kern/tenant/lezen')({ db: { data: {} } });
  assert.equal(lees.haal('ORG-1'), null); assert.equal(lees.vanWerkruimte('W1'), null);
  const db = { data: {} }; require('../server/kern/tenant/lezen')({ db }).haal('ORG-1');
  assert.deepEqual(db.data, {}, 'lezen maakt geen tenants-collectie');
});

test('voorstelcontrole weigert org tijdens opzegging, zonder lopende basisrechten te herschrijven', () => {
  const f = fixture(); f.db.data.tenants['ORG-1'].levensloop = { stand: 'opzegging' };
  assert.equal(f.org.controle(f.c(), { voorstel: true }).ok, false);
});

test('31 kalenderdagen en betaalherstel gelden éénmaal voor de hele organisatie, nooit voor de buur', async () => {
  const f = fixture(); await f.motor.provisioneerAutomatisch(f.c().id);
  const { bw, meldingen } = await f.achterstand();
  assert.equal(f.db.data.notifications['user-1'].length, 1);
  assert.equal(meldingen.beoordeel(f.c()).stand, 'HERSTELTERMIJN');
  f.stand.at = f.c().herstel.herstelTot;
  assert.equal(f.diensten.organisatie('ORG-1', nieuw), true);
  f.stand.at = new Date(Date.parse(f.stand.at) + 1).toISOString();
  assert.equal(meldingen.beoordeel(f.c()).stand, 'BEPERKT');
  for (const code of ['ZAAK-A', 'ZAAK-B']) {
    assert.equal(f.zaakAbonnement.magDienst(code, nieuw), false);
    for (const basisrecht of ['facturen', 'betalen', 'opzeggen', 'nazorg'])
      assert.equal(f.zaakAbonnement.magDienst(code, { ...nieuw, basisrecht }), true);
  }
  assert.equal(f.diensten.organisatie('ORG-1', nieuw), false);
  assert.equal(f.diensten.organisatie('ORG-2', nieuw), true);
  assert.equal(f.zaakAbonnement.magDienst('BUUR', nieuw), true);
  bw.status = 'BEVESTIGD'; bw.afgehandeldAt = f.stand.at;
  assert.equal(f.diensten.organisatie('ORG-1', nieuw), true);
  for (const code of ['ZAAK-A', 'ZAAK-B']) assert.equal(f.zaakAbonnement.magDienst(code, nieuw), true);
  assert.equal(f.db.data.lidmaatschapBetalingen.length, 1, 'geen factuur per zaak');
});
