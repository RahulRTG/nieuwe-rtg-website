/* Echte voorkeurcontroller. Geometrie blijft een afzonderlijke browserproef. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const bron = fs.readFileSync(path.join(__dirname, '../public/shared/volscherm.js'), 'utf8');

function fixture({ ds = true, werkruimte = false, shell = false, main = true, breedte = 1440,
  voorkeur = '0', ingebed = false, storageFout = false, loading = false } = {}) {
  const alle = el => [el, ...el.children.flatMap(alle)], events = {}, opslag = new Map([['rtg_volscherm', voorkeur]]);
  const past = (el, sel) => sel.split(',').some(s => {
    s = s.trim();
    if (s.includes(' > ')) { const [ouder, kind] = s.split(' > '); return past(el, kind) && !!el.parentNode && past(el.parentNode, ouder); }
    if (s.includes(' ')) { const i = s.lastIndexOf(' '); if (!past(el, s.slice(i + 1))) return false;
      for (let p = el.parentNode; p; p = p.parentNode) if (past(p, s.slice(0, i))) return true; return false; }
    const tag = s.match(/^[a-z]+/); if (tag && el.tagName !== tag[0].toUpperCase()) return false;
    return [...s.matchAll(/([.#])([\w-]+)/g)].every(m => m[1] === '#' ? el.id === m[2] : el.classList.contains(m[2]));
  });
  function node(tag) {
    const n = { tagName: tag.toUpperCase(), children: [], className: '', attrs: {}, dataset: {},
      setAttribute(k, v) { this.attrs[k] = String(v); }, hasAttribute(k) { return k in this.attrs; },
      getAttribute(k) { return this.attrs[k] ?? null; },
      appendChild(c) { c.remove(); this.children.push(c); c.parentNode = this; return c; },
      remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(c => c !== this); this.parentNode = null; },
      querySelector(s) { return alle(this).slice(1).find(c => past(c, s)) || null; },
      querySelectorAll(s) { return alle(this).slice(1).filter(c => past(c, s)); }
    };
    n.classList = { contains: c => n.className.split(/\s+/).includes(c),
      add(c) { if (!this.contains(c)) n.className = [n.className, c].filter(Boolean).join(' '); },
      remove(c) { n.className = n.className.split(/\s+/).filter(x => x !== c).join(' '); },
      toggle(c, aan) { if (aan === undefined) aan = !this.contains(c); if (aan) this.add(c); else this.remove(c); return aan; } };
    return n;
  }
  const html = node('html'), head = html.appendChild(node('head')), body = html.appendChild(node('body'));
  if (ds) html.setAttribute('data-ds', '1'); if (ingebed) html.classList.add('ds-ingebed');
  const inhoud = main ? body.appendChild(node('main')) : null;
  if (shell) { const os = body.appendChild(node('div')); os.id = 'shell'; }
  function verhuis() {
    body.classList.add('ds-wereldwerkruimte');
    const root = body.appendChild(node('div')); root.classList.add('wd-shell');
    const home = root.appendChild(node('div')); home.classList.add('wd-home'); home.classList.add('wd-page');
    if (inhoud) home.appendChild(inhoud);
    return root;
  }
  if (werkruimte) verhuis();
  const document = { documentElement: html, body, head, readyState: loading ? 'loading' : 'complete',
    createElement: node, getElementById: id => alle(html).find(n => n.id === id) || null,
    querySelector: sel => html.querySelector(sel), addEventListener: (naam, fn) => { events[naam] = fn; } };
  const window = { innerWidth: breedte, location: { search: ingebed ? '?embed=1' : '' },
    matchMedia: q => ({ matches: window.innerWidth >= Number(q.match(/min-width:\s*(\d+)/)?.[1] || 0) }) };
  window.self = window; window.top = ingebed ? {} : window;
  const localStorage = { getItem: k => { if (storageFout) throw Error('Opslag geblokkeerd'); return opslag.get(k) ?? null; },
    setItem: (k, v) => { if (storageFout) throw Error('Opslag geblokkeerd'); opslag.set(k, String(v)); } };
  const ctx = { window, document, localStorage };
  vm.runInNewContext(bron, ctx);
  return { api: window.RTGVol, window, document, html, body, inhoud, head, opslag, verhuis,
    klaar: () => events.DOMContentLoaded?.(), opnieuw: () => vm.runInNewContext(bron, ctx) };
}

for (const werkruimte of [false, true]) test('DS ' + (werkruimte ? 'werkruimte' : 'main') + ': echte API en toestelvoorkeur zonder legacy-injectie', () => {
  const f = fixture({ werkruimte, voorkeur: '1' });
  assert.deepEqual(Object.keys(f.api).sort(), ['aan', 'mogelijk', 'wissel', 'zet']);
  assert.equal(f.api.aan(), true); assert.equal(f.api.mogelijk(), true);
  assert.equal(f.html.classList.contains('ds-volscherm'), true);
  f.api.wissel(); assert.equal(f.api.aan(), false); assert.equal(f.opslag.get('rtg_volscherm'), '0');
  assert.equal(f.html.classList.contains('ds-volscherm'), false);
  f.api.zet(true); const api = f.api; f.opnieuw();
  assert.equal(f.window.RTGVol, api); assert.equal(f.opslag.get('rtg_volscherm'), '1');
  assert.equal(f.document.getElementById('volCss'), null);
  assert.equal(f.html.classList.contains('rtg-vol') || f.body.classList.contains('rtg-vol'), false);
});

test('DS voorkeur volgt dezelfde main door de werkruimteverhuizing, ook voor DOMContentLoaded', () => {
  const f = fixture({ voorkeur: '1', loading: true }), origineel = f.inhoud;
  const root = f.verhuis(); f.klaar();
  assert.equal(f.inhoud, origineel); assert.equal(root.querySelector('main'), origineel);
  assert.equal(f.api.mogelijk(), true); assert.equal(f.html.classList.contains('ds-volscherm'), true);
  f.api.zet(false); assert.equal(f.html.classList.contains('ds-volscherm'), false);
  f.api.zet(true); assert.equal(f.document.getElementById('volCss'), null);
});

test('DS beschikbaarheid gebruikt de echte werkruimtegrens en behoudt de voorkeur op mobiel', () => {
  for (const werkruimte of [false, true]) {
    const f = fixture({ werkruimte, voorkeur: '1' });
    for (const breedte of [390, 519, 520, 820, 999, 1000, 1440, 390]) {
      f.window.innerWidth = breedte;
      assert.equal(f.api.mogelijk(), breedte >= (werkruimte ? 1000 : 520), JSON.stringify({ werkruimte, breedte }));
      assert.equal(f.api.aan(), true); assert.equal(f.opslag.get('rtg_volscherm'), '1');
    }
  }
});

test('ingesloten DS en ontbrekend doel bieden geen werking aan', () => {
  for (const opts of [{ ingebed: true }, { main: false }]) {
    const f = fixture({ ...opts, voorkeur: '1' });
    assert.equal(f.api.mogelijk(), false); assert.equal(f.document.getElementById('volCss'), null);
    if (opts.ingebed) assert.equal(f.html.classList.contains('ds-volscherm'), false);
  }
});

test('geblokkeerde toestelopslag laat de bediening bruikbaar', () => {
  const f = fixture({ storageFout: true });
  assert.equal(f.api.aan(), false); f.api.zet(true);
  assert.equal(f.api.aan(), true); assert.equal(f.html.classList.contains('ds-volscherm'), true);
});

for (const shell of [false, true]) test('legacy ' + (shell ? '#shell' : 'main') + ': oorspronkelijke vlag en compatibiliteitsgeometrie blijven intact', () => {
  const f = fixture({ ds: false, shell, voorkeur: '1' });
  assert.equal((shell ? f.body : f.html).classList.contains('rtg-vol'), true);
  assert.equal(f.html.classList.contains('ds-volscherm'), false);
  const stijl = f.document.getElementById('volCss');
  assert.equal(stijl.tagName, 'STYLE');
  assert.match(stijl.textContent, /body\.rtg-vol #shell\{max-width:none !important/);
  assert.match(stijl.textContent, /prefers-reduced-motion: no-preference/);
  f.api.wissel(); assert.equal((shell ? f.body : f.html).classList.contains('rtg-vol'), false);
  assert.equal(f.head.children.length, 1);
});
