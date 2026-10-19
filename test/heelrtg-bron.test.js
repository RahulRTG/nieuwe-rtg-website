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

/* DE CATALOGUS VAN HEEL RTG LOOPT DOOR DEZELFDE POORT (19 oktober 2026). De
   widgetcatalogus kent geen werkrol en geen pas. Elke catalogus-app wiens adres
   een ingang met een werkrol of een pas in de gids heeft, moet die ingang ook
   VINDEN -- anders laat de poort (RTGAppCatalogusPoort, null) hem stil door. */
test('elke catalogus-app achter een werkrol of pas vindt zijn ingang in de gids, en het menu vraagt de poort', () => {
  const reg = require('../scripts/lib/wereldregister');
  const pas = fs.readFileSync(path.join(WORTEL, 'public/apps/app-main/app-main-24a3.js'), 'utf8')
    .match(/const PREMIUM = new Set\(\[([\s\S]*?)\]\)/)[1].match(/'([a-z]+)'/g).map((s) => s.slice(1, -1));
  const zonderQuery = (u) => { const s = String(u || ''), h = s.indexOf('#'); return (h < 0 ? s : s.slice(0, h)).split('?')[0] + (h < 0 ? '' : s.slice(h)); };
  const gids = new Map();
  for (const i of CATALOGUS.flatMap((w) => w.items || [])) if (i.url) gids.set(zonderQuery(i.url), (gids.get(zonderQuery(i.url)) || []).concat(i.id));
  const beperkt = Object.entries(reg.LINKS).filter(([k, v]) => v.url && (v.werkrol || pas.includes(k) || k === 'wallet'));
  const apps = require('../public/shared/interface/world-widget-catalog.json').apps;
  let gedekt = 0;
  for (const [k, v] of beperkt) {
    for (const app of apps.filter((a) => zonderQuery(a.url) === zonderQuery(v.url))) {
      assert.ok((gids.get(zonderQuery(app.url)) || []).includes('link:' + k), app.id + ' (' + app.url + ') vindt link:' + k + ' niet in de gids');
      gedekt++;
    }
  }
  assert.ok(gedekt >= 20, 'te weinig beperkte catalogus-apps gevonden (' + gedekt + '); is de lezer stuk?');
  const menu = fs.readFileSync(path.join(WORTEL, 'public/shared/rtg-edge-smart-menu/rtg-edge-smart-menu-01.js'), 'utf8');
  assert.match(menu, /poort && poort\(app\.url, app\) === false/, 'het menu vraagt de poort niet');
  const app29d = fs.readFileSync(path.join(WORTEL, 'public/apps/app-main/app-main-29d.js'), 'utf8');
  assert.match(app29d, /window\.RTGAppCatalogusPoort = [\s\S]*?gidsToegang\(id\)/, 'de poort is niet die van de gids');
});

/* De schermen van een werkrol die de catalogus aan iedereen toonde, terwijl de
   server een zaak-, personeels-, kantoor- of werkruimtesessie eist (gemeten op
   19 oktober 2026 met scripts/lib/bewakers.js en SCHERMROUTES.json). Elk heeft
   een ingang met die werkrol, en de gids kent hem -- anders filtert de poort niet. */
test('de gemeten werkrol-schermen hebben een ingang met hun werkrol in de gids, en geen tegel in een wereld', () => {
  const reg = require('../scripts/lib/wereldregister');
  const GEMETEN = {
    zaak: ['appstore-uitgever', 'belastingkantoor', 'dispatch', 'festival', 'gemeenteloket', 'ghost', 'handel', 'horeca-bar',
      'horeca-beheer', 'horeca-bezorg', 'horeca-club', 'horeca-events', 'horeca-expeditie', 'horeca-haccp', 'horeca-hotel',
      'horeca-vloer', 'kassa', 'leverancier-aanvragen', 'leverancier-commerce', 'leverancier-rtmail', 'leverancier-service',
      'luchthaven', 'magnaat-partnerstudio', 'marechaussee', 'oog', 'ovcontrol', 'rechtbank', 'redactie', 'rijksloket',
      'sportclub', 'voertuig', 'zaakkosten', 'zaakweb', 'zakelijk'],
    personeel: ['chauffeur', 'gemeentepda', 'horeca-pda', 'ovdienst', 'overheidspda', 'redactie-pda'],
    kantoor: ['appstore-kantoor', 'backoffice', 'boardroom', 'foundation/kwestiekantoor', 'isolatie', 'kantoren', 'kosten',
      'magnaat-kantoor', 'payroll', 'platformregister', 'routedekking', 'service', 'techniek', 'websitestudio'],
    werkruimte: ['werkplek']
  };
  const inGids = new Set(CATALOGUS.flatMap((w) => w.items || []).map((i) => i.id));
  const inWereld = new Set(reg.MAPPEN.flatMap((m) => m.items));
  let n = 0;
  for (const [rol, schermen] of Object.entries(GEMETEN)) {
    for (const s of schermen) {
      const url = '/apps/' + s + '.html';
      const k = Object.keys(reg.LINKS).find((x) => reg.LINKS[x].url === url);
      assert.ok(k, url + ' heeft geen ingang in LINKS');
      assert.equal(reg.LINKS[k].werkrol, rol, url + ' hoort werkrol ' + rol + ' te dragen');
      assert.ok(inGids.has('link:' + k), 'link:' + k + ' staat niet in de gids');
      assert.ok(!inWereld.has('link:' + k), 'link:' + k + ' staat als tegel in een wereld; het is een scherm van een werkrol');
      n++;
    }
  }
  assert.equal(n, 55);
});

