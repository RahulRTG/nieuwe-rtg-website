/* DE PERSONEELSPLEK EN HET RTG-ACCOUNT ERACHTER (server/accounts/staff.js).

   Een personeelsplek is een sleutel tot de kassa en het rooster van een zaak.
   Sinds de persoonlijke accounts hoort er een echt RTG-account achter, en de
   koppeling tussen plek en lid gaat via claimStaffMember/releaseStaffMember --
   twee functies die geen enkele toets aanriep. De voorwaarden staan IN de
   UPDATE, zodat twee gelijktijdige claims nooit allebei winnen; dat is precies
   wat hier wordt nagelopen, op een echte tijdelijke kluis.

   Wat hier niet mag sneuvelen:
   1. een accountplek ontstaat alleen bij een bestaand, actief lid, en draagt
      een marker die geen pincode is: geen enkele pin opent hem;
   2. buiten de testomgeving geeft het huis geen viercijferige pin meer uit,
      reset hem niet en verzint hem niet;
   3. een vrije plek wordt door precies één lid geclaimd; een ander lid krijgt
      null en de eerste blijft eigenaar; herhalen door de eigenaar mag; een
      ongeldig lid of een gedeactiveerde plek claimt niets;
   4. alleen de huidige eigenaar maakt de plek los;
   5. deactiveren sluit elke weg (lijst, telling, positie, pin), maar de rij
      blijft voor de uitnodigingssaga vindbaar; publicStaff lekt geen hash.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in claimStaffMember `(member_id IS NULL OR member_id = ?)` vervangen door
     `1` -> "3." ZAKT (RAAK: het tweede lid kaapte de plek);
   - in releaseStaffMember `AND member_id = ?` weggehaald (met de parameter)
     -> "4." ZAKT (RAAK);
   - in verifyStaffPin `s.pin_hash === ACCOUNT_ONLY_HASH` weggehaald -> "1."
     blijft groen: verifyPassword weigert de marker zelf ook (gelijkwaardige
     verdedigingslaag, met opzet dubbel).

   Draai: node --test test/staff-plek-weerbaar.test.js */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-plek-'));
process.env.RTG_DATA_DIR = TMP;
delete process.env.RTG_MAGNAAT_TEST;
const accounts = require('../server/accounts');
accounts.init();
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

async function metTestPin(werk) {
  const oud = process.env.RTG_MAGNAAT_TEST;
  process.env.RTG_MAGNAAT_TEST = '1';
  try { return await werk(); } finally { if (oud === undefined) delete process.env.RTG_MAGNAAT_TEST; else process.env.RTG_MAGNAAT_TEST = oud; }
}
const lid = (n) => accounts.createUser({ email: 'lid' + n + '@plek.test', password: 'wachtwoord-123', tier: 'rtg', realName: 'Lid ' + n });

test('1. een accountplek vraagt een actief lid en heeft geen pin', async () => {
  const a = await lid(1);
  for (const m of [undefined, 0, -3, 1.5, 999999])
    assert.throws(() => accounts.createAccountStaff({ supplierCode: 'zaak1', name: 'X', memberId: m }), e => e.code === 'RTG_STAFF_ACCOUNT_REQUIRED');
  const uit = await lid(2); accounts.zetActief(uit.id, false);
  assert.throws(() => accounts.createAccountStaff({ supplierCode: 'zaak1', name: 'X', memberId: uit.id }), e => e.code === 'RTG_STAFF_ACCOUNT_REQUIRED');
  const s = accounts.createAccountStaff({ supplierCode: 'zaak1', name: 'Anna', role: 'manager', func: 'Bar', memberId: a.id });
  assert.deepEqual([s.supplier_code, s.role, s.func, s.member_id, s.pin_hash], ['ZAAK1', 'manager', 'Bar', a.id, accounts.ACCOUNT_ONLY_HASH]);
  await metTestPin(async () => {
    for (const pin of ['0000', accounts.ACCOUNT_ONLY_HASH, '']) assert.equal(await accounts.verifyStaffPin(s.id, pin), null);
  });
});

