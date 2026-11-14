/* Pure DOM/transport fixture for the actual canonical Foundation owners.
   No claim about browser layout, focus containment or live server admission. */
'use strict';
const vm = require('node:vm');
const { bundel } = require('../../scripts/bundel');
const all = n => [n, ...n.children.flatMap(all)];
function fixture({ ds = true, source, session = { code: 'GEZIN', token: 'TOKEN', profiel: { id: 'ouder', naam: 'Ouder', beheerder: true, groep: 'volwassen' } } } = {}) {
  const document = { readyState: 'loading', title: 'RTFoundation · Studie' }, storage = new Map(), requests = [], events = {};
  if (session) storage.set('rtf_sessie', JSON.stringify(session));
  const decode = s => s.replace(/&(amp|lt|gt|quot|#39);/g, (_, k) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[k]);
  class Element {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.attrs = {}; this.events = {}; this.className = ''; this._text = ''; this.hidden = false; this.disabled = false; this.value = ''; this.style = { setProperty() {} }; this.dataset = {}; }
    getBoundingClientRect() { return { height: 80 }; }
    get firstChild() { return this.children[0] || null; }
    get isConnected() { return this === document.documentElement || !!this.parentNode?.isConnected; }
    get classList() { const names = () => this.className.split(/\s+/).filter(Boolean); return { contains: n => names().includes(n), add: (...ns) => { this.className = [...new Set([...names(), ...ns])].join(' '); }, remove: (...ns) => { this.className = names().filter(n => !ns.includes(n)).join(' '); }, toggle: (n, force) => { const on = force === undefined ? !names().includes(n) : force; this.classList[on ? 'add' : 'remove'](n); return on; } }; }
    appendChild(n) { n.remove(); this.children.push(n); n.parentNode = this; return n; }
    insertBefore(n, before) { if (!before) return this.appendChild(n); n.remove(); this.children.splice(this.children.indexOf(before), 0, n); n.parentNode = this; return n; }
    remove() { if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; }
    setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'class') this.className = String(v); if (k === 'id') this.id = String(v); if (k === 'hidden') this.hidden = true; }
    getAttribute(k) { return this.attrs[k] ?? null; }
    hasAttribute(k) { return k in this.attrs; }
    removeAttribute(k) { delete this.attrs[k]; }
    matches(s) { if (s.includes(',')) return s.split(',').some(k => this.matches(k.trim())); if (s === '*') return true; if (s[0] === '.') return this.classList.contains(s.slice(1)); if (s[0] === '#') return this.id === s.slice(1); if (s[0] === '[') return this.hasAttribute(s.slice(1, -1)); return this.tagName === s.toUpperCase(); }
    querySelectorAll(sel) { return all(this).slice(1).filter(n => sel.split(',').some(s => { const parts = s.trim().split(/\s+/); if (!n.matches(parts.pop())) return false; let p = n.parentNode; while (parts.length) { const last = parts.pop(); while (p && !p.matches(last)) p = p.parentNode; if (!p) return false; p = p.parentNode; } return true; })); }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    addEventListener(k, f) { (this.events[k] ||= []).push(f); }
    fire(k, opts = {}) { const e = { target: this, preventDefault() {}, stopPropagation() { this.stopped = true; }, ...opts }; let n = this; while (n) { if (n['on' + k]) n['on' + k](e); for (const f of n.events[k] || []) f(e); if (e.stopped) break; n = n.parentNode; } return e; }
    click() { if (!this.disabled) this.fire('click'); }
    focus() { document.activeElement = this; }
    showModal() { this.open = true; }
    close() { this.open = false; }
    get textContent() { return this._text + this.children.map(n => n.textContent).join(''); }
    set textContent(s) { this._text = String(s); this.children.forEach(n => { n.parentNode = null; }); this.children = []; }
    set innerHTML(html) { this.textContent = ''; this.html = html; this.insertAdjacentHTML('beforeend', html); }
    insertAdjacentHTML(_, html) { const stack = [this]; let end = 0; for (const m of html.matchAll(/<\/?([a-z][\w-]*)\b([^>]*?)>/gi)) { stack.at(-1)._text += decode(html.slice(end, m.index)); end = m.index + m[0].length; if (m[0][1] === '/') { stack.pop(); continue; } const n = new Element(m[1]); for (const a of m[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) n.setAttribute(a[1], decode(a[2] || '')); stack.at(-1).appendChild(n); if (!['INPUT','BR','HR','LINK','META'].includes(n.tagName)) stack.push(n); } }
  }
  document.documentElement = new Element('html'); if (ds) document.documentElement.setAttribute('data-ds', '');
  document.head = document.documentElement.appendChild(new Element('head')); document.body = document.documentElement.appendChild(new Element('body'));
  document.createElement = tag => new Element(tag); document.querySelector = s => document.documentElement.querySelector(s); document.querySelectorAll = s => document.documentElement.querySelectorAll(s);
  document.getElementById = id => all(document.documentElement).find(n => n.id === id) || null;
  document.addEventListener = (k, f) => { (events[k] ||= []).push(f); };
  const context = { document, location: { pathname: '/apps/foundation/studie.html', protocol: 'https:', search: '' }, localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) },
    fetch: (url, opts = {}) => new Promise((resolve, reject) => requests.push({ url, opts, resolve, reject })), setInterval: () => 1, clearInterval() {}, setTimeout() {}, clearTimeout() {}, alert() {}, confirm: () => true, Event: class { constructor(type) { this.type = type; } }, CustomEvent: class { constructor(type, detail) { this.type = type; this.detail = detail; } }, addEventListener() {}, dispatchEvent() {} };
  context.window = context; context.self = context; context.top = context; vm.createContext(context);
  vm.runInContext(source || bundel('apps/foundation/sessie.js'), context);
  return { context, document, storage, requests, session: context.Sessie, node: sel => document.querySelector(sel),
    add(tag) { return document.body.appendChild(new Element(tag)); },
    samen(source) { vm.runInContext(source || bundel('apps/foundation/samen.js'), context); },
    reply(req, data, status = 200) { req.resolve({ ok: status < 400, status, json: async () => data }); } };
}
async function tick() { for (let i = 0; i < 15; i++) await Promise.resolve(); }
module.exports = { fixture, tick };
