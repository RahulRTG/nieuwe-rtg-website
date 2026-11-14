'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fabriek = require('../server/kern/aanmeldingen/bedrijf');
const { maakAanbod } = require('../server/kern/aanmeldingen/abonnementsaanbod-vorm');
const { abonnementsAanbod } = require('../server/kern/pasprijs');
const kopie = x => JSON.parse(JSON.stringify(x));
const AT = '2026-11-13T10:00:00.000Z';
function fixture({ pas = 'business-lite', scopeCode = null } = {}) {
  const c = { id: 'c-1', accountId: 1, aanmeldingId: 'a-1', pas, frequentie: 'maand',
    automatischAbonnement: true, status: 'ACTIEF', activering: { at: AT, betaalWaarheidId: 'bw-1', rechtenAt: null } };
  const prijs = abonnementsAanbod('business-lite', { frequentie: 'maand', btwProfiel: 'nl-21' });
  c.aanbod = maakAanbod(c, { prijs, at: AT, opdracht: 'fixture', scope: { soort: 'zaak', code: scopeCode, capaciteiten: [] },
    verrekening: { ok: true, bronContractId: null, regels: [], creditCenten: 0, overCenten: 0, teBetalenCenten: prijs.termijn.brutoCenten } });
  const a = { id: 'a-1', accountId: 1, pas, status: 'geaccepteerd', naam: 'Eigenaar',
    bedrijf: { naam: 'Eigen Werk', type: 'vakwerk', plaats: 'Haarlem', behoeften: ['Team'] },
    besluit: { besluit: 'geaccepteerd', door: 'office:persoon-8', at: AT } };
  const db = { data: { contracten: [c], aanmeldingen: [a], suppliers: [] }, writable: true };
  const stand = { slot: 0, saves: 0, gemaakt: 0, rijen: [], actief: true };
  const bewerk = require('../server/db/collectie-bewerken')({ store: 'memory', db,
    save() { stand.saves++; if (stand.saveFout === stand.saves) throw Error('savefout'); } });
  const accounts = { getUserById: id => id === 1 ? { id, tier: 'rtg' } : null, isActief: () => stand.actief,
    listStaff: code => stand.rijen.filter(r => r.supplier_code === code && r.active === 1),
    setTier() { throw Error('Een zaak mag de persoonlijke pas niet veranderen.'); },
    legacyStaffPinToegestaan: () => true, makePin() { throw Error('Geen legacy-PIN op de automatische ingang.'); },
    async maakEigenaarEenmaal(g) {
      if (stand.voorAccount) stand.voorAccount(g);
      if (stand.accountFout) throw Error('accountfout');
      const oud = stand.rijen.find(r => r.supplier_code === g.supplierCode && r.member_id === g.memberId);
      if (oud) {
        if (oud.role !== 'manager' || oud.active !== 1 || g.verwachtStaffId != null && oud.id !== g.verwachtStaffId)
          throw Error('bestaande plek ingetrokken');
        return oud;
      }
      if (g.verwachtStaffId != null) throw Error('verwachte plek ontbreekt');
      const s = { id: ++stand.gemaakt, supplier_code: g.supplierCode, member_id: g.memberId, role: 'manager', active: 1 };
      stand.rijen.push(s);
      if (stand.accountAntwoordFout) { stand.accountAntwoordFout = false; throw Error('antwoord na accountcommit onderbroken'); }
      return s;
    } };
  const motor = fabriek({ db, accounts, nu: () => AT, save() {}, kap: (s, n) => String(s || '').slice(0, n),
    bewerkCollectie(vorm, werk) {
      stand.slot++; if (stand.voorSlot) stand.voorSlot(stand.slot);
      const r = bewerk(vorm, werk);
      if (stand.antwoordFout === stand.slot) throw Error('antwoord na collectiecommit onderbroken');
      return r;
    } });
  return { db, stand, accounts, motor, c: () => db.data.contracten[0], a: () => db.data.aanmeldingen[0] };
}
test('Business Lite reserveert offline zaak, expliciete Lite-rechten en eigen manager zonder persoonlijke paswijziging', async () => {
  const f = fixture(), aanbod = kopie(f.c().aanbod);
  f.stand.voorAccount = g => {
    assert.equal(f.db.data.suppliers[0].online, false);
    assert.equal(f.a().gezaakt.staffId, null); assert.equal(f.c().zaakCode, g.supplierCode);
    assert.equal(f.db.data.zaakAbonnement[g.supplierCode].pas, 'business-lite');
  };
  const r = await f.motor.provisioneerAutomatisch('c-1');
  assert.equal(r.ok, true); assert.equal(r.toegang, 'persoonlijk-rtg-account'); assert.equal(r.pin, undefined);
  assert.equal(f.db.data.suppliers.length, 1); assert.equal(f.a().gezaakt.staffId, r.staffId);
  assert.deepEqual(f.c().aanbod, aanbod); assert.equal(f.c().aanbod.scope.code, null);
  assert.equal(f.db.data.bedrijfsWensen[r.code][0].wens, 'Team');
  assert.equal(f.db.data.zaakAbonnement[r.code].contractId, 'c-1');
});
test('herhaalde en gelijktijdige calls maken geen tweede zaak of manager', async () => {
  const f = fixture(); const r = await Promise.all(Array.from({ length: 8 }, () => f.motor.provisioneerAutomatisch('c-1')));
  assert.ok(r.every(x => x.ok && x.code === r[0].code && x.staffId === r[0].staffId));
  assert.equal(f.db.data.suppliers.length, 1); assert.equal(f.stand.gemaakt, 1);
  assert.equal(f.db.data.bedrijfsWensen[r[0].code].length, 1);
});
test('savefout voor reservering geeft geen accountsideeffect; retry maakt eenmaal', async () => {
  const f = fixture(), voor = kopie(f.db.data); f.stand.saveFout = 1;
  assert.equal((await f.motor.provisioneerAutomatisch('c-1')).status, 503);
  assert.deepEqual(f.db.data, voor); assert.equal(f.stand.gemaakt, 0);
  assert.equal((await f.motor.provisioneerAutomatisch('c-1')).ok, true); assert.equal(f.stand.gemaakt, 1);
});
test('accountfout bewaart dezelfde offline reservering en hervat zonder tweede code', async () => {
  const f = fixture(); f.stand.accountFout = true;
  assert.equal((await f.motor.provisioneerAutomatisch('c-1')).status, 503);
  const code = f.c().zaakCode; assert.equal(f.a().gezaakt.staffId, null);
  f.stand.accountFout = false;
  assert.equal((await f.motor.provisioneerAutomatisch('c-1')).code, code);
  assert.equal(f.db.data.suppliers.length, 1); assert.equal(f.stand.gemaakt, 1);
});
test('antwoordverlies na accountcommit herleest de bestaande manager', async () => {
  const f = fixture(); f.stand.accountAntwoordFout = true;
  assert.equal((await f.motor.provisioneerAutomatisch('c-1')).status, 503); assert.equal(f.a().gezaakt.staffId, null);
  assert.equal((await f.motor.provisioneerAutomatisch('c-1')).ok, true); assert.equal(f.stand.gemaakt, 1);
});
test('finalizesavefout en antwoordverlies na beide collectiecommits blijven hervatbaar', async () => {
  for (const stand of [{ saveFout: 2 }, { antwoordFout: 1 }, { antwoordFout: 2 }]) {
    const f = fixture(); Object.assign(f.stand, stand);
    assert.equal((await f.motor.provisioneerAutomatisch('c-1')).status, 503);
    const code = f.c().zaakCode; assert.ok(code);
    assert.equal((await f.motor.provisioneerAutomatisch('c-1')).ok, true);
    assert.equal(f.c().zaakCode, code); assert.equal(f.stand.gemaakt, 1); assert.equal(f.db.data.suppliers.length, 1);
  }
});
test('bestaande eigen zaak behoudt online-stand, manager en inhoud; Business vereist menselijk besluit', async () => {
  const f = fixture({ pas: 'business', scopeCode: 'BESTAAND' });
  f.db.data.suppliers.push({ code: 'BESTAAND', online: true, name: 'Bestaand' });
  f.stand.rijen.push({ id: 77, supplier_code: 'BESTAAND', member_id: 1, role: 'manager', active: 1 });
  const r = await f.motor.provisioneerAutomatisch('c-1');
  assert.equal(r.ok, true); assert.equal(r.staffId, 77); assert.equal(f.stand.gemaakt, 0);
  assert.equal(f.db.data.suppliers[0].online, true); assert.equal(f.db.data.zaakAbonnement.BESTAAND.pas, 'business');
  const g = fixture({ pas: 'business' }); g.a().besluit.door = 'AI'; const voor = kopie(g.db.data);
  assert.equal((await g.motor.provisioneerAutomatisch('c-1')).status, 403); assert.deepEqual(g.db.data, voor);
});
test('vreemde of verdwenen bestaande zaak wordt niet als nieuwe eigen zaak aangemaakt', async () => {
  const f = fixture({ scopeCode: 'VREEMD' }); f.db.data.suppliers.push({ code: 'VREEMD', online: true });
  f.stand.rijen.push({ id: 77, supplier_code: 'VREEMD', member_id: 2, role: 'manager', active: 1 });
  const voor = kopie(f.db.data);
  assert.equal((await f.motor.provisioneerAutomatisch('c-1')).status, 403); assert.deepEqual(f.db.data, voor);
  f.db.data.suppliers = []; assert.equal((await f.motor.provisioneerAutomatisch('c-1')).status, 409);
  assert.equal(f.db.data.suppliers.length, 0); assert.equal(f.stand.gemaakt, 0);
});
test('bewijsKlaar blijft leidend, ook na betaling en bij een verlopen beroepsstuk', async () => {
  const f = fixture(); f.a().bedrijf.bewijsNodig = true;
  assert.equal((await f.motor.provisioneerAutomatisch('c-1')).status, 409);
  f.a().bewijs = { afgetekend: { door: 'medewerker', at: AT }, geldigTot: '2026-11-12' };
  assert.equal((await f.motor.provisioneerAutomatisch('c-1')).status, 409);
  f.a().bewijs.geldigTot = '2027-11-13'; assert.equal((await f.motor.provisioneerAutomatisch('c-1')).ok, true);
});
test('geen activering, veranderde offerte, vreemd account of ingetrokken aanvraag geeft geen mutatie', async () => {
  for (const wijzig of [f => { delete f.c().activering; }, f => { f.c().status = 'GEACCEPTEERD'; },
    f => { f.c().aanbod.tekst += 'anders'; }, f => { f.c().accountId = 2; }, f => { f.stand.actief = false; },
    f => { f.a().status = 'ingetrokken'; }, f => { f.c().eindigtOp = '2026-11-12T00:00:00.000Z'; }]) {
    const f = fixture(); wijzig(f); const voor = kopie(f.db.data);
    assert.ok((await f.motor.provisioneerAutomatisch('c-1')).error); assert.deepEqual(f.db.data, voor); assert.equal(f.stand.gemaakt, 0);
  }
});
test('een ingetrokken beheerder wordt door een contractretry niet heraangemaakt', async () => {
  const f = fixture(); assert.equal((await f.motor.provisioneerAutomatisch('c-1')).ok, true);
  f.stand.rijen[0].active = 0;
  assert.ok((await f.motor.provisioneerAutomatisch('c-1')).error); assert.equal(f.stand.gemaakt, 1);
});
