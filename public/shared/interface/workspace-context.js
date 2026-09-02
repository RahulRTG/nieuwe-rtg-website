/* Context Engine: een kleine, serialiseerbare afdruk van wat nu relevant is.
   Modules kunnen die lezen; alleen de host kan de context vervangen. */
(function (w) {
  'use strict';
  function clean(value) {
    var text = JSON.stringify(value == null ? {} : value);
    if (text.length > 16384) throw new Error('Workspace-context is groter dan 16 KB.');
    if (/"(?:token|authorization|password|secret|wachtwoord|sessie)"\s*:/i.test(text))
      throw new Error('Workspace-context mag geen geheimen bevatten.');
    return JSON.parse(text);
  }
  w.RTGWorkspaceContext = function (opties) {
    var o = opties || {}, current = {}, listeners = [];
    function get() { return clean(current); }
    function set(value, reason) {
      var next = clean(value); if (JSON.stringify(next) === JSON.stringify(current)) return get();
      current = next; var change = { value: get(), reason: reason || 'host-update' };
      listeners.slice().forEach(function (fn) { try { fn(change); } catch (e) {} }); return get();
    }
    function refresh() { try { return set(typeof o.source === 'function' ? o.source() : {}, 'source-refresh'); } catch (e) { return get(); } }
    refresh();
    return { get: get, set: set, refresh: refresh, subscribe: function (fn) { listeners.push(fn); return function () {
      var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; }, destroy: function () { listeners.length = 0; } };
  };
})(window);
