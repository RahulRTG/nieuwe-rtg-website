/* UI context only. Register before boot; restore is synchronous, false means
   not ready and must not mutate. Signal ready(name) after rendering. */
(function (g, factory) {
  'use strict';
  var core = typeof module === 'object' && module.exports ? require('./rtg-route-memory-core.js') : g && g.RTGRouteMemoryCore;
  if (!core) return;
  var library = factory(core);
  if (typeof module === 'object' && module.exports) module.exports = library;
  if (g && g.document && !g.RTGRouteMemory) {
    g.RTGRouteMemory = library.create(g, g.document); g.RTGRouteMemory.boot();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (C) {
  'use strict';
  var routeKey = C.routeKey, closed = C.closed, point = C.point;
  function create(win, doc) {
    var path = routeKey(win.location), adapters = Object.create(null), events = [];
    var started = false, interrupted = false, destroyed = false, saved = null;
    var pageVisible = false, timer = 0, saveTimer = 0, deadline = 0, retries = [];
    var bodyObserver, keyObserver, sizeObserver, observedAction, geometry = Object.create(null);
    var applied = Object.create(null), densityDone = false, sectionDone = false, anchorDone = false;
    var nativeWindow = !!(win.location && win.location.hash), nativePending = false, visibleAt = Date.now();
    try {
      var nav = win.performance.getEntriesByType('navigation')[0];
      nativePending = !!(nav && /^(back_forward|reload)$/.test(nav.type));
    } catch (e) {}
    function listen(target, name, fn, options) {
      target.addEventListener(name, fn, options); events.push([target, name, fn, options]);
    }
    function emit(name, detail) {
      try { doc.dispatchEvent(new win.CustomEvent(name, { detail: detail })); } catch (e) {}
    }
    function read() { try { return C.readStorage(win.sessionStorage); } catch (e) { return []; } }
    function elements() { return C.elements(doc); }
    function safeCapture(adapter) {
      try { return closed(adapter.capture()); } catch (e) { return null; }
    }
    function capture() { return C.capture(win, doc, adapters); }
    function save() {
      win.clearTimeout(saveTimer); saveTimer = 0;
      if (!started || destroyed || !path || !doc.body) return false;
      try {
        var state = capture();
        /* Loading a page must not erase the previous context before restoring it. */
        if (saved && !interrupted) {
          Object.keys(saved.adapters || {}).forEach(function (name) {
            if (!adapters[name] || !adapters[name].done) state.adapters[name] = saved.adapters[name];
          });
          if (!anchorDone && saved.anchor) state.anchor = saved.anchor;
          if (Date.now() < deadline) {
            if (!nativeWindow && (!applied.$window || !applied.$window.reached)) state.window = saved.window || state.window;
            state.scroll = Object.assign({}, saved.scroll || {}, state.scroll);
            Object.keys(saved.scroll || {}).forEach(function (name) {
              if (!applied[name] || !applied[name].reached) state.scroll[name] = saved.scroll[name];
            });
          }
        }
        return C.writeStorage(win.sessionStorage, path, state);
      } catch (e) { return false; }
    }
    function queueSave() {
      if (!saveTimer) saveTimer = win.setTimeout(save, 180);
    }
    function stopRestore() {
      win.clearTimeout(timer); timer = 0;
      retries.splice(0).forEach(function (id) { win.clearTimeout(id); });
      [bodyObserver, keyObserver, sizeObserver].forEach(function (observer) { if (observer) observer.disconnect(); });
    }
    function cancel() {
      if (interrupted) return;
      interrupted = true; stopRestore(); queueSave();
    }
    function restoreAdapter(name) {
      var adapter = adapters[name], value = saved && saved.adapters && saved.adapters[name];
      if (!adapter || adapter.done || value === undefined || interrupted) return;
      if (!adapter.nativeFields && JSON.stringify(safeCapture(adapter)) !== adapter.baseline) { adapter.done = true; return; }
      adapter.done = true; value = closed(value);
      if (value === null) return;
      try { if (adapter.restore(value) === false) adapter.done = false; }
      catch (e) { adapter.done = true; }
    }
    function restorePresentation() {
      var body = doc.body;
      if (!body) return;
      if (!densityDone && /^(compact|comfortable)$/.test(saved.density || '') && body.hasAttribute('data-rtg-density')) {
        densityDone = true; body.setAttribute('data-rtg-density', saved.density);
      }
      if (!sectionDone && C.validName(saved.section) && body.hasAttribute('data-rtg-section')) {
        sectionDone = true; body.setAttribute('data-rtg-section', saved.section);
      }
      var key = doc.querySelector('[data-rtg-continue-key]');
      if (!anchorDone && key && /^(links|midden|rechts)$/.test(saved.anchor || '') &&
          win.RTGContinueKey && win.RTGContinueKey.setPosition) {
        anchorDone = true; win.RTGContinueKey.setPosition(saved.anchor);
      }
      var action = doc.querySelector('.rtg-edge-action');
      if (Date.now() <= deadline && action && action !== observedAction && win.MutationObserver) {
        if (keyObserver) keyObserver.disconnect(); observedAction = action;
        keyObserver = new win.MutationObserver(schedule);
        keyObserver.observe(action, { childList: true, subtree: true, attributes: true,
          attributeFilter: ['data-rtg-continue-key'] });
      }
    }
    function restorePoint(name, el, value) { C.restorePoint(win, name, el, value, applied); }
    function restoreScroll() {
      if (!pageVisible || Date.now() > deadline) return;
      if (Object.keys(adapters).some(function (name) {
        return saved.adapters && saved.adapters[name] !== undefined && !adapters[name].done;
      })) return;
      var root = doc.scrollingElement || doc.documentElement;
      /* Let native history restoration win; only use our fallback when it
         remains at zero after pageshow and the route adapters are ready. */
      if (nativePending && !applied.$window && (win.scrollX || win.scrollY)) nativeWindow = true;
      if (nativePending && Date.now() - visibleAt >= 250) nativePending = false;
      if (!nativeWindow && !nativePending && root) restorePoint('$window', root, saved.window);
      var scroll = elements();
      Object.keys(scroll).forEach(function (name) {
        restorePoint(name, scroll[name], saved.scroll && saved.scroll[name]);
        if (sizeObserver && !geometry[name]) {
          geometry[name] = scroll[name]; sizeObserver.observe(scroll[name]);
          if (scroll[name].firstElementChild) sizeObserver.observe(scroll[name].firstElementChild);
        }
      });
    }
    function attempt() {
      timer = 0;
      if (!started || !saved || interrupted || destroyed) return;
      Object.keys(adapters).forEach(restoreAdapter);
      restorePresentation(); restoreScroll();
    }
    function schedule() {
      if (!timer && !interrupted && started && Date.now() <= deadline) timer = win.setTimeout(attempt, 80);
    }
    function ready(name) {
      if (!started || interrupted || destroyed) return false;
      if (name && adapters[name]) restoreAdapter(name);
      attempt(); return true;
    }
    function register(name, adapter) {
      if (!C.validName(name) || !adapter || typeof adapter.capture !== 'function' ||
          typeof adapter.restore !== 'function' || Object.keys(adapters).length >= 8 || adapters[name]) return false;
      adapters[name] = { capture: adapter.capture, restore: adapter.restore, done: false, nativeFields: adapter.nativeFields === true,
        baseline: JSON.stringify(safeCapture(adapter)) };
      if (started) ready(name);
      return true;
    }
    function start() {
      if (started || destroyed || !doc.body) return api;
      started = true; deadline = Date.now() + 8000;
      var record = read().find(function (entry) { return entry.key === path; }); saved = record && record.state;
      nativeWindow = nativeWindow || !!(win.scrollX || win.scrollY);
      if (saved && !interrupted) {
        if (win.MutationObserver) {
          bodyObserver = new win.MutationObserver(schedule);
          bodyObserver.observe(doc.body, { attributes: true, attributeFilter:
            ['data-rtg-edge-2-rendered', 'data-rtg-density', 'data-rtg-section'] });
        }
        if (win.ResizeObserver) { sizeObserver = new win.ResizeObserver(schedule); sizeObserver.observe(doc.body); }
        [160, 500, 1400, 3200, 7000].forEach(function (delay) { retries.push(win.setTimeout(attempt, delay)); });
        retries.push(win.setTimeout(stopRestore, 8100)); attempt();
      }
      emit('rtg-route-memory-ready', { route: path, restored: !!saved }); return api;
    }
    function boot() {
      if (doc.readyState === 'loading') listen(doc, 'DOMContentLoaded', start, { once: true }); else start();
      return api;
    }
    function destroy() {
      stopRestore(); win.clearTimeout(saveTimer); destroyed = true;
      events.splice(0).forEach(function (event) { event[0].removeEventListener(event[1], event[2], event[3]); });
    }
    ['wheel', 'touchstart', 'keydown', 'pointerdown', 'input', 'change'].forEach(function (name) {
      listen(doc, name, cancel, { capture: true, passive: true });
    });
    listen(doc, 'scroll', queueSave, { capture: true, passive: true });
    listen(win, 'pagehide', save);
    listen(doc, 'visibilitychange', function () { if (doc.visibilityState === 'hidden') save(); });
    listen(win, 'pageshow', function (event) {
      pageVisible = true; visibleAt = Date.now();
      if (event.persisted) { interrupted = true; stopRestore(); return; }
      schedule();
    });
    pageVisible = doc.readyState === 'complete';
    var api = { register: register, ready: ready, save: save, capture: capture,
      cancel: cancel, start: start, boot: boot, destroy: destroy, route: path };
    return api;
  }
  return Object.freeze({ create: create, routeKey: routeKey, storageKey: C.storageKey });
}));
