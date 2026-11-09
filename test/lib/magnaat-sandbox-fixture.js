'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const bron = fs.readFileSync(path.join(__dirname, '../../public/apps/magnaat-sandbox.js'), 'utf8');

// Werkelijke sandbox in een kleine DOM/netwerkfixture. Geen browsergeometriebewijs.
function fixture({ ds = false, ready = 'loading', search = '?magnaat=1' } = {}) {
  const events = {}, calls = [], document = { readyState: ready };
  class Node {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.attrs = {}; this.className = ''; this.hidden = false; }
    appendChild(n) { this.children.push(n); n.parentNode = this; return n; }
    get isConnected() { return this === document.documentElement || !!this.parentNode?.isConnected; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    hasAttribute(k) { return k in this.attrs; }
    getAttribute(k) { return this.attrs[k] ?? null; }
  }
  const walk = n => [n, ...n.children.flatMap(walk)];
  document.documentElement = new Node('html');
  if (ds) document.documentElement.setAttribute('data-ds', '');
  document.head = document.documentElement.appendChild(new Node('head'));
  document.body = document.documentElement.appendChild(new Node('body'));
  document.createElement = tag => new Node(tag);
  document.getElementById = id => walk(document.documentElement).find(n => n.id === id) || null;
  document.addEventListener = (type, fn, options) => (events[type] ||= []).push({ fn, options });
  function fire(type, extra = {}) {
    const e = { defaultPrevented: false, stopped: false, preventDefault() { this.defaultPrevented = true; },
      stopImmediatePropagation() { this.stopped = true; }, ...extra };
    for (const h of (events[type] || []).slice()) {
      h.fn(e);
      if (h.options?.once) events[type] = events[type].filter(x => x !== h);
      if (e.stopped) break;
    }
    return e;
  }
  const originalLocal = new Map([['token', 'echte-sessie']]), originalSession = new Map([['concept', 'echt-concept']]);
  const record = name => function (...args) { calls.push({ name, args, receiver: this }); return name; };
  function XHR() {}
  XHR.prototype.open = record('xhr-open'); XHR.prototype.send = record('xhr-send');
  const window = { localStorage: originalLocal, sessionStorage: originalSession, fetch: record('fetch'),
    XMLHttpRequest: XHR, EventSource: record('eventsource'), WebSocket: record('websocket'),
    RTCPeerConnection: record('peer'), open: record('open') };
  const navigator = { sendBeacon: record('beacon'), mediaDevices: { getUserMedia: record('media') },
    geolocation: { getCurrentPosition: record('gps-get'), watchPosition: record('gps-watch'), clearWatch: record('gps-clear') },
    serviceWorker: { register: record('serviceworker') } };
  const originalFetch = window.fetch;
  const context = { window, document, navigator, location: new URL('https://rtg.test/apps/chauffeur.html' + search),
    URL, URLSearchParams, Response, DOMException };
  vm.runInNewContext(bron, context);
  return { window, navigator, document, events, calls, originalLocal, originalSession, originalFetch, fire,
    styles: () => walk(document.documentElement).filter(n => n.tagName === 'STYLE'),
    marker: () => document.getElementById('rtgMagnaatTestMark'),
    ready() { document.readyState = 'interactive'; fire('DOMContentLoaded'); } };
}

module.exports = { fixture, bron };
