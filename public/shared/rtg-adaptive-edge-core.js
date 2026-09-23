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
  var DETAILS = Object.freeze({ home: 'Eerste Minuut', worlds: 'Uw werelden', ai: 'Pagina, taak en mandaat',
    context: 'Veilig voorbereid', menu: 'Alle functies', back: 'Vorige ruimte', status: 'Vertrouwd en veilig',
    primary: 'Volgende stap', connect: 'Mensen en gesprekken', presence: 'Actuele voortgang' });
  var SPECS = Object.freeze({
    home: [['home', 'Home', 'Home', 'home'], ['worlds', 'Werelden', 'Werelden', 'grid'],
      ['ai', 'Praat met Rahul', 'Rahul', 'spark'], ['context', 'Acties van dit scherm', 'Acties', 'list'],
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
  function detail(action) { return DETAILS[action] || 'RTG'; }
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
  function defaults(state) {
    var labels = { primary: 'Volgende stap', worlds: 'Uw werelden', context: 'Context en opties',
      status: 'Veiligheid en status', connect: 'Open Connect', presence: 'Bekijk actuele status', ai: 'Rahul vragen' };
    Object.keys(labels).forEach(function (id) { register(state, { id: id, label: labels[id], allowed: true }); });
  }
  /* Het model van de Edge die nu draait, voor EEN lezer: shared/edge/blikveld.js.
     momentopname() geeft een losse kopie zonder functies, dus wie leest kan het
     model niet veranderen -- het blikveld bezit niets (EDGE.md). */
  var laatste = null;
  function model() {
    laatste = { state: 'dock', deck: 'home', registry: Object.create(null),
      projections: Object.create(null), presence: null, identity: null, continuation: null };
    return laatste;
  }
  function momentopname() {
    var m = laatste;
    if (!m) return null;
    return { state: m.state, deck: m.deck, identity: m.identity || null,
      presence: m.presence ? { label: m.presence.label } : null,
      continuation: m.continuation ? { title: m.continuation.title, copy: m.continuation.copy } : null,
      acties: Object.keys(m.registry).map(function (id) {
        return { id: id, label: m.registry[id].label, allowed: allowed(m.registry[id]) };
      }) };
  }
  /* Het tweede register kent ALLEEN licht (EDGE.md par. 11, ronde 1). Wat een
     bevestiging vraagt, hoort in RTGAdaptief en weegt langs de grammatica; een
     eigen confirm of een zwaarder gewicht wordt geweigerd, nooit stil licht
     uitgevoerd. Leeg maken is ronde 2 (drie schermen leunen er nog op). */
  function register(state, item) {
    var id = String(item && item.id || '');
    if (!state || !/^[a-z][a-z0-9-]{1,39}$/.test(id)) return false;
    if (item.confirm || (item.gewicht && item.gewicht !== 'licht')) {
      if (typeof console !== 'undefined') console.warn('[edge] ' + id + ': dit register kent alleen licht; declareer in RTGAdaptief');
      return false;
    }
    state.registry[id] = { id: id, label: String(item.label || id).slice(0, 80),
      allowed: item.allowed, run: typeof item.run === 'function' ? item.run : null };
    return true;
  }
  /* Een tik: dezelfde ingang als het dock (RTGGewicht.voer), met gewicht licht. */
  function voer(e, w) {
    if (!e || typeof e.run !== 'function' || !allowed(e)) return false;
    if (w && w.RTGGewicht) return w.RTGGewicht.voer({ id: e.id, naam: e.label, gewicht: 'licht', doe: e.run }) !== false;
    e.run(); return true;
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
  return Object.freeze({ STATES: STATES, DECKS: DECKS, SPECS: SPECS, normState: normState, detail: detail,
    normDeck: normDeck, nextDeck: nextDeck, allowed: allowed, project: project,
    model: model, momentopname: momentopname, defaults: defaults, register: register, voer: voer, setProjection: setProjection, actions: actions });
}));
