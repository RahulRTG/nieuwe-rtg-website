/* Persoonlijke compositie van Adaptive Workspace. Deze laag kent uitsluitend
   ids, volgorde, zichtbaarheid en dichtheid; de modules en hun data niet. */
(function (w) {
  'use strict';
  w.RTGWorkspaceComposer = function (opties) {
    var o = opties || {}, runtime = o.runtime, state = 'peek', editing = false;
    var continuity, layout, syncBegonnen = false;
    continuity = w.RTGWorkspaceContinuity({ onChange: function (x) {
      if (!x) return; layout = x; draw(state, editing); if (o.onChange) o.onChange(x);
    } });
    layout = continuity.load(runtime.ids());
    if (!layout.updatedAt) runtime.manifests().forEach(function (m) {
      if (m.defaultHidden && layout.hidden.indexOf(m.id) < 0) layout.hidden.push(m.id);
    });
    function save() {
      layout.active = runtime.active(); layout = continuity.save(layout);
      o.root.dataset.rtgDensity = layout.density; return layout;
    }
    /* VASTE MODULES STAAN VOORAAN EN BLIJVEN STAAN. Het manifest zegt `pinned`
       (module-sdk.js); de werelden zijn er een, want op een telefoon is deze
       ruimte de bank en de bank draagt de werelden bovenaan (WERELD.md). Een
       opgeslagen indeling van voor deze regel kan ze ergens anders of verborgen
       hebben; dat wordt hier stil rechtgezet, want een lid dat de werelden kwijt
       is heeft geen knop om ze terug te halen. */
    function vast(id) {
      var m = runtime.manifests().find(function (x) { return x.id === id; }); return !!(m && m.pinned);
    }
    function vastVooraan(order) {
      var voor = order.filter(vast), rest = order.filter(function (id) { return !vast(id); });
      return voor.concat(rest);
    }
    function draw(nextState, isEditing) {
      state = nextState || state; editing = isEditing === true;
      o.list.textContent = ''; o.editorList.textContent = '';
      layout.hidden = layout.hidden.filter(function (id) { return !vast(id); });
      layout.order = runtime.mount(o.list, vastVooraan(layout.order));
      var manifests = runtime.manifests();
      layout.order.forEach(function (id) {
        var hidden = layout.hidden.indexOf(id) >= 0; runtime.setHidden(id, hidden);
        var m = manifests.find(function (x) { return x.id === id; }); if (!m) return;
        if (m.pinned) {
          /* Geen grijze knop zonder uitleg (GRAMMATICA.md): de rij zegt waarom
             hier niets te kiezen valt. */
          var vastRij = document.createElement('p'); vastRij.className = 'rtg-ss-vast';
          vastRij.textContent = m.title + ' staat vast: de werelden horen bovenaan de bank.';
          o.editorList.appendChild(vastRij); return;
        }
        var b = document.createElement('button'); b.type = 'button';
        b.textContent = m.title + (hidden ? ' toevoegen' : ' verbergen');
        b.dataset.ssAction = hidden ? 'show' : 'hide'; b.dataset.ssModuleId = id;
        o.editorList.appendChild(b);
      });
      o.bank.toggleAttribute('data-ss-editing', editing); o.editor.hidden = !editing;
      o.root.dataset.rtgDensity = layout.density; runtime.setState(state, layout.active);
      o.density.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-pressed', b.dataset.ssAction === 'density-' + layout.density ? 'true' : 'false');
      });
    }
    function move(id, richting) {
      var i = layout.order.indexOf(id), j = i + richting; if (i < 0 || j < 0 || j >= layout.order.length) return;
      if (vast(id) || vast(layout.order[j])) return;   // een vaste module verschuift niet, en niets schuift eroverheen
      var t = layout.order[j]; layout.order[j] = id; layout.order[i] = t; save(); draw(state, editing);
    }
    function hide(id, aan) {
      if (aan && vast(id)) return;                      // de werelden zijn niet weg te zetten (WERELD.md)
      var i = layout.hidden.indexOf(id); if (aan && i < 0) layout.hidden.push(id); if (!aan && i >= 0) layout.hidden.splice(i, 1);
      if (aan && layout.active === id) layout.active = null; save(); draw(state, editing);
    }
    function activeOrFirst() {
      var a = runtime.active(); if (a && layout.hidden.indexOf(a) < 0) return a;
      return layout.order.find(function (id) { return layout.hidden.indexOf(id) < 0; }) || null;
    }
    function blueprint(input) {
      var r = runtime.applyBlueprint(input); if (!r || !r.ok) return r;
      var rijen = r.blueprint.layout, gekozen = rijen.map(function (x) { return x.module; });
      runtime.ids().forEach(function (id) { if (gekozen.indexOf(id) < 0) gekozen.push(id); });
      layout.order = gekozen; layout.hidden = rijen.filter(function (x) { return x.state === 'hidden'; }).map(function (x) { return x.module; });
      runtime.ids().forEach(function (id) { if (!rijen.some(function (x) { return x.module === id; }) && layout.hidden.indexOf(id) < 0) layout.hidden.push(id); });
      var focus = rijen.find(function (x) { return x.state === 'focus'; });
      var eerste = rijen.find(function (x) { return x.state !== 'hidden'; });
      layout.active = focus ? focus.module : eerste ? eerste.module : null;
      save(); draw(state, editing); return r;
    }
    return {
      draw: draw, save: save, move: move, hide: hide,
      setDensity: function (x) { layout.density = x === 'compact' ? 'compact' : 'comfortable'; save(); draw(state, editing); },
      setActive: function (id, bewaren) { layout.active = id || null; if (id) runtime.setActive(id); if (bewaren) save(); return layout.active; },
      active: function () { return layout.active || runtime.active(); }, activeOrFirst: activeOrFirst, applyBlueprint: blueprint,
      sync: function () { if (syncBegonnen) return Promise.resolve(layout); syncBegonnen = true; return continuity.sync(runtime.ids()); },
      destroy: function () { continuity.destroy(); }
    };
  };
})(window);
