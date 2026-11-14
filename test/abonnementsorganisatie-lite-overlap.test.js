/* Echte aanbodkern en overlap-owner; een bestaande orgstand is hier expliciete
   leesfixture, geen bewijs van een providerbetaling of productieactivering. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { fixture, body, tekenen, aanvraag, kopie } = require('./abonnementsaanbod-fixture.cjs');
async function maak({ status = 'ACTIEF', gekoppeld = true } = {}) {
  const f = fixture({ tenants: { 'ORG-A': { org: 'ORG-A', actief: true,
    zaken: gekoppeld ? ['ZAAK-A'] : [], werkruimtes: [] } }, suppliers: [{ code: 'ZAAK-A' }],
  aanmeldingen: [aanvraag('business', { status: 'geaccepteerd', contract: { maandCenten: 700000 },
    besluit: { besluit: 'geaccepteerd', door: 'Benoemd medewerker', at: '2026-11-13T10:00:00.000Z', organisatie: 'ORG-A' } }),
  aanvraag('business-lite', { accountId: 2, gezaakt: { code: 'ZAAK-A' } })] });
  f.accounts.listStaff = () => [{ member_id: 2, role: 'manager' }];
  f.accounts.getMemberState = () => ({ invoices: [] });
  const ctx = require('../server/kern/aanmeldingen/abonnementscontext')({ db: f.db, accounts: f.accounts });
  f.stand.scope = ctx.scopeVoor; f.stand.credit = ctx.verrekeningVoor;
  const r = await f.motor.aanbod(1, body({ pas: 'business', aanmeldingId: 'a-business' })); assert.equal(r.ok, true);
  const c = f.db.data.contracten[0]; c.status = status;
  if (['ACTIEF', 'OPZEGGEND', 'GEEINDIGD'].includes(status)) {
    c.organisatieCode = 'ORG-A'; c.activering = { at: f.stand.at };
  }
  if (status === 'OPZEGGEND') c.eindigtOp = '2027-11-13T10:00:00.000Z';
  f.input = body({ pas: 'business-lite', aanmeldingId: 'a-business-lite' });
  return f;
}
test('Lite-aanbod voor reeds door Business gedekte zaak weigert vóór overeenkomst, credit of factuur', async () => {
  for (const status of ['AANGEBODEN', 'GEACCEPTEERD', 'ACTIEF', 'OPZEGGEND']) {
    const f = await maak({ status }), voor = kopie(f.db.data);
    const r = await f.motor.aanbod(2, f.input);
    assert.equal(r.status, 409, status); assert.equal(r.controleNodig, true);
    assert.deepEqual(f.db.data, voor); assert.equal(f.db.data.contracten.length, 1);
    assert.equal(f.db.data.lidmaatschapBetalingen, undefined);
  }
});
test('latere organisatiebinding blokkeert Lite-ondertekening, maar behoudt exact aanbodantwoord voor herstel', async () => {
  const f = await maak({ gekoppeld: false }), r = await f.motor.aanbod(2, f.input); assert.equal(r.ok, true);
  f.db.data.tenants['ORG-A'].zaken.push('ZAAK-A'); const voor = kopie(f.db.data);
  assert.equal((await f.motor.aanbod(2, f.input)).herhaald, true);
  const teken = await f.motor.teken(2, tekenen(r));
  assert.equal(teken.status, 409); assert.equal(teken.controleNodig, true);
  assert.deepEqual(f.db.data, voor);
  const c = f.db.data.contracten.find(x => x.id === r.contract.id);
  assert.equal(c.status, 'AANGEBODEN'); assert.equal(c.ondertekening, undefined);
});
test('dubbele tenantbinding levert geen Lite-omweg; organisatie zonder contract blijft wel mogelijk', async () => {
  const f = await maak();
  f.db.data.tenants['ORG-B'] = { org: 'ORG-B', actief: true, zaken: ['ZAAK-A'], werkruimtes: [] };
  const voor = kopie(f.db.data);
  assert.equal((await f.motor.aanbod(2, f.input)).status, 409); assert.deepEqual(f.db.data, voor);
  delete f.db.data.tenants['ORG-B']; f.db.data.contracten = [];
  const r = await f.motor.aanbod(2, f.input); assert.equal(r.ok, true);
  assert.equal((await f.motor.teken(2, tekenen(r))).ok, true);
});
test('expliciet ingetrokken onbetaald Business-voorstel blokkeert geen latere Lite-keuze', async () => {
  const f = await maak({ status: 'AANGEBODEN' }), c = f.db.data.contracten[0];
  assert.equal((await f.motor.intrekken(1, { contractId: c.id, aanbodHash: c.aanbod.hash })).ok, true);
  const r = await f.motor.aanbod(2, f.input); assert.equal(r.ok, true);
  assert.equal((await f.motor.teken(2, tekenen(r))).ok, true);
  assert.equal(f.db.data.contracten.find(x => x.id === c.id).status, 'GEEINDIGD');
});
