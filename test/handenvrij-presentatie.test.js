/* Bouwcontrole, geen visuele kwalificatie. De bestaande geldpoort draait met
   een kleine DOM-stomp; CSS-cascade, spraakapparatuur en viewportgedrag vragen
   de afzonderlijke browserproef en menselijke beoordeling. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { bundel } = require('../scripts/bundel');
const ontwerp = require('../scripts/ontwerpsysteem');
const handenvrij = require('../public/shared/handenvrij');
const root = path.join(__dirname, '..');
const lees = p => fs.readFileSync(path.join(root, p), 'utf8');
const familie = ['balk', 'chat', 'geld', 'scherm', 'oog', 'bureau', 'mond'];

test('iedere handenvrijcontroller gebruikt uitsluitend de centrale presentatie', () => {
  for (const naam of familie) {
    const bron = lees('public/shared/handenvrij-' + naam + '.js');
    assert.equal(ontwerp.telInjectie(bron), 0, naam);
    assert.doesNotMatch(bron, /createElement\(['"]style|var css\s*=/, naam);
    assert.doesNotMatch(bron, /\.style\.(?:cssText|display)\s*=/, naam);
    new vm.Script(bron, { filename: 'handenvrij-' + naam + '.js' });
  }
});

test('iedere directe Metgezel-host declareert de centrale Samen- en Handenvrijbronnen', () => {
  const hosts=[];(function loop(map){for(const e of fs.readdirSync(map,{withFileTypes:true})){const p=path.join(map,e.name);if(e.isDirectory())loop(p);else if(e.name.endsWith('.html')){const s=fs.readFileSync(p,'utf8');if(s.includes('/shared/metgezel.js')||s.includes('../shared/metgezel.js'))hosts.push([p,s]);}}})(path.join(root,'public'));
  assert.equal(hosts.length,261);
  for(const [pad,s] of hosts){const volledig=s.includes('/ds/rtg-ds.css')||s.includes('/ds/bediening.css');const minimaal=s.includes('/ds/tokens.css')&&s.includes('/ds/componenten/samen.css')&&s.includes('/ds/componenten/handenvrij.css');assert.ok(volledig||minimaal,pad);}
});

test('de drie browserbundels zijn exact hun bestaande bronparts', () => {
  for (const naam of ['balk', 'scherm', 'bureau']) {
    const p = 'shared/handenvrij-' + naam + '.js';
    assert.equal(lees('public/' + p), bundel(p).toString(), p);
  }
});

test('de handenvrij-component voldoet aan de bestaande DS-regels en leest bestaande tokens', () => {
  const css = lees('public/ds/componenten/handenvrij.css');
  const fouten = ontwerp.contractFouten({ paginas: {} })
    .filter(fout => fout.includes('componenten/handenvrij.css'));
  assert.deepEqual(fouten, []);
  const tokens = lees('public/ds/tokens.css');
  for (const [, token] of css.matchAll(/var\((--ds-[a-z0-9-]+)/g)) {
    assert.ok(tokens.includes(token + ':'), token + ' heeft een centrale definitie');
  }
});

/* Alleen de DOM-handelingen van geld.js. Een style-element is hier een fout;
   deze stomp berekent geen stijl en pretendeert geen zichtbaarheid te meten. */
function geldKamer() {
  class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.attrs = {}; this.events = {}; this.className = ''; this.hidden = false; }
    appendChild(el) { this.children.push(el); el.parentNode = this; return el; }
    insertBefore(el, voor) { const i = this.children.indexOf(voor); if (i < 0) return this.appendChild(el); this.children.splice(i, 0, el); el.parentNode = this; return el; }
    get firstChild() { return this.children[0] || null; }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(el => el !== this); this.parentNode = null; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return this.attrs[k] ?? null; }
    addEventListener(k, f) { this.events[k] = f; }
    click() { this.events.click?.(); }
    focus() { document.activeElement = this; }
    querySelector(selector) {
      const past = el => selector.startsWith('.') ? el.className.split(' ').includes(selector.slice(1)) : el.tagName === selector;
      for (const el of this.children) { if (past(el)) return el; const kind = el.querySelector(selector); if (kind) return kind; }
      return null;
    }
  }
  const document = { documentElement: { hasAttribute: naam => naam === 'data-ds' },
    createElement(tag) { assert.notEqual(tag, 'style'); return new Element(tag); }, activeElement: null };
  const sessie = new Map();
  const doorgestuurd = [], klaargezet = [], standen = [];
  const kamer = { vak: new Element('div'), zetVeld: tekst => klaargezet.push(tekst), geldDoorgaan: tekst => doorgestuurd.push(tekst) };
  const self = { Handenvrij: handenvrij, __handenvrijKamer: kamer, RTGChatScherm: { zet: stand => { standen.push(stand); kamer.vak.hidden = false; } } };
  vm.runInNewContext(lees('public/shared/handenvrij-geld.js'), {
    self, document, Date,
    sessionStorage: { getItem: k => sessie.get(k) ?? null, setItem: (k, v) => sessie.set(k, v) }
  });
  return { kamer, document, doorgestuurd, klaargezet, standen };
}

test('de gepresenteerde geldschakelaar vereist nog steeds bewuste instemming', t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-30T12:00:00Z') });
  const { kamer, document, doorgestuurd, klaargezet, standen } = geldKamer();
  assert.equal(kamer.geldPoort('boek een taxi naar huis', true, tekst => doorgestuurd.push(tekst)), true);
  assert.deepEqual(doorgestuurd, []);
  assert.deepEqual(klaargezet, ['boek een taxi naar huis']);
  assert.equal(kamer.geldPoort('boek een taxi naar huis', false, () => assert.fail('de poort verstuurt nooit zelf')), false);
  kamer.vak.querySelector('.hv-regel').querySelector('button').click();
  const kaart = kamer.vak.querySelector('.hv-kaart');
  assert.equal(kaart.getAttribute('role'), 'alertdialog');
  assert.match(kaart.className, /ds-handenvrij__geldkaart/);
  assert.equal(kamer.geldAan(), false);
  assert.deepEqual(standen, ['half']);
  const ja = kaart.querySelector('.ja');
  assert.equal(document.activeElement, ja);
  ja.click();
  assert.equal(kamer.geldAan(), true);
  assert.deepEqual(doorgestuurd, []);
});

test('de bestaande bevestiging kan annuleren en verstuurt pas na de menselijke ja-knop', t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-30T12:00:00Z') });
  const { kamer, doorgestuurd, standen } = geldKamer();
  kamer.vak.querySelector('.hv-regel').querySelector('button').click();
  kamer.vak.querySelector('.ja').click();
  const vraag = () => kamer.geldPoort('betaal de rekening', true, tekst => doorgestuurd.push(tekst));
  vraag();
  assert.deepEqual(doorgestuurd, []);
  assert.equal(kamer.geldAntwoord('nee'), true);
  assert.equal(kamer.vak.querySelector('.hv-kaart'), null);
  assert.deepEqual(doorgestuurd, []);
  vraag();
  kamer.vak.querySelector('.ja').click();
  assert.deepEqual(doorgestuurd, ['betaal de rekening']);
  assert.equal(kamer.vak.querySelector('.hv-kaart'), null);
  assert.deepEqual(standen, ['half', 'half', 'half']);
});
