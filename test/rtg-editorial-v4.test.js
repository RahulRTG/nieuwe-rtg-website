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

test('editorial v4 neemt uitsluitend expliciet gemigreerde schermen over', () => {
  const plain = { getAttribute(){ return null; } };
  const forced = { getAttribute(name){ return name === 'data-rtg-editorial-v4' ? 'force' : null; } };
  const disabled = { getAttribute(name){ return name === 'data-rtg-editorial-v4' ? 'off' : null; } };
  const editorialRoom = { getAttribute(){ return null; }, hasAttribute(name){ return name === 'data-rtg-editorial-room'; } };
  assert.equal(runtime.ownsPresentation('cover', plain), false);
  assert.equal(runtime.ownsPresentation('collection', plain), false);
  assert.equal(runtime.ownsPresentation('cover', disabled), false);
  assert.equal(runtime.ownsPresentation('collection', editorialRoom), false);
  for (const kind of ['cover', 'collection', 'task', 'detail', 'conversation', 'state', 'canvas']) {
    assert.equal(runtime.ownsPresentation(kind, plain), false, kind + ' houdt zijn geteste taakpresentatie');
    assert.equal(runtime.ownsPresentation(kind, forced), true, kind + ' kan bewust migreren');
  }
});

test('basis laadt editorial v4 als een werkelijk laatste presentatielaag', () => {
  const heritage = read('public/shared/rtg-heritage.css');
  const basis = read('public/shared/basis/basis-01.js');
  assert.doesNotMatch(heritage, /rtg-editorial-v4\.css/);
  assert.match(heritage, /rtg-editorial-system\.css/);
  assert.match(heritage, /rtg-cinematic-system\.css/);
  assert.match(heritage, /--rtg-editorial-version:20261001/);
  assert.match(basis, /blad\.href = '\/shared\/rtg-editorial-v4\.css'/);
  assert.match(basis, /laadEditorialBlad\(\)/);
  assert.match(read('public/shared/rtg-editorial-v4.css'), /--rtg-editorial-version:20261016/);
});

test('de werkelijke browserbundel laadt één nieuwe runtime en de service workers bewaren hem offline', () => {
  const basis = read('public/shared/basis.js');
  assert.match(basis, /\['rtg-editorial-v4-model', 'RTGEditorialV4Model'\]/);
  assert.match(basis, /\['rtg-editorial-v4', 'RTGEditorialV4'\]/);
  assert.match(basis, /\['rtg-cinematic-system', 'RTGCinematicSystem'\]/);
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
  assert.match(css, /\.rtg-adaptive-item-copy small\{[^}]*font-weight:600!important/,
    'de compacte Edge-labels blijven op lichte en donkere beelden leesbaar');
  assert.match(css, /prefers-reduced-motion:reduce\)[^{]*\{[\s\S]*transition-duration:0s!important/,
    'reduced motion schakelt overgangen werkelijk uit');
});

test('de ene schil sluit oude koppen, uitrekkende randen en Edge-overlap af', () => {
  const css = read('public/shared/rtg-editorial-v4.css');
  assert.match(css, /--v4-header:58px!important/);
  assert.match(css, /min-height:var\(--v4-header\)!important;max-height:var\(--v4-header\)!important/);
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

test('expliciet verklaarde routeacties verhuizen naar de V4-kop voordat de legacykop sluit', () => {
  const runtime = read('public/shared/rtg-editorial-v4.js');
  const css = read('public/shared/rtg-editorial-v4.css');
  const command = read('public/apps/command.html');
  const ios = read('public/shared/ios.js');
  assert.match(runtime, /querySelectorAll\('\[data-rtg-v4-header-action\],header/);
  assert.match(runtime, /syncHeaderActions\(doc, header\)/);
  assert.match(runtime, /actions\.insertBefore\(node, search \|\| null\)/);
  assert.match(css, /\.rtg-v4-header-actions>\[data-rtg-v4-header-action\]/);
  assert.match(css, /:has\(\.rtg-v4-header-actions>\[data-rtg-v4-header-action\]\)\{--v4-header:120px\}/,
    'een routeactie blijft op telefoon bereikbaar in een tweede koprij');
  assert.match(command, /id="q" type="search" data-rtg-v4-header-action/);
  assert.match(command, /data-rtg-editorial-v4="force"/);
  assert.match(runtime, /rtg-v4-edge-state/,
    'de bestaande Edge-status blijft vanuit de universele kop bereikbaar');
  assert.match(ios, /body > header:not\(\.rtg-v4-header\)/,
    'de oudere iOS-laag laat de universele V4-kop intact');
});

test('de schermkeuring erkent de ene native canvas-toolbar als de V4-kop', () => {
  const audit = read('scripts/desktop-audit.js');
  const runtime = read('public/shared/rtg-editorial-v4.js');
  assert.match(audit, /data-rtg-v4-canvas-toolbar/);
  assert.match(audit, /nonstandard-v4-canvas-toolbar/);
  assert.match(audit, /body\.dataset\.rtgV4Kind === 'canvas'/);
  assert.match(runtime, /body\.dataset\.rtgV4Kind !== 'canvas' \|\| !canvasToolbar/);
});

test('de schermkeuring verwacht voor V4 dezelfde ivoren grond in native productschillen', () => {
  const audit = read('scripts/desktop-audit.js');
  assert.match(audit, /region\.selector === '\.wk-shell' \? v4Canvas/);
});
