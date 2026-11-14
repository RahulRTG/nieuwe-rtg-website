'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const maak = require('../server/kern/betaalwaarheid');
const kopie = x => JSON.parse(JSON.stringify(x));
function pauze() { let klaar; const wacht = new Promise(resolve => { klaar = resolve; }); return { wacht, klaar }; }
function fixture() {
  const data = {}, gestart = pauze(), vervolg = pauze();
  let aantal = 0, callback = async () => {}, providerFout = false;
  const rail = {
    async maakBetaling(o) { gestart.klaar(); await vervolg.wacht;
      if (providerFout) throw Error('Providerantwoord verloren');
      return { id: 'pi_publicatie', status: 'succeeded', aanbieder: 'stripe', bedrag: o.bedrag, valuta: o.valuta }; },
    async haalBetaling() { gestart.klaar(); await vervolg.wacht;
      if (providerFout) throw Error('Providerantwoord verloren');
      return { id: 'pi_publicatie', status: 'succeeded', aanbieder: 'stripe', bedrag: 12100, valuta: 'eur' }; }
  };
  const w = maak({ d: () => data, save() {}, crypto, betaal: rail });
  w.registreerAfhandeling('factuur', async r => { aantal++; await callback(r); });
  const r = w.maak({ actor: 'acc:1', idem: 'publicatie', soort: 'factuur', bronRef: 'INV-1', centen: 12100,
    context: { own: true, accountId: 1, invoiceId: 'INV-1', contractId: 'C-1', termijn: 1 } });
  const publiceer = () => { data.betaalWaarheid = kopie(data.betaalWaarheid); return data.betaalWaarheid[r.id]; };
  return { data, w, r, gestart, vervolg, publiceer, aantal: () => aantal,
    callback: fn => { callback = fn; }, providerFout: () => { providerFout = true; },
    nu: () => data.betaalWaarheid[r.id] };
}

for (const ophalen of [false, true]) test('provider-' + (ophalen ? 'retrieve' : 'create') + '-await publiceert op actuele BW-rij', async () => {
  const f = fixture();
  if (ophalen) { f.r.provider = 'stripe'; f.r.providerId = 'pi_publicatie'; }
  const werk = f.w.begin(f.r.id, { aanbieder: 'stripe' });
  await f.gestart.wacht; const vers = f.publiceer();
  vers.extra = 'nieuwe termijn bleef behouden'; f.vervolg.klaar();
  const uit = await werk;
  assert.equal(f.nu().status, 'BEVESTIGD'); assert.equal(f.nu().providerId, 'pi_publicatie');
  assert.ok(f.nu().afgehandeldAt); assert.equal(uit.betaling.afgehandeld, true);
  assert.equal(f.nu().extra, 'nieuwe termijn bleef behouden'); assert.equal(f.aantal(), 1);
});

test('domeincallback die map publiceert krijgt afgehandeldAt op de nieuwe rij', async () => {
  const f = fixture(); f.callback(() => { f.publiceer().extra = 'contract geactiveerd'; });
  f.vervolg.klaar(); const uit = await f.w.begin(f.r.id, { aanbieder: 'stripe' });
  assert.ok(f.nu().afgehandeldAt); assert.equal(uit.betaling.afgehandeld, true);
  assert.equal(f.nu().gebeurtenissen.at(-1).soort, 'DOMEIN_AFGEHANDELD');
  await f.w.ronde({ tot: Date.now() + 100000 }); assert.equal(f.aantal(), 1);
});

test('callbackfout na publicatie bewaart herstelstand op actuele rij en retry herneemt', async () => {
  const f = fixture(); f.callback(() => { f.publiceer(); throw Error('activatie onderbroken'); });
  f.vervolg.klaar();
  await assert.rejects(() => f.w.begin(f.r.id, { aanbieder: 'stripe' }), e => e.code === 'BETAAL_AFHANDELING_MISLUKT');
  assert.equal(f.nu().status, 'BEVESTIGD'); assert.equal(f.nu().afhandelingPogingen, 1);
  assert.match(f.nu().afhandelingLaatsteFout, /activatie onderbroken/); assert.equal(f.nu().afgehandeldAt, undefined);
  f.callback(() => { f.publiceer(); });
  assert.equal((await f.w.ronde({ tot: Date.now() + 100000 })).ok, true);
  assert.ok(f.nu().afgehandeldAt); assert.equal(f.aantal(), 2);
});

test('gewijzigde valuta tijdens providerawait wordt niet met oud bewijs betaald', async () => {
  const f = fixture();
  const d = f.w.begin(f.r.id, { aanbieder: 'stripe' });
  await f.gestart.wacht; f.publiceer();
  // Providerresultaat met foutieve valuta dwingt controle af, niet oud object.
  f.nu().valuta = 'usd'; f.vervolg.klaar();
  await assert.rejects(() => d, e => e.code === 'BETAALWAARHEID_PUBLICATIE_CONFLICT');
  assert.equal(f.nu().providerId, null); assert.equal(f.aantal(), 0);
});

