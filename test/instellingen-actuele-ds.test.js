/* De echte bestaande owner met een minimale DOM-poort. Dit bewijst zijn
   lifecycle en delegatie, niet native browsermodaliteit of geometrie. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm');
const { bundel } = require('../scripts/bundel');

function omgeving(ds = false) {
  const nodes = [], timers = [], events = new Map(), calls = [];
  let document;
  function node(tag) {
    const n = { tagName: tag.toUpperCase(), className: '', children: [], events: {}, attrs: {}, style: {}, open: false,
      setAttribute(k, v) { this.attrs[k] = String(v); },
      appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
      addEventListener(k, f) { this.events[k] = f; },
      remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(c => c !== this); this.parentNode = null; },
      querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
      querySelectorAll(selector) {
        return this.children.flatMap(c => [(selector[0] === '.' ? c.classList.contains(selector.slice(1)) : c.tagName === selector.toUpperCase()) ? c : null,
          ...c.querySelectorAll(selector)]).filter(Boolean);
      },
      focus() { document.activeElement = this; },
      showModal() { assert.equal(this.tagName, 'DIALOG'); this.open = true; this.shown = (this.shown || 0) + 1; },
      close() { assert.equal(this.tagName, 'DIALOG'); this.open = false; },
      click() { this.events.click?.({ target: this }); }
    };
    Object.defineProperty(n, 'isConnected', { get() { return ['BODY', 'HEAD'].includes(n.tagName) || !!n.parentNode?.isConnected; } });
    n.classList = {
      contains: k => n.className.split(/\s+/).includes(k),
      add(k) { if (!this.contains(k)) n.className += ' ' + k; },
      remove(k) { n.className = n.className.split(/\s+/).filter(x => x !== k).join(' '); },
      toggle(k, aan) { if (aan === undefined) aan = !this.contains(k); if (aan) this.add(k); else this.remove(k); }
    };
    nodes.push(n); return n;
  }
  document = { readyState: 'complete', documentElement: { hasAttribute: k => ds && k === 'data-ds' },
    body: node('body'), head: node('head'), createElement: node,
    querySelector: q => ds && q === 'link[href="/ds/rtg-ds.css"]' ? {} : null,
    getElementById: id => nodes.find(n => n.id === id && n.isConnected) || null,
    addEventListener(k, f) { events.set(k, f); },
    removeEventListener(k, f) { if (events.get(k) === f) events.delete(k); }
  };
  const opener = node('button'); document.body.appendChild(opener); opener.focus();
  const window = { RTGGids: { open() { calls.push('gids'); } } };
  vm.runInNewContext(bundel('shared/bediening.js').toString('utf8'), { window, document, setTimeout: f => timers.push(f) });
  timers.splice(0).forEach(f => f());
  return { document, api: window.RTGBediening, opener, calls, zetDs(v) { ds = v; },
    paneel: () => document.body.children.find(n => n.classList.contains('bdn-scrim')),
    stijl: () => document.getElementById('rtgDsRuntimeCss'),
    escape() { const p = this.paneel(); if (p?.tagName === 'DIALOG') p.events.cancel({ preventDefault() {} }); else events.get('keydown')?.({ key: 'Escape' }); },
    keydownAan: () => events.has('keydown') };
}

for (const ds of [false, true]) test((ds ? 'DS' : 'legacy-host') + ': dezelfde instellingen-owner behoudt open, sluiten, focus en gidsdelegatie', () => {
  const f = omgeving(ds); assert.equal(f.api.aanwezig, true);
  f.api.open(); const p = f.paneel();
  assert.equal(p.tagName, 'DIALOG'); assert.equal(!!f.stijl(), !ds);
  assert.equal(p.classList.contains('ds-instellingen'), true);
  assert.equal(p.open, true); assert.equal(f.keydownAan(), false);
  assert.equal(f.document.activeElement, p.querySelector('button'));
  f.escape(); assert.equal(p.classList.contains('open'), false); assert.equal(p.open, false);
  assert.equal(f.document.activeElement, f.opener); assert.equal(f.keydownAan(), false);
  f.api.open(); f.paneel().querySelectorAll('button').find(b => b.textContent === 'Openen').click();
  assert.deepEqual(f.calls, ['gids']); assert.equal(f.paneel().classList.contains('open'), false);
  assert.equal(f.document.activeElement, f.opener);
});

test('DS actief vóór eerste opening gebruikt meteen native presentatie en injecteert geen legacy-CSS', () => {
  const f = omgeving(false); f.zetDs(true); f.api.open();
  assert.equal(f.paneel().tagName, 'DIALOG'); assert.equal(f.paneel().open, true);
  assert.equal(f.paneel().classList.contains('ds-instellingen'), true);
  assert.equal(f.stijl(), null); assert.equal(f.keydownAan(), false);
  f.escape(); assert.equal(f.document.activeElement, f.opener);
});

test('de canonieke runtimepresentatie blijft bij een late DS-markering dezelfde owner', () => {
  const f = omgeving(false); f.api.open(); const bestaand = f.paneel(), stijl = f.stijl();
  assert.ok(stijl); f.api.sluit(); f.zetDs(true); f.api.open();
  const nieuw = f.paneel(); assert.notEqual(nieuw, bestaand); assert.equal(bestaand.isConnected, false);
  assert.equal(stijl.isConnected, true); assert.equal(f.stijl(), stijl);
  assert.equal(nieuw.tagName, 'DIALOG'); assert.equal(nieuw.open, true);
  assert.equal(f.document.body.children.filter(n => n.classList.contains('bdn-scrim')).length, 1);
  f.api.sluit(); assert.equal(f.document.activeElement, f.opener);
});

test('DS-markering vervangt een geopend canoniek paneel niet en bewaart focus', () => {
  const f = omgeving(false); f.api.open(); const oud = f.paneel(), focus = f.document.activeElement;
  const oudeStijl = f.stijl(); f.zetDs(true); f.api.open();
  assert.equal(f.paneel(), oud); assert.equal(f.document.activeElement, focus);
  assert.equal(f.stijl(), oudeStijl); assert.equal(oud.classList.contains('open'), true);
  f.escape(); assert.equal(f.document.activeElement, f.opener);
  f.api.open(); assert.notEqual(f.paneel(), oud); assert.equal(f.paneel().tagName, 'DIALOG');
  assert.equal(f.stijl(), oudeStijl);
});

test('een hostmarkering wijzigt de presentatie niet; een verdwenen opener wordt niet opnieuw gefocust', () => {
  const f = omgeving(true); f.api.open(); f.api.sluit(); f.zetDs(false); f.api.open();
  assert.equal(f.paneel().tagName, 'DIALOG'); assert.ok(f.stijl()); assert.equal(f.keydownAan(), false);
  f.opener.remove(); const huidig = f.document.activeElement; f.api.sluit();
  assert.equal(f.document.activeElement, huidig); assert.equal(f.keydownAan(), false);
});
