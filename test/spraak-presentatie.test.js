'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const lees = bestand => fs.readFileSync(path.join(__dirname, '..', bestand), 'utf8');

test('spraak koppelt direct een zichtbaar rusticoon en herstelt dit na een resultaat', () => {
  let instantie, gehoord = '';
  class Herkenner {
    constructor() { instantie = this; this.events = {}; }
    addEventListener(naam, fn) { this.events[naam] = fn; }
    start() { this.gestart = true; }
  }
  const events = {}, attrs = {}, classes = new Set(), links = [];
  const knop = { innerHTML: '', hidden: false, classList: { add(n) { classes.add(n); } }, setAttribute(n, v) { attrs[n] = v; }, addEventListener(n, fn) { events[n] = fn; } };
  const document = { documentElement: { lang: 'nl', hasAttribute() { return false; } }, getElementById() { return null; },
    createElement() { return {}; }, head: { appendChild(link) { links.push(link); } } };
  const window = { SpeechRecognition: Herkenner, document };
  vm.runInNewContext(lees('public/shared/spraak.js'), { window, document: window.document });
  window.Spraak.koppel(knop, { opTekst: tekst => { gehoord = tekst; } });
  assert.equal(attrs['data-spraakknop'], ''); assert.equal(classes.has('ds-spraakknop'), true); assert.match(knop.innerHTML, /<rect/);
  assert.equal(links[0].href, '/ds/rtg-ds.css');
  events.click(); assert.equal(instantie.gestart, true); assert.match(knop.innerHTML, /<circle/);
  instantie.events.result({ results: [[{ transcript: '  open agenda  ' }]] });
  assert.equal(gehoord, 'open agenda');
  instantie.events.end(); assert.match(knop.innerHTML, /<rect/);
});

test('alle vier spraakhosts laden één centrale toegankelijke maat vóór gedrag', () => {
  const js = lees('public/shared/spraak.js'), css = lees('public/ds/componenten/spraak.css');
  assert.doesNotMatch(js, /createElement\(['"]style['"]\)|rtg-spraak-maat/);
  assert.match(css, /min-inline-size: var\(--ds-doel\)/); assert.match(css, /min-block-size: var\(--ds-doel\)/); assert.match(css, /:focus-visible/);
  for (const app of ['app', 'camera', 'muziek', 'personeel']) {
    const html = lees('public/apps/' + app + '.html');
    assert.equal((html.match(/\/shared\/spraak\.css/g) || []).length, 0, app);
    assert.equal((html.match(/\/shared\/spraak\.js/g) || []).length, 1, app);
  }
  assert.match(lees('public/ds/rtg-ds.css'), /componenten\/spraak\.css/);
});
