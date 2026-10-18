/* Workspace Blueprints zijn declaratief. AI of een beheerder mag een voorstel
   maken; deze validator beslist of het veilig op deze tenant en dit device past. */
(function (w) {
  'use strict';
  var STATES = ['hidden', 'peek', 'panel', 'workspace', 'focus'];
  /* Dit zijn uitsluitend presentaties van bestaande Living Modules. Een
     template is geen rol, entitlement of autorisatiebewijs. Dezelfde
     blueprintvalidator hieronder beslist opnieuw met de actuele serverrechten,
     tenantregels en devicegrenzen of een template beschikbaar is. */
  var TEMPLATES = [
    { id: 'personal', label: 'Persoonlijk', description: 'Profiel, context en berichten dichtbij.', layout: [
      ['navigation', 'panel'], ['profile', 'panel'], ['context', 'panel'], ['messages', 'panel'] ] },
    { id: 'provider', label: 'Uitvoerder', description: 'Eigen werk, zaakcontext en communicatie.', layout: [
      ['navigation', 'panel'], ['work', 'workspace'], ['coordination', 'panel'], ['messages', 'panel'], ['context', 'panel'] ] },
    { id: 'coordinator', label: 'Coördinator', description: 'Zaken, werkruimtes en overdrachten samen.', layout: [
      ['navigation', 'panel'], ['coordination', 'workspace'], ['work', 'workspace'], ['messages', 'panel'], ['context', 'panel'] ] },
    { id: 'manager', label: 'Manager', description: 'Overzicht, uitvoering, contacten en besluiten.', layout: [
      ['navigation', 'panel'], ['dashboard', 'workspace'], ['coordination', 'workspace'], ['work', 'panel'], ['messages', 'panel'], ['contacts', 'panel'] ] },
    { id: 'enterprise', label: 'Enterprise', description: 'Ketenoverzicht met werk, reizen en communicatie.', layout: [
      ['navigation', 'panel'], ['dashboard', 'workspace'], ['coordination', 'workspace'], ['work', 'workspace'],
      ['travel', 'panel'], ['messages', 'panel'], ['contacts', 'panel'] ] }
  ];
  function tekst(v, max) { return String(v || '').trim().slice(0, max); }
  function templateInvoer(spec) {
    return { workspace: spec.label, source: 'rtg-template:' + spec.id,
      layout: spec.layout.map(function (x) { return { module: x[0], state: x[1] }; }) };
  }
  w.RTGWorkspaceBlueprints = function (opties) {
    var o = opties || {};
    function validate(input) {
      var b = input || {}, fouten = [], gezien = Object.create(null), layout = [];
      var naam = tekst(b.workspace || b.name, 80); if (!naam) fouten.push('workspace-naam ontbreekt');
      if (!Array.isArray(b.layout) || !b.layout.length) fouten.push('layout ontbreekt');
      (Array.isArray(b.layout) ? b.layout : []).slice(0, 24).forEach(function (rij, i) {
        var mid = tekst(rij && (rij.module || rij.moduleId), 80), state = tekst(rij && (rij.state || rij.surface), 20);
        var manifest = typeof o.manifest === 'function' ? o.manifest(mid) : null;
        if (!manifest) { fouten.push('regel ' + i + ': onbekende module ' + mid); return; }
        if (gezien[mid]) { fouten.push('regel ' + i + ': module staat dubbel'); return; } gezien[mid] = true;
        if (STATES.indexOf(state) < 0) { fouten.push('regel ' + i + ': ongeldige state'); return; }
        if (state !== 'hidden' && (!manifest.surfaces[state] || manifest.states.indexOf(state) < 0)) {
          fouten.push('regel ' + i + ': surface niet ondersteund'); return;
        }
        // zonder antwoordfunctie is een vereiste permissie niet verleend (zelfde regel als workspace-policy.js)
        if (manifest.permissions.some(function (p) { return typeof o.permission !== 'function' || o.permission(p, mid) !== true; })) {
          fouten.push('regel ' + i + ': niet bevoegd voor ' + mid); return;
        }
        if (typeof o.moduleAllowed === 'function' && o.moduleAllowed(mid) !== true) {
          fouten.push('regel ' + i + ': tenant staat ' + mid + ' niet toe'); return;
        }
        if (typeof o.deviceAllows === 'function' && o.deviceAllows(state, mid) !== true) {
          fouten.push('regel ' + i + ': device ondersteunt deze indeling niet'); return;
        }
        layout.push({ module: mid, state: state });
      });
      if ((b.layout || []).length > 24) fouten.push('layout bevat meer dan 24 modules');
      return { ok: fouten.length === 0, errors: fouten, blueprint: fouten.length ? null : {
        version: 1, workspace: naam, layout: layout, source: tekst(b.source || 'user', 24) } };
    }
    function apply(input) {
      var r = validate(input); if (!r.ok) return r;
      var plan = {}; r.blueprint.layout.forEach(function (x) { plan[x.module] = x.state; });
      if (typeof o.apply === 'function') o.apply(plan, 'workspace-blueprint'); return r;
    }
    function templates() {
      return TEMPLATES.map(function (spec) {
        var r = validate(templateInvoer(spec));
        return { id: spec.id, label: spec.label, description: spec.description, available: r.ok };
      });
    }
    function applyTemplate(id) {
      var key = tekst(id, 32), spec = TEMPLATES.find(function (x) { return x.id === key; });
      if (!spec) return { ok: false, errors: ['onbekende werkruimtetemplate'], blueprint: null };
      return apply(templateInvoer(spec));
    }
    return { validate: validate, apply: apply, templates: templates, applyTemplate: applyTemplate };
  };
})(window);
