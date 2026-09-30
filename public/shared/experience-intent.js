/* Tijdelijke bedoeling per ingelogde sessie en tab. Geen autorisatie, profiel
   of domeinwaarheid. Alleen expliciet bewaren; terminale context wordt gewist. */
(function (g, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (g && g.document) g.RTGIntent = api;
}(typeof globalThis === 'undefined' ? null : globalThis, function () {
  'use strict';
  var KEY = 'rtg.intent.v1', TTL = 7200000, MAX = 8;
  var SOURCES = {dinner:'/apps/foodcourt.html',travel:'/apps/reisbureau.html'};
  var TERMINAL = ['FULFILLED', 'ABANDONED', 'EXPIRED', 'REVOKED'];
  function fields(value) {
    var out = {};
    if (!value || typeof value !== 'object') return out;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value.date || '') &&
        Number.isFinite(Date.parse(value.date)) && new Date(value.date).toISOString().slice(0,10) === value.date) out.date = value.date;
    if (Number.isInteger(value.participants) && value.participants >= 1 && value.participants <= 20) out.participants = value.participants;
    ['search','cuisine'].forEach(function (k) { if (typeof value[k] === 'string') out[k] = value[k].slice(0,80); });
    return out;
  }
  function create(options) {
    var storage = options.storage, owner = options.owner, now = options.now || Date.now;
    var purpose = options.purpose || 'dinner';
    if (!Object.prototype.hasOwnProperty.call(SOURCES,purpose)) throw new Error('Unknown intent purpose');
    function allowed(value, goal) {
      var clean = fields(value);
      if (goal === 'travel') { delete clean.search; delete clean.cuisine; }
      return clean;
    }
    if (!/^[a-f0-9]{64}$/.test(owner || '')) throw new Error('Authenticated session fingerprint required');
    function write(rows) { storage.setItem(KEY, JSON.stringify({ owner: owner, rows: rows })); }
    function read() {
      var t = now(), box;
      try { var raw = storage.getItem(KEY); box = raw && raw.length <= 16000 ? JSON.parse(raw) : null; } catch (e) { box = null; }
      if (!box || box.owner !== owner || !Array.isArray(box.rows)) { write([]); return []; }
      var rows = box.rows.slice(-MAX).filter(function (r) {
        return r && /^[a-zA-Z0-9-]{1,64}$/.test(r.id) && Object.prototype.hasOwnProperty.call(SOURCES,r.purpose) &&
          Number.isFinite(r.createdAt) && r.createdAt <= t && Number.isFinite(r.expiresAt) &&
          r.expiresAt > t && r.expiresAt <= r.createdAt + TTL &&
          (r.status === 'ACTIVE' || TERMINAL.indexOf(r.status) >= 0);
      }).map(function (r) {
        return { id:r.id, purpose:r.purpose, status:r.status, createdAt:r.createdAt, expiresAt:r.expiresAt,
          source:SOURCES[r.purpose], consent:'explicit', visibility:'this-session-tab',
          fields:r.status === 'ACTIVE' ? allowed(r.fields,r.purpose) : {} };
      });
      write(rows); return rows;
    }
    function begin(value) {
      var rows = read();
      if (rows.filter(function (r) { return r.status === 'ACTIVE'; }).length >= MAX) throw new Error('Rond eerst een andere bedoeling af.');
      var t = now(), r = {id:options.id(),purpose:purpose,status:'ACTIVE',createdAt:t,expiresAt:t+TTL,
        source:SOURCES[purpose],consent:'explicit',visibility:'this-session-tab',fields:allowed(value,purpose)};
      if (!/^[a-zA-Z0-9-]{1,64}$/.test(r.id) || rows.some(function (x) { return x.id === r.id; })) throw new Error('Invalid intent id');
      rows = rows.filter(function (x) { return x.status === 'ACTIVE'; }); rows.push(r); write(rows); return r;
    }
    function update(id, value) {
      var rows = read(), r = rows.find(function (x) { return x.purpose === purpose && x.id === id && x.status === 'ACTIVE'; });
      if (!r) return null;
      r.fields = allowed(value,purpose); write(rows); return r;
    }
    function end(id, status) {
      if (TERMINAL.indexOf(status) < 0) throw new Error('Invalid lifecycle transition');
      var rows = read(), r = rows.find(function (x) { return x.purpose === purpose && x.id === id && x.status === 'ACTIVE'; });
      if (!r) return false;
      r.status = status; r.fields = {}; write(rows); return true;
    }
    return { begin:begin, update:update, end:end, list:function () { return read().filter(function (r) { return r.purpose === purpose; }); }, clear:function () { storage.removeItem(KEY); } };
  }
  async function forSession(win, token, purpose) {
    if (!token) return null;
    var digest = await win.crypto.subtle.digest('SHA-256', new TextEncoder().encode('rtg-intent:' + token));
    var owner = Array.from(new Uint8Array(digest), function (b) { return b.toString(16).padStart(2,'0'); }).join('');
    return create({storage:win.sessionStorage,owner:owner,purpose:purpose,id:function () { return win.crypto.randomUUID(); }});
  }
  return Object.freeze({create:create,forSession:forSession,fields:fields,TTL:TTL,MAX:MAX,TERMINAL:TERMINAL});
}));
