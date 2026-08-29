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
    function draw(nextState, isEditing) {
      state = nextState || state; editing = isEditing === true;
      o.list.textContent = ''; o.editorList.textContent = '';
      layout.order = runtime.mount(o.list, layout.order);
      var manifests = runtime.manifests();
      layout.order.forEach(function (id) {
        var hidden = layout.hidden.indexOf(id) >= 0; runtime.setHidden(id, hidden);
        var m = manifests.find(function (x) { return x.id === id; }); if (!m) return;
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
      var t = layout.order[j]; layout.order[j] = id; layout.order[i] = t; save(); draw(state, editing);
    }
    function hide(id, aan) {
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
