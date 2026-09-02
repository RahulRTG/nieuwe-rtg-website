/* LEGACY MODULE ADAPTER.

   Een bestaande RTG-app kan meteen in de uniforme Dynamic Layer meedoen zonder
   te doen alsof zij al een native Living Module is. Het id en de persoonlijke
   plaats blijven gelijk; later kan dezelfde definitie native worden vervangen. */
(function (w, d) {
  'use strict';
  var SDK = w.RTGModuleSDK;
  if (!SDK) return;

  function el(tag, cls, tekst) {
    var n = d.createElement(tag); if (cls) n.className = cls;
    if (tekst != null) n.textContent = tekst; return n;
  }

  w.RTGWorkspaceLegacy = function (invoer, opties) {
    var o = opties || {}, id = String(invoer.id || ''), action = id + '.open';
    var m = Object.assign({}, invoer, { source: 'legacy', actions: (invoer.actions || []).concat([action]) });
    return SDK.define(m, function (ctx) {
      var body, uitleg, knop;
      function tekst(state) {
        if (typeof o.description === 'function') return o.description(state);
        return o.description || 'Open deze capability zonder uw huidige RTG-context te verliezen.';
      }
      return {
        actions: (function () {
          var a = {}; a[action] = { permission: o.permission || null, run: function (p) {
            return ctx.open((p && p.url) || o.url, (p && p.title) || ctx.manifest.title);
          } }; return a;
        })(),
        mount: function (root) {
          body = el('div', 'rtg-module-legacy'); uitleg = el('p', 'rtg-ss-quiet', tekst('panel'));
          knop = el('button', 'rtg-module-primary', o.label || 'Open in werkruimte'); knop.type = 'button';
          knop.dataset.rtgLegacyOpen = '1'; knop.dataset.ssUrl = o.url || '';
          body.appendChild(uitleg); body.appendChild(knop); root.appendChild(body);
        },
        render: function (state) {
          if (uitleg) uitleg.textContent = tekst(state);
          if (knop) knop.textContent = state === 'focus' ? (o.focusLabel || o.label || 'Open capability') : (o.label || 'Open in werkruimte');
        },
        handle: function (target) {
          var b = target && target.closest && target.closest('[data-rtg-legacy-open]');
          if (!b || !body.contains(b)) return false;
          ctx.actions.run(action, { url: b.dataset.ssUrl || o.url, title: ctx.manifest.title }).catch(function () {});
          return true;
        }
      };
    });
  };
})(window, document);
