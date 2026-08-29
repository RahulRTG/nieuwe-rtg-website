/* Identity en Session Runtime. Alleen deze grens leest het bestaande
   ledentoken; modules zien actor- en sessiecontext, nooit credentials. */
(function (w) {
  'use strict';
  w.RTGIdentityRuntime = function (opties) {
    var o = opties || {}, key = o.tokenKey || 'rtg_member_token';
    function token() { try { return w.localStorage.getItem(key) || ''; } catch (e) { return ''; } }
    function actor() { var a = typeof o.actor === 'function' ? o.actor() : o.actor;
      return a || { id: token() ? 'current-member' : 'anonymous', type: token() ? 'member' : 'anonymous' }; }
    return { authenticated: function () { return !!token(); }, actor: actor,
      headers: function () { var t = token(); return t ? { Authorization: 'Bearer ' + t } : {}; } };
  };
  w.RTGSessionRuntime = function (opties) {
    var o = opties || {}, identity = o.identity, listeners = [];
    function snapshot() { return { online: !w.navigator || w.navigator.onLine !== false,
      authenticated: !!(identity && identity.authenticated()), activeDevice: o.deviceId || null }; }
    function changed() { var s = snapshot(); listeners.slice().forEach(function (fn) { try { fn(s); } catch (e) {} }); }
    if (w.addEventListener) { w.addEventListener('online', changed); w.addEventListener('offline', changed); }
    return { snapshot: snapshot, subscribe: function (fn) { listeners.push(fn); return function () {
      var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; }, destroy: function () {
      if (w.removeEventListener) { w.removeEventListener('online', changed); w.removeEventListener('offline', changed); } listeners.length = 0;
    } };
  };
})(window);
