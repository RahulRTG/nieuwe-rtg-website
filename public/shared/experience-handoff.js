/* Explicit public-demo interests, consumed once by the existing welcome screen.
   No storage, free text, account mutation, token or permission transfer. */
(function (w, factory) {
  'use strict';
  var parse = factory();
  if (typeof module === 'object' && module.exports) module.exports = parse;
  if (!w) return;
  var params = new URLSearchParams(w.location.hash.slice(1)), labels = [];
  if (params.has('rtg-experience')) {
    labels = params.getAll('rtg-experience').length === 1 ? parse(params.get('rtg-experience')) : [];
    params.delete('rtg-experience');
    var rest = params.toString();
    w.history.replaceState(w.history.state, '', w.location.pathname + w.location.search + (rest ? '#' + rest : ''));
  }
  w.RTGExperienceHandoff = Object.freeze({ consume: function () { var result = labels; labels = []; return result; } });
}(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  var names = Object.freeze({ living: 'LivingOS', travel: 'TravelOS', work: 'WorkOS', foundation: 'FoundationOS' });
  return function (value) {
    if (typeof value !== 'string' || value.length > 64) return [];
    var keys = value.split(',');
    if (keys.length > 4 || !keys.every(function (key) { return Object.hasOwn(names, key); })) return [];
    return Array.from(new Set(keys)).map(function (key) { return names[key]; });
  };
}));
