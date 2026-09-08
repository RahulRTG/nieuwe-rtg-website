/* Closed route-context values and bounded per-tab storage. No source data. */
(function (g, factory) {
  'use strict'; var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (g) g.RTGRouteMemoryCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var KEY = 'rtg.route.context.v1', MAX = 24, BYTES = 65536, TTL = 86400000;
  var ID = /^[a-zA-Z][a-zA-Z0-9_.:-]{0,63}$/;
  var SECRET = /^(?:__proto__|prototype|constructor|token|accessToken|refreshToken|authorization|password|secret|wachtwoord|credentials|cookie|session|sessie)$/i;
  function routeKey(location) {
    try {
      var u = new URL(location.href), p = u.pathname;
      if (!p || p.length > 512) return null;
      var query = new URLSearchParams();
      ['id', 'tab', 'view'].forEach(function (name) {
        var value = u.searchParams.get(name);
        if (value && /^[a-zA-Z0-9_.:-]{1,80}$/.test(value)) query.set(name, value);
      });
      return p + (query.toString() ? '?' + query.toString() : '');
    } catch (e) { return null; }
  }
  function copy(value, depth) {
    depth = depth || 0;
    if (depth > 4) throw new Error('context depth');
    if (value == null || typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') return value.slice(0, 256);
    if (Array.isArray(value)) return value.slice(0, 24).map(function (x) { return copy(x, depth + 1); });
    if (typeof value !== 'object') throw new Error('context type');
    var out = {}, names = Object.keys(value);
    if (names.length > 24) throw new Error('context width');
    names.forEach(function (name) {
      if (SECRET.test(name) || !ID.test(name)) throw new Error('context field');
      out[name] = copy(value[name], depth + 1);
    });
    return out;
  }
  function closed(value) {
    try { var result = copy(value); return JSON.stringify(result).length <= 4096 ? result : null; }
    catch (e) { return null; }
  }
  function point(x, y) {
    function n(v) { v = Number(v); return Number.isFinite(v) ? Math.round(Math.max(0, Math.min(10000000, v))) : 0; }
    return { x: n(x), y: n(y) };
  }
  function normalizeState(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    var state = { window: point(value.window && value.window.x, value.window && value.window.y), scroll: {}, adapters: {} };
    Object.keys(value.scroll || {}).slice(0, 12).forEach(function (name) {
      if (!ID.test(name) || SECRET.test(name)) return;
      var v = value.scroll[name]; if (v && typeof v === 'object') state.scroll[name] = point(v.x, v.y);
    });
    Object.keys(value.adapters || {}).slice(0, 8).forEach(function (name) {
      if (!ID.test(name) || SECRET.test(name)) return;
      var v = closed(value.adapters[name]); if (v !== null) state.adapters[name] = v;
    });
    if (/^(compact|comfortable)$/.test(value.density || '')) state.density = value.density;
    if (ID.test(value.section || '')) state.section = value.section;
    if (/^(links|midden|rechts)$/.test(value.anchor || '')) state.anchor = value.anchor;
    return JSON.stringify(state).length <= 16384 ? state : null;
  }
  function readStorage(storage, now) {
    now = now == null ? Date.now() : now;
    try {
      var text = storage.getItem(KEY);
      if (!text || text.length > BYTES) return [];
      var rows = JSON.parse(text);
      if (!Array.isArray(rows)) return [];
      return rows.slice(-MAX).map(function (row) {
        if (!row || typeof row.key !== 'string' || row.key.length > 800 || row.key[0] !== '/' ||
            routeKey({href:'https://route.invalid' + row.key}) !== row.key ||
            row.at > now + 60000 || row.at <= now - TTL || !Number.isFinite(row.at)) return null;
        var state = normalizeState(row.state);
        return state ? { key: row.key, at: row.at, state: state } : null;
      }).filter(Boolean);
    } catch (e) { return []; }
  }
  function writeStorage(storage, path, state, now) {
    now = now == null ? Date.now() : now; state = normalizeState(state);
    if (!state || !path || path[0] !== '/' || routeKey({href:'https://route.invalid' + path}) !== path) return false;
    try {
      var rows = readStorage(storage, now).filter(function (row) { return row.key !== path; });
      rows.push({ key: path, at: now, state: state });
      while (rows.length > MAX || JSON.stringify(rows).length > BYTES) rows.shift();
      storage.setItem(KEY, JSON.stringify(rows)); return true;
    } catch (e) { return false; }
  }
  function elements(doc) {
    var out = Object.create(null);
    Array.prototype.slice.call(doc.querySelectorAll('[data-rtg-scroll]'), 0, 12).forEach(function (el) {
      var name = el.getAttribute('data-rtg-scroll');
      if (ID.test(name || '') && !SECRET.test(name) && !out[name]) out[name] = el;
    });
    return out;
  }
    function capture(win, doc, adapters) {
      var state = { window: point(win.scrollX, win.scrollY), scroll: {}, adapters: {} }, body = doc.body;
      var scroll = elements(doc);
      Object.keys(scroll).forEach(function (name) { state.scroll[name] = point(scroll[name].scrollLeft, scroll[name].scrollTop); });
      Object.keys(adapters).forEach(function (name) {
        var value = null; try { value = closed(adapters[name].capture()); } catch (e) {}
        if (value !== null) state.adapters[name] = value;
      });
      if (body) {
        var density = body.getAttribute('data-rtg-density'), section = body.getAttribute('data-rtg-section');
        if (/^(compact|comfortable)$/.test(density || '')) state.density = density;
        if (ID.test(section || '') && !SECRET.test(section)) state.section = section;
      }
      var key = doc.querySelector('[data-rtg-continue-key][data-rtg-key-anchor]');
      var anchor = key && key.getAttribute('data-rtg-key-anchor');
      if (/^(links|midden|rechts)$/.test(anchor || '')) state.anchor = anchor;
      return state;
    }
    function restorePoint(win, name, el, value, applied) {
      if (!value || typeof value !== 'object') return;
      var isWindow = name === '$window', current = isWindow ? point(win.scrollX, win.scrollY) : point(el.scrollLeft, el.scrollTop);
      var previous = applied[name];
      if (previous && (Math.abs(current.x - previous.x) > 2 || Math.abs(current.y - previous.y) > 2)) {
        previous.external = true; return;
      }
      if (previous && previous.external) return;
      var wanted = point(value.x, value.y), maxX = Math.max(0, el.scrollWidth - (isWindow ? win.innerWidth : el.clientWidth));
      var maxY = Math.max(0, el.scrollHeight - (isWindow ? win.innerHeight : el.clientHeight));
      var target = point(Math.min(wanted.x, maxX), Math.min(wanted.y, maxY));
      if (current.x !== target.x || current.y !== target.y) {
        if (isWindow) win.scrollTo({ left: target.x, top: target.y, behavior: 'instant' });
        else if (el.scrollTo) el.scrollTo({ left: target.x, top: target.y, behavior: 'instant' });
        else { el.scrollLeft = target.x; el.scrollTop = target.y; }
      }
      applied[name] = { x: target.x, y: target.y, reached: target.x === wanted.x && target.y === wanted.y };
    }
  return Object.freeze({ routeKey: routeKey, closed: closed, point: point,
    normalizeState: normalizeState, readStorage: readStorage, writeStorage: writeStorage,
    capture: capture, restorePoint: restorePoint, elements: elements, validName: function (x) { return ID.test(x || '') && !SECRET.test(x); },
    storageKey: KEY, maxRoutes: MAX, maxStorageLength: BYTES, maxAge: TTL });
}));
