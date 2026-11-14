'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { keten } = require('./abonnementen-keten-fixture.cjs');
const { kopie, body } = require('./abonnementsaanbod-fixture.cjs');
function deuren(f, bewerk = f.opties.bewerkCollectie) {
  const A = () => f.db.data.aanmeldingen || [], B = () => f.db.data.lidmaatschapBetalingen || [];
  const ctx = { db: f.db, save() {}, nu: () => f.stand.at, bewerkCollectie: bewerk, A, B,
    rid: () => crypto.randomUUID(), eur: n => n / 100, PASSEN: require('../server/kern/aanmeldingen/catalogus').PASSEN };
  const schema = require('../server/kern/aanmeldingen/betaalschema')(ctx);
  const lezer = require('../server/kern/aanmeldingen/lidabonnement')({ ...ctx, contracten: schema.contracten });
  const opzeg = require('../server/kern/aanmeldingen/lidabonnement-opzeg')({ ...schema, lezer });
  const ng = require('../server/kern/aanmeldingen/naargast')({ ...ctx, contracten: schema.contracten,
    accounts: f.accounts, zegOpZelf: opzeg.zegOpZelf, meldLid() {} }).naarGast;
  return { ...schema, lezer, opzeg, ng };
}
async function actief() {
  const f = keten(), id = await f.getekend();
  await f.service.betaal(1, { contractId: id }); f.bevestig(); await f.service.herstel(1, { contractId: id });
  return { ...f, id };
}

test('exacte opzegging bewaart gestarte facturen/BW en kiest niet eerste historische schemarij', async () => {
  const f = await actief(), d = deuren(f), c = f.db.data.contracten[0], rij = f.db.data.lidmaatschapBetalingen[0];
  const historie = { ...kopie(c), id: 'historie', status: 'GEEINDIGD' };
  f.db.data.contracten.unshift(historie);
  f.db.data.lidmaatschapBetalingen.unshift({ contractId: historie.id, aanmeldingId: c.aanmeldingId, termijnen: [] });
  assert.equal(d.lezer.mijn(1).abonnement.contractId, c.id);
  rij.termijnen.push({ nr: 99, vervalt: '2030-01-01T00:00:00.000Z', status: 'open', invoiceId: 'bewijs-bewaren', betaalWaarheidId: 'bewijs' },
    { nr: 100, vervalt: '2030-02-01T00:00:00.000Z', status: 'gepland' });
  const gestart = kopie(rij.termijnen.slice(0, 2)), bw = kopie(f.db.data.betaalWaarheid);
  const voorbeeld = d.opzeg.opzegVoorbeeld(1, { contractId: c.id });
  assert.equal(voorbeeld.contractId, c.id);
  const r = await d.opzeg.zegOpZelf(1, voorbeeld); assert.equal(r.ok, true);
  assert.equal(f.db.data.contracten.find(x => x.id === c.id).status, 'OPZEGGEND');
  assert.equal(f.db.data.contracten.find(x => x.id === historie.id).status, 'GEEINDIGD');
  assert.deepEqual(f.db.data.lidmaatschapBetalingen.find(x => x.contractId === c.id).termijnen, gestart);
  assert.deepEqual(f.db.data.betaalWaarheid, bw);
  assert.equal((await d.opzeg.zegOpZelf(1, voorbeeld)).alOpgezegd, true);
});

test('opslagfout houdt actief contract en schema heel; exacte retry annuleert eenmaal', async () => {
  const f = await actief(), d = deuren(f), v = d.opzeg.opzegVoorbeeld(1), voor = kopie(f.db.data);
  f.stand.saveFout = true;
  assert.equal((await d.opzeg.zegOpZelf(1, v)).status, 503); assert.deepEqual(f.db.data, voor);
  f.stand.saveFout = false; assert.equal((await d.opzeg.zegOpZelf(1, v)).ok, true);
  const na = kopie(f.db.data); assert.equal((await d.opzeg.zegOpZelf(1, v)).alOpgezegd, true);
  assert.deepEqual(f.db.data, na);
});

test('eigendom en voorbeeld worden opnieuw gecontroleerd binnen het collectieslot', async () => {
  for (const mutatie of ['prijs', 'eigenaar', 'vervangen']) {
    const f = await actief(), d = deuren(f), v = d.opzeg.opzegVoorbeeld(1);
    f.stand.voorSlot = () => {
      f.stand.voorSlot = null;
      if (mutatie === 'prijs') f.db.data.contracten[0].afgesprokenCenten++;
      if (mutatie === 'eigenaar') f.db.data.aanmeldingen[0].accountId = 2;
      if (mutatie === 'vervangen') f.db.data.contracten[0].status = 'GEEINDIGD';
    };
    const r = await d.opzeg.zegOpZelf(1, v);
    assert.ok([404, 409].includes(r.status), mutatie + ': ' + JSON.stringify(r));
    assert.notEqual(f.db.data.contracten[0].status, 'OPZEGGEND');
  }
});

test('andermans referentie en ambigu schema geven geen mutatie; oude verlenging mag geen auto prijs aanpassen', async () => {
  const f = await actief(), d = deuren(f), v = d.opzeg.opzegVoorbeeld(1), voor = kopie(f.db.data);
  assert.equal((await d.opzeg.zegOpZelf(2, v)).status, 409);
  assert.equal(d.verlengLidmaatschap(f.db.data.contracten[0].aanmeldingId, 1).status, 409);
  assert.deepEqual(f.db.data, voor);
  f.db.data.lidmaatschapBetalingen.push(kopie(f.db.data.lidmaatschapBetalingen[0]));
  assert.equal((await d.opzeg.zegOpZelf(1, v)).status, 409);
  assert.equal(f.db.data.contracten[0].status, 'ACTIEF');
});

