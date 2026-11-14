'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
function fixture(pas, zelfservice = true) {
  const a = { id: 'a-1', accountId: 1, pas, status: 'in behandeling' }, calls = [];
  const tenant = { org: 'MENSELIJK-ORG', actief: true, zaken: [], werkruimtes: [] };
  const { beslis } = require('../server/kern/aanmeldingen/besluit')({
    vind: id => id === a.id ? a : null, beeld: a => a, kap: (v, n) => String(v || '').slice(0, n),
    nu: () => '2026-11-13T10:00:00.000Z', zelfservice,
    accounts: { getUserById: id => id === 1 ? { id } : null, setTier() { calls.push('rechten'); return true; } },
    organisatieVoor: org => org === tenant.org ? tenant : null,
    save() { calls.push('save'); }, startBetalingen() { calls.push('termijnen'); },
    PASSEN: require('../server/kern/aanmeldingen/catalogus').PASSEN });
  return { a, calls, beslis: (door, contractEuro) => beslis(a.id, 'geaccepteerd', door, '', { contractEuro, organisatie: tenant.org }) };
}
test('Business en Lifestyle blijven menselijke toelating; akkoord maakt nog geen rechten of factuur', () => {
  for (const pas of ['business', 'lifestyle']) {
    const f = fixture(pas);
    assert.equal(f.beslis('', 6500).status, 403);
    assert.equal(f.a.status, 'in behandeling');
    const r = f.beslis('persoon:beoordelaar', pas === 'business' ? 7000 : undefined);
    assert.equal(r.ok, true); assert.equal(r.betaalschema, false);
    assert.deepEqual(f.calls, ['save']);
    assert.match(r.volgende, /teken/);
  }
});
test('nieuw Business-aanbod vereist werkelijk afgesproken prijs boven nieuwe bodem; Lifestyle krijgt geen verzonnen maatwerkprijs', () => {
  const f = fixture('business');
  for (const bedrag of [undefined, NaN, 0, 5000, 6499.99]) assert.equal(f.beslis('Mens', bedrag).status, 400);
  assert.equal(f.a.contract, undefined);
  assert.equal(f.beslis('Mens', 6700).ok, true);
  assert.equal(f.a.contract.maandCenten, 670000);
  const g = fixture('lifestyle');
  assert.equal(g.beslis('Mens').ok, true);
  assert.equal(g.a.contract, undefined, 'prijs komt pas uit expliciet nieuw aanbod, niet uit oude ex-btw bodem');
});
test('onvrijgegeven route behoudt bestaande handmatige contractafspraak', () => {
  const f = fixture('business', false);
  assert.equal(f.beslis('Mens', 5000).ok, true);
  assert.equal(f.a.contract.maandCenten, 500000);
  assert.deepEqual(f.calls, ['termijnen', 'rechten', 'save']);
});

test('kantoor kan automatische factuur of zaak niet via legacy afvinken of provisioning passeren', () => {
  const a = { id: 'a-1', accountId: 1, pas: 'business-lite', status: 'geaccepteerd', bedrijf: { naam: 'Zaak', type: 'zzp' } };
  const db = { data: { contracten: [{ id: 'c-1', aanmeldingId: a.id, automatischAbonnement: true }], suppliers: [] } };
  const mod = require('../server/kern/aanmeldingen/bedrijf')({ db, save() { throw Error('Mag niet schrijven'); },
    kap: s => String(s), nu: () => '2026-11-13T10:00:00.000Z', accounts: {} });
  const rij = { aanmeldingId: a.id, contractId: 'c-1', termijnen: [{ maand: 1, status: 'open' }] };
  assert.equal(mod.termijnVoldaan(() => [rij], a, 1, 'Mens').status, 409);
  assert.equal(mod.provisioneer(a).status, 409);
  assert.equal(rij.termijnen[0].status, 'open');
  assert.deepEqual(db.data.suppliers, []);
});
