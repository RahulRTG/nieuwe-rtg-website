'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { fixture, fix, weiger, tick, gewoon } = require('./lib/plek-fixture');

test('intrekken stopt alle watches inclusief 0; herhaalde stop en late GPS zijn inert', async () => {
  const f = fixture({ key: '1' }), punten = [], redenen = [];
  const opties = { geenPlek: reden => redenen.push(reden) };
  const stopA = f.api.volg(p => punten.push(p), opties), stopB = f.api.volg(p => punten.push(p), opties);
  assert.equal(await f.api.zetAan(false), false); assert.equal(f.key(), '0');
  assert.deepEqual(f.clears.slice().sort(), [0, 1]);
  const writes = f.writes.slice();
  for (const watch of f.watches) { fix(watch); weiger(watch); }
  stopA(); stopB(); await tick();
  assert.deepEqual(punten, []); assert.deepEqual(redenen, []); assert.deepEqual(f.writes, writes);
  await f.api.zetAan(false); assert.deepEqual(f.clears.slice().sort(), [0, 1]);
});

test('bijIntrekken meldt eenmaal na een fix, pas nadat alle oude watches gestopt zijn', async () => {
  const f = fixture({ key: '1' }), meldingen = [], redenen = [], gestoptBijMelding = [];
  for (const naam of ['A', 'B']) f.api.volg(() => {}, {
    bijIntrekken() { meldingen.push(naam); gestoptBijMelding.push(f.clears.slice().sort()); },
    geenPlek: r => redenen.push(r)
  });
  fix(f.watches[0]); fix(f.watches[1]);
  await f.api.zetAan(false); await f.api.zetAan(false);
  assert.deepEqual(meldingen.sort(), ['A', 'B']); assert.deepEqual(redenen, []);
  assert.deepEqual(gestoptBijMelding, [[0, 1], [0, 1]]);
});

test('lokale stop meldt geen intrekking en laat een andere volger werken', async () => {
  const f = fixture({ key: '1' }), meldingen = [], punten = [];
  const stopA = f.api.volg(() => assert.fail('A gestopt'), { bijIntrekken: () => meldingen.push('A') });
  f.api.volg(p => punten.push(p), { bijIntrekken: () => meldingen.push('B') });
  stopA(); fix(f.watches[0]); fix(f.watches[1]);
  assert.deepEqual(meldingen, []); assert.equal(punten.length, 1); assert.equal(f.key(), '1');
  await f.api.zetAan(false); assert.deepEqual(meldingen, ['B']);
});

test('nieuwe volger vanuit bijIntrekken behoort aan de nieuwe toestemming en wordt niet meegestopt', async () => {
  const f = fixture({ key: '1' }), punten = [], meldingen = [], gestoptBijMelding = [];
  f.api.volg(() => {}, { bijIntrekken() { meldingen.push('A'); } });
  f.api.volg(() => {}, { bijIntrekken() {
    meldingen.push('B'); gestoptBijMelding.push(f.clears.slice().sort());
    f.api.volg(p => punten.push(p));
  } });
  const aan = f.api.zetAan(true);
  assert.equal(f.watches.length, 3); fix(f.gets[0]); assert.equal(await aan, true);
  fix(f.watches[0]); fix(f.watches[1]); fix(f.watches[2]);
  assert.deepEqual(meldingen.sort(), ['A', 'B']); assert.equal(punten.length, 1);
  assert.deepEqual(gestoptBijMelding, [[0, 1]]);
  assert.deepEqual(f.clears.slice().sort(), [0, 1]);
});

test('reentrant uit vanuit bijIntrekken voorkomt dat de oude aan-operatie alsnog GPS start', async () => {
  const f = fixture({ key: '1' });
  f.api.volg(() => {}, { bijIntrekken() { f.api.zetAan(false); } });
  assert.equal(await f.api.zetAan(true), false);
  assert.equal(f.key(), '0'); assert.equal(f.gets.length, 0); assert.deepEqual(f.clears, [0]);
});

test('intrekken sluit publieke vraag en volgvraag meteen, zonder oude Ja of extra toestemming', async () => {
  const f = fixture(), punten = [], redenen = [];
  const vraag = f.api.vraag({ waarom: 'Losse vraag' });
  f.api.volg(p => punten.push(p), { waarom: 'Volger', geenPlek: r => redenen.push(r) });
  const kaarten = f.nodes('.rtgplek'), knoppen = kaarten.map(k => k.querySelector('.ja'));
  assert.equal(kaarten.length, 2);
  await f.api.zetAan(false); assert.equal(await vraag, null);
  assert.equal(f.nodes('.rtgplek').length, 0); assert.equal(f.document.activeElement, f.trigger);
  knoppen.forEach(k => k.fire('click')); kaarten.forEach(k => k.fire('keydown', { key: 'Escape' })); await tick();
  assert.equal(f.key(), '0'); assert.equal(f.gets.length + f.watches.length, 0);
  assert.deepEqual(punten, []); assert.deepEqual(redenen, []);
});

test('intrekken direct na Ja voorkomt nieuwe opslag en een uitgestelde eerste GPS-vraag', async () => {
  const f = fixture(); const vraag = f.api.vraag(); f.node('.ja').click();
  await f.api.zetAan(false); assert.equal(await vraag, null);
  assert.deepEqual(f.writes, [['rtg_os_gps', '0']]); assert.equal(f.gets.length, 0);
});

