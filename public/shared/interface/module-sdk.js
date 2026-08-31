/* RTG MODULE SDK v0.1.

   Een Living Module verklaart vooraf wat zij kan. De Workspace Runtime bezit
   identiteit, state, policy, chrome en transport. Een module levert uitsluitend
   surfaces en lifecycle-hooks binnen die gecontroleerde grens. */
(function (w) {
  'use strict';
  var VERSION = '0.1.0', STATES = ['peek', 'panel', 'workspace', 'focus'];
  var LEVELS = ['L0', 'L1', 'L2', 'L3', 'L4'], PERSIST = ['none', 'session', 'workspace', 'user'];
  var ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/, EVENT = /^[a-z][a-z0-9]*(?:\.[a-z0-9-]+)+$/;
  var SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;
  var catalogus = [];

  function uniek(lijst, naam, patroon) {
    if (lijst == null) return [];
    if (!Array.isArray(lijst)) throw new TypeError(naam + ' moet een lijst zijn.');
    var gezien = Object.create(null), uit = [];
    lijst.forEach(function (waarde) {
      var x = String(waarde || '').trim();
      if (!x || (patroon && !patroon.test(x))) throw new TypeError('Ongeldige ' + naam + ': ' + x);
      if (!gezien[x]) { gezien[x] = true; uit.push(x); }
    });
    return uit;
  }
  function versie(v, standaard) {
    if (Number.isFinite(Number(v)) && String(v).indexOf('.') < 0) v = Math.max(0, Math.floor(Number(v))) + '.0.0';
    v = String(v == null ? standaard : v).trim();
    if (!SEMVER.test(v)) throw new TypeError('Ongeldige semantische versie: ' + v);
    return v;
  }
  function getal(v, standaard, min, max) {
    var n = Number(v); if (!Number.isFinite(n)) n = standaard;
    return Math.max(min, Math.min(max, Math.round(n)));
  }
  function oppervlakken(m, states) {
    var invoer = m.surfaces || {}, uit = {};
    states.forEach(function (state) {
      var aanwezig = Array.isArray(invoer) ? invoer.indexOf(state) >= 0 :
        Object.prototype.hasOwnProperty.call(invoer, state) && invoer[state] !== false;
      uit[state] = aanwezig || !m.surfaces;
    });
    if (!Object.keys(uit).some(function (s) { return uit[s]; })) throw new TypeError('Een module moet minstens een surface leveren.');
    return uit;
  }
  function manifest(invoer) {
    var m = invoer || {}, id = String(m.id || '').trim();
    if (!ID.test(id)) throw new TypeError('Ongeldig module-id: ' + id);
    var titel = String(m.name || m.title || m.titel || '').trim();
    if (!titel || titel.length > 80) throw new TypeError('Module ' + id + ' mist een geldige naam.');
    var states = uniek(m.states || STATES, 'module-state');
    if (!states.length || states.some(function (s) { return STATES.indexOf(s) < 0; }))
      throw new TypeError('Module ' + id + ' heeft een onbekende state.');
    var gebeurtenissen = m.events || {}, state = m.state || {}, perf = m.performance || {};
    var runtime = m.runtime || {}, level = String(m.maturity || m.level || (m.source === 'legacy' ? 'L0' : 'L3')).toUpperCase();
    if (LEVELS.indexOf(level) < 0) throw new TypeError('Module ' + id + ' heeft een onbekend migratieniveau.');
    var persistence = String(state.persistence || 'none');
    if (PERSIST.indexOf(persistence) < 0) throw new TypeError('Module ' + id + ' heeft onbekende state-persistentie.');
    var schoon = {
      id: id, canonicalId: id.indexOf('.') >= 0 ? id : 'rtg.' + id,
      name: titel, title: titel, version: versie(m.version, '1.0.0'),
      runtime: { minVersion: versie(runtime.minVersion, VERSION) },
      source: m.source === 'legacy' ? 'legacy' : 'native', maturity: level,
      states: states, surfaces: oppervlakken(m, states),
      capabilities: uniek(m.capabilities, 'capability', ID),
      services: uniek(m.services, 'server-service', ID),
      permissions: uniek(m.permissions, 'permission', ID),
      actions: uniek(m.actions, 'actie', EVENT), invokes: uniek(m.invokes, 'aanroep', EVENT),
      events: {
        publishes: uniek(gebeurtenissen.publishes, 'publicatie', EVENT),
        subscribes: uniek(gebeurtenissen.subscribes, 'abonnement', EVENT)
      },
      lifecycle: ['onInstall', 'onMount', 'onActivate', 'onSuspend', 'onResume', 'onUnmount'],
      state: { persistence: persistence, schema: String(state.schema || state.schemaId || id + '.state.v1'),
        version: getal(state.version, 1, 1, 999) },
      performance: { peekBudgetKb: getal(perf.peekBudgetKb, 40, 1, 1024),
        panelBudgetKb: getal(perf.panelBudgetKb, 180, 1, 4096) },
      isolation: { scopedStyles: true, controlledNetwork: true, errorBoundary: true,
        eventAllowlist: true, actionAllowlist: true, globalMutation: false },
      priority: Number.isFinite(Number(m.priority)) ? Number(m.priority) : 100,
      defaultHidden: m.defaultHidden === true
    };
    return Object.freeze ? Object.freeze(schoon) : schoon;
  }
  function major(v) { return Number(String(v).split('.')[0]) || 0; }
  function compatibel(minimum) { return major(minimum) <= major(VERSION); }
  function define(invoer, create) {
    var m = manifest(invoer), fabriek = create || invoer.create;
    if (typeof fabriek !== 'function') throw new TypeError('Module ' + m.id + ' mist create(context).');
    var bron = invoer || {}, def = { manifest: m, create: fabriek, lifecycle: bron.lifecycle || {},
      surfaces: bron.surfaces || {}, validators: bron.validators || {} };
    return Object.freeze ? Object.freeze(def) : def;
  }
  function add(definitie) {
    if (!definitie || !definitie.manifest || typeof definitie.create !== 'function')
      throw new TypeError('Alleen een RTG-moduledefinitie kan worden geregistreerd.');
    if (!compatibel(definitie.manifest.runtime.minVersion))
      throw new Error('Module ' + definitie.manifest.id + ' vereist een nieuwere Workspace Runtime.');
    if (catalogus.some(function (d) { return d.manifest.id === definitie.manifest.id; }))
      throw new Error('Dubbele RTG-module: ' + definitie.manifest.id);
    catalogus.push(definitie);
    catalogus.sort(function (a, b) { return a.manifest.priority - b.manifest.priority || a.manifest.name.localeCompare(b.manifest.name); });
    return definitie;
  }
  var api = { version: VERSION, states: STATES.slice(), maturityLevels: LEVELS.slice(), persistence: PERSIST.slice(),
    define: define, validate: manifest, add: add, catalog: function () { return catalogus.slice(); }, compatible: compatibel,
    isId: function (id) { return ID.test(String(id || '')); }, isEvent: function (id) { return EVENT.test(String(id || '')); } };
  w.RTGModuleSDK = api;
  w.defineRTGModule = function (spec) { return add(define(spec, spec && spec.create)); };
})(window);
