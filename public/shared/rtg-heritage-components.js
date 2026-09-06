/* Verbindt de bestaande schermen aan één componentgrammatica. De route houdt
   haar DOM, handlers, bronstatus en canvas. Alleen semantische rollen komen erbij. */
(function (w, d) {
  'use strict';
  if (w.RTGHeritageComponents) return;
  var EXCLUDE = '.rtg-edge-chrome,[contenteditable="true"],.monaco-editor,.cm-editor,.leaflet-container,.maplibregl-map,[data-rtg-native-canvas]';
  var SCOPE = 'main,[role="main"],dialog,[role="dialog"]';
  function mark(el, name, value) { if (el && !el.hasAttribute(name)) el.setAttribute(name, value); }
  function guarded(el, guard) {
    if (guard === 'dialog') return el.matches('dialog,[role="dialog"]');
    if (guard === 'has-moment-row') return !!el.querySelector(':scope > .litem');
    if (guard === 'task-form') return !!el.querySelector('input:not([type="hidden"]):not([type="search"]),select,textarea') && !el.matches('[role="search"]');
    if (guard === 'operational-content') return Array.from(el.children).some(function (child) { return child.matches('form,fieldset,table,[role="table"],.rtg-register'); });
    return true;
  }
  function annotate() {
    var identity = w.RTGWorldIdentity, registry = w.RTGHeritageRegistry;
    if (!identity || !registry || !d.body) return;
    var path = identity.normalizePath(w.location.pathname), world = identity.classify(w.location.href);
    if (!world || world === 'redirect') return;
    var profile = registry.profiles[path] || {}, canvas = registry.canvas[path];
    mark(d.body, 'data-rtg-screen', profile.type || (canvas ? 'canvas' : 'operational'));
    if (canvas) d.querySelectorAll(canvas).forEach(function (el) {
      mark(el, 'data-rtg-native-canvas', 'true');
      if (!el.hasAttribute('data-rtg-resize-bound') && w.ResizeObserver) {
        mark(el, 'data-rtg-resize-bound', 'true'); var previous = '';
        new ResizeObserver(function (entries) {
          var rect = entries[0].contentRect, size = Math.round(rect.width) + ':' + Math.round(rect.height);
          if (size !== previous) { previous = size; w.dispatchEvent(new Event('resize')); }
        }).observe(el);
      }
    });
    (profile.rules || []).concat(registry.common).forEach(function (rule) {
      d.querySelectorAll(rule.selector).forEach(function (el) {
        if (!el.closest(SCOPE) || el.closest(EXCLUDE) || !guarded(el, rule.guard)) return;
        mark(el, 'data-rtg-component', rule.component);
        mark(el, 'data-rtg-component-variant', rule.variant);
      });
    });
    [[profile.display,'data-rtg-type','display'],[profile.row,'data-rtg-moment-row','native'],
      [profile.time,'data-rtg-moment-time','true']].forEach(function (x) {
      if (x[0]) d.querySelectorAll(x[0]).forEach(function (el) { mark(el,x[1],x[2]); });
    });
    d.querySelectorAll('.wrooster-kaart[href]').forEach(function (el) { mark(el,'data-rtg-component','WorldPortal'); });
    d.querySelectorAll('input,select,textarea').forEach(function (el) {
      if (!el.closest(SCOPE) || el.closest(EXCLUDE) || el.type === 'hidden') return;
      var labels = Array.from(el.labels || []).filter(function (label) { return label.textContent.trim(); });
      if (labels.length || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) {
        mark(el, 'data-rtg-form-control', el.type || el.tagName.toLowerCase());
        labels.forEach(function (label) { mark(label,'data-rtg-form-label','true'); });
      }
    });
    d.querySelectorAll('table,[role="table"]').forEach(function (el) {
      if (el.closest(SCOPE) && !el.closest(EXCLUDE) && el.getAttribute('role') !== 'presentation') mark(el,'data-rtg-operational-table','true');
    });
    d.body.setAttribute('data-rtg-grammar-ready', 'true');
  }
  function start() {
    annotate();
    var queued = false;
    new MutationObserver(function (records) {
      if (queued || !records.some(function (r) { return Array.from(r.addedNodes).some(function (n) { return n.nodeType === 1; }); })) return;
      queued = true; requestAnimationFrame(function () { queued = false; annotate(); });
    }).observe(d.body, { childList: true, subtree: true });
  }
  w.RTGHeritageComponents = { annotate: annotate };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start, { once: true }); else start();
}(window, document));
