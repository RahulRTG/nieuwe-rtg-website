'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { fixture } = require('./abonnementsdiensten-fixture.cjs');
const nieuw = { nieuweBetaaldeDienst: true };

test('echte off-session weigering krijgt eigen inbox, 31 dagen en herstel op definitief bewijs', async () => {
  const f = await fixture();
  assert.equal(f.contract.herstel.aankondiging.referentie, f.db.data.notifications['user-1'][0].id);
  assert.equal(f.meldingen.beoordeel(f.contract).stand, 'HERSTELTERMIJN');
  assert.equal(f.zaakAbonnement.magDienst('ZAAK', nieuw), true);
  f.stand.at = f.contract.herstel.herstelTot;
  assert.equal(f.zaakAbonnement.magDienst('ZAAK', nieuw), true);
  f.beperk(); assert.equal(f.zaakAbonnement.magDienst('ZAAK', nieuw), false);
  for (const basisrecht of ['facturen', 'betalen', 'opzeggen', 'nazorg'])
    assert.equal(f.zaakAbonnement.magDienst('ZAAK', { ...nieuw, basisrecht }), true);
  assert.equal(f.zaakAbonnement.magDienst('ZAAK', {}), true);
  assert.equal(f.zaakAbonnement.van('ZAAK').pas, 'business-lite');
  f.betaal(); assert.equal(f.zaakAbonnement.magDienst('ZAAK', nieuw), true);
});
test('requires_action, processing en eerste checkout worden niet tot mislukking gepromoveerd', async () => {
  for (const change of [b => { b.providerStatus = 'requires_action'; }, b => { b.providerStatus = 'processing'; },
    b => { b.start.terugkerend.modus = 'instellen'; }, b => { delete b.start; }, b => { b.provider = 'demo'; }]) {
    const f = await fixture(); change(f.bw); f.beperk();
    assert.equal(f.meldingen.beoordeel(f.contract).stand, 'BETALING_IN_BEHANDELING');
    assert.equal(f.zaakAbonnement.magDienst('ZAAK', nieuw), true);
  }
});
test('bedrijfseinde stopt nieuwe diensten op de exacte einddatum, niet dossier of nominale pas', async () => {
  const f = await fixture(); f.betaal(); f.contract.status = 'OPZEGGEND';
  f.contract.eindigtOp = '2026-11-14T10:00:00.000Z';
  assert.equal(f.zaakAbonnement.magDienst('ZAAK', nieuw), true);
  f.stand.at = f.contract.eindigtOp;
  assert.equal(f.zaakAbonnement.magDienst('ZAAK', nieuw), false);
  assert.equal(f.zaakAbonnement.magDienst('ZAAK', { basisrecht: 'nazorg', ...nieuw }), true);
  assert.equal(f.zaakAbonnement.magDienst('ZAAK', {}), true);
  assert.equal(f.zaakAbonnement.mag('ZAAK', 'can_use_pos'), true);
  f.contract.status = 'GEEINDIGD'; assert.equal(f.zaakAbonnement.magDienst('ZAAK', nieuw), false);
});
test('legacy en andere zaken blijven vrij; ongeldige automatische zaakbinding geeft geen nieuw recht', async () => {
  const f = await fixture(); f.beperk();
  assert.equal(f.zaakAbonnement.magDienst('OUD', nieuw), true);
  for (const change of [c => { c.zaakCode = 'ANDER'; }, c => { c.pas = 'business'; },
    c => { c.activering = null; }, c => { c.status = 'GEACCEPTEERD'; }]) {
    const g = await fixture(); g.betaal(); change(g.contract);
    assert.equal(g.zaakAbonnement.magDienst('ZAAK', nieuw), false);
  }
  delete f.contract.automatischAbonnement;
  assert.equal(f.zaakAbonnement.magDienst('ZAAK', nieuw), true);
  f.db.data.contracten = [];
  assert.equal(f.zaakAbonnement.magDienst('ZAAK', nieuw), false, 'verdwenen nieuwe contractbron is geen legacyfallback');
});
test('persoonlijke achterstand wordt niet op een andere houder of zijn zaak geplakt', async () => {
  const f = await fixture('lifestyle'); f.beperk();
  const service = require('../server/kern/aanmeldingen/abonnementen')({ db: f.db, accounts: {}, nu: () => f.stand.at });
  assert.equal(service.magDienst(1, nieuw), false);
  assert.equal(service.magDienst(2, nieuw), true);
  assert.equal(f.diensten.zaak('ZAAK', nieuw), true);
  f.betaal(); assert.equal(service.magDienst(1, nieuw), true);
});
