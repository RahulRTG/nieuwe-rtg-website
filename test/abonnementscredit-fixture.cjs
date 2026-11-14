'use strict';
const { keten } = require('./abonnementen-keten-fixture.cjs');
const { plan } = require('../server/kern/commercie/abonnementsverrekening');
async function activeer(f, input = {}) {
  const id = await f.getekend(input);
  await f.service.betaal(1, { contractId: id }); f.bevestig();
  await f.service.herstel(1, { contractId: id });
  return id;
}
async function creditketen(hybride = false) {
  const f = keten(), bron = await activeer(f, { frequentie: hybride ? 'maand' : 'jaar' });
  f.stand.at = hybride ? '2026-11-28T10:00:00.000Z' : '2026-11-14T10:00:00.000Z';
  if (hybride) f.db.data.aanmeldingen.unshift({ id: 'menselijk-lifestyle', pas: 'lifestyle', accountId: 1,
    status: 'geaccepteerd', besluit: { besluit: 'geaccepteerd', door: 'Bevoegd medewerker', at: f.stand.at } });
  const keuze = hybride ? { pas: 'lifestyle', aanmeldingId: 'menselijk-lifestyle' } : {};
  const huidig = await activeer(f, keuze);
  const lees = id => f.db.data.contracten.find(c => c.id === id);
  const input = (doelCenten = 25000) => ({ contract: lees(huidig), facturen: f.dossiers.get(1).invoices,
    betaalWaarheid: f.db.data.betaalWaarheid, contracten: f.db.data.contracten, op: f.stand.at, doelCenten });
  return { ...f, bron, huidig, keuze, lees, input, plan: doel => plan(input(doel)) };
}
module.exports = { activeer, creditketen };
