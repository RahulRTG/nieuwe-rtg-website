/* Navigation Runtime: modules geven een intent door; de host valideert en
   opent. Externe protocollen en vrije cross-origin navigatie zijn geen modulecapability. */
(function (w) {
  'use strict';
  w.RTGWorkspaceNavigation = function (opties) {
    var o = opties || {}, recent = [];
    function safe(url) {
      var value = String(url || '');
      if (!/^\/apps\/[a-zA-Z0-9._\/-]+(?:\?[a-zA-Z0-9._~%=&+-]*)?(?:#[a-zA-Z0-9._-]+)?$/.test(value))
        throw new Error('Module vroeg een niet-toegestane navigatie aan.');
      return value;
    }
    function open(url, title, source) {
      var intent = { url: safe(url), title: String(title || '').slice(0, 80), source: String(source || 'workspace').slice(0, 80) };
      recent.unshift(intent); if (recent.length > 20) recent.length = 20;
      return typeof o.open === 'function' ? o.open(intent.url, intent.title, intent.source) : intent;
    }
    return { open: open, recent: function () { return JSON.parse(JSON.stringify(recent)); }, destroy: function () { recent.length = 0; } };
  };
})(window);
