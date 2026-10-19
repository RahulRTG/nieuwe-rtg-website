/* DE BRON VAN HEEL RTG IS DE FUNCTIEGIDS (eigenaarsbesluit 19 oktober 2026).
   Het zoekmenu van de rand (apps/app-main/app-main-29d.js) en Rahuls "open
   <app>" (app-main-29.js, gidsCommando) lezen dezelfde gids: RTGWorkspaceDirectory
   over RTGWorkspaceWorldCatalog, met gidsToegang als poort. Deze toets houdt
   vast dat de OS-apps erin staan, dat het zoekmenu ook wat er alleen op lijkt
   toont (Rahul blijft exact kiezen), en dat een item dat de poort weigert --
   zoals een ingang met een werkrol die het lid niet heeft -- niet gevonden wordt.

   Draai los: node --test test/heelrtg-bron.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const D = require('../public/shared/interface/workspace-directory.js');
const venster = {};
new Function('window', fs.readFileSync(path.join(WORTEL, 'public/shared/interface/workspace-world-catalog.js'), 'utf8'))(venster);
const CATALOGUS = venster.RTGWorkspaceWorldCatalog;
const GUARD = { authenticated: true, sameSession: true, contextCurrent: true };
const zoek = (q, allow, alles) => D.search(q, { catalog: CATALOGUS, guard: GUARD, allow: allow || (() => true), alles });
const ids = (uit) => uit.matches.map((m) => m.id);

test('de OS-apps staan in de gids en het zoekmenu vindt ze', () => {
  for (const [q, id] of [['video', 'os:videobellen'], ['bellen', 'os:bellen'], ['snaps', 'os:snaps'], ['werk', 'os:werk']]) {
    const uit = zoek(q, null, true);
    assert.equal(uit.status, 'ready', q);
    assert.ok(ids(uit).includes(id), '"' + q + '" vindt ' + id + ' niet: ' + ids(uit).join(', '));
    const rij = CATALOGUS.flatMap((w) => w.items || []).find((x) => x.id === id);
    assert.equal(rij.url, null, id + ' heeft geen adres; hij opent via de app');
  }
});

test('Rahul blijft exact kiezen: "video" is voor hem Clips, voor het zoekmenu ook Videobellen', () => {
  assert.deepEqual(ids(zoek('video')), ['link:clips']);
  assert.ok(ids(zoek('video', null, true)).includes('os:videobellen'));
});

test('wat de poort weigert (een werkrol die het lid niet heeft), vindt het zoekmenu niet', () => {
  const alleen = (weg) => (id) => id !== weg;
  assert.ok(ids(zoek('tweede scherm', null, true)).includes('link:tweedescherm'), 'de gids kent het tweede scherm');
  assert.ok(!ids(zoek('tweede scherm', alleen('link:tweedescherm'), true)).includes('link:tweedescherm'));
  assert.ok(!ids(zoek('video', alleen('os:videobellen'), true)).includes('os:videobellen'));
});

test('het zoekmenu leest dezelfde gids en poort als gidsCommando, zonder tweede lijst', () => {
  const menu = fs.readFileSync(path.join(WORTEL, 'public/apps/app-main/app-main-29d.js'), 'utf8');
  assert.match(menu, /RTGWorkspaceDirectory/);
  assert.match(menu, /catalog: window\.RTGWorkspaceWorldCatalog, guard: gidsContext\(\), allow: gidsToegang/);
  assert.match(menu, /gidsOpen\(m\)/, 'een treffer opent langs dezelfde weg als Rahul');
  assert.doesNotMatch(menu, /\[\s*['"](?:os|tab|link):/, 'geen eigen lijst van onderdelen');
});
