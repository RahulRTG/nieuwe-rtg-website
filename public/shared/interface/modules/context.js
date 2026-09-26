/* Nu relevant als Living Module: wat het scherm nu aanreikt, uitgevoerd langs
   het gewicht. Afgesplitst uit second-screen-modules.js (ronde 2, stap 22). */
(function (w, d) {
  'use strict';
  var SDK = w.RTGModuleSDK; if (!SDK) return;
  function el(tag, cls, tekst) { var n = d.createElement(tag); if (cls) n.className = cls; if (tekst != null) n.textContent = tekst; return n; }
  function button(tekst, cls) { var b = el('button', cls, tekst); b.type = 'button'; return b; }
  SDK.add(SDK.define({
    id: 'context', title: 'Nu relevant', version: 1, source: 'native', priority: 20,
    states: SDK.states, capabilities: ['context.read', 'context.execute'], permissions: [],
    actions: ['context.execute'], events: { publishes: ['context.updated'], subscribes: [] }
  }, function (ctx) {
    var root, laatste = null, af = null, A = w.RTGAdaptief;
    /* De titel komt uit de werkruimtecontext (het blikveld), en alleen als een
       scherm of blad hem zelf zei: een titel van het casco of het document is
       een terugval van de Edge en geen context van wat hier speelt. */
    function titel() {
      var v = ctx.context().velden, c = v && v.context;
      return c && (c.herkomst === 'scherm' || c.herkomst === 'blad') && c.waarde ? c.waarde.titel : '';
    }
    function teken(c) {
      laatste = c || {}; if (!root) return; root.textContent = '';
      var kop = titel(); if (kop) root.appendChild(el('strong', '', kop));
      var items = A && A.voorNu ? A.voorNu() : [];
      (Array.isArray(items) ? items : []).slice(0, 4).forEach(function (x) {
        if (!x || !(x.label || x.naam)) return;
        var b = button(x.label || x.naam, 'rtg-ss-context-action'); b.dataset.ssContextId = x.id; root.appendChild(b);
      });
      if (!root.childNodes.length) root.appendChild(el('p', 'rtg-ss-quiet', 'Geen actie nodig. Rahul houdt de rest in de gaten.'));
      ctx.setStatus(items.length ? 'actueel' : 'Alles rustig', items.length ? 'ok' : 'quiet');
      ctx.events.publish('context.updated', { title: laatste.titel || null, source: laatste.bron || null,
        actions: (laatste.acties || []).slice(0, 12) });
    }
    function laatsteContext() { return (A && A.context && A.context()) || laatste || {}; }
    return {
      actions: { 'context.execute': { run: function (p) { return !!w.RTGGewicht && w.RTGGewicht.voerId(String(p.id)); } } },
      mount: function (body) {
        root = el('div', 'rtg-ss-context'); body.appendChild(root); teken(laatsteContext());
        if (A && A.opContext) af = A.opContext(teken);
      },
      render: function () { teken(laatsteContext()); },
      handle: function (target) {
        var b = target && target.closest && target.closest('[data-ss-context-id]'); if (!b || !root.contains(b)) return false;
        ctx.actions.run('context.execute', { id: b.dataset.ssContextId }).catch(function () {}); return true;
      },
      destroy: function () { if (af) af(); root = null; }
    };
  }));
})(window, document);
