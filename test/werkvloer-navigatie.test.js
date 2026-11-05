'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'public/apps/werkvloer.js'), 'utf8');

function element(tag) {
  return {
    tagName: String(tag).toUpperCase(), children: [], attributes: {}, classList: { add() {}, remove() {} },
    appendChild(child) { this.children.push(child); return child; },
    append(...children) { this.children.push(...children); },
    removeChild(child) { this.children.splice(this.children.indexOf(child), 1); },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    get firstChild() { return this.children[0] || null; }
  };
}

function runtime(pathname) {
  const nav = element('nav');
  const document = {
    readyState: 'loading', documentElement: { lang: 'nl' }, body: { setAttribute() {} },
    createElement: element, addEventListener() {},
    querySelector(selector) { return selector === '[data-ds-opsnav]' ? nav : null; }
  };
  const window = { self: null, top: null, location: { pathname: pathname || '/apps/ovdienst.html', search: '' } };
  window.self = window; window.top = window;
  const sandbox = { window, document, Intl, Date, JSON, Object, String, Promise,
    setTimeout, clearTimeout, fetch: async () => ({ ok: false, json: async () => ({}) }) };
  vm.createContext(sandbox); vm.runInContext(source, sandbox);
  return { RTGWerk: window.RTGWerk, nav };
}

test('de operatienavigatie bevat uitsluitend de vier vaste interne bestemmingen', () => {
  const r = runtime('/apps/ovcontrol.html');
  r.RTGWerk.opsNav();
  assert.deepEqual(r.nav.children.map(a => a.attributes.href), [
    '/apps/ov.html', '/apps/chauffeur.html', '/apps/luchthaven.html', '/apps/ovcontrol.html'
  ]);
  assert.equal(r.nav.children[3].attributes['aria-current'], 'page');
});

test('de personeelsdeur valt bij onbekende invoer dicht op de vaste personeels-app', () => {
  for (const bestemming of ['/apps/personeel.html', 'javascript:alert(1)', '//voorbeeld.invalid', '/apps/bank.html']) {
    const r = runtime(), doel = element('section');
    r.RTGWerk.deur(doel, bestemming);
    const link = doel.children.find(el => el.tagName === 'A');
    assert.equal(link.attributes.href, '/apps/personeel.html', bestemming);
  }
});
