'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { keten } = require('./abonnementen-keten-fixture.cjs');
async function opzet() {
  const f = keten();
  f.db.data.tenants = { ORG: { org: 'ORG', actief: true, zaken: ['ZAAK'], werkruimtes: ['W1'] } };
  f.db.data.aanmeldingen = [{ id: 'business-aanvraag', accountId: 1, pas: 'business', status: 'geaccepteerd',
    bedrijf: { naam: 'Organisatie', type: 'vakwerk' }, contract: { maandCenten: 700000 },
    besluit: { besluit: 'geaccepteerd', door: 'persoon:beoordelaar', at: f.stand.at, organisatie: 'ORG' } }];
  const id = await f.getekend({ pas: 'business', aanmeldingId: 'business-aanvraag' });
  return { ...f, id };
}

test('organisatieverandering na tekenen voorkomt zowel factuurvoorbereiding als providerstart', async () => {
  for (const wijzig of [f => { f.db.data.aanmeldingen[0].besluit.organisatie = 'ANDER'; },
    f => { f.db.data.aanmeldingen[0].besluit.door = 'getekend en betaald contract'; },
    f => { f.db.data.tenants.ORG.actief = false; },
    f => { f.db.data.zaakAbonnement = { ZAAK: { pas: 'business-lite', contractId: 'oud' } }; }]) {
    const f = await opzet(); wijzig(f);
    await assert.rejects(f.service.betaal(1, { contractId: f.id }), /organisatie|zaakabonnement/);
    assert.equal(f.stand.providerCalls, 0);
    assert.equal(f.accounts.getMemberState(1).invoices.length, 0);
    assert.equal(Object.keys(f.db.data.betaalWaarheid || {}).length, 0);
  }
});

test('verse eigenaarscontrole na accountwachttijd voorkomt nieuwe provider-I/O; herstel gebruikt dezelfde factuur', async () => {
  const f = await opzet(), gewoon = f.accounts.achtergrondWerk;
  let wissel = true;
  f.accounts.achtergrondWerk = async fn => {
    const r = await gewoon(fn);
    if (wissel) {
      wissel = false;
      await f.opties.bewerkCollectie({ tenants: 'kaart' }, data => { data.tenants.ORG.actief = false; });
    }
    return r;
  };
  await assert.rejects(f.service.betaal(1, { contractId: f.id }), /organisatie/);
  assert.equal(f.stand.providerCalls, 0);
  assert.equal(f.accounts.getMemberState(1).invoices.length, 1);
  await f.opties.bewerkCollectie({ tenants: 'kaart' }, data => { data.tenants.ORG.actief = true; });
  assert.equal((await f.service.betaal(1, { contractId: f.id })).ok, true);
  assert.equal(f.stand.providerCalls, 1);
  assert.equal(f.accounts.getMemberState(1).invoices.length, 1);
  assert.equal(Object.keys(f.db.data.betaalWaarheid).length, 1);
});

test('reeds gestarte provideropdracht blijft navraagbaar na gewijzigde org, zonder nieuwe betaling', async () => {
  const f = await opzet();
  assert.equal((await f.service.betaal(1, { contractId: f.id })).ok, true);
  f.db.data.aanmeldingen[0].besluit.organisatie = 'ANDER';
  assert.equal((await f.service.betaal(1, { contractId: f.id })).ok, true);
  assert.equal(f.stand.providerCalls, 1);
  assert.equal(f.users.get(1).tier, 'guest', 'geen persoonlijke Business-pas');
});

test('globale betaalwaarheid herleest de organisatie en herstelt eerst de ontbrekende factuur', async () => {
  const f = await opzet(); f.stand.accountFout = true;
  await assert.rejects(f.service.betaal(1, { contractId: f.id }), /Accountcommit/);
  const w = Object.values(f.db.data.betaalWaarheid)[0];
  assert.ok(w); assert.equal(f.accounts.getMemberState(1).invoices.length, 0);
  await assert.rejects(f.bw.begin(w.id), /Accountcommit/);
  assert.equal(f.stand.providerCalls, 0);
  f.stand.accountFout = false;
  await f.opties.bewerkCollectie({ tenants: 'kaart' }, data => { data.tenants.ORG.actief = false; });
  await assert.rejects(f.bw.begin(w.id), /organisatie/);
  assert.equal(f.stand.providerCalls, 0);
  await f.opties.bewerkCollectie({ tenants: 'kaart' }, data => { data.tenants.ORG.actief = true; });
  assert.equal((await f.bw.begin(w.id)).betaling.status, 'WACHT_OP_KLANT');
  assert.equal(f.accounts.getMemberState(1).invoices.length, 1);
  assert.equal(f.stand.providerCalls, 1);
});

async function lite() {
  const f = keten();
  f.accounts.listStaff = () => [{ member_id: 1, role: 'manager' }];
  f.db.data.suppliers = [{ code: 'ZAAK' }];
  f.db.data.tenants = { ORG: { org: 'ORG', actief: true, zaken: ['ZAAK'], werkruimtes: [] } };
  f.db.data.aanmeldingen = [{ id: 'lite-aanvraag', accountId: 1, pas: 'business-lite',
    status: 'in behandeling', bedrijf: { naam: 'Een zaak', type: 'vakwerk' }, gezaakt: { code: 'ZAAK' } }];
  const id = await f.getekend({ pas: 'business-lite', aanmeldingId: 'lite-aanvraag' });
  // Expliciete bestaande leesstand voor de overlapcontrole; geen providerbewijs.
  const orgVoorstel = { id: 'later-orgvoorstel', automatischAbonnement: true, pas: 'business',
    status: 'AANGEBODEN', aanbod: { scope: { soort: 'organisatie', code: 'ORG' } } };
  return { ...f, id, orgVoorstel };
}

test('later Business-voorstel voorkomt nieuwe Lite-factuur en providerstart voor dezelfde zaak', async () => {
  const f = await lite(); f.db.data.contracten.push(f.orgVoorstel);
  await assert.rejects(f.service.betaal(1, { contractId: f.id }), /organisatieabonnement/);
  assert.equal(f.stand.providerCalls, 0);
  assert.equal(f.accounts.getMemberState(1).invoices.length, 0);
  assert.equal(Object.keys(f.db.data.betaalWaarheid || {}).length, 0);
});

test('Lite herleest overlap na accountcommit en ook bij globale betaalhervatting', async () => {
  const f = await lite(), gewoon = f.accounts.achtergrondWerk;
  let wissel = true;
  f.accounts.achtergrondWerk = async fn => {
    const r = await gewoon(fn);
    if (wissel) {
      wissel = false;
      await f.opties.bewerkCollectie({ contracten: 'lijst' }, data => { data.contracten.push(f.orgVoorstel); });
    }
    return r;
  };
  await assert.rejects(f.service.betaal(1, { contractId: f.id }), /organisatieabonnement/);
  const w = Object.values(f.db.data.betaalWaarheid)[0];
  assert.ok(w); assert.equal(f.accounts.getMemberState(1).invoices.length, 1);
  await assert.rejects(f.bw.begin(w.id), /organisatieabonnement/);
  assert.equal(f.stand.providerCalls, 0);
  await f.opties.bewerkCollectie({ contracten: 'lijst' }, data => {
    data.contracten = data.contracten.filter(c => c.id !== f.orgVoorstel.id);
  });
  assert.equal((await f.service.betaal(1, { contractId: f.id })).ok, true);
  assert.equal(f.stand.providerCalls, 1);
  assert.equal(f.accounts.getMemberState(1).invoices.length, 1);
  assert.equal(Object.keys(f.db.data.betaalWaarheid).length, 1);
});