/* De gezinsrol is een regel op een plek: een catalogusscherm dat op de
   gezinsprofielsessie draait (het laadt apps/foundation/sessie.js) draagt
   `gezinssessie`, en de poort toont het alleen met een sessie, behalve de deur.
   Geen ander scherm draagt de vlag. */
test('de gezinsrol: de catalogus draagt de vlag uit het scherm, de poort volgt hem op een plek', () => {
  const apps = require('../public/shared/interface/world-widget-catalog.json').apps;
  for (const a of apps) {
    const html = fs.readFileSync(path.join(WORTEL, 'public', a.url.split(/[?#]/)[0]), 'utf8');
    const laadt = a.url.startsWith('/apps/foundation/') && /<script[^>]*\ssrc="(?:\/apps\/foundation\/)?sessie\.js"/.test(html);
    assert.equal(!!a.gezinssessie, laadt, a.id + ': de vlag gezinssessie volgt het scherm niet');
  }
  for (const id of ['foundation-zakgeld', 'foundation-arena', 'foundation-societeit', 'foundation-school', 'foundation-index'])
    assert.ok(apps.find((a) => a.id === id).gezinssessie, id + ' draagt de vlag niet');
  for (const id of ['foundation-wegwijzer', 'foundation-os-deelnemer', 'foundation-winkel', 'foundation-onveilig', 'foundation-registreren'])
    assert.ok(!apps.find((a) => a.id === id).gezinssessie, id + ' draait niet op de gezinssessie en hoort de vlag niet te dragen');
  const app29d = fs.readFileSync(path.join(WORTEL, 'public/apps/app-main/app-main-29d.js'), 'utf8');
  assert.match(app29d, /app && app\.gezinssessie && doel\.split\('#'\)\[0\] !== GEZINSDEUR \? gezinssessie\(\) : null/, 'de poort volgt de gezinsrol niet');
  assert.match(app29d, /const GEZINSDEUR = '\/apps\/foundation\/index\.html'/);
  assert.match(app29d, /gezinsPoort,\s+rtfPoort, rtfSpeler/, 'de regel noemt de serverpoorten niet die hij volgt');
});

/* "Mijn RTG" (/apps/app.html) staat in de catalogus, maar het is geen functie:
   het is de schil, en de gids kent het als de home van RTG Core. De poort leest
   het daarom als die context (de wereldpoort van de gids), niet als een los
   scherm zonder ingang. Werkrollen heeft geen home: dat is geen plek. */
test('de schil is de home van RTG Core in de gids, en de poort leest hem zo', () => {
  const apps = require('../public/shared/interface/world-widget-catalog.json').apps;
  const schil = apps.find((a) => a.id === 'app');
  assert.ok(schil && schil.url === '/apps/app.html');
  const homes = CATALOGUS.filter((w) => w.home === schil.url).map((w) => w.id);
  assert.deepEqual(homes, ['core'], 'de schil is in de gids de home van RTG Core en van niets anders');
  assert.ok(!CATALOGUS.find((w) => w.id === 'werkrollen').home, 'de context Werkrollen heeft geen home');
  const app29d = fs.readFileSync(path.join(WORTEL, 'public/apps/app-main/app-main-29d.js'), 'utf8');
  assert.match(app29d, /w\.home && zonderQuery\(w\.home\) === doel[\s\S]*?gidsToegang\('world:' \+ w\.id, 'world'\)/, 'de poort leest een home niet als zijn context');
});
