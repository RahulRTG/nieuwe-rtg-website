(function (g, fabriek) {
  'use strict';
  var api = fabriek();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (g && g.document) g.RTGAdaptiveEdgeCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var STATES = Object.freeze(['peek', 'dock', 'deck', 'expanded']);
  var DECKS = Object.freeze(['home', 'context', 'actions', 'connect', 'rahul']);
  var DEFAULTS = Object.freeze({
    home: ['primary', 'worlds', 'presence'], context: ['context', 'status', 'worlds'],
    actions: ['primary', 'context'], connect: ['connect', 'presence'], rahul: ['ai', 'context']
  });
  var SPECS = Object.freeze({
    home: [['home', 'Home', 'Home', 'home'], ['worlds', 'Werelden', 'Werelden', 'grid'],
      ['ai', 'Praat met Rahul', 'Rahul', 'spark'], ['primary', 'Volgende actie', 'Verder', 'next'],
      ['menu', 'Alle functies', 'Menu', 'menu']],
    context: [['back', 'Terug', 'Terug', 'back'], ['context', 'Context van deze pagina', 'Context', 'doc'],
      ['ai', 'Praat met Rahul', 'Rahul', 'spark'], ['status', 'Veiligheid en status', 'Status', 'shield'],
      ['menu', 'Alle functies', 'Menu', 'menu']],
    actions: [['back', 'Terug', 'Terug', 'back'], ['primary', 'Hoofdactie', 'Doen', 'target'],
      ['ai', 'Praat met Rahul', 'Rahul', 'spark'], ['context', 'Meer acties', 'Meer', 'list'],
      ['menu', 'Alle functies', 'Menu', 'menu']],
    connect: [['back', 'Terug', 'Terug', 'back'], ['connect', 'Connect openen', 'Connect', 'people'],
      ['ai', 'Praat met Rahul', 'Rahul', 'spark'], ['presence', 'Actuele activiteit', 'Actueel', 'replay'],
      ['menu', 'Alle functies', 'Menu', 'menu']],
    rahul: [['back', 'Terug', 'Terug', 'back'], ['context', 'Geef Rahul context', 'Context', 'branch'],
      ['ai', 'Praat met Rahul', 'Rahul', 'spark'], ['ai', 'Open gesprek met Rahul', 'Gesprek', 'mail'],
      ['menu', 'Alle functies', 'Menu', 'menu']]
  });
  function norm(list, value, fallback) {
    value = String(value || '').toLowerCase();
    return list.indexOf(value) >= 0 ? value : fallback;
  }
  function normState(value, fallback) { return norm(STATES, value, fallback || 'dock'); }
  function normDeck(value, fallback) { return norm(DECKS, value, fallback || 'home'); }
  function nextDeck(value, delta) {
    var index = DECKS.indexOf(normDeck(value));
    return DECKS[(index + (delta < 0 ? -1 : 1) + DECKS.length) % DECKS.length];
  }
  function allowed(item) {
    try { return typeof item.allowed === 'function' ? !!item.allowed() : item.allowed !== false; }
    catch (e) { return false; }
  }
  function project(ids, registry, limit) {
    var out = [], seen = Object.create(null), max = Math.max(0, Math.min(5, Number(limit) || 4));
    (ids || []).forEach(function (input) {
      var id = typeof input === 'string' ? input : input && input.id;
      var item = id && registry && registry[id];
      if (!item || seen[id] || out.length >= max || !allowed(item)) return;
      seen[id] = true; out.push(item);
    });
    return out;
  }
  function model() {
    return { state: 'dock', deck: 'home', registry: Object.create(null),
      projections: Object.create(null), presence: null, identity: null, continuation: null };
  }
  function register(state, item) {
    var id = String(item && item.id || '');
    if (!state || !/^[a-z][a-z0-9-]{1,39}$/.test(id)) return false;
    state.registry[id] = { id: id, label: String(item.label || id).slice(0, 80),
      allowed: item.allowed, run: typeof item.run === 'function' ? item.run : null };
    return true;
  }
  function setProjection(state, input) {
    if (!state || !input) return false;
    var deck = normDeck(input.deck, 'actions');
    state.projections[deck] = (input.actions || []).map(function (x) {
      return typeof x === 'string' ? x : x && x.id;
    }).filter(Boolean);
    return deck;
  }
  function actions(state) {
    return project((state.projections[state.deck] || []).concat(DEFAULTS[state.deck] || []), state.registry, 4);
  }
  return Object.freeze({ STATES: STATES, DECKS: DECKS, SPECS: SPECS, normState: normState,
    normDeck: normDeck, nextDeck: nextDeck, allowed: allowed, project: project,
    model: model, register: register, setProjection: setProjection, actions: actions });
}));
