'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const bron = fs.readFileSync('public/shared/leeg.js', 'utf8');

function node(tag) {
  return {
    tagName: tag.toUpperCase(), className: '', textContent: '', children: [], dataset: {}, attrs: {},
    appendChild(kind) { this.children.push(kind); return kind; },
    setAttribute(naam, waarde) { this.attrs[naam] = String(waarde); },
    addEventListener() {}, matches() { return false; }, focus() {}, click() {}
  };
}

function laad() {
  const listeners = {};
  const document = {
    createElement: node,
    addEventListener(naam, fn) { listeners[naam] = fn; },
    querySelector() { return null; }
  };
  const window = { document, localStorage: { getItem() { return null; } } };
  vm.runInContext(bron, vm.createContext({ window, document, URL }));
  return window.RTGLeeg;
}

test('lege staat houdt een interne app- of schermbestemming bedienbaar', () => {
  const leeg = laad();
  const app = leeg.vlak({ titel: 'Aanmelden', stappen: [{ tekst: 'Open', pad: '/apps/app.html' }] });
  assert.equal(app.tagName, 'A'); assert.equal(app.attrs.href, '/apps/app.html');
  const scherm = leeg.vlak({ titel: 'Etalage', stappen: [{ tekst: 'Ga', pad: '#etalage' }] });
  assert.equal(scherm.tagName, 'A'); assert.equal(scherm.attrs.href, '#etalage');
});

test('lege staat weigert uitvoerbare, externe en protocol-relative bestemmingen', () => {
  const leeg = laad();
  for (const pad of ['javascript:alert(1)', 'https://ander.example/pad', '//ander.example/pad', ' /apps/app.html', '/\\ander.example/pad']) {
    const vlak = leeg.vlak({ titel: 'Onveilig', stappen: [{ tekst: 'Ga', pad }] });
    assert.equal(vlak.tagName, 'DIV', pad);
    assert.equal(vlak.attrs.href, undefined, pad);
    const html = leeg.html({ titel: 'Onveilig', stappen: [{ tekst: 'Ga', pad }] });
    assert.doesNotMatch(html, /href=/, pad);
  }
});

test('meerdere stappen tonen uitsluitend geldige interne links', () => {
  const leeg = laad();
  const vlak = leeg.vlak({ titel: 'Kies', stappen: [
    { tekst: 'Intern', pad: '/apps/media.html?stand=kijk#nu' },
    { tekst: 'Extern', pad: 'https://ander.example/' }
  ] });
  assert.equal(vlak.tagName, 'DIV');
  assert.equal(vlak.children.filter(x => x.tagName === 'A').length, 1);
  assert.equal(vlak.children.find(x => x.tagName === 'A').attrs.href, '/apps/media.html?stand=kijk#nu');
});

test('HTML-vorm ontsnapt servertekst en gebruikt alleen het begrensde pad', () => {
  const leeg = laad();
  const html = leeg.html({ titel: '<script>', stappen: [{ tekst: 'Open "nu"', pad: '/apps/app.html?a=1&b=2' }] });
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /href="\/apps\/app\.html\?a=1&amp;b=2"/);
  assert.doesNotMatch(html, /<script>/);
});
