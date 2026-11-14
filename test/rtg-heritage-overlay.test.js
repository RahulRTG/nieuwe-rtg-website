/* Voer de echte Heritage-annotator uit: Rahul is een globale overlay, geen
   schermwortel. Een content-markering kan anders de verborgen overlay openen. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const bron = fs.readFileSync(path.join(__dirname, '../public/shared/rtg-heritage-components.js'), 'utf8');

class Element {
  constructor(tag, attrs = {}, breedte = 800, hoogte = 600) {
    this.tagName = tag.toUpperCase(); this.attrs = { ...attrs };
    this.children = []; this.parentElement = null; this.nodeType = 1;
    this.hidden = false; this.breedte = breedte; this.hoogte = hoogte;
    this.type = attrs.type || ''; this.labels = [];
    this.classList = { contains: naam => (this.attrs.class || '').split(/\s+/).includes(naam) };
  }
  appendChild(el) { this.children.push(el); el.parentElement = this; return el; }
  hasAttribute(naam) { return Object.hasOwn(this.attrs, naam); }
  getAttribute(naam) { return this.hasAttribute(naam) ? this.attrs[naam] : null; }
  setAttribute(naam, waarde) { this.attrs[naam] = String(waarde); }
  matches(selector) {
    return selector.split(',').some(deel => {
      const s = deel.trim();
      if (/^\.[\w-]+$/.test(s)) return this.classList.contains(s.slice(1));
      if (/^#[\w-]+$/.test(s)) return this.getAttribute('id') === s.slice(1);
      const a = s.match(/^([a-z]+|\.[\w-]+)?\[([\w-]+)(?:="([^"]*)")?\]$/);
      if (a) return (!a[1] || this.matches(a[1])) &&
        this.hasAttribute(a[2]) && (a[3] === undefined || this.getAttribute(a[2]) === a[3]);
      assert.match(s, /^[a-z]+$/, 'de minimale DOM moet deze selector werkelijk ondersteunen');
      return this.tagName === s.toUpperCase();
    });
  }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
  querySelectorAll(selector) {
    return this.children.flatMap(el => [...(el.matches(selector) ? [el] : []), ...el.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  getBoundingClientRect() {
    for (let el = this; el; el = el.parentElement) {
      if (el.hidden) return { width: 0, height: 0 };
    }
    return { width: this.breedte, height: this.hoogte };
  }
}

function omgeving() {
  const body = new Element('body');
  let start, wijziging;
  const document = {
    body, readyState: 'loading', querySelectorAll: selector => body.querySelectorAll(selector),
    addEventListener(naam, fn) { assert.equal(naam, 'DOMContentLoaded'); start = fn; }
  };
  const window = {
    location: { pathname: '/apps/mijn-neigingen.html', href: 'https://test.local/apps/mijn-neigingen.html' },
    RTGWorldIdentity: { normalizePath: p => p, classify: () => 'living' },
    RTGHeritageRegistry: {
      profiles: {}, canvas: {}, common: [{ selector: '[data-proef]', component: 'OperationalPanel', variant: 'default' }]
    }
  };
  vm.runInNewContext(bron, {
    window, document,
    getComputedStyle: el => ({ display: el.hidden ? 'none' : 'block', visibility: 'visible' }),
    requestAnimationFrame: fn => fn(),
    MutationObserver: class {
      constructor(fn) { wijziging = fn; }
      observe(el, opties) { assert.equal(el, body); assert.equal(opties.subtree, true); }
    }
  });
  return {
    body, start: () => start(), annotate: () => window.RTGHeritageComponents.annotate(),
    voegLaterToe(el) { body.appendChild(el); wijziging([{ addedNodes: [el] }]); }
  };
}

function rahul(metMain) {
  const paneel = new Element('section', { class: 'rtg-rahul-page ds-rahul', 'data-proef': 'rahul' }, 1400, 1000);
  const inhoud = paneel.appendChild(new Element(metMain ? 'main' : 'section', { 'data-proef': 'inhoud' }));
  const invoer = inhoud.appendChild(new Element('input', { type: 'text', 'aria-label': 'Vraag' }));
  const tabel = inhoud.appendChild(new Element('table'));
  return { paneel, inhoud, invoer, tabel };
}

function nietGeannoteerd(r) {
  for (const el of [r.paneel, r.inhoud, r.invoer, r.tabel]) {
    for (const attribuut of ['data-rtg-screen-root', 'data-rtg-component', 'data-rtg-component-variant',
      'data-rtg-form-control', 'data-rtg-operational-table']) {
      assert.equal(el.getAttribute(attribuut), null, `${el.tagName} in Rahul krijgt geen ${attribuut}`);
    }
  }
}

for (const zichtbaar of [true, false]) for (const later of [false, true]) for (const metMain of [false, true]) {
  test(`Rahul ${later ? 'na' : 'vóór'} annotatie, ${zichtbaar ? 'zichtbaar' : 'verborgen'} main, overlay ${metMain ? 'met' : 'zonder'} inner-main`, () => {
    const f = omgeving();
    const main = f.body.appendChild(new Element('main', { 'data-proef': 'echt' }));
    main.hidden = !zichtbaar;
    const fallback = f.body.appendChild(new Element('section', { id: 'echte-inhoud' }, 900, 700));
    const r = rahul(metMain);
    if (!later) f.body.appendChild(r.paneel);
    f.start();
    if (later) f.voegLaterToe(r.paneel);
    nietGeannoteerd(r);
    assert.equal(main.getAttribute('data-rtg-screen-root'), 'content');
    assert.equal(main.getAttribute('data-rtg-component'), 'OperationalPanel', 'gewone inhoud blijft geannoteerd');
    assert.equal(fallback.getAttribute('data-rtg-screen-root'), zichtbaar ? null : 'content',
      'de echte fallback blijft bereikbaar wanneer de main verborgen is');
    r.paneel.hidden = true;
    f.annotate();
    nietGeannoteerd(r);
    assert.equal(r.paneel.hidden, true, 'sluiten blijft eigendom van Rahul');
    r.paneel.hidden = false;
    f.annotate();
    nietGeannoteerd(r);
  });
}

test('zonder main blijft de grootste echte body-inhoud de Heritage-fallback', () => {
  const f = omgeving();
  const klein = f.body.appendChild(new Element('section', {}, 400, 300));
  const groot = f.body.appendChild(new Element('article', {}, 1000, 800));
  f.start();
  assert.equal(klein.getAttribute('data-rtg-screen-root'), null);
  assert.equal(groot.getAttribute('data-rtg-screen-root'), 'content');
  assert.equal(f.body.getAttribute('data-rtg-grammar-ready'), 'true');
});
