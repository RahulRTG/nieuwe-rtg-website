'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { fixture, body, tekenen, aanvraag, kopie, fabriek } = require('./abonnementsaanbod-fixture.cjs');

test('RTG-aanbod bevriest echte prijzen, alle voorwaarden en aparte scope zonder rechten of termijnen', async () => {
  const f = fixture({ onboarding: { scopes: { rtg: { contract: { versie: 7 } } }, profielen: {} },
    lidmaatschapBetalingen: [{ contractId: 'oud', termijnen: [{ centen: 123 }] }] });
  const r = await f.motor.aanbod(1, body());
  assert.equal(r.ok, true); assert.equal(r.contract.status, 'AANGEBODEN');
  const c = f.db.data.contracten[0], a = c.aanbod;
  assert.equal(c.accountId, 1); assert.equal(c.afgesprokenCenten, 20661);
  assert.equal(a.prijs.maand.brutoCenten, 25000); assert.equal(a.prijs.jaar.brutoCenten, 287500);
  assert.equal(a.voorwaarden.minimumMaanden, 12); assert.equal(a.voorwaarden.herstelDagen, 31);
  assert.equal(a.geldigTot, null); assert.match(a.tekst, /Daarna maandelijks opzegbaar/);
  assert.deepEqual(c.verrekening.regels, []); assert.equal(c.verrekening.creditCenten, 0);
  assert.deepEqual(f.db.data.lidmaatschapBetalingen, [{ contractId: 'oud', termijnen: [{ centen: 123 }] }]);
  assert.deepEqual(Object.keys(f.db.data.onboarding.scopes), ['rtg']);
  r.contract.aanbod.prijs.maand.brutoCenten = 1;
  assert.equal(c.aanbod.prijs.maand.brutoCenten, 25000);
});

test('UUID-herhaling behoudt eerste prijs; andere inhoud of tweede pending opdracht geeft conflict', async () => {
  const f = fixture(), b = body(), r = await f.motor.aanbod(1, b), na = kopie(f.db.data);
  f.stand.prijs = () => { throw Error('Een herhaling leest geen nieuwe prijs'); };
  const opnieuw = await f.motor.aanbod(1, b);
  assert.equal(opnieuw.herhaald, true); assert.deepEqual(opnieuw.contract, r.contract);
  assert.equal(f.stand.prijsCalls, 1);
  assert.equal((await f.motor.aanbod(1, { ...b, frequentie: 'jaar' })).status, 409);
  assert.deepEqual(f.db.data, na);
  delete f.stand.prijs;
  assert.equal((await f.motor.aanbod(1, body())).status, 409);
  assert.deepEqual(f.db.data, na); assert.equal(f.db.data.aanmeldingen.length, 1);
});

test('geen clientaccount, vrije sleutel of gratis jaarverbintenis; account wordt binnen slot opnieuw gecontroleerd', async () => {
  const f = fixture();
  for (const b of [body({ idempotencyKey: 'los' }), body({ pas: 'gratis' }), body({ frequentie: 'dag' })])
    assert.equal((await f.motor.aanbod(1, b)).status, 400);
  assert.equal((await f.motor.aanbod(3, body({ accountId: 1 }))).status, 401);
  assert.deepEqual(f.db.data, {});
  f.stand.voorSlot = () => f.users.delete(1);
  assert.equal((await f.motor.aanbod(1, body())).status, 401);
  assert.deepEqual(f.db.data, {});
});

test('Lite bindt eigen bedrijfsaanvraag en laat persoonlijke en zakelijke pending afspraken apart bestaan', async () => {
  const f = fixture({ aanmeldingen: [aanvraag('business-lite')] });
  const input = body({ pas: 'business-lite', aanmeldingId: 'a-business-lite' });
  assert.equal((await f.motor.aanbod(2, input)).status, 404);
  assert.equal((await f.motor.aanbod(1, body({ pas: 'business-lite' }))).status, 409);
  const lite = await f.motor.aanbod(1, input);
  assert.equal(lite.ok, true); assert.equal(lite.contract.aanbod.scope.soort, 'zaak');
  assert.equal(lite.contract.aanbod.prijs.maand.nettoCenten, 40000);
  assert.equal((await f.motor.aanbod(1, body())).ok, true);
  assert.equal(f.db.data.contracten.length, 2);
  f.stand.scope = () => ({ status: 403, error: 'Beheerdersrol ingetrokken' });
  const voor = kopie(f.db.data);
  assert.equal((await f.motor.teken(1, tekenen(lite))).status, 403);
  assert.deepEqual(f.db.data, voor);
});

