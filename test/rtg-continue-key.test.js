/* De Continue Key mag rijk bewegen, maar blijft exact de bestaande primaire
   Edge-knop. Deze toets bewaakt identiteit, veilige ankers, toetsenbord,
   langdruk, geometrie, a11y, opslag en motion-koppeling. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const key = require('../public/shared/rtg-continue-key.js');
const motion = require('../public/shared/rtg-heritage-motion.js');

const ROOT = path.join(__dirname, '..');
const lees = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const CSS = lees('public/shared/rtg-continue-key.css');
const JS = lees('public/shared/rtg-continue-key.js');
const CORE = lees('public/shared/rtg-continue-key-core.js');
const LIB = lees('public/shared/rtg-edge-library.js');
const EDGE = lees('public/shared/rtg-edge-system.js');
const LOADER = lees('public/shared/rtg-edge-2-loader.js');
const RANDEN = lees('public/shared/randen.js');

class NepElement {
  constructor(doc, tag = 'div') {
    this.ownerDocument = doc; this.tagName = tag.toUpperCase(); this.children = [];
    this.parentElement = null; this.attrs = {}; this.listeners = {}; this._text = '';
    this.hidden = false; this.isConnected = true; this.rect = { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 };
    const waarden = {};
    this.style = { waarden, setProperty: (n, v) => { waarden[n] = String(v); }, removeProperty: n => { delete waarden[n]; } };
  }
  set textContent(v) {
    this.children.forEach(c => { c.parentElement = null; c.isConnected = false; });
    this.children = []; this._text = String(v);
  }
  get textContent() { return this.children.length ? this.children.map(c => c.textContent).join('') : this._text; }
  appendChild(e) { e.parentElement = this; e.isConnected = this.isConnected; this.children.push(e); this._text = ''; return e; }
  setAttribute(n, v) { this.attrs[n] = String(v); }
  getAttribute(n) { return Object.hasOwn(this.attrs, n) ? this.attrs[n] : null; }
  removeAttribute(n) { delete this.attrs[n]; }
  addEventListener(n, fn, opties) { (this.listeners[n] ||= []).push({ fn, capture: opties === true || !!(opties && opties.capture) }); }
  dispatch(n, props = {}) {
    const ev = Object.assign({ type: n, target: this, key: '', pointerType: '', button: 0,
      preventDefault() { this.defaultPrevented = true; },
      stopImmediatePropagation() { this.immediateStopped = true; } }, props);
    for (const l of (this.listeners[n] || []).filter(x => x.capture)) { l.fn(ev); if (ev.immediateStopped) return ev; }
    for (const l of (this.listeners[n] || []).filter(x => !x.capture)) { l.fn(ev); if (ev.immediateStopped) return ev; }
    if (n === 'click' && !ev.immediateStopped && typeof this.onclick === 'function') this.onclick(ev);
    return ev;
  }
  matches(q) {
    if (q === '[data-rtg-morph-action]') return this.getAttribute('data-rtg-morph-action') !== null;
    return false;
  }
  alles() { return this.children.flatMap(c => [c, ...c.alles()]); }
  querySelectorAll(q) {
    const alle = this.alles();
    if (q === '[data-rtg-action-copy-for]') return alle.filter(e => e.getAttribute('data-rtg-action-copy-for') !== null);
    if (q === '[data-rtg-key-place]') return alle.filter(e => e.getAttribute('data-rtg-key-place') !== null);
    return [];
  }
  querySelector(q) {
    const alle = this.alles();
    if (q === '[data-rtg-action-copy]') return alle.find(e => e.getAttribute('data-rtg-action-copy') !== null) || null;
    if (q === '[aria-pressed="true"]') return alle.find(e => e.getAttribute('aria-pressed') === 'true') || null;
    return null;
  }
  getBoundingClientRect() {
    const lift = this.getAttribute('data-rtg-continue-key') !== null && this.parentElement
      ? Number.parseFloat(this.parentElement.style.waarden['--rtg-key-keyboard-lift']) || 0 : 0;
    return { ...this.rect, top: this.rect.top - lift, bottom: this.rect.bottom - lift };
  }
  focus() { this.ownerDocument.activeElement = this; this.focused = true; }
  setPointerCapture(id) { this.captured = id; }
}

function omgeving() {
  const doc = {
    activeElement: null,
    createElement: tag => new NepElement(doc, tag),
    createElementNS: (_ns, tag) => new NepElement(doc, tag),
    querySelectorAll: () => [],
    documentElement: {}, body: new NepElement(null, 'body')
  };
  doc.body.ownerDocument = doc;
  const timers = [], events = {}, opslag = [], waarden = {};
  const vvEvents = {};
  const win = {
    innerWidth: 390, innerHeight: 800,
    localStorage: {
      getItem: n => Object.hasOwn(waarden, n) ? waarden[n] : null,
      setItem(n, v) { opslag.push([n, String(v)]); waarden[n] = String(v); }
    },
    RTGHand: { is: () => 'rechts' }, RTGHeritageMotion: motion,
    matchMedia: q => ({ matches: q.includes('max-width') }),
    setTimeout(fn, ms) { timers.push({ fn, ms, actief: true }); return timers.length; },
    clearTimeout(id) { if (timers[id - 1]) timers[id - 1].actief = false; },
    requestAnimationFrame(fn) { fn(); },
    addEventListener(n, fn) { (events[n] ||= []).push(fn); },
    visualViewport: {
      height: 800, offsetTop: 0,
      addEventListener(n, fn) { (vvEvents[n] ||= []).push(fn); }
    }
  };
  win.run = grens => timers.filter(t => t.actief && t.ms <= grens).splice(0).forEach(t => { t.actief = false; t.fn(); });
  win.fire = n => (events[n] || []).forEach(fn => fn());
  win.fireViewport = n => (vvEvents[n] || []).forEach(fn => fn());
  return { doc, win, opslag, waarden };
}

function rand(omg) {
  const root = omg.doc.createElement('div'), footer = omg.doc.createElement('footer'); root.appendChild(footer);
  const slot = omg.doc.createElement('div'); slot.rect = { left: 100, right: 400, top: 726, bottom: 774, width: 300, height: 48 };
  const context = omg.doc.createElement('button'); context.rect = { left: 100, right: 144, top: 728, bottom: 772, width: 44, height: 44 };
  const button = omg.doc.createElement('button'); button.textContent = 'Ga verder';
  button.setAttribute('data-rtg-edge-primary', ''); button.rect = { left: 150, right: 194, top: 728, bottom: 772, width: 44, height: 44 };
  const xp = omg.doc.createElement('button'); xp.rect = { left: 210, right: 254, top: 728, bottom: 772, width: 44, height: 44 };
  footer.appendChild(slot); slot.appendChild(context); slot.appendChild(button); slot.appendChild(xp);
  return { root, footer, slot, context, button, xp };
}

test('Edge markeert en selecteert exact één expliciete hoofdactie', () => {
  assert.equal((LIB.match(/data-rtg-edge-primary/g) || []).length, 1);
  assert.equal(key.SELECTOR, '.rtg-edge-action > [data-rtg-edge-primary]');
  assert.equal((EDGE.match(/\.rtg-edge-action \[data-rtg-edge-primary\]/g) || []).length, 2);
  assert.equal((LOADER.match(/\.rtg-edge-action \[data-rtg-edge-primary\]/g) || []).length, 1);
  assert.doesNotMatch(EDGE, /querySelector\('\.rtg-edge-action button'/);
  assert.doesNotMatch(LOADER, /querySelector\('\.rtg-edge-action button'/);
  const omg = omgeving(), eerste = rand(omg).button, tweede = rand(omg).button;
  omg.doc.querySelectorAll = () => [eerste, tweede];
  assert.equal(key.sync(omg.doc, omg.win), null, 'twee kandidaten falen gesloten');
  assert.equal(eerste.getAttribute('data-rtg-continue-key'), null);
  assert.equal(tweede.getAttribute('data-rtg-continue-key'), null);
});

test('een route zonder bewezen hoofdhandeling toont geen loze Continue Key', () => {
  assert.match(RANDEN, /actie: null/);
  assert.doesNotMatch(RANDEN, /main \.knop|main \.campus-ingang|main \[data-primary\]/,
    'de generieke schil mag niet de eerste toevallige knop activeren');
  assert.match(EDGE, /hoofdactie\.hidden = !hoofdtekst/);
  assert.match(LOADER, /k\.hidden = false/);

  key.stop();
  const omg = omgeving(), { button } = rand(omg);
  button.hidden = true;
  omg.doc.querySelectorAll = () => [button];
  assert.equal(key.sync(omg.doc, omg.win), null, 'een verborgen, doelloze actie wordt niet verrijkt');
  assert.equal(button.getAttribute('data-rtg-continue-key'), null);
  button.hidden = false; button.setAttribute('aria-disabled', 'true');
  assert.equal(key.sync(omg.doc, omg.win), null, 'een onbeschikbare actie wordt niet verrijkt');
  button.setAttribute('aria-disabled', 'false');
  assert.ok(key.sync(omg.doc, omg.win), 'een expliciet geopende actie wordt wel verrijkt');
});

test('gesloten ankers en opslag bewaren uitsluitend de positievoorkeur', () => {
  assert.deepEqual(key.ANCHORS, ['links', 'midden', 'rechts']);
  assert.equal(key.normalizeAnchor('MIDDEN'), 'midden');
  assert.equal(key.normalizeAnchor('vrij'), null);
  assert.equal(key.anchorForX(0, 0, 300), 'links');
  assert.equal(key.anchorForX(150, 0, 300), 'midden');
  assert.equal(key.anchorForX(299, 0, 300), 'rechts');
  const { win, opslag } = omgeving();
  assert.equal(key.writePreference(win, 'vrij'), false);
  assert.equal(key.writePreference(win, 'links'), true);
  assert.deepEqual(opslag, [[key.STORAGE_KEY, 'links']]);
  assert.equal(key.readPreference(win), 'links');
  assert.equal((CORE.match(/\.setItem\(/g) || []).length, 1);
  assert.doesNotMatch(JS + CORE, /cookie|sessionStorage|indexedDB/);
});

test('verrijking houdt knop en onclick identiek, ook na Edge-redraw', () => {
  key.stop();
  const omg = omgeving(), { root, slot, button } = rand(omg); let klikken = 0;
  const handler = () => { klikken++; }; button.onclick = handler;
  const rt = key.enhance(button, omg.doc, omg.win);
  assert.ok(rt); assert.strictEqual(rt.button, button); assert.strictEqual(button.onclick, handler);
  assert.equal(slot.children.filter(e => e.getAttribute('data-rtg-edge-primary') !== null).length, 1);
  assert.equal(button.getAttribute('data-rtg-continue-key'), '');
  assert.equal(button.querySelectorAll('[data-rtg-action-copy-for]').length, 4);
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  assert.match(button.getAttribute('aria-describedby'), /rtg-continue-key-/);
  button.dispatch('click'); assert.equal(klikken, 1, 'gewone tik blijft van de bestaande handler');

  button.textContent = 'Open route';
  assert.equal(button.querySelector('[data-rtg-action-copy]'), null);
  const opnieuw = key.enhance(button, omg.doc, omg.win);
  assert.strictEqual(opnieuw, rt); assert.strictEqual(button.onclick, handler);
  assert.equal(slot.children.filter(e => e.className === 'rtg-continue-key-picker').length, 0,
    'de alternatieve bediening vervuilt de hoofdactiesleuf niet');
  assert.equal(root.alles().filter(e => e.className === 'rtg-continue-key-picker').length, 1);
  assert.equal(button.querySelectorAll('[data-rtg-action-copy-for]')[0].textContent, 'Open route');
  assert.equal(button.getAttribute('data-rtg-key-anchor'), 'rechts', 'redraw verplaatst de Key niet');
  assert.equal(key.setState('pending', { progress: .4 }), true);
  assert.equal(button.getAttribute('aria-busy'), 'true');
  assert.equal(button.style.waarden['--rtg-action-progress'], '0.4');
  assert.equal(key.setState('success'), true);
  assert.equal(button.getAttribute('aria-busy'), 'false');
});

test('capsule blijft geometrisch tussen bestaande Edge-buren', () => {
  key.stop(); const omg = omgeving(), { button } = rand(omg);
  const rt = key.enhance(button, omg.doc, omg.win);
  button.setAttribute('data-rtg-key-anchor', 'links');
  const rechts = key.measure(rt);
  assert.deepEqual(rechts, { direction: 'right', width: 54 });
  assert.ok(button.rect.left + rechts.width <= 210 - 6, 'capsule raakt rechter buur niet');
  button.setAttribute('data-rtg-key-anchor', 'rechts');
  const links = key.measure(rt);
  assert.deepEqual(links, { direction: 'left', width: 44 });
  assert.ok(button.rect.right - links.width >= 144 + 6, 'capsule raakt linker buur niet');
});

test('langdruk verplaatst alleen langs veilige rail en activeert de actie niet', () => {
  key.stop(); const omg = omgeving(), { button } = rand(omg); let klikken = 0;
  const handler = () => { klikken++; }; button.onclick = handler;
  const rt = key.enhance(button, omg.doc, omg.win);
  button.dispatch('pointerdown', { pointerId: 7, pointerType: 'touch', clientX: 160, clientY: 750 });
  omg.win.run(520);
  assert.equal(rt.picker.hidden, false); assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.equal(button.captured, 7); assert.equal(klikken, 0);
  button.dispatch('pointermove', { pointerId: 7, pointerType: 'touch', clientX: 250, clientY: 750 });
  assert.equal(button.getAttribute('data-rtg-key-anchor'), 'midden');
  assert.equal(omg.opslag.length, 0, 'preview wordt niet bewaard');
  button.dispatch('pointerup', { pointerId: 7, pointerType: 'touch', clientX: 250, clientY: 750 });
  assert.deepEqual(omg.opslag, [[key.STORAGE_KEY, 'midden']]);
  const klik = button.dispatch('click');
  assert.equal(klik.defaultPrevented, true); assert.equal(klikken, 0, 'synthetische klik na langdruk wordt ingeslikt');
  assert.strictEqual(button.onclick, handler, 'de oorspronkelijke handler is niet vervangen');
});

test('toetsenbordalternatief, Escape en toetsenbordruimte blijven bereikbaar', () => {
  key.stop(); const omg = omgeving(), { slot, button } = rand(omg);
  const rt = key.enhance(button, omg.doc, omg.win);
  const links = button.dispatch('keydown', { key: 'ArrowLeft', altKey: true });
  assert.equal(links.defaultPrevented, true);
  assert.equal(button.getAttribute('data-rtg-key-anchor'), 'midden');
  const enter = button.dispatch('keydown', { key: 'Enter' });
  assert.equal(enter.defaultPrevented, undefined, 'Enter blijft voor de bestaande hoofdactie');
  button.dispatch('keydown', { key: 'F10', shiftKey: true });
  assert.equal(rt.picker.hidden, false); assert.equal(omg.doc.activeElement.getAttribute('data-rtg-key-place'), 'midden');
  rt.picker.dispatch('keydown', { key: 'Escape' });
  assert.equal(rt.picker.hidden, true); assert.strictEqual(omg.doc.activeElement, button);

  omg.doc.activeElement = Object.assign(omg.doc.createElement('input'), {
    rect: { left: 145, right: 260, top: 430, bottom: 475, width: 115, height: 45 }
  });
  omg.win.visualViewport.height = 500; omg.win.fireViewport('resize');
  assert.equal(slot.style.waarden['--rtg-key-keyboard-lift'], '350px', 'Key komt boven toetsenbord én actief veld');
  omg.win.fireViewport('resize');
  assert.equal(slot.style.waarden['--rtg-key-keyboard-lift'], '350px', 'herhaalde meting oscilleert niet');
});

test('Focus en een appvenster sluiten de tijdelijke kiezer zonder terugkeer', () => {
  key.stop(); const omg = omgeving(), { button } = rand(omg);
  omg.doc.querySelectorAll = () => [button];
  const rt = key.enhance(button, omg.doc, omg.win);
  button.dispatch('keydown', { key: 'F10', shiftKey: true }); assert.equal(rt.picker.hidden, false);
  omg.doc.body.setAttribute('data-rtg-edge-2-state', 'focus'); key.sync(omg.doc, omg.win);
  assert.equal(rt.picker.hidden, true); assert.equal(button.getAttribute('aria-expanded'), 'false');
  omg.doc.body.setAttribute('data-rtg-edge-2-state', 'overview'); key.sync(omg.doc, omg.win);
  assert.equal(rt.picker.hidden, true, 'terugkeer naar Edge laat de kiezer niet spontaan terugkomen');
});

test('CSS maakt een 44px cirkel/capsule zonder flowanimatie en respecteert rust', () => {
  assert.match(CSS, /\.rtg-edge-action>\[data-rtg-edge-primary\]\{[^}]*flex:0 0 44px[^}]*min-height:44px/);
  assert.match(CSS, /flex:0 0 44px;width:44px;min-width:44px;max-width:44px;height:44px;min-height:44px/);
  assert.match(CSS, /:focus-visible,\[data-rtg-key-expanded="true"\]/);
  assert.match(CSS, /@media\(hover:hover\) and \(pointer:fine\)/);
  assert.match(CSS, /clip-path:inset\(0 round 999px\)/);
  assert.match(CSS, /env\(safe-area-inset-bottom,0px\)/);
  assert.match(CSS, /@media\(max-width:767px\)[\s\S]*:has\(>\[data-rtg-continue-key\]\)::before\{display:none\}/);
  assert.match(CSS, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(CSS, /html\.rtg-stil/);
  assert.doesNotMatch(CSS, /transition(?:-property)?\s*:[^;}]*\b(?:width|height|left|right|margin|padding)\b/);
  assert.doesNotMatch(CSS.replace(/\/\*[\s\S]*?\*\//g, ''), /(^|[;{\s])order\s*:/);
  assert.doesNotMatch(JS + CORE, /cloneNode|replaceWith|\.onclick\s*=|fetch\s*\(|location\.|history\./);
});

test('Continue-laag laadt in vaste volgorde en ieder browserbestand blijft klein', () => {
  const heritage = lees('public/shared/rtg-heritage.css');
  assert.ok(heritage.indexOf('rtg-heritage-motion.css') < heritage.indexOf('rtg-continue-key.css'));
  assert.ok(heritage.indexOf('rtg-continue-key.css') < heritage.indexOf('rtg-heritage-materials.css'));
  const deel = lees('public/shared/basis/basis-01aa-continue.js');
  assert.ok(deel.indexOf('rtg-continue-key-core.js') < deel.indexOf('rtg-continue-key.js'));
  for (const bestand of ['public/shared/rtg-continue-key-core.js', 'public/shared/rtg-continue-key.js',
    'public/shared/rtg-continue-key.css', 'public/shared/basis/basis-01aa-continue.js']) {
    assert.ok(fs.statSync(path.join(ROOT, bestand)).size < 10 * 1024, bestand + ' overschrijdt 10 kB');
  }
});
