/* De declaratieve catalogi onder de Workspace Runtime. Registries kennen het
   contract; zij voeren nooit zelf domeinwerk uit. */
(function (w) {
  'use strict';
  function bevries(x) { return Object.freeze ? Object.freeze(x) : x; }
  function kopie(x) { return JSON.parse(JSON.stringify(x)); }
  w.RTGWorkspaceRegistries = function () {
    var modules = Object.create(null), capabilities = Object.create(null), services = Object.create(null);
    var permissions = Object.create(null), worlds = Object.create(null);
    var events = Object.create(null), actions = Object.create(null);
    function claim(bak, id, owner, extra, meervoudig) {
      var bestaand = bak[id];
      if (bestaand && !meervoudig && bestaand.owner !== owner) throw new Error(id + ' is al van ' + bestaand.owner + '.');
      if (!bestaand) bak[id] = { id: id, owner: owner, owners: [owner] };
      else if (bestaand.owners.indexOf(owner) < 0) bestaand.owners.push(owner);
      Object.keys(extra || {}).forEach(function (k) { bak[id][k] = extra[k]; });
      return bak[id];
    }
    function registerManifest(m) {
      if (!m || modules[m.id]) throw new Error('Modulemanifest ontbreekt of is dubbel.');
      modules[m.id] = m;
      m.capabilities.forEach(function (id) { claim(capabilities, id, m.id, {}, true); });
      m.services.forEach(function (id) { claim(services, id, m.id, {}, true); });
      m.permissions.forEach(function (id) { claim(permissions, id, m.id, {}, true); });
      m.events.publishes.forEach(function (id) { claim(events, id, m.id, { publishers: (events[id] && events[id].publishers || []).concat([m.id]) }, true); });
      m.events.subscribes.forEach(function (id) { claim(events, id, m.id, { subscribers: (events[id] && events[id].subscribers || []).concat([m.id]) }, true); });
      m.actions.forEach(function (id) { claim(actions, id, m.id, { declared: true }, false); });
      return m;
    }
    function registerWorldCatalog(catalog) {
      (Array.isArray(catalog) ? catalog : []).forEach(function (world) {
        var wid = String(world.id || ''); if (!/^[a-z][a-z0-9-]*$/.test(wid) || worlds[wid]) throw new Error('Ongeldige of dubbele wereld: ' + wid);
        var copy = { id: wid, name: String(world.name || wid), home: String(world.home || ''), kind: world.kind === 'core' ? 'core' : 'world', items: [] };
        (Array.isArray(world.items) ? world.items : []).forEach(function (item) {
          var iid = String(item.id || ''), match = /^(link|tab|os):([a-z][a-z0-9-]*)$/.exec(iid);
          if (!match || !/^L[0-4]$/.test(String(item.maturity || ''))) throw new Error('Ongeldige wereldfunctie: ' + iid);
          var cap = 'world.' + wid + '.' + match[1] + '.' + match[2], meta = { world: wid, kind: match[1], key: match[2],
            name: String(item.name || iid), url: item.url || null, maturity: item.maturity, module: item.module || null };
          claim(capabilities, cap, 'world.' + wid, meta, false); copy.items.push(Object.assign({ capability: cap, id: iid }, meta));
        });
        worlds[wid] = copy;
      });
      return worldCatalog();
    }
    function worldCatalog() { return kopie(Object.keys(worlds).map(function (id) { return worlds[id]; })); }
    function registerAction(id, owner, spec) {
      var a = actions[id];
      if (!a || a.owner !== owner) throw new Error('Actie ' + id + ' is niet door ' + owner + ' gedeclareerd.');
      if (a.registered) throw new Error('Dubbele actie-implementatie: ' + id);
      a.registered = true; a.permission = spec.permission || null; a.confirm = !!spec.confirm;
      a.offline = spec.offline === true; a.idempotent = spec.idempotent !== false; a.audit = spec.audit === true;
      a.inputSchema = String(spec.inputSchema || id + '.input.v1'); return a;
    }
    function eventSchema(id, spec) {
      if (!events[id]) events[id] = { id: id, owner: 'workspace', owners: ['workspace'] };
      var e = events[id]; e.version = Math.max(1, Math.floor(Number(spec && spec.version) || 1));
      e.schema = String(spec && spec.schema || id + '.payload.v' + e.version); return e;
    }
    function get(soort, id) {
      var bakken = { module: modules, capability: capabilities, service: services, permission: permissions, event: events, action: actions };
      return bakken[soort] && bakken[soort][id] || null;
    }
    function snapshot() {
      return bevries(kopie({ modules: modules, capabilities: capabilities, services: services,
        permissions: permissions, events: events, actions: actions, worlds: worlds }));
    }
    return { registerManifest: registerManifest, registerWorldCatalog: registerWorldCatalog, worldCatalog: worldCatalog,
      registerAction: registerAction, eventSchema: eventSchema, get: get, snapshot: snapshot };
  };
})(window);