test('Business/Lifestyle eisen bestaande eigen menselijke toelating, ook nog bij het tekenen', async () => {
  for (const pas of ['business', 'lifestyle']) {
    const a = aanvraag(pas, { contract: { maandCenten: 650000 } });
    const f = fixture({ aanmeldingen: [a] }), b = body({ pas, aanmeldingId: a.id });
    assert.equal((await f.motor.aanbod(1, { ...b, door: 'Een mens' })).status, 403);
    const rij = f.db.data.aanmeldingen[0];
    rij.status = 'geaccepteerd'; rij.besluit = { besluit: 'geaccepteerd', door: 'backoffice (gedeelde code)', at: f.stand.at };
    assert.equal((await f.motor.aanbod(1, b)).status, 403);
    rij.besluit.door = 'Benoemde medewerker';
    if (pas === 'business') {
      rij.besluit.organisatie = 'FIXTURE-ORG';
      f.db.data.tenants = { 'FIXTURE-ORG': { org: 'FIXTURE-ORG', zaken: [], werkruimtes: [], actief: true } };
    }
    const r = await f.motor.aanbod(1, b); assert.equal(r.ok, true);
    f.db.data.aanmeldingen[0].status = 'afgewezen';
    const voor = kopie(f.db.data);
    assert.equal((await f.motor.teken(1, tekenen(r))).status, 409);
    assert.deepEqual(f.db.data, voor);
  }
});

test('ongeldige, asynchrone en falende broncallbacks publiceren geen kortdossier of halve overeenkomst', async () => {
  for (const prijs of [() => null, async () => ({}), () => ({ status: 409, error: 'Geen prijsbewijs' }), () => { throw Error('Bron stuk'); }]) {
    const f = fixture(); f.stand.prijs = prijs;
    assert.ok([409, 503].includes((await f.motor.aanbod(1, body())).status)); assert.deepEqual(f.db.data, {});
  }
  const f = fixture(); f.stand.credit = () => ({ ok: true, bronContractId: null, regels: [], creditCenten: 1, teBetalenCenten: 24999, overCenten: 0 });
  assert.equal((await f.motor.aanbod(1, body())).status, 503); assert.deepEqual(f.db.data, {});
  const zonderSlot = fabriek({ ...f.opties, bewerkCollectie: undefined });
  assert.equal((await zonderSlot.aanbod(1, body())).status, 503);
});

test('upgrade reserveert gehele bewezen credit, toont carry en weigert versleten verrekenofferte', async () => {
  const f = fixture();
  f.stand.credit = () => ({ ok: true, bronContractId: 'oude-overeenkomst', regels: [{ factuurId: 'factuur-1',
    beschikbaarCenten: 50000, centen: 25000, overCenten: 25000 }], creditCenten: 25000, teBetalenCenten: 0, overCenten: 25000 });
  const r = await f.motor.aanbod(1, body()), c = f.db.data.contracten[0];
  assert.equal(r.ok, true); assert.equal(c.verrekening.creditCenten, 50000);
  assert.equal(c.verrekening.regels[0].centen, 50000); assert.equal(c.aanbod.verrekening.creditCenten, 25000);
  assert.equal(c.aanbod.verrekening.overCenten, 25000); assert.equal(c.aanbod.geldigTot, '2026-11-13T10:15:00.000Z');
  assert.match(c.aanbod.tekst, /betaalbevestiging uiterlijk/);
  f.stand.at = '2026-11-13T10:15:00.001Z'; const voor = kopie(f.db.data);
  const laat = await f.motor.teken(1, tekenen(r));
  assert.equal(laat.status, 409); assert.equal(laat.code, 'AANBOD_VERLOPEN'); assert.deepEqual(f.db.data, voor);
});

test('mijn is eigen, read-only en toont geen aanbod van een ander account', async () => {
  const f = fixture(), r = await f.motor.aanbod(1, body()), voor = kopie(f.db.data), saves = f.stand.saves;
  assert.equal(f.motor.mijn(1).contracten[0].id, r.contract.id);
  assert.deepEqual(f.motor.mijn(2).contracten, []); assert.equal(f.motor.mijn(3).status, 401);
  assert.deepEqual(f.db.data, voor); assert.equal(f.stand.saves, saves);
});