test('2. buiten de testomgeving geen pin uitgeven, resetten of verzinnen', async () => {
  const dicht = (e) => e.code === 'RTG_STAFF_PIN_GESLOTEN';
  await assert.rejects(accounts.createStaff({ supplierCode: 'zaak2', name: 'P', pin: '1234' }), dicht);
  assert.throws(() => accounts.createStaffSync({ supplierCode: 'zaak2', name: 'P', pin: '1234' }), dicht);
  assert.throws(() => accounts.createStaffZaai({ supplierCode: 'zaak2', name: 'P', pin: '1234' }), dicht);
  await assert.rejects(accounts.setStaffPin(1, '9999'), dicht);
  assert.throws(() => accounts.makePin(), dicht);
  assert.equal(accounts.countStaff('zaak2'), 0);
  const s = await metTestPin(() => accounts.createStaffSync({ supplierCode: 'zaak2', name: 'P', pin: '1234' }));
  assert.equal(await accounts.verifyStaffPin(s.id, '1234'), null, 'buiten de testomgeving opent ook een goede pin niets');
  await metTestPin(async () => {
    assert.equal((await accounts.verifyStaffPin(s.id, '1234')).id, s.id);
    assert.equal(await accounts.verifyStaffPin(s.id, '4321'), null);
    await accounts.setStaffPin(s.id, '5678');
    assert.equal(await accounts.verifyStaffPin(s.id, '1234'), null, 'na een reset werkt de oude pin niet meer');
    assert.match(accounts.makePin(), /^\d{4}$/);
  });
});

test('3+4. claimen door precies één lid; loslaten alleen door de eigenaar', async () => {
  const a = await lid(3), b = await lid(4);
  const s = await metTestPin(() => accounts.createStaffSync({ supplierCode: 'zaak3', name: 'Vrij', pin: '1111' }));
  for (const m of [0, -1, 'x', null]) assert.equal(accounts.claimStaffMember(s.id, m, 'rtg'), null);
  assert.equal(accounts.claimStaffMember(s.id, a.id, 'lifestyle-heel-lange-tiernaam').member_tier, 'lifestyle-heel-lange');
  assert.equal(accounts.claimStaffMember(s.id, b.id, 'rtg'), null, 'een tweede lid kaapt de plek niet');
  assert.equal(accounts.claimStaffMember(s.id, a.id).member_id, a.id, 'de eigenaar mag herhalen');
  assert.equal(accounts.staffByMember('zaak3', a.id).id, s.id);
  assert.equal(accounts.staffByMember('ZAAK3', b.id), null);
  assert.equal(accounts.staffByMember('zaak3', null), null);
  assert.deepEqual(accounts.staffPositions(a.id).map(p => p.id), [s.id]);
  assert.deepEqual(accounts.staffPositions(null), []);
  for (const m of [b.id, 0, 'x']) assert.equal(accounts.releaseStaffMember(s.id, m), false);
  assert.equal(accounts.getStaffById(s.id).member_id, a.id);
  assert.equal(accounts.releaseStaffMember(s.id, a.id), true);
  assert.equal(accounts.releaseStaffMember(s.id, a.id), false, 'al los');
  assert.equal(accounts.claimStaffMember(s.id, b.id, null).member_id, b.id, 'daarna is de plek vrij');
  assert.equal(accounts.setStaffMember(s.id, null, null).member_id, null);
  accounts.deactivateStaff(s.id);
  assert.equal(accounts.claimStaffMember(s.id, a.id, 'rtg'), null, 'een gedeactiveerde plek claimt niemand');
  assert.equal(accounts.releaseStaffMember(s.id, a.id), false);
});

test('5. deactiveren sluit elke weg; publicStaff lekt niets', async () => {
  const a = await lid(5);
  const s = accounts.createAccountStaff({ supplierCode: 'zaak5', name: 'Een naam die veel langer is dan zestig tekens en dus wordt afgekapt', memberId: a.id });
  assert.equal(s.name.length, 60);
  assert.equal(accounts.countStaff('ZAAK5'), 1);
  assert.equal(accounts.listStaff('zaak5').length, 1);
  const p = accounts.publicStaff(s);
  assert.deepEqual(Object.keys(p).sort(), ['func', 'id', 'lid', 'name', 'role']);
  assert.deepEqual([p.role, p.func, p.lid], ['staff', null, true]);
  assert.equal(accounts.publicStaff(null), null);
  assert.equal(accounts.deactivateStaffVanZaak('zaak5'), 1);
  assert.equal(accounts.deactivateStaffVanZaak(undefined), 0);
  assert.deepEqual([accounts.countStaff('zaak5'), accounts.listStaff('zaak5').length, accounts.staffPositions(a.id).length], [0, 0, 0]);
  assert.equal(accounts.getStaffById(s.id), null);
  assert.equal(accounts.getStaffByIdAny(s.id).active, 0, 'de rij blijft bestaan, gedeactiveerd');
  assert.equal(accounts.getStaffByIdAny(987654), null);
  assert.equal(accounts.activateStaff(s.id).id, s.id);
  assert.equal(accounts.countStaff(undefined), 0);
});
