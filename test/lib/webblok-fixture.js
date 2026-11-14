/* Bronfixture: echte renderer en schoonmaak, bestuurbare DOM en transport. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const crypto = require('node:crypto'), { schoon: scho } = require('../../server/kern/util');
const schoon = require('../../server/kern/webmaker-schoon')({ scho, crypto });
const ontwerp = require('../../server/kern/webmaker-ontwerp')({ scho, crypto,
  schoonBlok: schoon.schoonBlok, schoonKleuren: schoon.schoonKleuren });
const html = fs.readFileSync(path.join(__dirname, '../../public/apps/browser.html'), 'utf8');
const begin = html.indexOf('let HUIDIGE=null;'), eind = html.indexOf('\nif(!TOKEN)', begin);
assert.ok(begin >= 0 && eind > begin, 'de volledige bestaande renderer is gevonden');
const bron = html.slice(begin, eind);
const startBegin = html.indexOf('async function toonStart(){');
const startEind = html.indexOf('\n// ---- een site tonen', startBegin);
const tabBegin = html.indexOf('let HIST=[]'), tabEind = html.indexOf("\n$('#terugKnop').addEventListener", tabBegin);
assert.ok(startBegin >= 0 && startEind > startBegin && tabBegin >= 0 && tabEind > tabBegin);
const navigatie = html.slice(tabBegin, tabEind) + '\n' + html.slice(startBegin, startEind);

class Stijl { setProperty(naam, waarde) { this[naam] = String(waarde); } }
class Element {
  constructor(tag) {
    this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {};
    this.style = new Stijl(); this.className = ''; this.listeners = {}; this.attrs = {};
    this.value = ''; this._tekst = ''; this.parentNode = null; this.hidden = false;
    this.selectionStart = 0; this.selectionEnd = 0; this.selectionDirection = 'none';
    this.classList = { add: (...namen) => {
      this.className = [...new Set(this.className.split(/\s+/).filter(Boolean).concat(namen))].join(' ');
    }, contains: naam => this.className.split(/\s+/).includes(naam) };
  }
  appendChild(el) { return this.insertBefore(el, null); }
  insertBefore(el, voor) {
    if (el.parentNode) el.remove();
    const i = voor ? this.children.indexOf(voor) : this.children.length;
    assert.ok(i >= 0); this.children.splice(i, 0, el); el.parentNode = this; return el;
  }
  moveBefore(el, voor) {
    if (el.parentNode) el.parentNode.children.splice(el.parentNode.children.indexOf(el), 1);
    const i = voor ? this.children.indexOf(voor) : this.children.length;
    assert.ok(i >= 0); this.children.splice(i, 0, el); el.parentNode = this;
  }
  remove() {
    if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1);
    this.parentNode = null;
    if (this.contains(this.ownerDocument?.activeElement)) this.ownerDocument.activeElement = null;
  }
  get firstChild() { return this.children[0] || null; }
  get nextSibling() { return this.parentNode?.children[this.parentNode.children.indexOf(this) + 1] || null; }
  get isConnected() { return this._root || !!this.parentNode?.isConnected; }
  contains(el) { return !!el && (el === this || this.children.some(n => n.contains(el))); }
  querySelector(sel) { return alle(this).slice(1).find(el => sel.split(',').some(s =>
    s.startsWith('.') ? el.classList.contains(s.slice(1)) : el.tagName === s.toUpperCase())) || null; }
  closest(sel) {
    assert.equal(sel, '[hidden]');
    for (let el = this; el; el = el.parentNode) if (el.hidden) return el;
    return null;
  }
  focus() { if (this.isConnected && !this.closest('[hidden]')) this.ownerDocument.activeElement = this; }
  setSelectionRange(start, end, direction) {
    this.selectionStart = start; this.selectionEnd = end; this.selectionDirection = direction;
  }
  set textContent(tekst) { this._tekst = String(tekst); [...this.children].forEach(el => el.remove()); }
  get textContent() { return this._tekst + this.children.map(el => el.textContent).join(''); }
  set innerHTML(tekst) {
    assert.ok(['hoofd', 'rooster'].includes(this.id), 'auteursinhoud mag niet via innerHTML worden gerenderd');
    this.textContent = tekst;
    // Alleen de vaste start-/foutpagina maakt id-haken voor de echte eigenaar.
    for (const match of tekst.matchAll(/<([a-z]+)\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
      const el = this.ownerDocument.createElement(match[1]); el.id = match[2]; this.appendChild(el);
    }
  }
  setAttribute(naam, waarde) { this.attrs[naam] = String(waarde); }
  addEventListener(naam, doe) { this.listeners[naam] = doe; }
}
const alle = el => [el, ...el.children.flatMap(alle)];
const vind = (el, tag) => alle(el).find(n => n.tagName === tag.toUpperCase());
function site(invoer = {}) {
  const d = ontwerp({ d: invoer, key: 'test-lid', opts: null, bestaand: null });
  return { ...d, adres: 'proefsite', volgorde: schoon.schoonVolgorde(invoer, d.blokken) };
}
function fixture() {
  const hoofd = new Element('main'); hoofd.id = 'hoofd'; hoofd._root = true;
  const meldingen = [], verzoeken = [], window = { innerWidth: 1080, addEventListener() {}, scrollTo() {} };
  const knoppen = Object.fromEntries(['terugKnop', 'vooruitKnop', 'adres', 'tabstrip'].map(id => [id, new Element('div')]));
  const document = { activeElement: null, createElement: tag => Object.assign(new Element(tag), { ownerDocument: document }), querySelector: sel => {
    if (sel === '#hoofd') return hoofd;
    if (sel === '#hoofd .doek') return alle(hoofd).find(el => el.classList.contains('doek')) || null;
    if (sel.startsWith('#')) return knoppen[sel.slice(1)] || alle(hoofd).find(el => el.id === sel.slice(1)) || null;
    return null;
  } };
  hoofd.ownerDocument = document;
  Object.values(knoppen).forEach(el => { el.ownerDocument = document; el._root = true; });
  let id = 0, antwoord = () => Promise.resolve({ ok: true, via: 'werklijst' });
  const ctx = { window, document, $: document.querySelector,
    api: (url, body) => { verzoeken.push({ url, body }); return antwoord(url, body); },
    RTGId: voor => voor + '-' + (++id), meld: tekst => meldingen.push(tekst),
    clearTimeout() {}, setTimeout() {}, esc: tekst => String(tekst),
    GIDS: [], bwLees: () => [], bwStand() {} };
  vm.runInNewContext(navigatie + '\n' + bron +
    '\nresultaat={tekenBlok,schilder,versieNu,toonSite,toonStart,ga,nieuwTab,zet(v){HUIDIGE=v}};', ctx);
  return { ...ctx.resultaat, hoofd, window, document, meldingen, verzoeken,
    antwoord: doe => { antwoord = doe; }, doek: () => document.querySelector('#hoofd .doek') };
}

function blokVoorbeelden() {
  return [
    { type: 'hero', kop: 'Welkom', sub: 'Onze zaak', knop: 'Lees meer' },
    { type: 'kop', tekst: 'Kop' }, { type: 'tekst', tekst: 'Tekst & regels\nblijven tekst' },
    { type: 'knop', tekst: 'Open', href: 'javascript:alert(1)' },
    { type: 'beeld', src: '/foto.jpg?x=" onerror="alert(1)', bijschrift: 'Basis',
      varianten: { telefoon: { src: '/ander.jpg', bijschrift: 'Mobiel' } } },
    { type: 'kolommen', lk: 'Links', lt: 'Een', rk: 'Rechts', rt: 'Twee' },
    { type: 'galerij', beelden: ['/een.jpg', '/twee.jpg'] },
    { type: 'citaat', tekst: 'Een citaat', bron: 'De auteur' },
    { type: 'formulier', soort: 'vraag', kop: 'Schrijf ons', knop: 'Verstuur' },
    { type: 'faq', kop: 'Vragen', vragen: [{ v: 'Wanneer?', a: 'Morgen.' }] },
    { type: 'prijzen', kop: 'Prijzen', regels: [{ naam: 'Dienst', prijs: '€ 12', wat: 'Per uur' }] },
    { type: 'ruimte', hoogte: 40 }, { type: 'voettekst', tekst: 'Tot ziens' }
  ];
}
function auteursOntwerp() {
  return { titel: 'Webblokproef', thema: 'licht', accent: '#1a6b4e',
      kleuren: { bg: '#f5efe2', txt: '#253044', card: '#dfe5d1' }, blokken: [
        { id: 'hero', type: 'hero', kop: 'Welkom bij de proef', sub: 'Inhoud van de maker', knop: 'Hero CTA' },
        { id: 'kop', type: 'kop', tekst: 'Kop desktop', varianten: {
          telefoon: { tekst: 'Kop telefoon' }, tablet: { tekst: 'Kop tablet' } } },
        { id: 'tekst', type: 'tekst', tekst: 'Tekst & "citaat" <img src=x onerror="window.__webblokXss=1">' },
        { id: 'knop', type: 'knop', tekst: 'Losse CTA', href: 'javascript:window.__webblokXss=1' },
        { id: 'beeld', type: 'beeld', src: '/images/daily/notities.webp', bijschrift: 'Eigen beeld',
          varianten: { telefoon: { bijschrift: 'Eigen mobiel beeld' } } },
        { id: 'kolommen', type: 'kolommen', lk: 'Linker kolom', lt: 'Links inhoud', rk: 'Rechter kolom', rt: 'Rechts inhoud' },
        { id: 'galerij', type: 'galerij', beelden: ['/images/daily/agenda.webp', '/images/daily/notities.webp'] },
        { id: 'citaat', type: 'citaat', tekst: 'Citaat van de maker', bron: 'De auteur', verberg: ['telefoon'] },
        { id: 'ruimte', type: 'ruimte', hoogte: 73 },
        { id: 'voet', type: 'voettekst', tekst: 'Voettekst van de maker', verberg: ['tablet'] },
        { id: 'form', type: 'formulier', soort: 'offerte', kop: 'Schrijf ons', knop: 'Verstuur webproef' },
        { id: 'faq', type: 'faq', kop: 'Veelgestelde proefvraag', vragen: [{ v: 'Wanneer open?', a: 'Morgen om tien uur.' }] },
        { id: 'prijzen', type: 'prijzen', kop: 'Onze proefprijzen', regels: [{ naam: 'Proefdienst', prijs: '€ 12', wat: 'Per uur' }] }
      ], volgorde: { telefoon: ['form', 'kop', 'hero'], tablet: ['kop', 'form', 'hero'] } };
}
module.exports = { schoon, site, fixture, alle, vind, blokVoorbeelden, auteursOntwerp };
