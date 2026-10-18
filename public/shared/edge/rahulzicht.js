/* Positieve, vluchtige Rahul-projectie van Edge en Workspace. Zij kopieert
   alleen opgesomde velden. Assistant-acties zijn declaratieve voorstellen uit
   het bestaande modulecontract; deze laag voert ze nooit uit. */
(function (root, fabriek) {
  'use strict';
  var api = fabriek();
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  if (root && !root.RTGEdgeRahulzicht) root.RTGEdgeRahulzicht = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var WERELDEN = ['living', 'travel', 'work', 'foundation'];
  /* De herkomsten die zeggen dat het SCHERM (of het blad via de brug, of het
     casco van de Edge) het zelf zei. `document` staat er niet in: een kale
     paginatitel weet de helper zelf ook, en hem hier als blikveld-waarheid
     doorgeven zou herkomst verzinnen. */
  var TITELBRON = ['scherm', 'blad', 'edge-casco'];
  var GRENS = { deel: 70, soort: 24, id: 40, werkruimte: 40, module: 40 };
  var MODI = ['peek', 'panel', 'workspace', 'focus'];
  var ASSISTENTSOORTEN = ['read', 'search', 'open', 'propose'];
  var ACTIE = /^[a-z][a-z0-9]*(?:\.[a-z0-9-]+)+$/;

  var MEE = Object.freeze({
    wereld: 'de wereld waarin het scherm of het open blad staat (living, travel, work, foundation)',
    context: 'alleen de TITEL, en alleen als het scherm hem zelf zei; de server leest hem als `deel`',
    object: 'alleen soort en id, als verwijzing; de server zoekt het object zelf op of het bestaat niet'
  });
  var NIET_MEE = Object.freeze({
    identiteit: 'wie iemand is gaat langs de kluis en nooit langs de Edge (EDGE.md besluit 2)',
    activiteit: 'het contract van menscontext.js heeft er geen plek voor; samenstellen wat niemand leest is een lek zonder nut',
    presence: 'wie of wat er meekijkt is geen context voor een vraag, en kan een naam dragen (besluit 2)',
    voortzetting: 'de lijst open bladen is een spoor van waar iemand was (besluit 1); een gedragslogboek gaat niet naar een model',
    hoofdactie: 'wat Rahul mag klaarzetten bepaalt de server (beleid.js, resolver.js); context schept nooit een capability',
    trust: 'de Trust Rail toont een toestand aan een mens; het contract kent hem niet',
    bevoegdheid: 'de Edge verleent niets, en de server weet zelf wat iemand mag'
  });
  /* De Runtime bezit meer: layout, panelen, state en uitvoerfuncties. Dit is de
     volledige positieve lijst van wat Rahul daarvan mag zien. */
  var WERKRUIMTE_MEE = Object.freeze({
    id: 'de niet-gevoelige identificatie van de huidige werkruimte',
    modus: 'de zichtbare presentatiemodus uit de bestaande Workspace-state',
    module: 'de actieve module, alleen als RTGAdaptief dezelfde module als actuele context bevestigt'
  });
  var ASSISTENT_MEE = Object.freeze({
    module: 'de actieve module uit dezelfde Workspace-projectie',
    mogelijkheden: 'alleen expliciet assistant-safe actie-id en type; nooit invoer of uitvoering'
  });

  function kort(x, n) {
    return String(x == null ? '' : x).replace(/[\x00-\x1f\x7f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
  }
  function woord(x, n) {
    return String(x == null ? '' : x).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, n);
  }
  /* Een Workspace-sleutel wordt niet verbeterd. Tekst met spaties, opmaak of
     instructies is geen id en valt geheel weg. */
  function sleutel(x, n) {
    var s = String(x == null ? '' : x);
    return /^[a-z][a-z0-9-]*$/.test(s) ? s.slice(0, n) : '';
  }

  function werkruimteVan(w, blik) {
    try {
      var root = w && w.document && w.document.getElementById('rtgCommand');
      var second = root && root.__rtgSecondScreen, runtime = second && second.runtime;
      var engine = runtime && runtime.stateEngine;
      if (!engine || typeof engine.get !== 'function') return null;
      var state = engine.get('workspace');
      if (!state || typeof state !== 'object') return null;
      var uit = {}, id = sleutel(state.id, GRENS.werkruimte);
      var modus = MODI.indexOf(state.surface) >= 0 ? state.surface : '';
      var module = sleutel(state.active, GRENS.module);
      var context = blik && blik.velden && blik.velden.context;
      var bron = context && context.waarde && String(context.waarde.bron || '');
      if (id) uit.id = id;
      if (modus) uit.modus = modus;
      /* State alleen is geen bewijs van actuele focus. De levende Edge-context
         moet dezelfde module aanwijzen. */
      if (module && bron === 'workspace.' + module) uit.module = module;
      return Object.keys(uit).length ? uit : null;
    } catch (e) { return null; }
  }

  function assistentVan(w, werkruimte) {
    try {
      var root = w && w.document && w.document.getElementById('rtgCommand');
      var runtime = root && root.__rtgSecondScreen && root.__rtgSecondScreen.runtime;
      if (!runtime || typeof runtime.assistantManifest !== 'function' || !werkruimte || !werkruimte.module) return null;
      var manifest = runtime.assistantManifest(), module = sleutel(manifest && manifest.module, GRENS.module);
      if (!manifest || manifest.status !== 'ready' || !module || module !== werkruimte.module) return null;
      var mogelijkheden = [];
      (Array.isArray(manifest.actions) ? manifest.actions : []).slice(0, 8).forEach(function (actie) {
        var id = String(actie && actie.id || ''), soort = String(actie && actie.kind || '');
        if (ACTIE.test(id) && ASSISTENTSOORTEN.indexOf(soort) >= 0) mogelijkheden.push({ id: id, soort: soort });
      });
      return mogelijkheden.length ? { module: module, mogelijkheden: mogelijkheden } : null;
    } catch (e) { return null; }
  }

  /* Van een blikveld (de uitslag van lees()) naar de context voor Rahul.
     Geeft null als er niets bruikbaars in staat -- dan houdt de aanroeper wat
     hij zelf al had, en zegt deze laag niet dat ze iets zag. */
  function projecteer(blik, werkruimte, assistent) {
    var v = blik && blik.velden;
    if (!v || typeof v !== 'object') return null;
    var context = {}, herkomst = {}, iets = false;

    var w = v.wereld;
    if (w && WERELDEN.indexOf(w.waarde) >= 0) {
      context.wereld = w.waarde; herkomst.wereld = String(w.herkomst || ''); iets = true;
    }
    var c = v.context, cw = c && c.waarde;
    if (cw && TITELBRON.indexOf(c.herkomst) >= 0 && kort(cw.titel, GRENS.deel)) {
      context.deel = kort(cw.titel, GRENS.deel); herkomst.deel = String(c.herkomst); iets = true;
    }
    var o = v.object, ow = o && o.waarde;
    if (ow && ow.id != null && String(ow.id) !== '') {
      context.verwijzingen = [{ soort: woord(ow.soort, GRENS.soort) || 'onbekend', id: kort(ow.id, GRENS.id) }];
      herkomst.verwijzingen = String(o.herkomst || ''); iets = true;
    }
    if (werkruimte && typeof werkruimte === 'object') {
      var ruimte = {}, wid = sleutel(werkruimte.id, GRENS.werkruimte);
      var modus = MODI.indexOf(werkruimte.modus) >= 0 ? werkruimte.modus : '';
      var module = sleutel(werkruimte.module, GRENS.module);
      if (wid) ruimte.id = wid;
      if (modus) ruimte.modus = modus;
      if (module) ruimte.module = module;
      if (Object.keys(ruimte).length) {
        context.werkruimte = ruimte; herkomst.werkruimte = 'workspace-runtime'; iets = true;
      }
    }
    if (assistent && typeof assistent === 'object') {
      var amodule = sleutel(assistent.module, GRENS.module), mogelijkheden = [];
      (Array.isArray(assistent.mogelijkheden) ? assistent.mogelijkheden : []).slice(0, 8).forEach(function (actie) {
        var id = String(actie && actie.id || ''), soort = String(actie && actie.soort || '');
        if (ACTIE.test(id) && ASSISTENTSOORTEN.indexOf(soort) >= 0) mogelijkheden.push({ id: id, soort: soort });
      });
      if (amodule && mogelijkheden.length && context.werkruimte && context.werkruimte.module === amodule) {
        context.assistent = { module: amodule, mogelijkheden: mogelijkheden };
        herkomst.assistent = 'workspace-assistant-manifest'; iets = true;
      }
    }
    return iets ? { context: context, herkomst: herkomst } : null;
  }

  /* Leest het blikveld van dit venster. Zacht: zonder blikveld, of als het
     gooit, is er niets gezien -- en dat is geen fout. */
  function lees(w) {
    var B = w && w.RTGEdgeBlikveld;
    if (!B || typeof B.lees !== 'function') return null;
    try {
      var blik = B.lees(), werkruimte = werkruimteVan(w, blik);
      var uit = projecteer(blik, werkruimte, assistentVan(w, werkruimte));
      if (uit && Number.isFinite && Number.isFinite(blik.op)) uit.context.op = blik.op;
      return uit;
    } catch (e) { return null; }
  }

  return Object.freeze({ projecteer: projecteer, lees: lees, MEE: MEE, NIET_MEE: NIET_MEE,
    WERKRUIMTE_MEE: WERKRUIMTE_MEE, ASSISTENT_MEE: ASSISTENT_MEE });
}));
