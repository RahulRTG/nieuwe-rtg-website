/* RTG CINEMATIC SYSTEM ----------------------------------------------------
   Verbindt alle echte appschermen aan dezelfde fotografische compositie.
   Deze laag maakt geen navigatie, knoppen of inhoud. Zij benoemt uitsluitend
   bestaande roots en introducties, zodat Edge, data en domeinhandlers de ene
   bron van waarheid blijven. */
(function (w, d) {
  'use strict';
  if (w.RTGCinematicSystem) return;

  var SKIP = '.rtg-edge-chrome,dialog,[role="dialog"],[data-rtg-native-canvas],.monaco-editor,.cm-editor,.leaflet-container,.maplibregl-map';
  var LEADS = '[data-rtg-component="EditorialHero"],[data-rtg-component="ContextStrip"],.kantoor-intro,.rtg-intro,.dagkop,.dagtitel,.onthaal';

  function visible(el) {
    if (!el || el.closest(SKIP)) return false;
    var style = w.getComputedStyle ? w.getComputedStyle(el) : null;
    return !style || (style.display !== 'none' && style.visibility !== 'hidden');
  }

  function screenKind(body, profile, canvas) {
    var declared = body.getAttribute('data-rtg-screen') || (profile && profile.type);
    if (canvas || declared === 'canvas') return 'immersive';
    if (declared === 'world-home') return 'world-home';
    if (declared === 'agenda' || declared === 'dossier' || declared === 'files') return declared;
    if (body.querySelector('form,fieldset,[data-rtg-operational-table],table,[role="grid"]')) return 'operational';
    return declared || 'editorial';
  }

  function chooseLead(root, kind) {
    if (!root || kind === 'immersive') return null;
    var lead = Array.from(root.querySelectorAll(LEADS)).find(visible);
    if (lead) return lead;
    var title = Array.from(root.querySelectorAll('h1')).find(function (el) {
      return visible(el) && el.textContent.trim().length > 1;
    });
    if (!title) return null;
    var candidate = title.closest('header,section,article');
    if (!candidate || candidate === root || candidate.querySelector('form,table,[role="grid"],[data-rtg-native-canvas]')) return null;
    return candidate;
  }

  function annotate() {
    var identity = w.RTGWorldIdentity, registry = w.RTGHeritageRegistry, body = d.body;
    if (!identity || !registry || !body) return false;
    var path = identity.normalizePath(w.location.href), world = identity.classify(w.location.href);
    if (!world || world === 'redirect') return false;
    var profile = registry.profiles[path] || null, canvas = registry.canvas[path] || null;
    var root = d.querySelector('[data-rtg-screen-root="content"],[data-rtg-screen-root="immersive"]');
    if (!root) return false;

    body.setAttribute('data-rtg-cinematic', 'true');
    body.setAttribute('data-rtg-cinematic-kind', screenKind(body, profile, canvas));
    root.setAttribute('data-rtg-cinematic-root', root.getAttribute('data-rtg-screen-root') || 'content');

    d.querySelectorAll('[data-rtg-cinematic-lead]').forEach(function (el) {
      if (!root.contains(el)) el.removeAttribute('data-rtg-cinematic-lead');
    });
    var lead = chooseLead(root, body.getAttribute('data-rtg-cinematic-kind'));
    if (lead) lead.setAttribute('data-rtg-cinematic-lead', 'true');
    body.setAttribute('data-rtg-cinematic-ready', 'true');
    return true;
  }

  function start() {
    annotate();
    if (!w.MutationObserver || !d.body) return;
    var queued = false;
    new MutationObserver(function (records) {
      if (queued || !records.some(function (record) {
        return record.type === 'attributes' || Array.from(record.addedNodes || []).some(function (node) { return node.nodeType === 1; });
      })) return;
      queued = true;
      w.requestAnimationFrame(function () { queued = false; annotate(); });
    }).observe(d.body, { childList: true, subtree: true, attributes: true,
      attributeFilter: ['data-rtg-screen', 'data-rtg-screen-root'] });
  }

  w.RTGCinematicSystem = Object.freeze({ annotate: annotate, screenKind: screenKind });
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}(window, document));
