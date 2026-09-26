(function (g, fabriek) {
  'use strict';
  var api = fabriek();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (g && g.document) g.RTGAdaptiveEdgeCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var STATES = Object.freeze(['peek', 'dock', 'deck', 'expanded']);
  var DECKS = Object.freeze(['home', 'context', 'actions', 'connect', 'rahul']);
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
  /* Het model van de Edge die nu draait, voor EEN lezer: shared/edge/blikveld.js.
     momentopname() geeft een losse kopie zonder functies, dus wie leest kan het
     model niet veranderen -- het blikveld bezit niets (EDGE.md). */
  var laatste = null;
  function model() {
    laatste = { state: 'dock', deck: 'home', presence: null, identity: null, continuation: null };
    return laatste;
  }
  function momentopname() {
    var m = laatste;
    if (!m) return null;
    return { state: m.state, deck: m.deck, identity: m.identity || null,
      presence: m.presence ? { label: m.presence.label } : null,
      continuation: m.continuation ? { title: m.continuation.title, copy: m.continuation.copy } : null };
  }
  /* ER IS GEEN TWEEDE REGISTER MEER (EDGE.md par. 11, ronde 2 stap 17 en 18).
     Handelingen declareert een scherm in RTGAdaptief, waar ze langs de
     grammatica en het gewicht lopen; de Edge-kern kent alleen zijn toestand en
     zijn decks. register, setProjection en voer bestaan met opzet niet, en
     test/edgeregister-leeg.test.js zakt zodra ze terugkomen. */
  return Object.freeze({ STATES: STATES, DECKS: DECKS, SPECS: SPECS, normState: normState, detail: detail,
    normDeck: normDeck, nextDeck: nextDeck, model: model, momentopname: momentopname });
}));
