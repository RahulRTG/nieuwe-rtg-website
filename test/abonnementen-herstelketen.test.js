'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { keten } = require('./abonnementen-keten-fixture.cjs');
const { termijn } = require('../server/kern/aanmeldingen/abonnementstermijn');

test('herstelmelding en contractsnapshot committen samen; eigen inbox, 31 dagen en geen tierverlaging', async () => {
  const f = keten(), id = await f.getekend();
  await f.service.betaal(1, { contractId: id }); f.bevestig(); await f.service.herstel(1, { contractId: id });
  f.stand.at = '2026-12-13T10:00:00.000Z'; await f.service.ronde();
  const w = Object.values(f.db.data.betaalWaarheid).find(w => w.context.termijn === 2);
  const p = [...f.providers.values()].find(p => p.id === w.providerId); p.status = 'canceled';
  f.stand.at = '2026-12-14T10:00:00.000Z';
  assert.deepEqual((await f.service.ronde()).fouten, []);
  const c = f.db.data.contracten[0], h = c.herstel;
  assert.equal(h.herstelTot, '2027-01-14T10:00:00.000Z');
  assert.equal(f.db.data.notifications['user-1'][0].id, h.aankondiging.referentie);
  assert.equal(f.db.data.notifications['user-1'][0].body, h.tekst);
  assert.equal(f.db.data.notifications['user-2'], undefined);
  assert.equal(f.service.magDienst(1, { nieuweBetaaldeDienst: true }), true);
  f.stand.at = '2027-01-14T10:00:00.001Z';
  assert.equal(f.service.magDienst(1, { nieuweBetaaldeDienst: true }), false);
  for (const basisrecht of ['facturen', 'betalen', 'opzeggen', 'nazorg'])
    assert.equal(f.service.magDienst(1, { basisrecht, nieuweBetaaldeDienst: true }), true);
  assert.equal(f.users.get(1).tier, 'rtg');
  assert.equal(f.service.mijn(1).contracten[0].herstelstand.stand, 'BEPERKT');
});

test('opslaan mislukt: geen fictief aangekondigde hersteltermijn of gedeeltelijke inbox', async () => {
  const f = keten(), id = await f.getekend();
  await f.service.betaal(1, { contractId: id }); f.bevestig(); await f.service.herstel(1, { contractId: id });
  f.stand.at = '2026-12-13T10:00:00.000Z'; await f.service.ronde();
  const w = Object.values(f.db.data.betaalWaarheid).find(w => w.context.termijn === 2);
  [...f.providers.values()].find(p => p.id === w.providerId).status = 'canceled';
  await f.bw.begin(w.id, w.start);
  f.stand.at = '2026-12-14T10:00:00.000Z'; f.stand.saveFout = true;
  const meldingen = require('../server/kern/aanmeldingen/abonnementsmeldingen')({ ...f.opties });
  await assert.rejects(meldingen.meld(id));
  assert.equal(f.db.data.contracten[0].herstel, undefined);
  assert.equal(f.db.data.notifications, undefined);
});

test('dezelfde contractmotor rekent 11,5 maand voor jaarbetaling en bewaart de toekomstige minimumverplichting', async () => {
  const f = keten(), id = await f.getekend({ frequentie: 'jaar' });
  await f.service.betaal(1, { contractId: id }); f.bevestig(); await f.service.herstel(1, { contractId: id });
  const c = f.db.data.contracten[0];
  const motor = require('../server/kern/commercie/contract').maakContracten({ db: f.db, save() {}, nu: () => f.stand.at });
  assert.equal(termijn(c, 1).brutoCenten, 287500);
  assert.equal(motor.verplichtingOp(c, c.startAt).brutoCenten, 287500);
  assert.equal(motor.termijnenTussen(c, c.startAt, c.prijsVastTot).length, 1);
  const g = keten(), maand = await g.getekend();
  await g.service.betaal(1, { contractId: maand }); g.bevestig(); await g.service.herstel(1, { contractId: maand });
  const m = require('../server/kern/commercie/contract').maakContracten({ db: g.db, save() {} });
  const mc = g.db.data.contracten[0];
  assert.equal(m.termijnenTussen(mc, mc.startAt, mc.prijsVastTot).length, 12);
  assert.equal(m.termijnenTussen(mc, '2026-12-13T10:00:00.000Z', mc.prijsVastTot).reduce((s, t) => s + t.brutoCenten, 0), 275000);
});
