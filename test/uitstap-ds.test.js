'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), crypto = require('node:crypto');
const { fixture } = require('./lib/foundation-ds-fixture');
const bron = fs.readFileSync('public/shared/uitstap.js', 'utf8');
function opstelling(ds = true, breekReplace = false) {
  const f = fixture({ ds, source: '/* alleen DOM */' }), events = {}, navigatie = [], observers = [];
  const proto = Object.getPrototypeOf(f.document.body), matches = proto.matches;
  proto.matches = function (s) {
    if (s === 'dialog:modal') return this.tagName === 'DIALOG' && this.modal && this.open;
    if (s === '[aria-modal="true"]') return this.getAttribute('aria-modal') === 'true';
    return matches.call(this, s);
  };
  proto.closest = function (s) { for (let n = this; n; n = n.parentNode) if (n.matches(s)) return n; return null; };
  proto.checkVisibility = function () { return !this.hidden && (this.tagName !== 'DIALOG' || this.open); };
  f.document.readyState = 'complete';
  f.document.addEventListener = (n, fn, capture) => { (events[n] ||= []).push({ fn, capture }); };
  f.context.MutationObserver = class { constructor(fn) { observers.push(fn); } observe() {} };
  f.context.innerWidth = 390; f.context.innerHeight = 844;
  f.context.Date = { now: () => f.now };
  f.now = 10000;
  f.context.location.replace = href => { navigatie.push({ methode: 'replace', href, title: f.document.title }); if (breekReplace) throw Error('replace unavailable'); };
  f.context.location.assign = href => { navigatie.push({ methode: 'assign', href, title: f.document.title }); };
  f.document.elementFromPoint = () => f.hit || f.document.body;
  f.document.activeElement = f.document.body;
  f.storage.set('sessie', 'behouden');
  f.event = (n, e = {}) => { for (const r of events[n] || []) r.fn(e); };
  f.muteer = () => observers.forEach(fn => fn());
  f.dialog = () => { const d = f.add('dialog'); d.open = true; d.modal = true; d.setAttribute('aria-modal', 'true'); return d; };
  vm.runInContext(bron, f.context);
  return Object.assign(f, { events, navigatie, observers, knop: f.node('#rtg-uitstap') });
}
test('Uitstap keeps immediate title-before-replace, fallback and the existing storage contract', () => {
  for (const ds of [false,true]) for (const fail of [false,true]) {
    const f = opstelling(ds, fail); f.knop.click();
    assert.deepEqual(f.navigatie, fail
      ? [{ methode: 'replace', href: 'https://www.google.nl/', title: 'Nieuw tabblad' },
        { methode: 'assign', href: 'https://www.google.nl/', title: 'Nieuw tabblad' }]
      : [{ methode: 'replace', href: 'https://www.google.nl/', title: 'Nieuw tabblad' }]);
    assert.equal(f.storage.get('sessie'), 'behouden', 'geen nieuwe uitlog of wisbelofte');
    assert.equal(f.context.location.href, undefined);
    assert.equal(f.knop.classList.contains('ds-uitstap'), ds);
    assert.equal(f.document.body.classList.contains('ds-uitstap-actief'), ds);
    assert.equal(!!f.knop.style.cssText, !ds);
    assert.match(f.knop.getAttribute('aria-label'), /neutrale pagina/);
    assert.equal(f.observers.length, ds ? 1 : 0);
  }
});
test('DS Escape uses capture without consuming the first Escape; two presses retain the 1500ms contract', () => {
  const f = opstelling(); assert.equal(f.events.keydown[0].capture, true);
  f.event('keydown', { key: 'Escape', preventDefault() { throw Error('mag eerste Escape niet afpakken'); } });
  assert.equal(f.navigatie.length, 0);
  f.now += 1600; f.event('keydown', { key: 'Escape' }); assert.equal(f.navigatie.length, 0);
  f.now += 100; f.event('keydown', { key: 'Escape' }); assert.equal(f.navigatie.length, 1);
  const old = opstelling(false); assert.equal(old.events.keydown[0].capture, false);
});
test('the same DS exit follows the actual top-layer hit, including reverse DOM open order and close/reopen', () => {
  const f = opstelling(), first = f.dialog(), last = f.dialog(), b = f.knop;
  f.hit = last; f.document.activeElement = last; f.muteer(); assert.equal(b.parentNode, last);
  // First in DOM is opened last: DOM ordering is not top-layer ordering.
  f.hit = first; f.document.activeElement = last; f.muteer(); assert.equal(b.parentNode, first);
  first.open = false; f.hit = last; f.event('close'); assert.equal(b.parentNode, last);
  last.open = false; f.hit = f.document.body; f.document.activeElement = f.document.body; f.event('close');
  assert.equal(b.parentNode, f.document.body);
  first.open = true; f.hit = first; f.muteer(); assert.equal(b.parentNode, first);
  assert.equal(f.document.querySelectorAll('#rtg-uitstap').length, 1); assert.equal(b, f.node('#rtg-uitstap'));
  assert.equal(first.open, true); assert.equal(f.navigatie.length, 0, 'laagsynchronisatie is geen vluchtactie');
});
test('Foundation protected home stays inert; exit survives gate rerender and returns without access changes', () => {
  const f = opstelling(), home = f.add('main'), gate = f.add('section'), b = f.knop;
  home.setAttribute('inert', ''); gate.className = 'ds-foundation-toegang'; gate.setAttribute('aria-modal', 'true');
  f.hit = gate; f.document.activeElement = gate; f.muteer(); assert.equal(b.parentNode, gate);
  gate.innerHTML = '<p>De deur blijft gesloten</p>'; f.muteer(); assert.equal(b.parentNode, gate);
  assert.equal(home.hasAttribute('inert'), true); assert.equal(gate.getAttribute('aria-modal'), 'true');
  b.focus(); gate.remove(); f.hit = f.document.body; f.muteer();
  assert.equal(b.parentNode, f.document.body); assert.equal(f.document.activeElement, b);
  assert.equal(home.hasAttribute('inert'), true);
  vm.runInContext(bron, f.context); assert.equal(f.document.querySelectorAll('#rtg-uitstap').length, 1);
});
test('legacy inline presentation remains byte-identical to 3b07587407', () => {
  const f = opstelling(false);
  assert.equal(crypto.createHash('sha256').update(f.knop.style.cssText).digest('hex'), '25fadd5d30786b3f203402edcfe0ac6be3a33e665d432d43500d0dbf456246e4');
});
