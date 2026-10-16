'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const runtime = require('../public/shared/rtg-editorial-v4');
const emptyBody = { getAttribute(){ return null; }, querySelector(){ return null; }, matches(){ return false; } };

test('editorial v4 classificeert de zeven schermfamilies deterministisch', () => {
  const registry = { canvas: { '/apps/camera.html':'#zoeker' } };
  const formBody = { getAttribute(){ return null; }, querySelector(){ return {}; }, matches(){ return false; } };
  assert.equal(runtime.classify('/apps/rtg.html', emptyBody, registry), 'cover');
  assert.equal(runtime.classify('/apps/mall.html', emptyBody, registry), 'collection');
  assert.equal(runtime.classify('/apps/agenda.html', emptyBody, registry), 'task');
  assert.equal(runtime.classify('/apps/rtmail.html', emptyBody, registry), 'conversation');
  assert.equal(runtime.classify('/apps/camera.html', emptyBody, registry), 'canvas');
  assert.equal(runtime.classify('/apps/privacy.html', emptyBody, registry), 'state');
  assert.equal(runtime.classify('/apps/reisboek.html', emptyBody, registry), 'detail');
  assert.equal(runtime.classify('/apps/reisboek.html', formBody, registry), 'detail');
  assert.equal(runtime.classify('/apps/privacy.html', formBody, registry), 'state');
});

test('heritage laadt uitsluitend editorial v4 als laatste presentatielaag', () => {
  const heritage = read('public/shared/rtg-heritage.css');
  assert.match(heritage, /@import url\('\.\/rtg-editorial-v4\.css'\);/);
  assert.doesNotMatch(heritage, /@import url\('\.\/rtg-(?:editorial-system|cinematic-system)\.css'\);/);
  const imports = [...heritage.matchAll(/@import url\('([^']+)'\);/g)];
  assert.equal(imports.at(-1)[1], './rtg-editorial-v4.css');
});

test('de werkelijke browserbundel laadt één nieuwe runtime en de service workers bewaren hem offline', () => {
  const basis = read('public/shared/basis.js');
  assert.match(basis, /\['rtg-editorial-v4-model', 'RTGEditorialV4Model'\]/);
  assert.match(basis, /\['rtg-editorial-v4', 'RTGEditorialV4'\]/);
  assert.doesNotMatch(basis, /\['rtg-cinematic-system', 'RTGCinematicSystem'\]/);
  for (const file of ['public/sw.js','public/apps/foundation/sw.js']) {
    const source = read(file);
    assert.match(source, /rtg-editorial-v4\.css/);
    assert.match(source, /rtg-editorial-v4-model\.js/);
    assert.match(source, /rtg-editorial-v4\.js/);
  }
});

test('de nieuwe laag definieert header, Edge en alle apparaatbreekpunten', () => {
  const css = read('public/shared/rtg-editorial-v4.css');
  for (const marker of ['.rtg-v4-header','data-rtg-v4-kind="cover"','data-rtg-v4-kind="collection"',
    'data-rtg-v4-kind="task"','data-rtg-v4-kind="detail"','data-rtg-v4-kind="conversation"',
    'data-rtg-v4-kind="state"','data-rtg-v4-kind="canvas"','.rtg-adaptive-bar']) assert.ok(css.includes(marker), marker);
  assert.match(css, /@media\(max-width:699px\)/);
  assert.match(css, /@media\(min-width:700px\) and \(max-width:1179px\)/);
  assert.match(css, /@media\(min-width:1180px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /@media\(forced-colors:active\)/);
});

test('de ene schil sluit oude koppen, uitrekkende randen en Edge-overlap af', () => {
  const css = read('public/shared/rtg-editorial-v4.css');
  assert.match(css, /min-height:58px!important;max-height:58px!important/);
  assert.match(css, /data-rtg-editorial-v4="true"\] \.topnav\{display:none!important\}/);
  assert.match(css, />\.rtg-v4-section-masthead\+h1/);
  assert.match(css, /data-rtg-editorial-v4="true"\] #rtg-uitstap/);
  assert.match(css, /bottom:calc\(94px \+ env\(safe-area-inset-bottom,0px\)\)!important/);
  assert.match(css, /\.rtg-adaptive-edge::before\{display:none!important\}/);
  assert.match(css, /\.rtg-edge-chrome> :is\(\.rtg-edge-top,\.rtg-edge-side,\.rtg-edge-bottom\)/);
  assert.match(css, /:has\(#gate\[data-rtg-access\]/);
  assert.match(css, /:has\(#onbGate:not\(\[hidden\]\)\)>\.rtg-v4-header/);
  assert.match(css, /#shell:has\(>#app\.active\)/);
});
