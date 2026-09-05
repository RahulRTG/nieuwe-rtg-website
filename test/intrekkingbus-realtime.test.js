/* Een geconfigureerde clusterleiding is onderdeel van de machtiging van een
   persoonlijke SSE-verbinding: valt zij weg, dan blijft geen mogelijk stale
   stream open. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const signaal = require('../server/kern/intreksignaal');

test('Redis-uitval sluit bestaande streams en weigert nieuwe fail-closed', async () => {
  const oud = process.env.REDIS_URL;
  signaal._wis();
  delete require.cache[require.resolve('../server/middleware/isolatiepoort-realtime')];
  const realtime = require('../server/middleware/isolatiepoort-realtime');
  const poort = require('../server/middleware/isolatiepoort');
  const dragers = require('../server/kern/isolatie/sessiedragers');
  const maakIsolatie = require('../server/kern/isolatie');
  const functies = require('../server/functies');
  let standWachter = null;
  const bus = {
    soort: 'redis', gereed: () => true, publish() {}, subscribe() {},
    herhaal: async () => [], bewaar: async () => true,
    onStand(fn) { standWachter = fn; fn({ soort: 'redis', gereed: true }); }
  };
  const antwoord = () => ({ writableEnded: false, end() { this.writableEnded = true; } });
  try {
    process.env.REDIS_URL = 'redis://cluster';
    signaal.koppelBus(bus);
    await new Promise(resolve => setImmediate(resolve));
    dragers.zetSessieOplosser(() => ({ tier: 'rtg', key: 'user-1', account: { id: 1 } }));
    poort.zetLaag(maakIsolatie({ db: { data: {} }, save() {}, functies,
      huisStand: () => 'normaal' }), { afdwingen: true });
    const res = antwoord();
    assert.equal(realtime.registreer({ res, token: 'tok',
      sessie: { tier: 'rtg', key: 'user-1', account: { id: 1 } } }).toegestaan, true);

    standWachter({ soort: 'redis', gereed: false });
    assert.equal(res.writableEnded, true, 'de uitval sluit wat al openstond');
    const nieuw = realtime.registreer({ res: antwoord(), token: 'tok',
      sessie: { tier: 'rtg', key: 'user-1', account: { id: 1 } } });
    assert.equal(nieuw.toegestaan, false);
    assert.equal(nieuw.antwoord.reden, 'ISOLATIE_ONBEPAALD');
  } finally {
    realtime._wis(); poort.zetLaag(null); dragers.zetSessieOplosser(null); signaal._wis();
    if (oud === undefined) delete process.env.REDIS_URL; else process.env.REDIS_URL = oud;
  }
});

test('een remote intrekking blijft ook voor volgende HTTP-verificaties gelden', async () => {
  signaal._wis();
  let ontvang;
  const bus = {
    soort: 'redis', gereed: () => true, publish() {}, herhaal: async () => [],
    bewaar: async () => true,
    subscribe(k, fn) { ontvang = fn; },
    onStand(fn) { fn({ soort: 'redis', gereed: true }); }
  };
  signaal.koppelBus(bus);
  await new Promise(resolve => setImmediate(resolve));
  const token = Buffer.from('7.' + (Date.now() + 60000) + '.1.abcdefghijkl').toString('base64url') + '.sig';
  ontvang({ versie: 1, bron: 'andere-instance', soort: 'token',
    waarde: signaal.vingerVanToken(token), verloopt: Date.now() + 60000 });
  assert.equal(signaal.tokenIngetrokken(token), true);
  signaal._wis();
});

test('replay wordt geladen voordat de Redis-intrekkingsleiding gereed heet', async () => {
  signaal._wis();
  const token = 'replay-token';
  const bericht = { versie: 1, bron: 'eerder-proces', soort: 'token',
    waarde: signaal.vingerVanToken(token), verloopt: Date.now() + 60000 };
  const bus = { soort: 'redis', publish() {}, subscribe() {}, bewaar: async () => true,
    herhaal: async () => [bericht],
    onStand(fn) { fn({ soort: 'redis', gereed: true }); } };
  signaal.koppelBus(bus);
  assert.equal(signaal.stand().gereed, false, 'replay is onderdeel van readiness');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(signaal.stand().gereed, true);
  assert.equal(signaal.tokenIngetrokken(token), true);
  signaal._wis();
});

test('een mislukte duurzame Redis-intrekking geeft geen vals succes', async () => {
  signaal._wis();
  const bus = { soort: 'redis', publish() {}, subscribe() {}, herhaal: async () => [],
    bewaar: async () => { throw new Error('redis schrijf weg'); },
    onStand(fn) { fn({ soort: 'redis', gereed: true }); } };
  signaal.koppelBus(bus);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(signaal.meldToken('credential', Date.now() + 60000), true,
    'lokaal wordt onmiddellijk gesloten');
  await assert.rejects(signaal.wachtDuurzaam(), /redis schrijf weg/);
  assert.equal(signaal.stand().gereed, false,
    'na onzekere duurzaamheid blijft de machtigingsketen dicht');
  signaal._wis();
});

test('een pending intrekking wordt vóór readiness herspeeld en pas daarna gewist', async () => {
  signaal._wis();
  const token = 'outage-token';
  const rij = { sleutel: 'token:' + signaal.vingerVanToken(token), soort: 'token',
    waarde: signaal.vingerVanToken(token), verloopt: Date.now() + 60000 };
  let rijen = [rij], magBewaren = false, standWachter;
  signaal.koppelOutbox({ lijst: () => rijen.slice(),
    voltooi(s) { const voor = rijen.length; rijen = rijen.filter(r => !s.includes(r.sleutel)); return voor - rijen.length; } });
  const bus = { soort: 'redis', publish() {}, subscribe() {}, gereed: () => true,
    herhaal: async () => [],
    bewaar: async () => { if (!magBewaren) throw new Error('redis down'); return 1; },
    onStand(fn) { standWachter = fn; fn({ soort: 'redis', gereed: false }); } };
  signaal.koppelBus(bus);
  standWachter({ soort: 'redis', gereed: true });
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(signaal.stand().gereed, false);
  assert.equal(rijen.length, 1, 'mislukte replay blijft duurzaam pending');
  magBewaren = true;
  await new Promise(resolve => setTimeout(resolve, 650));
  assert.equal(rijen.length, 0);
  assert.equal(signaal.stand().gereed, true, 'readiness opent pas na SET+PUBLISH en outboxbevestiging');
  assert.equal(signaal.tokenIngetrokken(token), true);
  signaal._wis();
});

test('een gedeelde outboxrij van een gecrashte buur wordt vóór readiness herspeeld', async () => {
  signaal._wis();
  const token = 'credential-van-gecrashte-a';
  const rij = { sleutel: 'token:' + signaal.vingerVanToken(token), soort: 'token',
    waarde: signaal.vingerVanToken(token), verloopt: Date.now() + 60000 };
  let gedeeld = [rij], gedeeldVoltooid = false;
  signaal.koppelOutbox({
    lijst: () => [], voltooi: () => 0,
    gedeeld: async () => gedeeld.slice(),
    gedeeldVoltooi: async sleutels => {
      gedeeld = gedeeld.filter(r => !sleutels.includes(r.sleutel));
      gedeeldVoltooid = true;
    }
  });
  const bus = { soort: 'redis', publish() {}, subscribe() {}, gereed: () => true,
    herhaal: async () => [], bewaar: async () => 1,
    onStand(fn) { fn({ soort: 'redis', gereed: true }); } };
  signaal.koppelBus(bus);
  assert.equal(signaal.stand().gereed, false, 'de gedeelde replay hoort bij de readinessbarrier');
  for (let i = 0; i < 50 && !signaal.stand().gereed; i++)
    await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(gedeeldVoltooid, true, 'wissen volgt pas na de Redis-write');
  assert.equal(gedeeld.length, 0);
  assert.equal(signaal.tokenIngetrokken(token), true);
  assert.equal(signaal.stand().gereed, true);
  signaal._wis();
});
