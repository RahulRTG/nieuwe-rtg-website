'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ontwerp = require('../scripts/ontwerpsysteem');
const lees = pad => fs.readFileSync(pad, 'utf8');

// Alleen DOM-eigendom: deze kleine stomp meet geen CSS of browsergeometrie.
function fixture(ds = true) {
  class Node {
    constructor(tag, cls = '') { this.tagName = tag; this.className = cls; this.children = []; this.dataset = {}; this.attrs = {}; }
    get classList() { return { add: c => { this.className += ' ' + c; }, contains: c => this.className.split(' ').includes(c) }; }
    setAttribute(k, v) { this.attrs[k] = v; }
    hasAttribute(k) { return k in this.attrs; }
    appendChild(n) { return this.insertBefore(n, null); }
    prepend(n) { this.insertBefore(n, this.children[0]); }
    before(n) { this.parentNode.insertBefore(n, this); }
    insertBefore(n, before) {
      if (n.parentNode) n.parentNode.children.splice(n.parentNode.children.indexOf(n), 1);
      const at = this.children.indexOf(before); this.children.splice(at < 0 ? this.children.length : at, 0, n); n.parentNode = this; n.isConnected = true; return n;
    }
    matches(selectors) { return selectors.split(',').some(s => s[0] === '.' ? this.classList.contains(s.slice(1)) :
      s.startsWith('[role=') ? this.attrs.role === 'dialog' : s === this.tagName); }
    querySelector(selector) { for (const n of this.children) { if (n.matches(selector)) return n; const found = n.querySelector(selector); if (found) return found; } return null; }
  }
  const html = new Node('html'), body = new Node('body');
  if (ds) html.setAttribute('data-ds', '1');
  body.dataset.rtgWorld = 'work'; body.isConnected = true;
  const document = { documentElement: html, body, title: 'PDA', createElement: tag => new Node(tag), querySelector: selector => body.querySelector(selector) };
  const window = { location: { pathname: '/apps/studio-pda.html' }, addEventListener() {} };
  return { Node, body, document, window };
}

test('de wereldloader behoudt Spatial op een DS-scherm zonder een tweede Adaptive Edge', async () => {
  const geladen = [];
  let gestart = 0;
  const document = {
    readyState: 'complete',
    documentElement: { hasAttribute: naam => naam === 'data-ds' },
    body: { dataset: { rtgWorld: 'work' }, hasAttribute: () => false },
    head: { appendChild(node) { geladen.push(node.src); queueMicrotask(node.onload); } },
    createElement() { return {}; }
  };
  const window = {
    self: null, top: null, location: { search: '' },
    RTGDesktopHome: { start() { gestart++; } }
  };
  window.self = window.top = window;
  vm.runInNewContext(lees('public/shared/rtg-world-desktop.js'), { window, document, URLSearchParams, queueMicrotask, console });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.ok(geladen.includes('/shared/interface/workspace-runtime.js'));
  assert.ok(geladen.includes('/shared/interface/world-desktop-home.js'));
  assert.equal(geladen.some(pad => pad.includes('rtg-adaptive-edge')), false);
  assert.equal(gestart, 1);
  assert.equal(document.body.dataset.rtgDesktopState, undefined);
});

