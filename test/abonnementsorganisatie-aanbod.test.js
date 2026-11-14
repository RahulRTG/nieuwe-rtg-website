/* Echte aanbod-, toelatings- en tenantlezers op een geheugenstore. Geen
   provider-, browser- of crashduurzaamheidsclaim. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { fixture, body, tekenen, aanvraag, kopie } = require('./abonnementsaanbod-fixture.cjs');
const context = require('../server/kern/aanmeldingen/abonnementscontext');
const vorm = require('../server/kern/aanmeldingen/abonnementsaanbod-vorm');
function maak() {
  const a = aanvraag('business', { status: 'geaccepteerd', contract: { maandCenten: 725000 },
    besluit: { besluit: 'geaccepteerd', door: 'Bevoegd medewerker', at: '2026-11-13T10:00:00.000Z', organisatie: 'ORG-A' } });
  const f = fixture({ aanmeldingen: [a], tenants: { 'ORG-A': { org: 'ORG-A', actief: true, zaken: ['ZAAK-A'], werkruimtes: [] },
    'ORG-B': { org: 'ORG-B', actief: true, zaken: [], werkruimtes: [] } }, suppliers: [{ code: 'ZAAK-A' }] });
  f.accounts.listStaff = () => [{ member_id: 1, role: 'manager' }];
  f.accounts.getMemberState = () => ({ invoices: [] });
  f.context = context({ db: f.db, accounts: f.accounts });
  f.stand.scope = f.context.scopeVoor;
  f.stand.credit = f.context.verrekeningVoor;
  f.input = body({ pas: 'business', aanmeldingId: a.id });
  return f;
}
function besluitFixture() {
  const f = maak(), a = f.db.data.aanmeldingen[0]; a.status = 'in behandeling'; a.besluit = null;
  const lezen = require('../server/kern/tenant/lezen')({ db: f.db });
  f.beslis = require('../server/kern/aanmeldingen/besluit')({ vind: id => id === a.id ? a : null,
    beeld: kopie, kap: (s, n) => String(s || '').slice(0, n), nu: () => f.stand.at,
    accounts: f.accounts, save() { f.stand.saves++; }, startBetalingen() { throw Error('Geen stil betaalplan'); },
    PASSEN: { business: { naam: 'Business' } }, zelfservice: true, organisatieVoor: lezen.haal }).beslis;
  return f;
}
test('Business-toelating bindt bestaande actieve org, eigen account en echte beslisser vóór mutatie', () => {
  for (const organisatie of [undefined, 'ONTBREEKT', '__proto__']) {
    const f = besluitFixture(), voor = kopie(f.db.data);
    const r = f.beslis(f.input.aanmeldingId, 'geaccepteerd', 'Bevoegd medewerker', '', { contractEuro: 7250, organisatie });
    assert.equal(r.status, 409); assert.deepEqual(f.db.data, voor); assert.equal(f.stand.saves, 0);
  }
  for (const door of [null, 'AI', 'RTG-personeel', 'backoffice (gedeelde code)']) {
    const f = besluitFixture();
    assert.equal(f.beslis(f.input.aanmeldingId, 'geaccepteerd', door, '', { contractEuro: 7250, organisatie: 'ORG-A' }).status, 403);
  }
  const f = besluitFixture();
  const r = f.beslis(f.input.aanmeldingId, 'geaccepteerd', 'Bevoegd medewerker', '', { contractEuro: 7250, organisatie: ' org-a ' });
  assert.equal(r.ok, true); assert.equal(r.aanmelding.besluit.organisatie, 'ORG-A');
  assert.equal(f.db.data.aanmeldingen[0].contract.maandCenten, 725000);
  assert.equal(f.db.data.lidmaatschapBetalingen, undefined);
});
test('Business-aanbod omvat goedgekeurde organisatie, niet de door browser gekozen zaak of organisatie', async () => {
  const f = maak(), r = await f.motor.aanbod(1, { ...f.input, organisatie: 'ORG-B', zaakCode: 'VALS' });
  assert.equal(r.ok, true); assert.deepEqual(r.contract.aanbod.scope, {
    soort: 'organisatie', code: 'ORG-A', capaciteiten: require('../server/kern/commercie/capaciteiten').capsVan('business') });
  assert.equal(r.contract.aanbod.prijs.maand.nettoCenten, 725000);
  assert.match(r.contract.aanbod.tekst, /hele organisatie ORG-A/);
  assert.equal((await f.motor.teken(2, tekenen(r))).status, 404);
  assert.equal((await f.motor.teken(1, tekenen(r))).ok, true);
});
test('oude toelating zonder org, ontbrekende of gesloten org levert geen nieuw Business-aanbod', async () => {
  for (const wijzig of [f => delete f.db.data.aanmeldingen[0].besluit.organisatie,
    f => delete f.db.data.tenants['ORG-A'], f => f.db.data.tenants['ORG-A'].actief = false,
    f => f.db.data.tenants['ORG-A'].levensloop = { stand: 'bewaring' },
    f => f.db.data.tenants.DUBBEL = kopie(f.db.data.tenants['ORG-A'])]) {
    const f = maak(); wijzig(f); const voor = kopie(f.db.data);
    assert.equal((await f.motor.aanbod(1, f.input)).status, 409); assert.deepEqual(f.db.data, voor);
  }
});
test('org/admission opnieuw gecontroleerd vóór tekenen, ook na een idempotent aanbodantwoord', async () => {
  for (const wijzig of [f => f.db.data.aanmeldingen[0].besluit.organisatie = 'ORG-B',
    f => delete f.db.data.tenants['ORG-A'], f => f.db.data.tenants['ORG-A'].actief = false]) {
    const f = maak(), r = await f.motor.aanbod(1, f.input); assert.equal(r.ok, true);
    wijzig(f); const voor = kopie(f.db.data);
    assert.equal((await f.motor.aanbod(1, f.input)).herhaald, true);
    assert.equal((await f.motor.teken(1, tekenen(r))).status, 409);
    assert.deepEqual(f.db.data, voor);
  }
});
test('persoonlijke overeenkomst wordt nooit stil als bron voor een organisatieaanbod gebruikt', () => {
  const f = maak();
  const r = f.context.verrekeningVoor(1, { contracten: [{ id: 'persoonlijk', aanmeldingId: 'persoonlijke-aanvraag',
    pas: 'rtg', status: 'ACTIEF', aanbod: { scope: { soort: 'persoon', code: null } } }],
    aanmeldingen: [{ id: 'persoonlijke-aanvraag', accountId: 1 }], op: f.stand.at,
    doelCenten: 877250, pas: 'business', scope: { soort: 'organisatie', code: 'ORG-A' } });
  assert.equal(r.ok, true); assert.equal(r.bronContractId, null); assert.equal(r.creditCenten, 0);
});
test('los zaakabonnement en tweede aanvrager op dezelfde org blokkeren vóór nieuwe betaalverplichtingen', async () => {
  const f = maak(); f.db.data.zaakAbonnement = { 'ZAAK-A': { contractId: 'onverklaarde-zaakafspraak' } };
  const voor = kopie(f.db.data);
  assert.equal((await f.motor.aanbod(1, f.input)).status, 409); assert.deepEqual(f.db.data, voor);
  delete f.db.data.zaakAbonnement;
  const r = await f.motor.aanbod(1, f.input); assert.equal(r.ok, true);
  const a2 = { ...kopie(f.db.data.aanmeldingen[0]), id: 'tweede-aanvrager', accountId: 2 };
  f.db.data.aanmeldingen.push(a2);
  const tweede = body({ pas: 'business', aanmeldingId: a2.id }), na = kopie(f.db.data);
  assert.equal((await f.motor.aanbod(2, tweede)).status, 409); assert.deepEqual(f.db.data, na);
  assert.equal((await f.motor.intrekken(1, { contractId: r.contract.id, aanbodHash: r.contract.aanbod.hash })).ok, true);
  assert.equal((await f.motor.aanbod(2, tweede)).ok, true);
});
test('verse collectiesnapshot wint van oude tenantcache vóór ondertekening', async () => {
  const f = maak(), r = await f.motor.aanbod(1, f.input); assert.equal(r.ok, true);
  const oorspronkelijk = f.opties.bewerkCollectie;
  const motor = require('../server/kern/aanmeldingen/abonnementsaanbod')({ ...f.opties,
    bewerkCollectie(vorm, werk) {
      assert.equal(vorm.tenants, 'kaart'); assert.equal(vorm.zaakAbonnement, 'kaart');
      return oorspronkelijk(vorm, waarden => {
        waarden.tenants['ORG-A'].actief = false;
        return werk(waarden);
      });
    } });
  assert.equal((await motor.teken(1, tekenen(r))).status, 409);
  assert.equal(f.db.data.contracten[0].status, 'AANGEBODEN');
  assert.equal(f.db.data.contracten[0].ondertekening, undefined);
});
test('Lite blijft per zaak; oude Business-momentopname behoudt geldige oude tekst', async () => {
  const f = maak(), a = aanvraag('business-lite', { gezaakt: { code: 'ZAAK-A' } });
  f.db.data.aanmeldingen.push(a);
  const r = await f.motor.aanbod(1, body({ pas: a.pas, aanmeldingId: a.id }));
  assert.equal(r.ok, true); assert.equal(r.contract.aanbod.scope.soort, 'zaak');
  assert.match(r.contract.aanbod.tekst, /één zaak/);
  // Een vóór dit besluit gevormde snapshot wordt niet met nieuwe tekst gehasht.
  const c = kopie(f.db.data.contracten[0]); c.pas = 'business'; c.aanbod.pas = 'business';
  delete c.aanbod.voorwaarden.bedrijfsReikwijdte;
  const { hash, tekst, ...inhoud } = c.aanbod;
  const zonderNieuweZin = tekst.split('\n').filter(z => !/Business Lite geldt voor één zaak/.test(z));
  zonderNieuweZin[1] = 'Aanbod ' + c.id + ' voor abonnement business.';
  const h = vorm.hash(inhoud);
  zonderNieuweZin[zonderNieuweZin.length - 2] = 'Alle versiegebonden bedragen, termijnen, reikwijdte en verrekenregels: ' + vorm.canon(inhoud);
  zonderNieuweZin[zonderNieuweZin.length - 1] = 'Aanbodreferentie: ' + h;
  c.aanbod.hash = h; c.aanbod.tekst = zonderNieuweZin.join('\n');
  assert.equal(vorm.aanbodGeldig(c), true);
});
