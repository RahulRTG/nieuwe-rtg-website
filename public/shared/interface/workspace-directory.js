/* De read-only functiegids voor Rahul en Command. De inhoud komt uitsluitend
   uit RTGWorkspaceWorldCatalog, het uit MAPPEN gegenereerde register. Deze laag
   zoekt en onderscheidt; openen blijft bij de bestaande app-/Command-route. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) root.RTGWorkspaceDirectory = api;
})(typeof globalThis === 'undefined' ? null : globalThis, function () {
  'use strict';
  var MAX_QUERY = 120, ID = /^[a-z0-9][a-z0-9._:-]{0,95}$/;

  function tekst(value) {
    var raw = String(value == null ? '' : value).trim();
    if (!raw || raw.length > MAX_QUERY || /[\u0000-\u001f\u007f]/.test(raw)) return '';
    return raw.toLowerCase().normalize ? raw.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '') : raw.toLowerCase();
  }
  function veilig(row) {
    return Object.freeze({ id: row.id, name: row.name, world: row.world, kind: row.kind });
  }
  function dicht(reason) {
    return Object.freeze({ version: 1, status: 'closed', reason: reason, query: '', matches: Object.freeze([]) });
  }
  function guard(options) {
    var g = options && options.guard;
    if (!g || g.authenticated !== true || g.sameSession !== true) return 'session';
    if (g.contextCurrent !== true) return 'context';
    if (typeof options.allow !== 'function') return 'permission';
    return '';
  }
  function rows(catalog, allow) {
    var result = [], seen = Object.create(null), list = Array.isArray(catalog) ? catalog : [];
    list.forEach(function (world) {
      if (!world || !ID.test(String(world.id || '')) || !world.name) return;
      var worldId = 'world:' + world.id;
      if ((!allow || allow(worldId, 'world') === true) && !seen[worldId]) {
        seen[worldId] = true;
        result.push({ id: worldId, name: String(world.name), world: String(world.name), kind: 'world',
          key: String(world.id) });
      }
      (Array.isArray(world.items) ? world.items : []).forEach(function (item) {
        if (!item || !ID.test(String(item.id || '')) || !item.name || seen[item.id]) return;
        if (allow && allow(item.id, 'item') !== true) return;
        seen[item.id] = true;
        result.push({ id: String(item.id), name: String(item.name), world: String(world.name), kind: 'item',
          key: String(item.id).replace(/^[^:]+:/, '') });
      });
    });
    return result;
  }
  function match(row, query) {
    var name = tekst(row.name), id = tekst(row.id), key = tekst(row.key), world = tekst(row.world);
    if (query === name || query === id || query === key) return 2;
    return name.indexOf(query) >= 0 || id.indexOf(query) >= 0 || key.indexOf(query) >= 0 || world.indexOf(query) >= 0 ? 1 : 0;
  }
  function search(input, options) {
    var reason = guard(options);
    if (reason) return dicht(reason);
    var query = tekst(input);
    if (!query || /(?:https?:\/\/|javascript:|data:|\/api\/|\.\.\/)/.test(query)) return dicht('query');
    var all = rows(options.catalog, options.allow), exact = [], related = [];
    all.forEach(function (row) { var score = match(row, query); if (score === 2) exact.push(row); else if (score === 1) related.push(row); });
    var found = exact.length ? exact : related;
    return Object.freeze({ version: 1, status: found.length ? 'ready' : 'unknown', reason: found.length ? (exact.length ? 'exact' : 'related') : 'not-found',
      query: query, matches: Object.freeze(found.slice(0, 12).map(veilig)) });
  }
  function resolve(input, options) {
    var result = search(input, options);
    if (result.status !== 'ready') return result;
    if (result.reason === 'exact' && result.matches.length === 1)
      return Object.freeze({ version: 1, status: 'match', reason: 'exact', query: result.query, match: result.matches[0], matches: result.matches });
    return Object.freeze({ version: 1, status: 'choices', reason: result.reason, query: result.query, matches: result.matches });
  }
  return Object.freeze({ search: search, resolve: resolve, maxQuery: MAX_QUERY });
});