test('een ingebed DS-scherm houdt zijn verborgen actiebronnen voor de ouder-Edge', () => {
  const edge = lees('public/ds/edge.js');
  assert.doesNotMatch(edge, /querySelectorAll\(['"]\.ds-kop['"]\)[\s\S]{0,120}\.remove\(/);
  assert.match(edge, /data-ds-ingebed/);
});

test('DS-domein verhuist met dezelfde nodes en invoer; gedeelde bediening blijft buiten het verbergbare vlak', () => {
  const f = fixture(), main = new f.Node('main'), input = new f.Node('input');
  input.value = 'onbewaard concept'; input.onclick = () => 'zelfde listener'; main.appendChild(input);
  f.body.appendChild(main);
  const overlays = ['ds-edge', 'ds-melding', 'ds-rahul', 'ds-samen-venster', 'ds-samen-banner', 'ds-samen-ingang', 'ds-handenvrij__balk', 'ds-handenvrij__chat'];
  const controls = overlays.map(cls => f.body.appendChild(new f.Node('div', cls)));
  const dialog = f.body.appendChild(new f.Node('dialog'));
  vm.runInNewContext(lees('public/shared/interface/world-desktop-surface.js'), f);
  const surface = f.window.RTGDesktopSurface.prepare();
  assert.equal(main.parentNode, surface); assert.equal(main.children[0], input);
  assert.equal(input.value, 'onbewaard concept'); assert.equal(input.onclick(), 'zelfde listener');
  for (const control of [...controls, dialog]) assert.equal(control.parentNode, f.body);
  surface.hidden = true;
  assert.equal(controls.some(c => c.parentNode === surface), false, 'een frame verbergt geen globale bediening');
});

for (const ds of [true, false]) test((ds ? 'DS' : 'legacy') + ': gewone domeinwrapper houdt dezelfde move-owner', () => {
  const f = fixture(ds), main = f.body.appendChild(new f.Node('main'));
  const legacyEdge = f.body.appendChild(new f.Node('div', 'rtg-edge-chrome'));
  vm.runInNewContext(lees('public/shared/interface/world-desktop-surface.js'), f);
  const surface = f.window.RTGDesktopSurface.prepare();
  assert.equal(main.parentNode, surface); assert.equal(legacyEdge.parentNode, f.body);
  assert.equal(surface.className, 'wd-page');
});

test('springlink focust de echte DS-hoofdinhoud en houdt de gesloten toegangspoort leidend', () => {
  for (const ds of [true, false]) {
    const f = fixture(ds), root = f.body.appendChild(new f.Node('div', 'wd-shell'));
    const home = root.appendChild(new f.Node('div', 'wd-page')), main = home.appendChild(new f.Node('main'));
    main.id = 'inhoud'; home.hidden = false;
    f.Node.prototype.addEventListener = function (name, run) { this[name] = run; };
    f.Node.prototype.focus = function () { f.document.activeElement = this; };
    f.Node.prototype.scrollIntoView = function () {};
    let gate, sync;
    f.document.getElementById = id => id === 'rtf-toegang-slot' ? gate : null;
    f.MutationObserver = class { constructor(run) { sync = run; } observe() {} disconnect() {} };
    vm.runInNewContext(lees('public/shared/interface/world-desktop-surface.js'), f);
    f.window.RTGDesktopSurface.guard(root, home);
    const skip = f.body.children[0], target = ds ? main : home;
    assert.equal(skip.classList.contains('ds-basis__spring'), true);
    assert.equal(skip.attrs.href, '#' + target.id);
    skip.click({ preventDefault() {} }); assert.equal(f.document.activeElement, target);
    gate = f.body.appendChild(new f.Node('SECTION')); gate.id = 'rtf-toegang-slot'; gate.style = {};
    f.document.documentElement.classList.add('rtf-toegang-dicht'); sync();
    assert.equal(home.hidden, true); assert.equal(home.inert, true);
    assert.equal(skip.attrs.href, '#rtf-toegang-slot'); skip.click({ preventDefault() {} });
    assert.equal(f.document.activeElement, gate);
    f.document.documentElement.className = ''; sync();
    assert.equal(home.hidden, false); assert.equal(home.inert, false);
    assert.equal(skip.attrs.href, '#' + target.id);
  }
});

test('DS-presentatie draagt bestaande zelfstandige domeinen en canvassen, niet legacy of worldHome', () => {
  for (const [ds, worldHome, canvas] of [[true, false, false], [false, false, false], [true, true, false], [true, false, true]]) {
    const f = fixture(ds), home = f.body.appendChild(new f.Node('main'));
    if (worldHome) f.body.dataset.worldHome = 'work';
    if (canvas) home.setAttribute('data-rtg-canvas-surface', 'true');
    f.window.RTGDesktopSurface = { prepare: () => home, guard() {}, move: (parent, n) => parent.appendChild(n) };
    f.window.RTGDesktopUI = { el: (tag, cls) => new f.Node(tag, cls), label: n => n, taal: () => 'nl' };
    f.window.RTGWorldPresentation = { start() {} };
    f.window.fetch = () => new Promise(() => {});
    vm.runInNewContext(lees('public/shared/interface/world-desktop-home.js'), f);
    f.window.RTGDesktopHome.start();
    assert.equal(f.body.classList.contains('ds-wereldwerkruimte'), ds && !worldHome);
    assert.equal(f.body.querySelector('.wd-home'), home, 'de bestaande domein-node blijft de inhoud');
  }
});

test('toegangsdeur behoudt presentatie en dezelfde inhoud bij native dialoog naar werkruimte', () => {
  for (const ds of [true, false]) {
    const f = fixture(ds), root = f.body.appendChild(new f.Node('div', 'wd-shell'));
    const home = root.appendChild(new f.Node('main'));
    let gate = f.body.appendChild(new f.Node('DIALOG', ds ? 'ds-foundation-deur' : 'bestaande-deur'));
    gate.id = 'rtf-toegang-slot'; gate.open = true;
    const content = gate.appendChild(new f.Node('div')); content.onclick = () => 'zelfde handeling';
    f.Node.prototype.addEventListener = function () {};
    Object.defineProperty(f.Node.prototype, 'firstChild', { get() { return this.children[0]; } });
    f.Node.prototype.replaceWith = function (next) {
      const p = this.parentNode, i = p.children.indexOf(this); p.children[i] = next;
      next.parentNode = p; next.isConnected = true; next.style = {}; this.parentNode = null; gate = next;
    };
    let gesloten = 0; gate.close = () => { gesloten++; gate.open = false; };
    f.document.getElementById = id => id === 'rtf-toegang-slot' ? gate : null;
    f.document.documentElement.classList.add('rtf-toegang-dicht');
    f.MutationObserver = class { observe() {} disconnect() {} };
    vm.runInNewContext(lees('public/shared/interface/world-desktop-surface.js'), f);
    f.window.RTGDesktopSurface.guard(root, home);
    assert.equal(gesloten, 1);
    assert.equal(gate.tagName, 'section');
    assert.equal(gate.classList.contains(ds ? 'ds-foundation-deur' : 'bestaande-deur'), true);
    assert.equal(gate.attrs.role, 'main'); assert.equal(gate.attrs['aria-live'], 'polite');
    assert.equal(gate.parentNode, root); assert.equal(root.firstChild, gate);
    assert.equal(gate.firstChild, content); assert.equal(content.onclick(), 'zelfde handeling');
    assert.equal(home.hidden, true); assert.equal(home.inert, true);
  }
});

test('DS-werkruimte leest de hoofdtaak vóór ondersteuning; legacy en levende nodes houden hun eigenaar', () => {
  for (const [ds, worldHome] of [[true, false], [false, false], [true, true]]) {
    const f = fixture(ds), home = f.body.appendChild(new f.Node('main'));
    const input = home.appendChild(new f.Node('input')), frame = home.appendChild(new f.Node('iframe'));
    input.value = 'onbewaard concept'; frame.eigenToestand = { sessie: 'blijft' };
    const toestand = frame.eigenToestand; let verhuizingen = 0;
    if (worldHome) f.body.dataset.worldHome = 'work';
    f.window.RTGDesktopSurface = { prepare: () => home, guard() {}, move: (parent, n) => { verhuizingen++; return parent.appendChild(n); } };
    f.window.RTGDesktopUI = { el: (tag, cls) => new f.Node(tag, cls), label: n => n, taal: () => 'nl' };
    f.window.RTGWorldPresentation = { start() {} }; f.window.fetch = () => new Promise(() => {});
    vm.runInNewContext(lees('public/shared/interface/world-desktop-home.js'), f);
    f.window.RTGDesktopHome.start();
    const root = f.body.querySelector('.wd-shell'), volgorde = root.children.slice();
    const positie = cls => root.children.findIndex(n => n.classList.contains(cls));
    if (ds && !worldHome) {
      for (const taak of ['wd-home', 'wd-focus']) for (const hulp of ['wd-people', 'wd-favorites', 'wd-library'])
        assert.ok(positie(taak) < positie(hulp), taak + ' komt vóór ' + hulp + ' in de leesvolgorde');
    } else {
      assert.deepEqual(root.children.map(n => n.className.trim()),
        ['wd-greeting', 'wd-people', 'wd-home', 'wd-favorites', 'wd-focus', 'wd-announcement', 'wd-library']);
    }
    f.window.RTGDesktopHome.start();
    assert.equal(verhuizingen, 1, 'een volgende initialisatie verplaatst geen bestaande inhoud');
    assert.deepEqual(root.children, volgorde);
    assert.equal(home.children[0], input); assert.equal(input.value, 'onbewaard concept');
    assert.equal(home.children[1], frame); assert.equal(frame.eigenToestand, toestand);
  }
});

test('wereldwerkruimte-presentatie volgt bestaande DS-regels zonder Heritage-imports of eigen kleuren', () => {
  const delen = ['wereldwerkruimte', 'wereldwerkruimte-widgets', 'wereldwerkruimte-beelden'];
  const fouten = ontwerp.contractFouten({ paginas: {} }).filter(f => delen.some(n => f.includes('componenten/' + n + '.css')));
  assert.deepEqual(fouten, []);
  const tokens = lees('public/ds/tokens.css');
  for (const naam of delen) {
    const css = lees('public/ds/componenten/' + naam + '.css');
    assert.doesNotMatch(css, /@import|var\(--(?:rtg|wh|wd|wp)-/);
    assert.ok(Buffer.byteLength(css) < 10 * 1024, naam);
    for (const [, token] of css.matchAll(/var\((--ds-[a-z0-9-]+)/g)) assert.ok(tokens.includes(token + ':'), token);
  }
});

test('wereldpresentatie begrenst navigatie en beelden zonder onbesliste laadbron', () => {
  const bron = lees('public/shared/interface/world-presentation.js');
  for (const ds of [true, false]) {
    const analyse = ontwerp.scriptLaadAnalyse(bron, { ds });
    assert.deepEqual(analyse.onzeker, []);
    assert.equal(analyse.injecties + analyse.mogelijkeInjecties, 0);
  }
  assert.match(bron, /function localLink\(anchor, path\)/);
  assert.match(bron, /Ongeldige wereldroute/);
  assert.match(bron, /Ongeldige wereldafbeelding/);
  assert.doesNotMatch(bron, /\.(?:src|href)\s*=\s*(?:c\[|new URL|['"]#)/);
  for (const wereld of ['living', 'work', 'travel', 'foundation'])
    assert.ok(fs.existsSync('public/images/world-homes/' + wereld + '-warm.jpg'), wereld + ': warm hoofdbeeld ontbreekt');
});

test('wereldwerkruimte gebruikt aantoonbare beeld- en fragmentbronnen', () => {
  for (const pad of ['public/shared/interface/world-desktop-cards.js',
    'public/shared/interface/world-desktop-surface.js',
    'public/shared/interface/world-widget-surfaces.js']) {
    const analyse = ontwerp.scriptLaadAnalyse(lees(pad), { ds: true });
    assert.deepEqual(analyse.onzeker, [], pad);
    assert.equal(analyse.injecties + analyse.mogelijkeInjecties, 0, pad);
  }
});
