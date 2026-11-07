/* Actual-code proef met bestuurbare DOM/events en uitgestelde transportantwoorden.
   Dit model meet geen browsergeometrie, top layer of native focuscontainment. */
'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.join(__dirname, '../..');
const bron = fs.readFileSync(path.join(root, 'public/shared/poortgesprek.js'), 'utf8');
const adres = fs.readFileSync(path.join(root, 'public/shared/adresvoorstel.js'), 'utf8');
const decode = s => s.replace(/&(?:amp|lt|gt|quot|#39);/g, x => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" })[x]);
const loop = n => [n, ...n.children.flatMap(loop)];
function fixture({ ds = true, source = bron } = {}) {
  const document = { activeElement: null }, events = {};
  class Node {
    constructor(tag) {
      this.tagName = tag.toUpperCase(); this.children = []; this.attrs = {}; this.events = {};
      this.className = ''; this.hidden = false; this.open = false; this.disabled = false; this.value = ''; this._text = '';
      this.classList = { contains: n => this.className.split(/\s+/).includes(n),
        add: (...names) => { this.className = [...new Set(this.className.split(/\s+/).filter(Boolean).concat(names))].join(' '); } };
    }
    appendChild(n) { if (n.parentNode) n.remove(); this.children.push(n); n.parentNode = this; return n; }
    remove() { if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; }
    contains(n) { return loop(this).includes(n); }
    get isConnected() { return this === document.documentElement || !!this.parentNode?.isConnected; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return this.attrs[k] ?? null; }
    removeAttribute(k) { delete this.attrs[k]; }
    hasAttribute(k) { return k in this.attrs; }
    querySelectorAll(sel) { return loop(this).slice(1).filter(n => sel.split(',').some(s => {
      s = s.trim(); return s.startsWith('.') ? n.classList.contains(s.slice(1)) : n.tagName === s.toUpperCase();
    })); }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    addEventListener(k, f) { (this.events[k] ||= []).push(f); }
    fire(k, props = {}) { const e = { target: this, preventDefault() { this.defaultPrevented = true; }, ...props }; (this.events[k] || []).forEach(f => f(e)); return e; }
    click() { if (!this.disabled) this.fire('click'); }
    focus() { if (this.isConnected && !this.disabled) document.activeElement = this; }
    showModal() { this.open = true; this.modalCalls = (this.modalCalls || 0) + 1; }
    close() { this.open = false; queueMicrotask(() => this.fire('close')); }
    getBoundingClientRect() { return { left: 100, right: 500, top: 100, bottom: 500 }; }
    get textContent() { return this._text + this.children.map(n => n.textContent).join(''); }
    set textContent(v) { this._text = String(v); this.children.forEach(n => { n.parentNode = null; }); this.children = []; }
    set innerHTML(v) {
      this.textContent = ''; this.html = v;
      const stack = [this]; let end = 0;
      for (const m of v.matchAll(/<\/?([a-z][\w-]*)\b([^>]*?)>/gi)) {
        stack.at(-1)._text += decode(v.slice(end, m.index)); end = m.index + m[0].length;
        if (m[0][1] === '/') { stack.pop(); continue; }
        const n = new Node(m[1]);
        for (const a of m[2].matchAll(/([\w-]+)="([^"]*)"/g)) {
          const val = decode(a[2]); n.setAttribute(a[1], val);
          if (a[1] === 'class') n.className = val; else if (a[1] === 'id') n.id = val;
        }
        stack.at(-1).appendChild(n); if (!['INPUT', 'BR'].includes(n.tagName)) stack.push(n);
      }
    }
  }
  document.createElement = tag => new Node(tag);
  document.documentElement = new Node('html'); if (ds) document.documentElement.setAttribute('data-ds', '1');
  document.head = document.documentElement.appendChild(new Node('head'));
  document.body = document.documentElement.appendChild(new Node('body'));
  document.getElementById = id => loop(document.documentElement).find(n => n.getAttribute('id') === id) || null;
  document.addEventListener = (k, f) => { (events[k] ||= []).push(f); };
  const trigger = document.body.appendChild(new Node('button')); trigger.focus();
  const window = {}, context = { window, document, Promise };
  vm.runInNewContext(adres, context); vm.runInNewContext(source, context);
  const requests = [], call = (url, body) => new Promise((resolve, reject) => { requests.push({ url, body: JSON.parse(JSON.stringify(body)), resolve, reject }); });
  return { document, window, requests, call, trigger, api: window.RTGGegevensPoort,
    ds(value) { if (value) document.documentElement.setAttribute('data-ds', '1'); else document.documentElement.removeAttribute('data-ds'); },
    node: sel => document.body.querySelector(sel), styles: () => document.head.querySelectorAll('style'),
    links: () => document.head.querySelectorAll('link'),
    key(key) { (events.keydown || []).forEach(f => f({ key })); } };
}
async function tick() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
async function start(f, veld = 'telefoon', id = 'A') {
  const result = f.api.los({ soort: 'reservering' }, f.call); await tick();
  f.requests.at(-1).resolve({ id, tekst: 'Vraag ' + id, veld }); await tick(); return { result };
}
module.exports = { fixture, tick, start, bron };
