/* Eigen a11y-keuring (scripts/a11ykeuring.js), die axe-core verving. De keuring
   zelf draait in de browser (scripts/a11y.js); hier toetsen we de PURE kern in
   Node -- kleur/luminantie/contrast-wiskunde en de conservatieve predicaten
   (mist-alt/naam/label) -- plus dat de geïnjecteerde BRON syntactisch klopt.
   Los: node --test test/a11ykeuring.test.js */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const k = require('../scripts/a11ykeuring');

// klein DOM-element-mock voor de predicaten
function elm(tag, attrs = {}, text = '') {
  return {
    tagName: tag.toUpperCase(), _a: attrs, _t: text,
    getAttribute(n) { return n in this._a ? this._a[n] : null; },
    hasAttribute(n) { return n in this._a; },
    get textContent() { return this._t; },
    get value() { return this._a.value; },
    closest() { return null; }, querySelector() { return null; }
  };
}

test('kleur ontleedt rgb/rgba en weigert de rest', () => {
  assert.deepEqual(k.kleur('rgb(255, 255, 255)'), [255, 255, 255, 1]);
  assert.deepEqual(k.kleur('rgba(12, 12, 11, 0.5)'), [12, 12, 11, 0.5]);
  assert.equal(k.kleur('transparent'), null);
  assert.equal(k.kleur(''), null);
});

test('luminantie en contrastverhouding kloppen met WCAG', () => {
  assert.ok(Math.abs(k.luminantie([255, 255, 255]) - 1) < 1e-9);
  assert.ok(k.luminantie([0, 0, 0]) < 1e-9);
  assert.ok(Math.abs(k.ratio([255, 255, 255], [0, 0, 0]) - 21) < 0.01, 'wit op zwart = 21:1');
  assert.ok(Math.abs(k.ratio([0, 0, 0], [0, 0, 0]) - 1) < 1e-9, 'gelijk = 1:1');
  // wit op het huismerk-zwart (#0C0C0B) is ruim voldoende
  assert.ok(k.ratio([255, 255, 255], [12, 12, 11]) > 18);
});

test('grootTekst volgt de WCAG-grenzen (24px, of 18.66px vet)', () => {
  assert.equal(k.grootTekst(24, 400), true);
  assert.equal(k.grootTekst(16, 400), false);
  assert.equal(k.grootTekst(19, 700), true);
  assert.equal(k.grootTekst(16, 700), false);
});

test('naam: vindt een toegankelijke naam via alle gangbare mechanismen', () => {
  global.document = { getElementById: () => null };
  try {
    assert.equal(k.naam(elm('button', { 'aria-label': 'Sluiten' })), 'Sluiten');
    assert.equal(k.naam(elm('a', {}, 'Naar huis')), 'Naar huis');
    assert.equal(k.naam(elm('button', { title: 'Menu' })), 'Menu');
    assert.equal(k.naam(elm('button', {})), '', 'geen enkele naam -> leeg');
  } finally { delete global.document; }
});

test('mistAlt: alleen als er echt geen alt en geen presentation/hidden is', () => {
  assert.equal(k.mistAlt(elm('img', {})), true);
  assert.equal(k.mistAlt(elm('img', { alt: '' })), false, 'lege alt is bewust-decoratief, geen overtreding');
  assert.equal(k.mistAlt(elm('img', { alt: 'Logo' })), false);
  assert.equal(k.mistAlt(elm('img', { role: 'presentation' })), false);
  assert.equal(k.mistAlt(elm('img', { 'aria-hidden': 'true' })), false);
});

test('mistNaam: knop/link zonder enige naam', () => {
  global.document = { getElementById: () => null };
  try {
    assert.equal(k.mistNaam(elm('button', {})), true);
    assert.equal(k.mistNaam(elm('button', {}, 'OK')), false);
    assert.equal(k.mistNaam(elm('a', { 'aria-hidden': 'true' })), false, 'verborgen telt niet');
  } finally { delete global.document; }
});

test('mistLabel: veld zonder label/aria/title/placeholder (conservatief, geen vals alarm)', () => {
  assert.equal(k.mistLabel(elm('INPUT', {})), true);
  assert.equal(k.mistLabel(elm('INPUT', { 'aria-label': 'E-mail' })), false);
  assert.equal(k.mistLabel(elm('INPUT', { title: 'Zoek' })), false);
  assert.equal(k.mistLabel(elm('INPUT', { placeholder: 'E-mail' })), false, 'placeholder telt mee, zoals axe');
  assert.equal(k.mistLabel(elm('INPUT', { type: 'hidden' })), false);
  assert.equal(k.mistLabel(elm('INPUT', { type: 'submit' })), false);
  // een veld met een gekoppeld <label> (via de .labels-NodeList) is niet ongelabeld
  const metLabel = elm('INPUT', {}); metLabel.labels = [{}];
  assert.equal(k.mistLabel(metLabel), false);
});

test('BRON is syntactisch geldige browsercode en bevat de instap', () => {
  assert.match(k.BRON, /window\.__a11yKeur = keurInPagina/);
  // parse-check zonder uitvoeren: new Function gooit bij een syntaxfout
  assert.doesNotThrow(() => new Function('window', 'document', 'getComputedStyle', 'CSS', k.BRON));
});
