/* Accountgebonden tabopslag voor Rahul. Alleen een SHA-256-afdruk van de
   actieve sessievorm wordt bewaard; wisselen sluit fail-closed. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) root.RTGRahulSession = api;
})(typeof globalThis === 'undefined' ? null : globalThis, function () {
  'use strict';
  var KEY = 'rtg.rahul.session.v2', LEGACY = 'rtg_rahul_command', MAX = 12, LIMIT = 16000;
  var TOKENS = [['member','rtg_member_token'],['supplier','rtg_sup_token'],['staff','rtg_pda_token'],['office','rtg_office_token']];
  function principal(win) {
    try {
      for (var i = 0; i < TOKENS.length; i++) {
        var token = win.localStorage.getItem(TOKENS[i][1]);
        if (token) return TOKENS[i][0] + ':' + token;
      }
    } catch (e) {}
    return '';
  }
  async function owner(win) {
    var value = principal(win);
    if (!value || !win.crypto || !win.crypto.subtle || typeof TextEncoder !== 'function') return '';
    var digest = await win.crypto.subtle.digest('SHA-256', new TextEncoder().encode('rtg-rahul:' + value));
    return Array.from(new Uint8Array(digest), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  function clean(rows) {
    return (Array.isArray(rows) ? rows : []).slice(-MAX).map(function (row) {
      return { rol: row && row.rol === 'user' ? 'user' : 'rahul', tekst: String(row && row.tekst || '').slice(0, 2000),
        noot: row && row.noot ? String(row.noot).slice(0, 2000) : undefined };
    });
  }
  function create(win) {
    function clear() { try { win.sessionStorage.removeItem(KEY); win.sessionStorage.removeItem(LEGACY); } catch (e) {} }
    async function read() {
      var current = await owner(win); try { win.sessionStorage.removeItem(LEGACY); } catch (e) {}
      if (!current) { clear(); return { owner: '', history: [] }; }
      var box = null;
      try { var raw = win.sessionStorage.getItem(KEY); box = raw && raw.length <= LIMIT ? JSON.parse(raw) : null; } catch (e) {}
      if (!box || box.owner !== current || !Array.isArray(box.history)) {
        try { win.sessionStorage.setItem(KEY, JSON.stringify({ owner: current, history: [] })); } catch (e) {}
        return { owner: current, history: [] };
      }
      return { owner: current, history: clean(box.history) };
    }
    async function write(expectedOwner, rows) {
      var current = await owner(win);
      if (!current || current !== expectedOwner) {
        try {
          var raw = win.sessionStorage.getItem(KEY), saved = raw && raw.length <= LIMIT ? JSON.parse(raw) : null;
          if (!saved || saved.owner === expectedOwner) win.sessionStorage.removeItem(KEY);
          win.sessionStorage.removeItem(LEGACY);
        } catch (e) {}
        return false;
      }
      var text = JSON.stringify({ owner: current, history: clean(rows) });
      if (text.length > LIMIT) return false;
      try { win.sessionStorage.setItem(KEY, text); win.sessionStorage.removeItem(LEGACY); return true; } catch (e) { return false; }
    }
    return { read: read, write: write, clear: clear };
  }
  return Object.freeze({ create: create, key: KEY, legacyKey: LEGACY });
});
