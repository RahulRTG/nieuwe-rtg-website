/* Actual-code DOM/GPS-model. Meet callbacks, toestemming en opslag;
   browsergeometrie, hit-testing en echte focusvolgorde vallen hierbuiten. */
'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const bron = fs.readFileSync(path.join(__dirname, '../../public/shared/plek.js'), 'utf8');
const loop = n => [n, ...n.children.flatMap(loop)];

function fixture({ ds = true, key = null, gps = true, source = bron } = {}) {
  const document = { activeElement: null }, opslag = new Map(), writes = [];
  if (key !== null) opslag.set('rtg_os_gps', String(key));
  class Node {
    constructor(tag) {
      this.tagName = tag.toUpperCase(); this.children = []; this.attrs = {}; this.events = {};
      this.className = ''; this.hidden = false; this.disabled = false; this._text = '';
      this.classList = {
        contains: name => this.className.split(/\s+/).includes(name),
        add: (...names) => { this.className = [...new Set(this.className.split(/\s+/).filter(Boolean).concat(names))].join(' '); }
      };
    }
    get isConnected() { return this === document.documentElement || !!this.parentNode?.isConnected; }
    appendChild(n) { n.remove(); this.children.push(n); n.parentNode = this; return n; }
    append(...nodes) { nodes.forEach(n => this.appendChild(n)); }
    remove() {
      if (!this.parentNode) return;
      if (this.contains(document.activeElement)) document.activeElement = document.body;
      this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null;
    }
    contains(n) { return loop(this).includes(n); }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return this.attrs[k] ?? null; }
    hasAttribute(k) { return k in this.attrs; }
    removeAttribute(k) { delete this.attrs[k]; }
    querySelectorAll(sel) {
      return loop(this).slice(1).filter(n => sel.split(',').some(s => {
        s = s.trim(); return s.startsWith('.') ? n.classList.contains(s.slice(1)) : n.tagName === s.toUpperCase();
      }));
    }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    addEventListener(k, fn) { (this.events[k] ||= []).push(fn); }
    removeEventListener(k, fn) { this.events[k] = (this.events[k] || []).filter(f => f !== fn); }
    fire(type, props = {}) {
      const e = { type, target: this, bubbles: true, defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() { this.stopped = true; }, ...props };
      for (let n = this; n; n = e.bubbles && !e.stopped ? n.parentNode : null) {
        e.currentTarget = n; (n.events[type] || []).slice().forEach(fn => fn(e));
      }
      return e;
    }
    click() { if (!this.disabled) this.fire('click'); }
    focus() { if (this.isConnected && !this.disabled) document.activeElement = this; }
    get textContent() { return this._text + this.children.map(n => n.textContent).join(''); }
    set textContent(v) { this.children.slice().forEach(n => n.remove()); this._text = String(v); }
  }
  document.createElement = tag => new Node(tag);
  document.documentElement = new Node('html');
  if (ds) document.documentElement.setAttribute('data-ds', '1');
  document.head = document.documentElement.appendChild(new Node('head'));
  document.body = document.documentElement.appendChild(new Node('body'));
  document.contains = n => document.documentElement.contains(n);
  document.getElementById = id => loop(document.documentElement).find(n => n.getAttribute('id') === id) || null;
  document.querySelector = sel => document.documentElement.querySelector(sel);
  document.querySelectorAll = sel => document.documentElement.querySelectorAll(sel);
  const trigger = document.body.appendChild(new Node('button')); trigger.focus();
  const gets = [], watches = [], clears = [];
  const navigator = gps ? { geolocation: {
    getCurrentPosition(ok, error, options) { gets.push({ ok, error, options }); },
    watchPosition(ok, error, options) { const id = watches.length; watches.push({ ok, error, options, id }); return id; },
    clearWatch(id) { clears.push(id); }
  } } : {};
  const localStorage = {
    getItem(k) { return opslag.get(k) ?? null; },
    setItem(k, v) { writes.push([k, String(v)]); opslag.set(k, String(v)); },
    removeItem(k) { writes.push([k, null]); opslag.delete(k); }
  };
  const events = {};
  const window = { addEventListener(type, fn) { (events[type] ||= []).push(fn); } };
  vm.runInNewContext(source, { window, document, navigator, localStorage, Promise });
  return { api: window.RTGPlek, document, trigger, gets, watches, clears, writes,
    key: () => localStorage.getItem('rtg_os_gps'),
    storage(value, key = 'rtg_os_gps') {
      const oldValue = opslag.get(key) ?? null;
      if (key === null) opslag.clear();
      else if (value === null) opslag.delete(key);
      else opslag.set(key, String(value));
      (events.storage || []).forEach(fn => fn({ key, oldValue, newValue: value, storageArea: localStorage }));
    },
    ds(value) { if (value) document.documentElement.setAttribute('data-ds', '1'); else document.documentElement.removeAttribute('data-ds'); },
    node: sel => document.body.querySelector(sel), nodes: sel => document.body.querySelectorAll(sel),
    styles: () => document.head.querySelectorAll('style'),
    links: () => document.head.querySelectorAll('link') };
}
function fix(request, lat = 52.37, lng = 4.9) {
  request.ok({ coords: { latitude: lat, longitude: lng, accuracy: 10 } });
}
function weiger(request) { request.error({ code: 1, message: 'Toestel weigert' }); }
async function tick() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
const gewoon = value => JSON.parse(JSON.stringify(value));
module.exports = { fixture, fix, weiger, tick, gewoon };