test('echte providerthrow na publicatie bewaart fout op actuele rij', async () => {
  const f = fixture(); f.providerFout();
  const werk = f.w.begin(f.r.id, { aanbieder: 'stripe' });
  await f.gestart.wacht; f.publiceer(); f.vervolg.klaar();
  // De aparte bewijsadapter mag de onbewezen testprovider verder weigeren;
  // hier moet het oorspronkelijke fout-event op de actuele rij staan.
  await assert.rejects(() => werk);
  assert.equal(f.nu().gebeurtenissen.at(-1).soort, 'PROVIDER_FOUT');
  assert.match(f.nu().gebeurtenissen.at(-1).fout, /Providerantwoord verloren/);
  assert.equal(f.nu().providerId, null); assert.equal(f.aantal(), 0);
});

test('echte typed collectiepublicatie tijdens providerawait bewaart bevestiging en andere betaling', async () => {
  const f = fixture(), db = { data: f.data, writable: true };
  const bewerk = require('../server/db/collectie-bewerken')({ db, store: 'memory', save() {} });
  const werk = f.w.begin(f.r.id, { aanbieder: 'stripe' });
  await f.gestart.wacht;
  await bewerk({ betaalWaarheid: 'kaart' }, stand => { stand.betaalWaarheid['BW-andere'] = { id: 'BW-andere' }; });
  assert.notEqual(f.nu(), f.r, 'proef moet objectvervanging bereiken');
  f.vervolg.klaar();
  assert.equal((await werk).betaling.afgehandeld, true);
  assert.equal(f.nu().status, 'BEVESTIGD'); assert.ok(f.nu().afgehandeldAt);
  assert.equal(f.data.betaalWaarheid['BW-andere'].id, 'BW-andere');
});

test('hervatronde leest actuele status na provider en schrijft geen wachtstand op verdwenen object', async () => {
  const f = fixture(); f.w.bereidVoor(f.r.id, { aanbieder: 'stripe' });
  const werk = f.w.ronde({ tot: Date.now() + 3600000 });
  await f.gestart.wacht; f.publiceer(); f.vervolg.klaar();
  const uit = await werk;
  assert.equal(uit.hervat.afgerond, 1); assert.equal(uit.hervat.wachtNog, 0);
  assert.equal(f.nu().status, 'BEVESTIGD'); assert.equal(f.nu().hervatPogingen, undefined);
});

test('gewijzigde eigenaar/context of verdwenen rij wordt nooit met oud bewijs betaald', async () => {
  for (const wijzig of [r => { r.actor = 'acc:2'; }, r => { r.context.accountId = 2; },
    r => { r.context.contractId = 'C-2'; }, r => { r.centen = 13000; },
    r => { r.gebeurtenissen = []; }, r => { r.start = { aanbieder: 'mollie' }; }]) {
    const f = fixture(), werk = f.w.begin(f.r.id, { aanbieder: 'stripe' });
    await f.gestart.wacht; wijzig(f.publiceer()); f.vervolg.klaar();
    await assert.rejects(() => werk, e => e.code === 'BETAALWAARHEID_PUBLICATIE_CONFLICT');
    assert.notEqual(f.nu().status, 'BEVESTIGD'); assert.equal(f.aantal(), 0);
  }
  const f = fixture(), werk = f.w.begin(f.r.id, { aanbieder: 'stripe' });
  await f.gestart.wacht; delete f.data.betaalWaarheid[f.r.id]; f.vervolg.klaar();
  await assert.rejects(() => werk, e => e.code === 'BETAALWAARHEID_PUBLICATIE_CONFLICT');
  assert.equal(f.nu(), undefined); assert.equal(f.aantal(), 0);
});

test('latere refund/controle tijdens callback krijgt geen onwaar afgehandeldAt', async () => {
  const f = fixture(); f.callback(() => { f.publiceer().status = 'CONTROLE_NODIG'; });
  f.vervolg.klaar(); await assert.rejects(() => f.w.begin(f.r.id, { aanbieder: 'stripe' }));
  assert.equal(f.nu().status, 'CONTROLE_NODIG'); assert.equal(f.nu().afgehandeldAt, undefined);
});

test('provider-id die tijdens startcontrole verschijnt wordt opgehaald en nooit opnieuw gestart', async () => {
  const data = {}; let starts = 0, haalt = 0;
  const rail = {
    async maakBetaling() { starts++; throw Error('geen tweede providerstart'); },
    async haalBetaling() { haalt++; return { id: 'pi_tijdens_controle', status: 'succeeded',
      aanbieder: 'stripe', bedrag: 12100, valuta: 'eur' }; }
  };
  const w = maak({ d: () => data, save() {}, crypto, betaal: rail });
  w.registreerAfhandeling('factuur', async () => {});
  const r = w.maak({ actor: 'acc:1', idem: 'controle-race', soort: 'factuur', bronRef: 'INV-race',
    centen: 12100, context: { own: true, startcontrole: 'race' } });
  w.bereidVoor(r.id, { aanbieder: 'stripe' });
  w.registreerStartcontrole('race', async () => {
    data.betaalWaarheid = kopie(data.betaalWaarheid);
    const vers = data.betaalWaarheid[r.id]; vers.provider = 'stripe'; vers.providerId = 'pi_tijdens_controle';
  });
  const uit = await w.begin(r.id, { aanbieder: 'stripe' });
  assert.equal(starts, 0); assert.equal(haalt, 1);
  assert.equal(uit.betaling.status, 'BEVESTIGD');
  assert.equal(data.betaalWaarheid[r.id].providerId, 'pi_tijdens_controle');
});
