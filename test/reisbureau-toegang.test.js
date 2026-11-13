'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakReisToegang } = require('../server/kern/reisbureau-toegang');
const staffSessie = require('../server/accounts/staff-sessie');
const maakTenantRegister = require('../server/kern/tenant/register');

function huis() {
  const account = { id: 7, actief: 1, sessies_vanaf: 0 };
  const staff = { id: 4, supplier_code: 'REIS-A', member_id: 7, active: 1, role: 'manager' };
  const supplier = { code: 'REIS-A', name: 'Eigen reisbedrijf', type: 'reisbureau', partnerStatus: 'actief' };
  const sess = { role: 'supplier', code: supplier.code, staffId: staff.id, lid: account.id,
    lidKey: 'user-7', lidInlogOp: 100, manager: true, staffRole: 'manager' };
  const accounts = {
    getStaffById: id => id === staff.id && staff.active === 1 ? staff : null,
    getUserById: id => id === account.id ? account : null,
    isActief: row => !!row && row.actief === 1,
    legacyStaffPinToegestaan: () => false
  };
  accounts.controleerStaffSessie = value => staffSessie.controleer(accounts, value);
  const db = { data: { tenants: {}, werkruimtes: {} } };
  const register = maakTenantRegister({ db, save: () => {}, schoon: (v, max) => String(v || '').slice(0, max),
    findSupplier: code => code === supplier.code ? supplier : null });
  assert.equal(register.zet({ org: 'ORG-A', naam: 'Eigen reisbedrijf' }).ok, true);
  assert.equal(register.bind('ORG-A', 'zaak', supplier.code, true).ok, true);
  const lifecycle = { stand: 'actief' };
  const kern = { accounts, tenant: { register, levensloop: { stand: org => org === 'ORG-A' ? lifecycle : null } },
    sessionFor: token => token === 'persoonlijke-werksessie' ? sess : null,
    findSupplier: code => code === supplier.code ? supplier : null,
    boardroomWie: req => req && req.get('authorization') === 'Bearer persoonlijk-kantoor' ? 'user-7' : null };
  const request = () => ({ get: () => 'Bearer persoonlijke-werksessie', supplier: { ...supplier },
    actor: { staffId: staff.id, manager: true, role: 'manager', lid: 7, lidKey: 'user-7' }, body: {} });
  return { kern, toegang: maakReisToegang(kern), request, staff, account, sess, supplier, register, lifecycle };
}

test('het zelfstandige bureau gebruikt org uit de bestaande tenantspine en actor uit de actieve personeelsplek', () => {
  const h = huis(), req = h.request();
  req.body = { org: 'RTG', supplierCode: 'ANDER', actorRef: 'user-99', manager: true };
  const uit = h.toegang.partner(req);
  assert.deepEqual(uit, { org: 'ORG-A', supplierCode: 'REIS-A', actorRef: 'user-7', role: 'manager' });
  assert.ok(Object.isFrozen(uit));
  assert.equal(h.register.haal('ORG-A').zaken[0], 'REIS-A');
});

test('een aanbieder kan de eigen uitvoering behandelen, maar verkrijgt geen reisbureauverkooprecht', () => {
  const h = huis();
  h.supplier.type = 'hotel';
  assert.equal(h.toegang.partner(h.request()).status, 403);
  assert.deepEqual(h.toegang.aanbieder(h.request()),
    { org: 'ORG-A', supplierCode: 'REIS-A', actorRef: 'user-7', role: 'manager' });
});

test('demotie werkt direct ondanks een oude managersessie en vervalste actor/body', () => {
  const h = huis(), req = h.request();
  assert.equal(h.toegang.partner(req).org, 'ORG-A');
  h.staff.role = 'staff';
  req.body.role = 'manager';
  assert.equal(h.sess.manager, true);
  assert.equal(h.toegang.partner(req).status, 403);
  assert.equal(h.toegang.aanbieder(req).status, 403);
});

test('uitdiensttreding, accountintrekking en sessie-intrekking sluiten ook een eerder geopende reiswerkplek', () => {
  for (const verander of [h => { h.staff.active = 0; }, h => { h.account.actief = 0; },
    h => { h.account.sessies_vanaf = 101; }, h => { h.staff.member_id = 9; }]) {
    const h = huis(), req = h.request();
    assert.equal(h.toegang.partner(req).org, 'ORG-A');
    verander(h);
    assert.equal(h.toegang.partner(req).status, 401);
  }
});

test('de poort vraagt zowel de bestaande leverancierspoort als een actuele persoonlijke sessie', () => {
  for (const verander of [req => { req.supplier.code = 'ANDER'; }, req => { delete req.actor; },
    req => { req.actor.staffId = 99; }, req => { delete req.supplier; }]) {
    const h = huis(), req = h.request(); verander(req);
    assert.equal(h.toegang.partner(req).status, 403);
  }
  const h = huis();
  assert.equal(h.toegang.partner({ ...h.request(), get: () => 'Bearer vervalst' }).status, 401);
  assert.equal(h.toegang.partner(null).status, 401);
  h.kern.accounts.legacyStaffPinToegestaan = () => true;
  delete h.sess.staffId; delete h.sess.lid; delete h.sess.lidKey;
  assert.equal(h.toegang.partner(h.request()).status, 403);
});

