'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { creditketen } = require('./abonnementscredit-fixture.cjs');
const { plan } = require('../server/kern/commercie/abonnementsverrekening');
const { maakAanbod } = require('../server/kern/aanmeldingen/abonnementsaanbod-vorm');
function controle(f) {
  const r = f.plan(); assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.controleNodig, true); assert.equal(r.creditCenten, null); assert.equal(r.overCenten, null);
  assert.deepEqual(r.regels, []);
}
test('alleen paid of creditvelden vertrouwen kan geen nultermijn of hybride termijn bekostigen', async () => {
  for (const hybride of [false, true]) for (const wijzig of [
    i => { delete i.verrekend; delete i.betaalBewijzen; }, i => { i.abonnement.creditCenten--; },
    i => { i.abonnement.origineelBrutoCenten++; }, i => { i.abonnement.aanbodHash = 'ander'; },
    i => { i.abonnement.accountId = 2; }, i => { i.abonnement.valuta = 'usd'; },
    i => { i.abonnement.termijn = 2; }, i => { i.abonnement.tot = '2027-01-14T10:00:00.000Z'; },
    i => { i.status = 'open'; }, i => { i.bijdrage++; }
  ]) {
    const f = await creditketen(hybride);
    wijzig(f.dossiers.get(1).invoices.find(i => i.abonnement.contractId === f.huidig)); controle(f);
  }
});
test('gewijzigde reservering, ontbrekende activering of afwijkende voorganger geven geen nieuwe credit', async () => {
  for (const wijzig of [
    c => { c.verrekening.creditCenten++; }, c => { c.verrekening.creditCenten = 0; },
    c => { c.verrekening.regels[0].centen--; }, c => { c.verrekening.status = 'GERESERVEERD'; },
    c => { c.verrekening.toegepastAt = '2026-11-13T10:00:00.000Z'; },
    c => { delete c.activering; }, c => { delete c.ondertekening; },
    c => { c.ondertekening.profiel = 'user-2'; }, c => { c.aanbod.verrekening.overCenten++; }
  ]) { const f = await creditketen(); wijzig(f.lees(f.huidig)); controle(f); }
  for (const wijzig of [c => { c.vervangenDoor = 'ander'; }, c => { c.accountId = 2; },
    c => { c.eindigtOp = '2026-11-15T10:00:00.000Z'; }, c => { c.status = 'ACTIEF'; }]) {
    const f = await creditketen(); wijzig(f.lees(f.bron)); controle(f);
  }
});
test('dezelfde voorganger kan niet in twee opvolgers worden uitgegeven of onder een andere bron worden verstopt', async () => {
  const f = await creditketen();
  const dubbel = structuredClone(f.lees(f.huidig)); dubbel.id = 'dubbel';
  f.db.data.contracten.push(dubbel); controle(f);
  f.db.data.contracten.pop();
  const r = f.plan(); assert.equal(r.ok, true);
  f.db.data.contracten.push({ id: 'vreemde-claim', accountId: 1,
    verrekening: { bronContractId: 'ander-contract', status: 'GERESERVEERD', regels: r.regels } });
  controle(f);
});
test('dubbele termijn, dubbele bronrij en verdwenen oorspronkelijke factuur blijven fail-closed', async () => {
  for (const wijzig of [f => { f.db.data.contracten.push(structuredClone(f.lees(f.bron))); },
    f => { f.db.data.contracten.splice(f.db.data.contracten.indexOf(f.lees(f.bron)), 1); },
    f => { f.dossiers.get(1).invoices.push(structuredClone(f.dossiers.get(1).invoices.at(-1))); },
    f => { f.dossiers.get(1).invoices.splice(0, 1); }]) {
    const f = await creditketen(); wijzig(f); controle(f);
  }
});
test('dezelfde providerbetaling onder een nieuwe BW-id kan niet tegelijk oorspronkelijke cash en hybride bijbetaling zijn', async () => {
  const f = await creditketen(true), ws = Object.values(f.db.data.betaalWaarheid);
  const oud = ws.find(w => w.context.contractId === f.bron), nieuw = ws.find(w => w.context.contractId === f.huidig);
  nieuw.providerPaymentId = oud.providerId; controle(f);
});
test('gewijzigd contract- of termijnbewijs op cash van een hybride factuur wordt geweigerd', async () => {
  for (const wijzig of [w => { w.context.termijn = 9; }, w => { w.context.contractId = 'ander'; },
    w => { w.context.accountId = 2; }, w => { w.status = 'WACHT_OP_KLANT'; },
    w => { w.terugbetaalOpdrachten = [{ status: 'VASTGELEGD', centen: 1 }]; }]) {
    const f = await creditketen(true); wijzig(Object.values(f.db.data.betaalWaarheid).find(w => w.context.contractId === f.huidig));
    controle(f);
  }
});
test('nultermijn met verzonnen providerbewijs, vreemd verrekenreceipt of extra toekomstige termijn levert niets op', async () => {
  for (const wijzig of [i => { i.betaalBewijzen = [{ id: 'fake', centen: 0 }]; },
    i => { i.verrekend.contractId = 'ander'; }, i => { i.verrekend.creditCenten++; },
    i => { i.abonnement.termijn = 600000; }]) {
    const f = await creditketen(); wijzig(f.dossiers.get(1).invoices.at(-1)); controle(f);
  }
});
test('zelfverwijzing en een wederzijdse keten blijven begrensd, ook met opnieuw gevormde offertehash', async () => {
  const f = await creditketen(), c = f.lees(f.huidig);
  c.verrekening.bronContractId = c.id; controle(f);
  const g = await creditketen(), a = g.lees(g.bron), b = g.lees(g.huidig);
  // Maak de grafiek syntactisch gesloten; de oorspronkelijke cash is daarmee
  // uitdrukkelijk geen geldige ongewijzigde oorsprong meer.
  a.verrekening = structuredClone(b.verrekening); a.verrekening.bronContractId = b.id;
  a.verrekening.toegepastAt = a.startAt; b.vervangenDoor = a.id; b.eindigtOp = a.startAt; b.status = 'GEEINDIGD';
  const oud = a.aanbod, q = { ...structuredClone(b.aanbod.verrekening), bronContractId: b.id };
  a.aanbod = maakAanbod(a, { prijs: oud.prijs, scope: oud.scope, verrekening: q, at: oud.at, opdracht: oud.opdracht });
  const r = plan({ ...g.input(), contract: b, op: b.startAt });
  assert.equal(r.controleNodig, true);
});
