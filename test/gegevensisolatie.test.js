'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { ROUTES, meet, oordeel, voegToe, antwoordVan } = require('../scripts/lib/gegevensisolatie');
const { beoordeelIdorRij } = require('../scripts/bevoegdronde');
test('gegevensisolatie: echte accounts, eigen telefoon, kruispogingen en herstart', async () => {
  // Opzettelijk onbereikbare loopbackdiensten. Een geërfde opslagconfig
  // zou de echte positieve controles doen falen, nooit een externe dienst raken.
  const vervuild = { DATABASE_URL: 'postgresql://fixture@127.0.0.1:1/verboden',
    PG_URL: 'postgresql://fixture@127.0.0.1:1/verboden', REDIS_URL: 'redis://127.0.0.1:1',
    RTG_STORE: 'postgres', RTG_AUDIT_DATABASE_URL: 'postgresql://fixture@127.0.0.1:1/verboden',
    RTG_MEDIA_BACKEND: 's3', RTG_MEDIA_S3_BUCKET: 'fixture-bucket',
    RTG_MEDIA_S3_ENDPOINT: 'http://127.0.0.1:1', RTG_MEDIA_S3_KEY: 'fixture', RTG_MEDIA_S3_SECRET: 'fixture' };
  const vorige = Object.fromEntries(Object.keys(vervuild).map(k => [k, process.env[k]]));
  let uit;
  try { Object.assign(process.env, vervuild); uit = await meet(); }
  finally { for (const [k, v] of Object.entries(vorige)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }

  for (const pad of ROUTES) {
    const r = uit['POST ' + pad];
    assert.equal(oordeel(r).stand, 'gemeten', JSON.stringify(r));
    assert.equal(beoordeelIdorRij(r, { methode: 'POST', pad }).stand, 'gemeten');
    assert.equal(beoordeelIdorRij(r, { methode: 'GET', pad }).stand, 'open');
    assert.equal(beoordeelIdorRij(r, { methode: 'POST', pad: '/api/anders' }).stand, 'open');
  }
  const origineel = uit['POST ' + ROUTES[1]];
  const wijzig = fn => { const r = structuredClone(origineel); fn(r.proef); return oordeel(r).stand; };
  const stap = (p, id) => p.stappen.find(x => x.id === id);
  assert.equal(wijzig(p => { stap(p, 'weigering:kruis:a').status = 200; }), 'gebroken');
  assert.equal(wijzig(p => { stap(p, 'weigering:kruis:a').status = 500; }), 'open');
  assert.equal(wijzig(p => { stap(p, 'weigering:kruis:a').lek = true; p.fout = 'fixture'; p.stappen.push(null); }), 'gebroken');
  assert.equal(wijzig(p => { stap(p, 'zeg:a').na.b = p.actors.a; }), 'gebroken');
  assert.equal(wijzig(p => { stap(p, 'start:b').na.overig = p.actors.a; }), 'gebroken');
  assert.equal(wijzig(p => { stap(p, 'start:a').antwoord.extra = { user: p.actors.b }; }), 'gebroken');
  assert.equal(wijzig(p => { stap(p, 'zeg:b').antwoord.extra = { telefoon: p.telefoons.a }; }), 'gebroken');
  assert.equal(wijzig(p => { stap(p, 'start:a').antwoord.extra = { profiel: p.actors.b }; p.fout = 'fixture'; p.actors = {}; p.stappen.push(null); }), 'gebroken', 'bekende payloadbreuk blijft bij ontbrekende fixture');
  assert.equal(wijzig(p => { stap(p, 'zeg:a').antwoord.tekst = { telefoon: p.telefoons.b }; p.fout = 'fixture'; }), 'gebroken', 'geneste inhoud in verwacht primitief veld');
  assert.equal(wijzig(p => { stap(p, 'weigering:anoniem:0').antwoord.extra = p.actors.a; }), 'gebroken');
  assert.equal(wijzig(p => { stap(p, 'weigering:kruis:a').gesprek = stap(p, 'start:a').gesprek; }), 'open');
  assert.equal(wijzig(p => { stap(p, 'zeg:a').actorId = p.actors.b; }), 'open');
  assert.equal(wijzig(p => { stap(p, 'start:a').doel = p.actors.a; }), 'open');
  assert.equal(wijzig(p => { p.sessies.a.voor.telefoon = p.telefoons.a; }), 'open');
  assert.equal(wijzig(p => { p.sessies.a.na.actor = p.actors.b; }), 'open');
  assert.equal(wijzig(p => { p.sessies.a.herstart.telefoon = p.telefoons.b; }), 'open');
  assert.equal(wijzig(p => { p.herstart.na.a = p.actors.a; }), 'open');
  assert.equal(wijzig(p => { p.herstart.aantal = 0; }), 'open');
  assert.equal(wijzig(p => { p.stappen = p.stappen.filter(x => x.id !== 'zeg:b'); }), 'open');
  assert.equal(wijzig(p => { p.stappen.push(p.stappen[0]); }), 'open');
  assert.equal(wijzig(p => { p.omgeving = 'productie'; }), 'open');
});
test('gegevensbewijs behoudt tegenbewijs en alle geneste antwoordvelden', () => {
  for (const oud of [{ staat: 'doorbraak' }, { staat: 'lek' }, { lek: true, staat: 'onbereikbaar' }])
    for (const nieuw of [{ staat: 'gegevensgescheiden' }, { staat: 'onbereikbaar' }])
      assert.equal(voegToe({ route: oud }, { route: nieuw }).route, oud);
  const v = antwoordVan({ extra: { phone: '0612345678' } });
  assert.deepEqual(Object.keys(v.extra), ['phone']);
  assert.match(v.extra.phone, /^[a-f0-9]{64}$/);
});