test('tenantbinding, sluiting en lifecycle worden bij iedere handeling opnieuw gelezen', () => {
  const h = huis(), req = h.request();
  h.lifecycle.stand = 'opzegging';
  assert.equal(h.toegang.partner(req).org, 'ORG-A', 'tijdens afgesproken uitloop werkt de zaak nog');
  for (const stand of ['bewaring', 'vernietigd', 'onbekend']) {
    h.lifecycle.stand = stand;
    assert.equal(h.toegang.partner(req).status, 403, stand);
  }
  h.lifecycle.stand = 'actief';
  h.register.zet({ org: 'ORG-A', actief: false });
  assert.equal(h.toegang.partner(req).status, 403);
  h.register.zet({ org: 'ORG-A', actief: true });
  h.register.bind('ORG-A', 'zaak', 'REIS-A', false);
  assert.equal(h.toegang.partner(req).status, 403, 'een oude sessie bewaart geen verwijderde tenantbinding');
});

test('een gesloten of vervangen zaak kan geen contract uitvoeren via een oud requestobject', () => {
  for (const stand of ['geschorst', 'beeindigd']) {
    const h = huis(), req = h.request();
    h.supplier.partnerStatus = stand;
    assert.equal(h.toegang.partner(req).status, 403);
  }
  const h = huis(), req = h.request();
  h.kern.findSupplier = () => null;
  assert.equal(h.toegang.partner(req).status, 403);
});

test('kantoor gebruikt het bestaande officeAuth-bewijs en een persoonlijk actief account', () => {
  const h = huis();
  const req = { officeKey: 'user-7', get: () => 'Bearer persoonlijk-kantoor', body: { org: 'ORG-A', actorRef: 'user-99' } };
  assert.deepEqual(h.toegang.kantoor(req), { org: 'rtg', actorRef: 'user-7', role: 'kantoor' });
  assert.equal(h.toegang.kantoor({ ...req, officeKey: null }).status, 403);
  assert.equal(h.toegang.kantoor({ ...req, officeKey: 'user-99' }).status, 403);
  assert.equal(h.toegang.kantoor({ ...req, get: () => 'Bearer gedeelde-code' }).status, 403);
  assert.equal(h.toegang.kantoor(null).status, 403);
  h.account.actief = 0;
  assert.equal(h.toegang.kantoor(req).status, 401);
});

test('ontbrekende Authority- of tenantbouwstenen vallen gesloten', () => {
  assert.equal(maakReisToegang({}).kantoor(null).status, 503);
  assert.equal(maakReisToegang({}).partner(null).status, 503);
  const h = huis();
  h.kern.tenant.levensloop = null;
  assert.equal(h.toegang.aanbieder(h.request()).status, 503);
});

test('de klant kiest alleen de ontvanger; een lege keuze wijst expliciet naar RTG Travel', () => {
  const h = huis();
  for (const code of [null, undefined, '', ' '])
    assert.deepEqual(h.toegang.ontvanger(code), { org: 'rtg', supplierCode: null, naam: 'RTG Travel' });
  assert.deepEqual(h.toegang.ontvanger(' reis-a '),
    { org: 'ORG-A', supplierCode: 'REIS-A', naam: 'Eigen reisbedrijf' });
  const doel = h.toegang.ontvanger('REIS-A');
  assert.equal(doel.actorRef, undefined, 'een keuze levert geen medewerkerbevoegdheid');
  assert.equal(doel.role, undefined);
  assert.equal(h.toegang.ontvanger({ org: 'ORG-A' }).status, 400);
  assert.equal(h.toegang.ontvanger('ORG-A').status, 403, 'de org is geen zaakselectie');
});

test('de ontvangerkeuze weigert een andere genre, gesloten zaak, niet-actieve tenant of ontbrekende spine', () => {
  for (const verander of [h => { h.supplier.type = 'hotel'; },
    h => { h.supplier.partnerStatus = 'geschorst'; },
    h => { h.register.zet({ org: 'ORG-A', actief: false }); },
    h => { h.lifecycle.stand = 'bewaring'; },
    h => { h.register.bind('ORG-A', 'zaak', 'REIS-A', false); }]) {
    const h = huis(); verander(h);
    assert.equal(h.toegang.ontvanger('REIS-A').status, 403);
  }
  assert.equal(maakReisToegang({}).ontvanger('REIS-A').status, 503);
});

test('een offerteregel kan een actieve leverancier aanwijzen zonder medewerkersbevoegdheid te verkrijgen', () => {
  const h = huis();
  h.supplier.type = 'hotel';
  assert.deepEqual(h.toegang.leverancier(' reis-a '),
    { org: 'ORG-A', supplierCode: 'REIS-A', naam: 'Eigen reisbedrijf' });
  assert.equal(h.toegang.leverancier('REIS-A').actorRef, undefined);
  for (const code of [null, undefined, '', ' ', 1, {}, []])
    assert.equal(h.toegang.leverancier(code).status, 400);
  h.lifecycle.stand = 'bewaring';
  assert.equal(h.toegang.leverancier('REIS-A').status, 403);
});
