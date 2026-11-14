'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { fixture, fix, weiger, tick } = require('./lib/plek-fixture');

test('toestemmingVersie leest alleen de bestaande generatie; elke bewuste wissel maakt oude versie ongeldig', async () => {
  const f = fixture(), oud = f.api.toestemmingVersie();
  assert.equal(f.api.toestemmingVersie(), oud); assert.deepEqual(f.writes, []);
  assert.equal(f.gets.length + f.watches.length, 0);
  const aan = f.api.zetAan(true), eerste = f.api.toestemmingVersie();
  assert.notEqual(eerste, oud); fix(f.gets[0]); assert.equal(await aan, true);
  await f.api.zetAan(false); assert.notEqual(f.api.toestemmingVersie(), eerste);
});

for (const ds of [false, true]) test((ds ? 'DS' : 'legacy') + ': uit in andere tab annuleert alle owners; opnieuw aan herleeft niets', async () => {
  const f = fixture({ ds, key: '1' }), punten = [], meldingen = [];
  for (const naam of ['A', 'B']) f.api.volg(p => punten.push(p), { bijIntrekken: () => meldingen.push(naam) });
  const vraag = f.api.vraag(), oud = f.api.toestemmingVersie();
  f.storage('0'); assert.equal(await vraag, null);
  assert.equal(f.key(), '0'); assert.notEqual(f.api.toestemmingVersie(), oud);
  assert.deepEqual(f.clears.slice().sort(), [0, 1]); assert.deepEqual(meldingen.sort(), ['A', 'B']);
  const ingetrokken = f.api.toestemmingVersie();
  f.storage('1'); assert.equal(f.key(), '1'); assert.notEqual(f.api.toestemmingVersie(), ingetrokken);
  assert.equal(f.gets.length, 1); assert.equal(f.watches.length, 2, 'geen automatische herstart');
  f.watches.forEach(w => { fix(w); weiger(w); }); weiger(f.gets[0]); fix(f.gets[0]); await tick();
  assert.deepEqual(punten, []); assert.equal(f.key(), '1'); assert.deepEqual(f.writes, [], 'niet terugschrijven naar andere tabs');
  const stop = f.api.volg(p => punten.push(p)); fix(f.watches[2]);
  assert.equal(punten.length, 1, 'een nieuwe bewuste volger mag de nieuwe toestemming gebruiken'); stop();
});

test('storageclear sluit open toestemming en maakt oude Ja inert', async () => {
  const f = fixture(), vraag = f.api.vraag(), ja = f.node('.ja');
  f.storage(null, null); assert.equal(await vraag, null);
  assert.equal(f.node('.rtgplek'), null); assert.equal(f.document.activeElement, f.trigger);
  ja.fire('click'); await tick();
  assert.equal(f.key(), null); assert.deepEqual(f.writes, []); assert.equal(f.gets.length, 0);
});

test('andere opslagwijziging verandert geen toestemming of actieve volger', () => {
  const f = fixture({ key: '1' }), punten = [], oud = f.api.toestemmingVersie();
  const stop = f.api.volg(p => punten.push(p)); f.storage('ander', 'rtg_andere_voorkeur');
  assert.equal(f.api.toestemmingVersie(), oud); fix(f.watches[0]);
  assert.equal(punten.length, 1); assert.deepEqual(f.clears, []); stop();
});

test('zonder GPS stopt de terminale volger vóór geenPlek, zonder latere intrekkingsmelding', async () => {
  const f = fixture({ gps: false, key: '1' }), redenen = [], intrekkingen = [];
  const stop = f.api.volg(() => assert.fail('geen GPS'), {
    geenPlek: r => redenen.push(r), bijIntrekken: () => intrekkingen.push('oud')
  });
  assert.deepEqual(redenen, ['geen-gps']); await f.api.zetAan(false); stop();
  assert.deepEqual(intrekkingen, []); assert.equal(redenen.length, 1);
});

test('Nu niet en al geweigerde vraag geven owners vrij vóór de terminale melding', async () => {
  const f = fixture(), redenen = [], intrekkingen = [];
  const opties = { geenPlek: r => redenen.push(r), bijIntrekken: () => intrekkingen.push('oud') };
  const stop = f.api.volg(() => assert.fail('geen toestemming'), opties);
  f.node('.nee').click(); await tick();
  const stopTweede = f.api.volg(() => assert.fail('weigering geldt nog'), opties); await tick();
  assert.deepEqual(redenen, ['niet-toegestaan', 'niet-toegestaan']);
  await f.api.zetAan(false); stop(); stopTweede();
  assert.deepEqual(intrekkingen, []); assert.equal(f.gets.length + f.watches.length, 0);
});

test('reentrante nieuwe toestemming na toestelerror krijgt geen oude geenPlek-melding', async () => {
  const f = fixture({ key: '1' }), redenen = []; let nieuweAan;
  f.api.volg(() => {}, {
    geenPlek: r => redenen.push(r), bijIntrekken() { nieuweAan = f.api.zetAan(true); }
  });
  weiger(f.watches[0]);
  assert.equal(f.key(), '1'); assert.equal(f.gets.length, 1); assert.deepEqual(f.clears, [0]);
  fix(f.gets[0]); assert.equal(await nieuweAan, true);
  assert.deepEqual(redenen, []); assert.equal(f.key(), '1');
});