test('asynchrone typed opzegging wordt afgewacht vóór een contractgebonden gastplanning', async () => {
  const f = await actief();
  const d = deuren(f, async (vorm, werk) => f.opties.bewerkCollectie(vorm, werk));
  const v = d.opzeg.opzegVoorbeeld(1), r = await d.ng.lidEinde(1, v);
  assert.equal(r.ok, true); assert.equal(f.db.data.contracten[0].status, 'OPZEGGEND');
  assert.equal(f.db.data.pasNaarGast.gepland['1'].contractId, f.id);
  assert.equal(f.db.data.pasNaarGast.gepland['1'].op, r.gastOp);
});

test('een exact zakelijk contract kan worden opgezegd zonder persoonlijke afspraak te raken', async () => {
  const f = await actief(), c = f.db.data.contracten[0], d = deuren(f);
  const a = { id: 'eigen-zaak', accountId: 1, pas: 'business-lite', status: 'geaccepteerd',
    bedrijf: { naam: 'Fixture Atelier', type: 'vakwerk', plaats: 'Utrecht' } };
  f.db.data.aanmeldingen.unshift(a);
  const r = await f.service.aanbod(1, body({ pas: a.pas, aanmeldingId: a.id })); assert.equal(r.ok, true);
  const zaak = f.db.data.contracten.find(x => x.id === r.contract.id);
  // Alleen een lees-/opzegfixture voor de zakelijke ACTIEF-stand, geen betaalclaim.
  zaak.status = 'ACTIEF';
  f.db.data.lidmaatschapBetalingen.unshift({ aanmeldingId: a.id, contractId: zaak.id, termijnen: [] });
  assert.equal(d.lezer.mijn(1).abonnement.contractId, c.id);
  const v = d.opzeg.opzegVoorbeeld(1, { contractId: zaak.id });
  assert.equal(v.contractId, zaak.id);
  assert.equal(d.ng.lidEinde(1, v).status, 409, 'zakelijke opzegging is nooit persoonlijke pasverlaging');
  assert.equal((await d.opzeg.zegOpZelf(1, v)).ok, true);
  assert.equal(f.db.data.contracten.find(x => x.id === c.id).status, 'ACTIEF');
  assert.equal(f.db.data.contracten.find(x => x.id === zaak.id).status, 'OPZEGGEND');
});

test('opzeg-leesprojectie begrenst laatste maand maar herprijst een gestarte termijn nooit', async () => {
  const f = await actief(), d = deuren(f), c = f.db.data.contracten[0];
  const lees = require('../server/kern/aanmeldingen/lidabonnement-termijnen');
  const einde = '2027-12-28T10:00:00.000Z', op = Date.parse('2027-11-28T10:00:00.000Z');
  const rij = { termijnen: [] };
  const nieuw = lees({ rij, contract: c, contracten: d.contracten, op, eindigtOp: einde });
  assert.equal(nieuw.length, 1); assert.equal(nieuw[0].brutoCenten, 12097);
  assert.equal(nieuw[0].tot, einde);
  rij.termijnen.push({ nr: nieuw[0].nr, brutoCenten: 25000, centen: 20661, status: 'open',
    vervalt: nieuw[0].vervalt, invoiceId: 'bestaande-factuur', betaalWaarheidId: 'bestaande-betaalopdracht' });
  assert.deepEqual(lees({ rij, contract: c, contracten: d.contracten, op, eindigtOp: einde }), rij.termijnen);
});

test('organisatiecontract is geen persoonlijke pas en kan die niet opzeggen of naar gast zetten', async () => {
  const f = await actief(), d = deuren(f), persoon = f.db.data.contracten[0];
  const a = { id: 'organisatie-aanvraag', accountId: 1, pas: 'business', status: 'geaccepteerd' };
  const org = { ...kopie(persoon), id: 'organisatiecontract', aanmeldingId: a.id, pas: 'business',
    startAt: '2026-11-14T10:00:00.000Z', aanbod: { ...kopie(persoon.aanbod), scope: { soort: 'organisatie', code: 'ORG-A' } } };
  // Alleen lees-/opzegfixture: geen geldig aanbod, handtekening of betaalclaim.
  f.db.data.aanmeldingen.unshift(a); f.db.data.contracten.unshift(org);
  f.db.data.lidmaatschapBetalingen.unshift({ aanmeldingId: a.id, contractId: org.id, termijnen: [] });
  assert.equal(d.lezer.mijn(1).abonnement.contractId, persoon.id);
  persoon.status = 'GEEINDIGD';
  assert.equal(d.lezer.mijn(1).abonnement.contractId, persoon.id, 'lopende org maskeert nooit geëindigd persoonlijk contract');
  assert.equal(d.lezer.stand(1).id, persoon.id);
  persoon.status = 'ACTIEF';
  const v = d.opzeg.opzegVoorbeeld(1, { contractId: org.id });
  assert.equal(v.contractId, org.id); assert.equal(d.ng.lidEinde(1, v).status, 409);
  assert.equal((await d.opzeg.zegOpZelf(1, v)).ok, true);
  assert.equal(f.db.data.contracten.find(c => c.id === persoon.id).status, 'ACTIEF');
  assert.equal(f.users.get(1).tier, 'rtg');
  f.db.data.aanmeldingen = [a];
  assert.equal(d.lezer.stand(1), null, 'auth krijgt geen organisatiecontract als persoonlijke pasbron');
});