for (const antwoord of ['fix', 'fout']) test('publieke get wordt bij intrekken afgewikkeld; late ' + antwoord + ' blijft inert', async () => {
  const f = fixture({ key: '1' });
  let afgerond = false;
  const vraag = f.api.vraag().then(p => { afgerond = true; return p; });
  assert.equal(f.gets.length, 1); await f.api.zetAan(false); await tick();
  assert.equal(afgerond, true, 'geen GPS-antwoord nodig om te annuleren'); assert.equal(await vraag, null);
  const writes = f.writes.slice();
  if (antwoord === 'fix') fix(f.gets[0]); else weiger(f.gets[0]); await tick();
  assert.equal(f.key(), '0'); assert.deepEqual(f.writes, writes);
});

test('gelijktijdige publieke get en eerste volgfix worden samen ingetrokken', async () => {
  const f = fixture(), punten = [], redenen = [];
  f.api.volg(p => punten.push(p), { geenPlek: r => redenen.push(r) });
  f.node('.ja').click(); await tick();
  const vraag = f.api.vraag(); assert.equal(f.gets.length, 2);
  await f.api.zetAan(false); assert.equal(await vraag, null);
  fix(f.gets[0]); weiger(f.gets[1]); await tick();
  assert.deepEqual(punten, []); assert.deepEqual(redenen, []); assert.equal(f.watches.length, 0);
  assert.equal(f.key(), '0');
});

test('uit en opnieuw aan maakt een nieuwe toestemming; oude zetAan-fout kan deze niet wissen', async () => {
  const f = fixture(); let oudAf = false;
  const oud = f.api.zetAan(true).then(aan => { oudAf = true; return aan; });
  await f.api.zetAan(false); await tick(); assert.equal(oudAf, true); assert.equal(await oud, false);
  const nieuw = f.api.zetAan(true); fix(f.gets[1]); assert.equal(await nieuw, true);
  const writes = f.writes.slice(); weiger(f.gets[0]); fix(f.gets[0]); await tick();
  assert.equal(f.key(), '1'); assert.deepEqual(f.writes, writes);
});

test('een tweede bewuste aan vervangt ook een nog lopende eerste aan', async () => {
  const f = fixture(); const oud = f.api.zetAan(true), nieuw = f.api.zetAan(true);
  assert.equal(await oud, false); fix(f.gets[1]); assert.equal(await nieuw, true);
  weiger(f.gets[0]); assert.equal(f.key(), '1');
});

test('opnieuw aan herstart oude watches nooit; alleen een nieuwe volger ontvangt nieuwe fixes', async () => {
  const f = fixture({ key: '1' }), oud = [], nieuw = [];
  f.api.volg(p => oud.push(p)); const oudeVraag = f.api.vraag();
  await f.api.zetAan(false); assert.equal(await oudeVraag, null);
  const aan = f.api.zetAan(true); fix(f.gets[1]); assert.equal(await aan, true);
  f.api.volg(p => nieuw.push(gewoon(p)));
  fix(f.watches[0]); weiger(f.watches[0]); weiger(f.gets[0]); fix(f.watches[1]);
  assert.deepEqual(oud, []); assert.equal(nieuw.length, 1); assert.equal(f.key(), '1');
  assert.deepEqual(f.clears, [0]);
});

test('intrekken vanuit de eerste fix verhindert de aansluitende watch', async () => {
  const f = fixture(); let punten = 0;
  f.api.volg(() => { punten++; f.api.zetAan(false); });
  f.node('.ja').click(); await tick(); fix(f.gets[0]); await tick();
  assert.equal(punten, 1); assert.equal(f.key(), '0'); assert.equal(f.watches.length, 0);
});

test('intrekken vóór de publieke await wist ook een al ontvangen fix uit de uitkomst', async () => {
  const f = fixture({ key: '1' }); const vraag = f.api.vraag();
  fix(f.gets[0]); await f.api.zetAan(false); assert.equal(await vraag, null);
});

for (const soort of ['eerste fix', 'watch']) test('actuele toestelweigering bij ' + soort + ' stopt alle owners en meldt alleen de betrokken volger', async () => {
  const f = fixture({ key: soort === 'watch' ? '1' : null }), redenenA = [], redenenB = [];
  f.api.volg(() => assert.fail('geen positie'), { geenPlek: r => redenenA.push(r) });
  if (soort === 'eerste fix') { f.node('.ja').click(); await tick(); }
  f.api.volg(() => assert.fail('andere watch moet stoppen'), { geenPlek: r => redenenB.push(r) });
  const vraag = f.api.vraag();
  weiger(soort === 'watch' ? f.watches[0] : f.gets[0]);
  assert.equal(await vraag, null); await tick();
  assert.deepEqual(redenenA, [soort === 'watch' ? 'toestel-weigert' : 'niet-toegestaan']);
  assert.deepEqual(redenenB, []); assert.equal(f.key(), '0');
  assert.equal(f.clears.length, f.watches.length);
  for (const w of f.watches) { fix(w); weiger(w); }
  assert.equal(redenenA.length, 1);
});

test('echte Plek en Plaats sturen na intrekken geen waarneming uit een late watch', async () => {
  const f = fixture({ key: '1' }), requests = [];
  const window = { RTGPlek: f.api, addEventListener() {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/shared/plaats.js'), 'utf8'), {
    window, localStorage: { getItem: k => k === 'rtg_member_token' ? 'lid-A' : null },
    fetch: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      return { ok: true, json: async () => ({ hekken: [{ id: 'leverancier:Z', soort: 'punt', punten: [{ lat: 52.37, lng: 4.9 }], straalM: 100 }] }) };
    }
  });
  assert.equal((await window.RTGPlaats.start('nadering')).ok, true);
  await f.api.zetAan(false); fix(f.watches[0]); await tick();
  assert.deepEqual(f.clears, [0]);
  assert.equal(requests.filter(r => r.url === '/api/plaats/waarneem').length, 0);
  assert.deepEqual(gewoon(window.RTGPlaats.stand().binnen), []);
  window.RTGPlaats.stop();
});
