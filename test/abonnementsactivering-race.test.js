/* Synthetische keten, echte accountcallback en collectiepublicatie. De hook
   ligt na de oorspronkelijke factuurlezing, vóór de collectiewerkfunctie:
   de echte PG-slotname is daar async. Geen PG- of crashduurzaamheidsclaim. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { keten } = require('./abonnementen-keten-fixture.cjs');
async function nulTermijn() {
  const f = keten(), oud = await f.getekend({ frequentie: 'jaar' });
  await f.service.betaal(1, { contractId: oud }); f.bevestig(); await f.service.herstel(1, { contractId: oud });
  f.stand.at = '2026-11-14T10:00:00.000Z';
  const id = await f.getekend(); await f.service.betaal(1, { contractId: id });
  return { ...f, id };
}
test('nultermijn mag gewijzigde eigen factuur na collectiewacht niet blind voldaan verklaren', async () => {
  const mutanten = [i => i.abonnement.contractId = 'ander', i => i.abonnement.accountId = 2,
    i => i.abonnement.termijn = 7, i => i.abonnement.creditCenten--,
    i => i.abonnement.origineelBrutoCenten++, i => i.abonnement.valuta = 'usd',
    i => i.bijdrage = 99, i => i.btwOpbouw.nettoCenten = 1];
  for (const wijzig of mutanten) {
    const f = await nulTermijn();
    f.stand.voorSlot = () => {
      delete f.stand.voorSlot;
      wijzig(f.dossiers.get(1).invoices.find(i => i.abonnement.contractId === f.id));
    };
    await assert.rejects(f.service.afgewikkeld(1, f.id, 1), undefined, String(wijzig));
    const i = f.dossiers.get(1).invoices.at(-1);
    assert.equal(i.status, 'open'); assert.equal(i.verrekend, undefined);
    assert.equal(f.db.data.contracten.find(c => c.id === f.id).activering?.rechtenAt || null, null);
  }
});
test('nultermijn bewaart ongerelateerde verse dossiermutatie en blijft idempotent', async () => {
  const f = await nulTermijn();
  f.stand.voorSlot = () => { delete f.stand.voorSlot; f.dossiers.get(1).notitie = 'Nieuw bevestigd werk'; };
  assert.equal((await f.service.afgewikkeld(1, f.id, 1)).ok, true);
  assert.equal((await f.service.afgewikkeld(1, f.id, 1)).ok, true);
  const md = f.dossiers.get(1), i = md.invoices.find(i => i.abonnement.contractId === f.id);
  assert.equal(md.notitie, 'Nieuw bevestigd werk'); assert.equal(i.status, 'paid');
  assert.equal(i.verrekend.contractId, f.id); assert.equal(i.betaalBewijzen, undefined);
  assert.equal(f.providers.size, 1, 'alleen oorspronkelijke jaarbetaling; geen fakecent');
});
test('laat gewijzigd betaald bewijs wordt binnen de verse accountcallback opnieuw geweigerd', async () => {
  for (const wijzig of [i => i.status = 'open', i => i.betaalBewijzen = []]) {
    const f = keten(), id = await f.getekend();
    await f.service.betaal(1, { contractId: id }); f.bevestig(); await f.service.herstel(1, { contractId: id });
    f.stand.voorSlot = () => { delete f.stand.voorSlot; wijzig(f.dossiers.get(1).invoices[0]); };
    await assert.rejects(f.service.afgewikkeld(1, id, 1));
  }
});
test('een oude rechtenretry na accountcommit-wacht draait een inmiddels voltooide upgrade niet terug', async () => {
  const f = keten(), oud = await f.getekend();
  await f.service.betaal(1, { contractId: oud }); f.bevestig(); await f.service.herstel(1, { contractId: oud });
  const origineel = f.accounts.achtergrondWerk;
  let pak = true, wachtKlaar, door;
  const wacht = new Promise(r => { wachtKlaar = r; }), vervolg = new Promise(r => { door = r; });
  f.accounts.achtergrondWerk = async fn => {
    const deze = pak; pak = false;
    const r = await origineel(fn);
    if (deze) { wachtKlaar(); await vervolg; }
    return r;
  };
  const retry = f.service.afgewikkeld(1, oud, 1);
  await wacht;
  try {
    f.stand.at = '2026-11-28T10:00:00.000Z';
    f.db.data.aanmeldingen.unshift({ id: 'lifestyle-race', pas: 'lifestyle', accountId: 1, status: 'geaccepteerd',
      besluit: { besluit: 'geaccepteerd', door: 'Bevoegd medewerker', at: f.stand.at } });
    const nieuw = await f.getekend({ pas: 'lifestyle', aanmeldingId: 'lifestyle-race' });
    await f.service.betaal(1, { contractId: nieuw }); f.bevestig(); await f.service.herstel(1, { contractId: nieuw });
    assert.equal(f.users.get(1).tier, 'lifestyle');
  } finally { door(); }
  await retry;
  assert.equal(f.db.data.contracten.find(c => c.id === oud).status, 'GEEINDIGD');
  assert.equal(f.users.get(1).tier, 'lifestyle');
});
