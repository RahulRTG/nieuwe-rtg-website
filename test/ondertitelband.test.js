'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const bron = fs.readFileSync('public/shared/ondertitelband.js', 'utf8');

function opstelling() {
  class Node {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null; this.className = ''; this._text = ''; }
    appendChild(node) { if (node.parentNode) node.remove(); this.children.push(node); node.parentNode = this; return node; }
    insertBefore(node, voor) { if (node.parentNode) node.remove(); const i = voor ? this.children.indexOf(voor) : -1; this.children.splice(i < 0 ? this.children.length : i, 0, node); node.parentNode = this; return node; }
    remove() { if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; }
    querySelector(selector) { return this.children.find(node => selector.includes('.ondert') && node.className.split(/\s+/).includes('ondert')) || null; }
    setAttribute(naam, waarde) { this[naam] = String(waarde); }
    set textContent(waarde) { this._text = String(waarde); this.children.forEach(n => { n.parentNode = null; }); this.children = []; }
    get textContent() { return this._text + this.children.map(n => n.textContent).join(''); }
  }
  const html = new Node('html'), head = html.appendChild(new Node('head'));
  html.hasAttribute = () => false;
  head.appendChild(new Node('meta'));
  const document = {
    documentElement: html, head,
    createElement: tag => new Node(tag),
    getElementById: id => head.children.find(node => node.id === id) || null
  };
  const window = {};
  vm.runInNewContext(bron, { window, document });
  const vlak = new Node('div');
  const events = {};
  const video = { currentTime: 0, addEventListener(naam, fn) { (events[naam] ||= []).push(fn); }, fire(naam) { for (const fn of events[naam] || []) fn(); } };
  return { window, document, vlak, video };
}

test('alle mediaschermen gebruiken de centrale DS-ondertitelcomponent', () => {
  for (const app of ['clips', 'media', 'salon', 'theater', 'wereld']) {
    const html = fs.readFileSync('public/apps/' + app + '.html', 'utf8');
    assert.equal((html.match(/\/shared\/ondertitelband\.css/g) || []).length, 0, app);
    assert.equal((html.match(/\/shared\/ondertitelband\.js/g) || []).length, 1, app);
  }
  const css = fs.readFileSync('public/ds/componenten/ondertitelband.css', 'utf8');
  assert.match(css, /\.ds-ondertitelband/);
  assert.doesNotMatch(css, /!important|#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(bron, /createElement\(['"]style['"]\)|ondertitelband\.css/);
  assert.match(bron, /ondertitelStijlLink\.href = '\/ds\/rtg-ds\.css'/);
});

test('cues volgen tijd en sprongen, tekst blijft tekst en einde ruimt de band', () => {
  const f = opstelling();
  f.window.RTGOndertitelband.zet(f.vlak, f.video, [
    { van: 5, tot: 8, tekst: 'Tweede' },
    { van: 1, tot: 3, tekst: '<img src=x onerror=alert(1)>' }
  ]);
  const band = f.vlak.querySelector('.ondert');
  assert.match(band.className, /ds-ondertitelband/);
  assert.equal(f.document.getElementById('rtgDsRuntimeCss').href, '/ds/rtg-ds.css');
  assert.equal(band.getAttribute ? band.getAttribute('aria-live') : band['aria-live'], 'off');
  f.video.currentTime = 2; f.video.fire('timeupdate');
  assert.equal(band.textContent, '<img src=x onerror=alert(1)>');
  assert.equal(band.children.length, 1); assert.equal(band.children[0].tagName, 'SPAN');
  f.video.currentTime = 6; f.video.fire('seeked'); assert.equal(band.textContent, 'Tweede');
  f.video.fire('ended'); assert.equal(band.textContent, '');
  f.window.RTGOndertitelband.weg(f.vlak); assert.equal(f.vlak.querySelector('.ondert'), null);
});

test('lege of onbruikbare invoer laat geen oude ondertitel achter', () => {
  const f = opstelling();
  f.window.RTGOndertitelband.zet(f.vlak, f.video, [{ van: 0, tot: 2, tekst: 'Actief' }]);
  assert.ok(f.vlak.querySelector('.ondert'));
  f.window.RTGOndertitelband.zet(f.vlak, f.video, []);
  assert.equal(f.vlak.querySelector('.ondert'), null);
  assert.doesNotThrow(() => f.window.RTGOndertitelband.zet(null, f.video, []));
});
