'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { creditketen, activeer } = require('./abonnementscredit-fixture.cjs');
const { plan } = require('../server/kern/commercie/abonnementsverrekening');

test('jaar → nulmaand → upgrade draagt ongebruikte termijn én onuitgegeven rest door, zonder nieuwe cash', async () => {
  const f = await creditketen(), k = f.lees(f.huidig).verrekening.creditCenten;
  f.stand.at = '2026-11-29T10:00:00.000Z';
  const r = f.plan(), voor = JSON.stringify(f.input());
  assert.equal(r.ok, true, r.redenen.join('; '));
  assert.equal(r.beschikbaarCenten, k - 12500); assert.equal(r.creditCenten, 25000);
  assert.equal(r.overCenten, k - 37500);
  const maand = r.regels.find(x => x.factuurId), rest = r.regels.find(x => x.soort === 'resttegoed');
  assert.equal(maand.brutoCenten, 25000); assert.equal(maand.creditHerkomst.cashCenten, 0);
  assert.equal(rest.beschikbaarCenten, k - 25000); assert.equal(rest.toegewezenCenten, 25000);
  assert.equal(rest.factuurId, undefined, 'contractrest is geen verzonnen factuur');
  assert.ok(rest.betaalWaarheidIds.length); assert.ok(rest.bronFactuurIds.length);
  assert.deepEqual(f.plan(), r); assert.equal(JSON.stringify(f.input()), voor);
  const derde = await activeer(f);
  assert.equal(f.lees(derde).verrekening.creditCenten, k - 12500);
  assert.equal(f.lees(f.huidig).vervangenDoor, derde); assert.equal(f.providers.size, 1);
  const vierde = await activeer(f);
  assert.equal(f.lees(vierde).verrekening.creditCenten, k - 12500, 'op dezelfde tijd wordt geen cent bijgemaakt');
  assert.equal(f.providers.size, 1);
});
test('hybride termijnwaarde omvat werkelijk cash én eerder betaald credit, niet alleen nieuwe cash', async () => {
  const f = await creditketen(true); f.stand.at = '2026-12-13T10:00:00.000Z';
  const r = f.plan(2000000);
  assert.equal(r.ok, true, r.redenen.join('; ')); assert.equal(r.creditCenten, 1000000);
  assert.equal(r.teBetalenCenten, 1000000); assert.equal(r.regels[0].brutoCenten, 2000000);
  assert.equal(r.regels[0].creditHerkomst.cashCenten, 1987500);
  assert.equal(r.regels[0].creditHerkomst.creditCenten, 12500);
  assert.equal(r.regels[0].betaalWaarheidIds.length, 2);
  const derde = await activeer(f, f.keuze);
  assert.equal(f.lees(derde).aanbod.verrekening.creditCenten, 1000000);
  assert.equal(f.lees(derde).aanbod.verrekening.teBetalenCenten, 1000000);
});
test('reeds gebruikte credittermijnen worden afgetrokken vóór het resterende saldo wordt doorgegeven', async () => {
  const f = await creditketen(), k = f.lees(f.huidig).verrekening.creditCenten;
  f.stand.at = '2026-12-14T10:00:00.000Z'; assert.deepEqual((await f.service.ronde()).fouten, []);
  f.stand.at = '2026-12-29T10:00:00.000Z';
  const r = f.plan(999999);
  assert.equal(r.ok, true, r.redenen.join('; '));
  assert.equal(r.beschikbaarCenten, k - 50000 + Math.floor(25000 * 16 / 31));
  assert.equal(r.regels.find(x => x.soort === 'resttegoed').toegewezenCenten, 50000);
  const facturen = f.dossiers.get(1).invoices;
  const ontbreekt = facturen.findIndex(x => x.abonnement.contractId === f.huidig && x.abonnement.termijn === 1);
  facturen.splice(ontbreekt, 1);
  assert.equal(f.plan().controleNodig, true, 'een verdwenen gebruikte termijn maakt nooit nieuw resttegoed');
});
test('reservering sluit zowel huidige factuur als resttegoed uit; vrijgeven maakt dezelfde bronnen weer beschikbaar', async () => {
  const f = await creditketen(); f.stand.at = '2026-11-29T10:00:00.000Z';
  const voor = f.plan(), id = await f.getekend();
  const r = f.plan(); assert.equal(r.ok, true); assert.equal(r.creditCenten, 0); assert.equal(r.overCenten, 0);
  assert.ok(r.overgeslagen.some(x => x.creditId === f.huidig));
  const c = f.lees(id);
  await f.service.intrekken(1, { contractId: id, aanbodHash: c.aanbod.hash });
  assert.deepEqual(f.plan(), voor);
});
test('refund of pending refund op de oorspronkelijke cash maakt afgeleide overdracht controleplichtig', async () => {
  for (const wijzig of [w => { w.status = 'GEDEELTELIJK_TERUGBETAALD'; w.terugbetaaldCenten = 1; },
    w => { w.terugbetaalOpdrachten = [{ status: 'VASTGELEGD', centen: 1 }]; },
    w => { w.status = 'TERUGBETAALD'; w.terugbetaaldCenten = w.centen; }]) {
    const f = await creditketen(); wijzig(Object.values(f.db.data.betaalWaarheid)[0]);
    const r = f.plan(); assert.equal(r.ok, false); assert.equal(r.controleNodig, true); assert.equal(r.creditCenten, null);
  }
});
test('huidige hybride cashrefund wordt voorzichtig volledig van de ongebruikte totale waarde afgetrokken', async () => {
  const f = await creditketen(true); f.stand.at = '2026-12-13T10:00:00.000Z';
  const w = Object.values(f.db.data.betaalWaarheid).find(w => w.context.contractId === f.huidig);
  w.status = 'GEDEELTELIJK_TERUGBETAALD'; w.terugbetaaldCenten = 900000;
  assert.equal(f.plan(2000000).creditCenten, 100000);
  w.terugbetaalOpdrachten = [{ status: 'IN_BEHANDELING', centen: 1 }];
  assert.equal(f.plan().controleNodig, true);
});
test('clamp en afronding behouden alle beschikbare centen, ook bij een doel van nul', async () => {
  const f = await creditketen(); f.stand.at = '2026-11-29T10:00:00.001Z';
  const r = f.plan(0), k = f.lees(f.huidig).verrekening.creditCenten;
  assert.equal(r.ok, true); assert.equal(r.creditCenten, 0); assert.equal(r.teBetalenCenten, 0);
  assert.equal(r.overCenten, k - 12501);
  assert.equal(r.regels.reduce((s, r) => s + r.centen + r.overCenten, 0), r.beschikbaarCenten);
});
test('ongeldige bronverzamelingen blijven een duidelijk controleantwoord, geen exception of stille nul', () => {
  for (const invoer of [null, {}, { contract: {} }]) {
    const r = plan(invoer); assert.equal(r.ok, false); assert.equal(r.controleNodig, true); assert.equal(r.creditCenten, null);
  }
});
