'use strict';
/* Contract voor de laadtrein rond de ene Edge. Onafhankelijke bronnen mogen
   tegelijk vertrekken; geen enkele gedeeltelijke trein mag de oude UI ruimen. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const lees = naam => fs.readFileSync(path.join(ROOT, 'public/shared', naam), 'utf8');
const RANDEN = lees('randen.js');
const EDGE2 = lees('rtg-edge-2-loader.js');

function klassen() {
  const set = new Set();
  return {
    add(...namen) { namen.forEach(naam => set.add(naam)); },
    remove(...namen) { namen.forEach(naam => set.delete(naam)); },
    contains(naam) { return set.has(naam); }
  };
}

function omgeving(pad = '/apps/onbekend.html', wereld = 'work') {
  const knopen = [];
  function element(tag) {
    const attrs = Object.create(null), luisteraars = Object.create(null);
    const el = {
      tagName: String(tag).toUpperCase(), classList: klassen(), dataset: {}, sheet: null,
      setAttribute(naam, waarde) { attrs[naam] = String(waarde); },
      getAttribute(naam) { return Object.hasOwn(attrs, naam) ? attrs[naam] : null; },
      hasAttribute(naam) { return Object.hasOwn(attrs, naam); },
      removeAttribute(naam) { delete attrs[naam]; },
      addEventListener(naam, fn) { (luisteraars[naam] ||= []).push(fn); },
      emit(naam) { for (const fn of luisteraars[naam] || []) fn.call(el, { type: naam, target: el }); }
    };
    for (const attribuut of ['src', 'href', 'id', 'rel']) Object.defineProperty(el, attribuut, {
      get() { return el.getAttribute(attribuut) || ''; }, set(waarde) { el.setAttribute(attribuut, waarde); }
    });
    return el;
  }
  const body = element('body');
  body.dataset.rtgWorld = wereld;
  const head = element('head');
  head.appendChild = el => { if (!knopen.includes(el)) knopen.push(el); return el; };
  const documentElement = element('html');
  documentElement.appendChild = head.appendChild;
  const document = {
    body, head, documentElement, title: 'Bestaand scherm', readyState: 'complete',
    createElement: element,
    querySelector() { return null; },
    querySelectorAll(selector) {
      const match = /^(script|link)(?:\[rel~="stylesheet"\])?\[(src|href)\]$/.exec(selector);
      return match ? knopen.filter(el => el.tagName === match[1].toUpperCase() && el.getAttribute(match[2])) : [];
    },
    getElementById(id) { return knopen.find(el => el.id === id) || null; },
    addEventListener() {}, removeEventListener() {}
  };
  const href = 'https://rtg.test' + pad;
  const location = new URL(href);
  const window = { document, location, URL, URLSearchParams, setTimeout() {}, clearTimeout() {} };
  window.self = window; window.top = window;
  function seed(tag, bron, geladen = false) {
    const el = element(tag);
    if (tag === 'script') el.src = bron; else { el.href = bron; el.rel = 'stylesheet'; }
    if (geladen) { el.sheet = {}; el.setAttribute('data-rtg-geladen', 'true'); }
    knopen.push(el); return el;
  }
  function voor(bron) {
    return knopen.filter(el => {
      const waarde = el.getAttribute(el.tagName === 'SCRIPT' ? 'src' : 'href');
      return waarde && new URL(waarde, href).pathname === bron;
    });
  }
  function draai(bron) {
    vm.runInNewContext(bron, { window, document, location, URL, URLSearchParams, setTimeout() {}, clearTimeout() {} });
  }
  return { window, document, body, knopen, seed, voor, draai };
}

test('Edge 1 downloadt onafhankelijke kernbronnen parallel en exact eenmaal', () => {
  const o = omgeving('/apps/app.html', 'living');
  const bestaandBlad = o.seed('link', '/shared/rtg-edge-system.css', true);
  const bestaandeWerelden = o.seed('script', '/shared/rtg-edge-worlds.js');
  let gestart = 0;
  o.draai(RANDEN);

  for (const bron of ['/shared/rtg-edge-system.css', '/shared/rtg-edge-worlds.js',
    '/shared/rtg-edge-icons.js', '/shared/rtg-edge-library.js']) {
    assert.equal(o.voor(bron).length, 1, bron + ' is gededupliceerd');
  }
  assert.equal(o.voor('/shared/rtg-edge-system.js').length, 0, 'uitvoerder wacht op de drie kernen');

  o.window.RTGEdgeWorlds = { living: { kort: 'LivingOS', all: [] } };
  bestaandeWerelden.emit('load');
  o.window.RTGEdgeIcons = {};
  o.voor('/shared/rtg-edge-icons.js')[0].emit('load');
  assert.equal(o.voor('/shared/rtg-edge-system.js').length, 0);
  o.window.RTGEdgeLibrary = {};
  o.voor('/shared/rtg-edge-library.js')[0].emit('load');
  assert.equal(o.voor('/shared/rtg-edge-system.js').length, 1, 'uitvoerder volgt pas na alle drie');
  o.window.RTGEdge = { start() { gestart++; } };
  o.voor('/shared/rtg-edge-system.js')[0].emit('load');
  assert.equal(gestart, 1);

  const aantal = o.knopen.length;
  o.draai(RANDEN);
  assert.equal(o.knopen.length, aantal, 'tweede boot doet geen tweede request');
  assert.equal(o.voor('/shared/rtg-edge-system.css')[0], bestaandBlad);
});

test('een ontbrekende Edge 1-kern laat de oude UI volledig staan', () => {
  const o = omgeving('/apps/app.html', 'living');
  o.draai(RANDEN);
  o.voor('/shared/rtg-edge-system.css')[0].emit('error');
  o.window.RTGEdgeWorlds = { living: { kort: 'LivingOS', all: [] } };
  o.voor('/shared/rtg-edge-worlds.js')[0].emit('load');
  o.window.RTGEdgeIcons = {};
  o.voor('/shared/rtg-edge-icons.js')[0].emit('load');
  o.window.RTGEdgeLibrary = {};
  o.voor('/shared/rtg-edge-library.js')[0].emit('load');
  assert.equal(o.voor('/shared/rtg-edge-system.js').length, 0);
  assert.equal(o.body.classList.contains('rtg-edge-host'), false);
  assert.equal(o.body.hasAttribute('data-rtg-edge-ready'), false);
});

test('Edge 2 downloadt vorm, context, Command en reveal parallel en commit als laatste', () => {
  const o = omgeving();
  const css = o.seed('link', '/shared/rtg-edge-2.css', true);
  const context = o.seed('script', '/shared/rtg-edge-2-context.js');
  let gestart = 0;
  o.draai(EDGE2);
  assert.equal(o.voor('/shared/rtg-edge-2.css').length, 1);
  assert.equal(o.voor('/shared/rtg-edge-2-context.js').length, 1);
  assert.equal(o.voor('/shared/rtg-edge-command.js').length, 1);
  assert.equal(o.voor('/shared/rtg-edge-2-reveal.js').length, 1);
  assert.equal(o.voor('/shared/rtg-edge-2.js').length, 0);

  o.window.RTGEdge2Context = {};
  context.emit('load');
  assert.equal(o.voor('/shared/rtg-edge-2.js').length, 0, 'de Command-brug hoort bij dezelfde complete laadgolf');
  let gekoppeld = 0;
  o.window.RTGEdgeCommand = { koppel() { gekoppeld++; } };
  o.voor('/shared/rtg-edge-command.js')[0].emit('load');
  assert.equal(o.voor('/shared/rtg-edge-2.js').length, 0, 'ook reveal hoort bij dezelfde complete laadgolf');
  o.window.RTGEdge2Reveal = { start() {} };
  o.voor('/shared/rtg-edge-2-reveal.js')[0].emit('load');
  assert.equal(o.voor('/shared/rtg-edge-2.js').length, 1, 'alle vier kernen ontsluiten samen de uitvoerder');
  o.window.RTGEdge2 = { start() { gestart++; } };
  o.voor('/shared/rtg-edge-2.js')[0].emit('load');
  assert.equal(gestart, 1);
  assert.equal(gekoppeld, 1);
  const aantal = o.knopen.length;
  o.draai(EDGE2);
  assert.equal(o.knopen.length, aantal);
  assert.equal(o.voor('/shared/rtg-edge-2.css')[0], css);
});

test('een Edge 2-bronfout behoudt Edge 1 en start geen halve verrijking', () => {
  const o = omgeving();
  o.draai(EDGE2);
  assert.equal(o.voor('/shared/rtg-edge-2.css').length, 1);
  assert.equal(o.voor('/shared/rtg-edge-2-context.js').length, 1,
    'vorm en context zijn in dezelfde laadgolf aangelegd');
  assert.equal(o.voor('/shared/rtg-edge-command.js').length, 1);
  assert.equal(o.voor('/shared/rtg-edge-2-reveal.js').length, 1);
  o.voor('/shared/rtg-edge-2.css')[0].emit('error');
  o.window.RTGEdge2Context = {};
  o.voor('/shared/rtg-edge-2-context.js')[0].emit('load');
  o.window.RTGEdgeCommand = { koppel() {} };
  o.voor('/shared/rtg-edge-command.js')[0].emit('load');
  assert.equal(o.voor('/shared/rtg-edge-2.js').length, 0);
  assert.equal(o.body.hasAttribute('data-rtg-edge-2-rendered'), false);
});
