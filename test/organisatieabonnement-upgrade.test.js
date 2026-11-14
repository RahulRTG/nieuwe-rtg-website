'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { fixture } = require('./organisatieabonnement-fixture.cjs');
const { maakAanbod } = require('../server/kern/aanmeldingen/abonnementsaanbod-vorm');
function opvolger(f) {
  const oud = f.c(), c = { ...f.kopie(oud), id: 'org-c-2' };
  delete c.organisatieCode;
  const verrekening = { ok: true, bronContractId: oud.id, regels: [], creditCenten: 0,
    overCenten: 0, teBetalenCenten: oud.aanbod.prijs.termijn.brutoCenten };
  c.aanbod = maakAanbod(c, { prijs: oud.aanbod.prijs, scope: oud.aanbod.scope,
    at: f.stand.at, opdracht: 'upgrade', verrekening });
  c.verrekening = { ...verrekening, status: 'GERESERVEERD' };
  return c;
}
test('alleen de expliciet gekozen voorganger passeert preflight; pas exacte gesloten bron passeert activering', async () => {
  const f = fixture(); await f.motor.provisioneerAutomatisch(f.c().id);
  const c = opvolger(f); f.db.data.contracten.push(c);
  assert.equal(f.org.controle(c, { voorstel: true }).ok, true);
  assert.equal(f.org.controle(c).ok, false);
  const oud = f.c(); oud.status = 'GEEINDIGD'; oud.eindigtOp = c.activering.at; oud.vervangenDoor = c.id;
  c.verrekening.status = 'TOEGEPAST'; c.organisatieCode = 'ORG-1';
  assert.equal(f.org.controle(c).ok, true);
  assert.equal(f.org.vanOrganisatie('ORG-1').contract.id, c.id);
  assert.ok(f.zaakAbonnement.lijst().every(r => r.contractId === c.id));
  c.verrekening.bronContractId = 'verzonnen';
  assert.equal(f.org.vanOrganisatie('ORG-1').ok, false, 'oude bron mag niet uit de keten verdwijnen');
});
test('een tweede bestaande zaakovereenkomst kan niet in één bronupgrade verdwijnen', async () => {
  const f = fixture(); await f.motor.provisioneerAutomatisch(f.c().id);
  const c = opvolger(f); f.db.data.contracten.push(c);
  f.db.data.contracten.push({ id: 'lite-2', accountId: 1, status: 'ACTIEF' });
  f.db.data.zaakAbonnement['ZAAK-B'] = { pas: 'business-lite', contractId: 'lite-2' };
  assert.equal(f.org.controle(c, { voorstel: true }).ok, false);
  assert.equal(f.zaakAbonnement.magDienst('ZAAK-A', { nieuweBetaaldeDienst: true }), false);
});
test('een echt geëindigd los contract geeft geen dubbele lopende betaalverplichting', async () => {
  const f = fixture();
  f.db.data.contracten.push({ id: 'lite-oud', accountId: 1, status: 'GEEINDIGD', eindigtOp: '2026-11-12T00:00:00.000Z' });
  f.db.data.zaakAbonnement['ZAAK-B'] = { pas: 'business-lite', contractId: 'lite-oud' };
  assert.equal(f.org.controle(f.c(), { voorstel: true }).ok, true);
  assert.equal((await f.motor.provisioneerAutomatisch(f.c().id)).ok, true);
  assert.equal(f.zaakAbonnement.van('ZAAK-B').pas, 'business');
  assert.equal(f.db.data.zaakAbonnement['ZAAK-B'].contractId, 'lite-oud', 'geen stille historische mutatie');
});
test('normaal geëindigde organisatiehistorie verhindert geen nieuwe overeenkomst zonder upgradeclaim', async () => {
  const f = fixture(); await f.motor.provisioneerAutomatisch(f.c().id);
  const oud = f.c(), nieuw = { ...f.kopie(oud), id: 'org-opnieuw' };
  nieuw.aanbod = maakAanbod(nieuw, { prijs: oud.aanbod.prijs, scope: oud.aanbod.scope,
    at: f.stand.at, opdracht: 'opnieuw', verrekening: oud.aanbod.verrekening });
  oud.status = 'GEEINDIGD'; oud.eindigtOp = '2026-11-12T00:00:00.000Z';
  f.db.data.contracten.push(nieuw);
  assert.equal(f.org.controle(nieuw).ok, true);
  assert.equal(f.org.vanOrganisatie('ORG-1').contract.id, nieuw.id);
  assert.equal(f.zaakAbonnement.van('ZAAK-A').contractId, nieuw.id);
  nieuw.status = 'GEEINDIGD'; nieuw.eindigtOp = f.stand.at;
  assert.equal(f.org.vanOrganisatie('ORG-1').contract.id, nieuw.id);
  assert.equal(f.zaakAbonnement.magDienst('ZAAK-A', { nieuweBetaaldeDienst: true }), false);
});
test('tenantlezer vereist exacte unieke sleutel en binding, ook voor werkruimtes', () => {
  const f = fixture(), lees = require('../server/kern/tenant/lezen')({ db: f.db });
  assert.equal(lees.haal('org-1').org, 'ORG-1'); assert.equal(lees.vanWerkruimte('w1').org, 'ORG-1');
  f.db.data.tenants['ORG-2'].werkruimtes.push('W1'); assert.equal(lees.vanWerkruimte('W1'), null);
  f.db.data.tenants.ALIAS = f.kopie(f.db.data.tenants['ORG-1']); assert.equal(lees.haal('ORG-1'), null);
  delete f.db.data.tenants['ORG-1']; assert.equal(lees.haal('ORG-1'), null, 'geen waarde onder verkeerde sleutel vertrouwen');
});
test('tweede pending organisatieaanbod blokkeert vóór inning, niet de bestaande rechten tijdens één eigen upgrade', async () => {
  const f = fixture(); await f.motor.provisioneerAutomatisch(f.c().id);
  const c = opvolger(f); c.status = 'AANGEBODEN'; f.db.data.contracten.push(c);
  assert.equal(f.org.controle(c, { voorstel: true }).ok, true);
  assert.equal(f.org.vanOrganisatie('ORG-1').ok, true, 'voorstel schorst de lopende afspraak niet');
  const tweede = { ...f.kopie(c), id: 'org-ander-account', accountId: 2 };
  tweede.aanbod = maakAanbod(tweede, { prijs: c.aanbod.prijs, scope: c.aanbod.scope,
    at: f.stand.at, opdracht: 'ander', verrekening: { ...c.aanbod.verrekening, bronContractId: null } });
  f.db.data.contracten.push(tweede);
  assert.equal(f.org.controle(tweede, { voorstel: true }).ok, false);
  assert.equal(f.org.controle(c, { voorstel: true }).ok, false);
  assert.equal(f.org.vanOrganisatie('ORG-1').ok, true);
  tweede.status = 'GEEINDIGD';
  assert.equal(f.org.controle(c, { voorstel: true }).ok, true, 'ingetrokken voorstel is geen lopende verplichting');
});
