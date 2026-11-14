'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { fixture } = require('./organisatieabonnement-fixture.cjs');
const { maakAanbod } = require('../server/kern/aanmeldingen/abonnementsaanbod-vorm');
const { abonnementsAanbod } = require('../server/kern/pasprijs');
function lite(f) {
  const c = { id: 'lite-nieuw', accountId: 1, aanmeldingId: 'lite-a', pas: 'business-lite', frequentie: 'maand',
    automatischAbonnement: true, status: 'ACTIEF', zaakCode: 'ZAAK-A', activering: { at: f.stand.at } };
  const prijs = abonnementsAanbod('business-lite', { frequentie: 'maand', btwProfiel: 'nl-21' });
  c.aanbod = maakAanbod(c, { prijs, at: f.stand.at, opdracht: 'eigen-lite',
    scope: { soort: 'zaak', code: 'ZAAK-A', capaciteiten: [] }, verrekening: { ok: true, bronContractId: null,
      regels: [], creditCenten: 0, overCenten: 0, teBetalenCenten: prijs.termijn.brutoCenten } });
  return c;
}
test('lopende, opzeggende, getekende en pending organisatieplicht blokkeren nieuwe individuele zaakplicht', () => {
  for (const status of ['CONCEPT', 'AANGEBODEN', 'GEACCEPTEERD', 'ACTIEF', 'VERLENGBAAR', 'OPZEGGEND']) {
    const f = fixture(); f.c().status = status;
    assert.equal(f.org.controleZaak('zaak-a').status, 409, status);
    assert.equal(f.org.controleZaak('ZAAK-B').status, 409, status);
    assert.equal(f.zaakAbonnement.zet('ZAAK-A', 'business-lite', 'nieuwe-betaalroute').status, 409);
    assert.deepEqual(f.db.data.zaakAbonnement, {});
    assert.equal(f.org.controleZaak('BUUR').ok, true);
  }
});
test('geen orgcontract en nog ongebonden zaak blijven mogelijk, zonder impliciete rol of credit', () => {
  const f = fixture(); f.db.data.contracten = [];
  const voor = f.kopie(f.db.data);
  assert.equal(f.org.controleZaak('ZAAK-A').ok, true);
  assert.equal(f.org.controleZaak(null).ok, true);
  assert.equal(f.org.controleZaak('NIEUW').ok, true);
  assert.deepEqual(f.db.data, voor);
  assert.equal(f.org.controleZaak({ code: 'ZAAK-A' }).ok, false);
});
test('normaal bewezen org-einde laat een nieuwe Lite-overeenkomst toe, geen omzetting van org of personeelsrollen', async () => {
  const f = fixture(); await f.motor.provisioneerAutomatisch(f.c().id);
  f.c().status = 'GEEINDIGD'; f.c().eindigtOp = f.stand.at;
  assert.equal(f.org.controleZaak('ZAAK-A').ok, true);
  const c = lite(f); f.db.data.contracten.push(c);
  const oud = f.kopie(f.c()), tenants = f.kopie(f.db.data.tenants);
  const r = f.zaakAbonnement.zet('ZAAK-A', 'business-lite', 'abonnement:' + c.id, c.id);
  assert.equal(r.ok, true); assert.equal(r.herkomst, 'vastgelegd'); assert.equal(r.pas, 'business-lite');
  assert.equal(f.zaakAbonnement.mag('ZAAK-A', 'can_use_enterprise_governance'), false);
  assert.equal(f.zaakAbonnement.magDienst('ZAAK-A', { nieuweBetaaldeDienst: true }), true);
  assert.equal(f.zaakAbonnement.magDienst('ZAAK-B', { nieuweBetaaldeDienst: true }), false);
  assert.equal(c.aanbod.verrekening.bronContractId, null); assert.equal(c.aanbod.verrekening.creditCenten, 0);
  assert.deepEqual(f.c(), oud); assert.deepEqual(f.db.data.tenants, tenants); assert.equal(f.stand.staff, 0);
});
test('ongeldig of toekomstig einde en replacement wijzen niet op vrije individuele zaakruimte', () => {
  for (const wijzig of [c => { c.eindigtOp = null; }, c => { c.eindigtOp = 'morgen'; },
    c => { c.eindigtOp = '2026-11-14T00:00:00.000Z'; }, c => { c.vervangenDoor = 'andere-org'; }]) {
    const f = fixture(); f.c().status = 'GEEINDIGD'; f.c().eindigtOp = f.stand.at; wijzig(f.c());
    assert.equal(f.org.controleZaak('ZAAK-A').status, 409);
  }
});
test('werkelijk vrijgegeven voorstel is geen organisatieplicht, administratief geëindigd zonder bewijs wel', () => {
  const f = fixture(); f.c().status = 'GEEINDIGD'; delete f.c().activering;
  assert.equal(f.org.controleZaak('ZAAK-A').status, 409);
  f.c().verrekening = { status: 'VRIJGEGEVEN' };
  f.c().intrekking = { at: f.stand.at, reden: 'eigen-voorstel-voor-betaalstart' };
  assert.equal(f.org.controleZaak('ZAAK-A').ok, true);
  f.c().activering = { at: f.stand.at };
  assert.equal(f.org.controleZaak('ZAAK-A').status, 409);
});
test('vreemde rekeninghouder, misvormde binding en dubbele tenant zijn geen overlapomweg', () => {
  const f = fixture(); f.c().accountId = 99;
  assert.equal(f.org.controleZaak('ZAAK-A').status, 409, 'dekking hangt niet van koper af');
  f.c().organisatieCode = 'ORG-1'; f.c().pas = 'rtg';
  assert.equal(f.org.controleZaak('ZAAK-A').status, 409, 'beschadigde orgbinding wordt niet genegeerd');
  f.db.data.tenants['ORG-2'].zaken.push('ZAAK-A');
  assert.equal(f.org.controleZaak('ZAAK-A').status, 409);
  f.db.data.contracten = [];
  assert.equal(f.org.controleZaak('ZAAK-A').status, 409, 'dubbele tenant eerst herstellen');
});
test('exact vervangen org-historie blijft gesloten als de laatste orgafspraak normaal eindigt; geen krediet naar Lite', async () => {
  const f = fixture(); await f.motor.provisioneerAutomatisch(f.c().id);
  const oud = f.c(), volgende = { ...f.kopie(oud), id: 'org-later' };
  const verrekening = { ...oud.aanbod.verrekening, bronContractId: oud.id };
  volgende.aanbod = maakAanbod(volgende, { prijs: oud.aanbod.prijs, scope: oud.aanbod.scope,
    at: f.stand.at, opdracht: 'org-upgrade', verrekening });
  volgende.verrekening = { ...verrekening, status: 'TOEGEPAST' };
  oud.status = 'GEEINDIGD'; oud.eindigtOp = volgende.activering.at; oud.vervangenDoor = volgende.id;
  f.db.data.contracten.push(volgende);
  assert.equal(f.org.controleZaak('ZAAK-A').status, 409, 'opvolger loopt nog');
  volgende.status = 'GEEINDIGD'; volgende.eindigtOp = f.stand.at;
  assert.equal(f.org.controleZaak('ZAAK-A').ok, true);
  volgende.verrekening.bronContractId = 'andere-bron';
  assert.equal(f.org.controleZaak('ZAAK-A').status, 409, 'onbewezen replacement vraagt controle');
});
