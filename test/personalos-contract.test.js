'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { normaliseer } = require('../server/kern/personalos/contract');
const catalog = require('../server/kern/personalos/catalog');
const engine = require('../server/kern/personalos/engine');

test('PersonalOS-contract bewaart alleen beperkte vrijwillige voorkeuren', () => {
  const ids = catalog.allIds();
  const r = normaliseer({ goals: ['ondernemen', 'ondernemen'], layout: 'simple',
    pinnedCapabilities: ['onderneming'], hiddenSuggestions: ['theater'],
    medicalDiagnosis: 'mag niet mee', debt: 4000, contextRef: 'bedrijf-van-een-ander' }, ids);
  assert.deepEqual(r.goals, ['ondernemen']);
  assert.equal(r.medicalDiagnosis, undefined);
  assert.equal(r.debt, undefined);
  assert.equal(r.contextRef, undefined);
  assert.equal(r.worldOrderMode, 'auto');
  assert.equal(normaliseer({ goals: ['sociale_klasse_arm'] }, ids).status, 400);
  assert.equal(normaliseer({ pinnedCapabilities: ['onbekende-app'] }, ids).status, 400);
});

test('Authority Adapter sluit doelgroep en ingetrokken functies fail-closed uit', () => {
  const open = catalog.toegestaan({ tier: 'rtg', state: {}, person: 'user-1' });
  assert.ok(open.some(x => x.id === 'onderneming'));
  assert.ok(!open.some(x => x.id === 'werkos'), 'een RTG-pas is geen WorkOS-relatie');
  const dicht = catalog.toegestaan({ tier: 'rtg', state: { ondernemersos: { aan: false } }, person: 'user-1' });
  assert.ok(!dicht.some(x => x.id === 'onderneming'));
  assert.deepEqual(catalog.toegestaan({ tier: 'onbekend', state: {}, person: 'x' }), []);
});

test('de samensteller is deterministisch en heeft geen AI of I/O nodig', () => {
  const capabilities = catalog.preview();
  const preferences = { ...normaliseer({ goals: ['talent_ontwikkelen'],
    pinnedCapabilities: ['podium'] }, catalog.allIds()), revision: 4 };
  const args = { catalog: capabilities, preferences, contextRef: 'private:x', subjectRef: 'member:X',
    authorityRevision: 'a_1', catalogVersion: 'test', now: () => '2026-11-10T10:00:00.000Z',
    hash: s => crypto.createHash('sha256').update(s).digest('hex') };
  const a = engine.maak(args), b = engine.maak(args);
  assert.deepEqual(a, b);
  assert.equal(a.worlds.flatMap(w => w.capabilities)[0].id, 'podium');
  const start = process.hrtime.bigint();
  for (let i = 0; i < 1000; i++) engine.maak(args);
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  assert.ok(ms < 1000, '1000 composities duurden ' + ms.toFixed(1) + ' ms');
});

test('automatische wereldvolgorde volgt doelen, handmatige volgorde blijft staan', () => {
  const capabilities = catalog.preview();
  const hash = s => crypto.createHash('sha256').update(s).digest('hex');
  const bouw = preferences => engine.maak({ catalog: capabilities, preferences,
    contextRef: 'x', subjectRef: 'x', authorityRevision: 'x', catalogVersion: 'x',
    now: () => '2026-11-10T10:00:00.000Z', hash });
  const auto = normaliseer({ goals: ['ondernemen'] }, catalog.allIds());
  assert.equal(bouw({ ...auto, revision: 1 }).worlds[0].id, 'workos');
  const hand = normaliseer({ goals: ['ondernemen'], worldOrder: ['travelos', 'livingos'] }, catalog.allIds());
  assert.equal(hand.worldOrderMode, 'manual');
  assert.equal(bouw({ ...hand, revision: 1 }).worlds[0].id, 'travelos');
});

test('de 16 koppelingen en alle 102 overige catalogusbestemmingen zijn feitelijk geclassificeerd', () => {
  const items = require('../public/shared/sprongindex.json').items;
  const eigenaars = require('../SCHERMEIGENAAR.json').capabilities;
  const perScherm = new Map();
  for (const [capability, scherm] of Object.entries(eigenaars)) {
    const lijst = perScherm.get(scherm) || [];
    lijst.push(capability); perScherm.set(scherm, lijst);
  }
  const documentpad = url => String(url || '').split(/[?#]/)[0].replace(/^\//, '');
  const perDocument = new Map();
  for (const item of items) if (item.url) {
    const p = documentpad(item.url);
    perDocument.set(p, (perDocument.get(p) || 0) + 1);
  }

  /* Selecteer de concrete catalogusrij die de adapter werkelijk gebruikt.
     `reizen` bestaat ook als tab zonder URL; die rij is dus een van de 102
     overige bestemmingen en niet stil een zeventiende capability. */
  const gekoppeld = new Set();
  for (const capability of catalog.preview()) {
    const index = items.findIndex((item, i) => !gekoppeld.has(i) &&
      item.sleutel === capability.id && item.url === capability.url);
    assert.notEqual(index, -1, capability.id + ': concrete sprongindexrij ontbreekt');
    gekoppeld.add(index);
    const scherm = documentpad(capability.url);
    assert.equal((perScherm.get(scherm) || []).length, 1, capability.id + ': geen unieke schermeigenaar');
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', scherm)), capability.id + ': schermbestand ontbreekt');
  }
  assert.equal(gekoppeld.size, 16);

  const klassen = { canoniek_scherm_zonder_binding: 0, gedeeld_document_of_deeplink: 0,
    tab_zonder_route: 0, os_handelingsingang_zonder_route: 0 };
  items.forEach((item, index) => {
    if (gekoppeld.has(index)) return;
    if (!item.url) {
      if (item.soort === 'tab') klassen.tab_zonder_route++;
      else if (item.soort === 'os') klassen.os_handelingsingang_zonder_route++;
      else assert.fail(item.sleutel + ': ongeclassificeerde ingang zonder route');
      return;
    }
    const scherm = documentpad(item.url);
    if (/[?#]/.test(item.url) || (perDocument.get(scherm) || 0) > 1) {
      klassen.gedeeld_document_of_deeplink++;
      return;
    }
    assert.equal((perScherm.get(scherm) || []).length, 1, item.sleutel + ': geen unieke schermeigenaar');
    klassen.canoniek_scherm_zonder_binding++;
  });
  assert.deepEqual(klassen, { canoniek_scherm_zonder_binding: 75,
    gedeeld_document_of_deeplink: 14, tab_zonder_route: 8,
    os_handelingsingang_zonder_route: 5 });
  assert.equal(Object.values(klassen).reduce((som, aantal) => som + aantal, 0), 102);
});
