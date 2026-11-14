'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const klok = require('../server/lib/klok');
const { fixture } = require('./organisatieabonnement-fixture.cjs');

test('organisatieherstel begrenst nieuwe WerkOS-inrichting, niet bestaande toegang of intrekking', async t => {
  const f = fixture();
  t.mock.method(klok, 'nu', () => Date.parse(f.stand.at));
  assert.equal((await f.motor.provisioneerAutomatisch(f.c().id)).ok, true);
  f.db.data.tenants['ORG-1'].groepen = [];
  f.db.data.tenants['ORG-1'].contract = { pakket: 'zakelijk', tot: null };
  const tenant = require('../server/kern/tenant')({ db: f.db, save() {},
    schoon: (s, n) => String(s || '').trim().slice(0, n), findSupplier: () => null, bedrijf: () => ({}) });
  assert.equal(tenant.contract.magWerkruimteErbij('ORG-1').ok, true);
  assert.equal(tenant.groepZet('W1', { groep: 'Team', rol: 'directie' }).ok, true);
  const { bw } = await f.achterstand();
  f.stand.at = new Date(Date.parse(f.c().herstel.herstelTot) + 1).toISOString();
  assert.equal(tenant.contract.magWerkruimteErbij('ORG-1').ok, false);
  const voor = f.kopie(f.db.data.tenants);
  assert.equal(tenant.groepZet('W1', { groep: 'Nieuw', rol: 'directie' }).status, 402);
  assert.deepEqual(f.db.data.tenants, voor, 'geweigerde inrichting verandert niets');
  assert.equal(tenant.contract.tel('ORG-1').ok, true, 'lopende WerkOS-aanroepen blijven beschikbaar');
  assert.equal(tenant.groepZet('W1', { groep: 'Team', rol: 'directie', aan: false }).ok, true,
    'beveiliging: toegang intrekken blijft mogelijk');
  assert.equal(tenant.contract.magInrichting('ORG-2').ok, true, 'de buur krijgt geen beperking');
  bw.status = 'BEVESTIGD'; bw.afgehandeldAt = f.stand.at;
  assert.equal(tenant.contract.magWerkruimteErbij('ORG-1').ok, true);
  assert.equal(tenant.groepZet('W1', { groep: 'Nieuw', rol: 'directie' }).ok, true);
  assert.equal(tenant.contract.van('ORG-1').grenzen.werkruimtes, 5,
    'Business wist bestaande technische pakketquota niet uit');
});
