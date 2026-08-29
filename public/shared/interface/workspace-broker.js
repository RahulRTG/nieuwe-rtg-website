/* RTG EVENT FABRIC EN ACTION BROKER.

   Events beschrijven uitsluitend wat is gebeurd. Actions vragen om uitvoering
   en lopen eerst door registry, schema, policy, bevestiging, deduplicatie en
   audit. DOM, functies en geheimen passeren deze grens nooit. */
(function (w) {
  'use strict';
  var SDK = w.RTGModuleSDK; if (!SDK) return;
  function kopie(waarde) {
    if (waarde == null) return {};
    var tekst = JSON.stringify(waarde);
    if (tekst.length > 16384) throw new Error('Workspace-bericht is groter dan 16 KB.');
    var uit = JSON.parse(tekst), fout = false;
    (function kijk(x) {
      if (!x || typeof x !== 'object' || fout) return;
      Object.keys(x).forEach(function (k) {
        if (/token|authorization|password|secret|sessie|wachtwoord/i.test(k)) fout = true; else kijk(x[k]);
      });
    })(uit);
    if (fout) throw new Error('Workspace-berichten mogen geen geheimen dragen.'); return uit;
  }
  w.RTGWorkspaceBroker = function (opties) {
    var o = opties || {}, acties = Object.create(null), luisteraars = Object.create(null), pending = Object.create(null), dood = false;
    var registries = o.registries, policy = o.policy;
    function def(id) { return typeof o.definition === 'function' ? o.definition(id) : null; }
    function meld(waar, e) { if (typeof o.error === 'function') o.error(waar, e); }
    function allowed(permission, moduleId) {
      if (!permission) return true;
      try { return policy ? policy.allowed(permission, moduleId) : typeof o.permission !== 'function' || o.permission(permission, moduleId) === true; }
      catch (e) { return false; }
    }
    function eventSchema(type) {
      var bekend = registries && registries.get('event', type);
      if (!bekend && registries) bekend = registries.eventSchema(type, { version: 1 });
      return bekend || { version: 1 };
    }
    function publish(type, data, bron, intern) {
      var definitie = def(bron); if (dood || !SDK.isEvent(type)) return false;
      if (!intern && definitie && definitie.manifest.events.publishes.indexOf(type) < 0)
        throw new Error('Module ' + bron + ' declareert publicatie ' + type + ' niet.');
      var schema = eventSchema(type), actor = policy && policy.actor ? policy.actor() : {};
      var event = { event: type, version: schema.version || 1, source: bron || 'workspace',
        timestamp: new Date().toISOString(), workspaceId: String(o.workspaceId || 'default'),
        actorId: actor && actor.id || null, payload: kopie(data) };
      if (Object.freeze) Object.freeze(event);
      (luisteraars[type] || []).slice().forEach(function (x) {
        try { x.fn(event); } catch (e) { meld('event:' + type + ':' + x.owner, e); }
      });
      if (typeof o.observe === 'function') { try { o.observe(event); } catch (e) { meld('event-observer:' + type, e); } }
      return true;
    }
    function subscribe(owner, type, fn, intern) {
      var definitie = def(owner);
      if (!SDK.isEvent(type) || typeof fn !== 'function') throw new TypeError('Ongeldig workspace-abonnement.');
      if (!intern && definitie && definitie.manifest.events.subscribes.indexOf(type) < 0)
        throw new Error('Module ' + owner + ' declareert abonnement ' + type + ' niet.');
      eventSchema(type); var rij = luisteraars[type] || (luisteraars[type] = []), x = { owner: owner, fn: fn }; rij.push(x);
      return function () { var i = rij.indexOf(x); if (i >= 0) rij.splice(i, 1); };
    }
    function registerAction(owner, actionId, spec) {
      var definitie = def(owner), s = spec || {};
      if (!definitie || definitie.manifest.actions.indexOf(actionId) < 0)
        throw new Error('Module ' + owner + ' declareert actie ' + actionId + ' niet.');
      if (acties[actionId]) throw new Error('Dubbele workspace-actie: ' + actionId);
      if (typeof s.run !== 'function') throw new TypeError('Actie ' + actionId + ' mist run().');
      acties[actionId] = { owner: owner, permission: s.permission || null, confirm: s.confirm || null,
        offline: s.offline === true, idempotent: s.idempotent !== false, audit: s.audit === true,
        validate: s.validate, run: s.run };
      if (registries) registries.registerAction(actionId, owner, s);
    }
    function bevestig(vraag, payload) {
      if (!vraag) return Promise.resolve(true);
      return Promise.resolve(typeof o.confirm === 'function' ? o.confirm(vraag, payload) : w.confirm(String(vraag)));
    }
    function audit(fase, actionId, a, besluit, extra) {
      if (!besluit.auditRequired || typeof o.audit !== 'function') return;
      try { o.audit({ phase: fase, action: actionId, owner: a.owner, actor: besluit.actor && besluit.actor.id || null,
        workspaceId: o.workspaceId || 'default', detail: extra || null, at: new Date().toISOString() }); } catch (e) { meld('audit:' + actionId, e); }
    }
    function run(vrager, actionId, data) {
      var a = acties[actionId], definitie = def(vrager);
      if (!a) return Promise.reject(new Error('Onbekende workspace-actie: ' + actionId));
      if (definitie && a.owner !== vrager && definitie.manifest.invokes.indexOf(actionId) < 0)
        return Promise.reject(new Error('Module ' + vrager + ' mag ' + actionId + ' niet aanroepen.'));
      var payload; try { payload = kopie(data); } catch (e) { return Promise.reject(e); }
      if (typeof a.validate === 'function' && a.validate(payload) !== true)
        return Promise.reject(new TypeError('Input voor ' + actionId + ' voldoet niet aan het actieschema.'));
      var besluit = policy ? policy.decide({ type: 'action', action: actionId, requester: vrager, owner: a.owner,
        permission: a.permission, confirm: a.confirm, offline: a.offline, audit: a.audit, idempotent: a.idempotent, input: payload })
        : { allowed: allowed(a.permission, a.owner), reason: 'permission', confirmationRequired: !!a.confirm,
          auditRequired: a.audit, idempotencyRequired: a.idempotent };
      if (!besluit.allowed) return Promise.reject(new Error('Actie geweigerd: ' + besluit.reason + '.'));
      var key = actionId + ':' + JSON.stringify(payload); if (a.idempotent && pending[key]) return pending[key];
      var werk = bevestig(besluit.confirmationRequired ? a.confirm : null, payload).then(function (ja) {
        if (!ja) return { ok: false, cancelled: true };
        audit('requested', actionId, a, besluit); return Promise.resolve(a.run(payload, besluit)).then(function (resultaat) {
          audit('completed', actionId, a, besluit); publish('workspace.action.completed', { action: actionId, owner: a.owner }, 'workspace', true);
          return resultaat;
        });
      }).catch(function (e) { audit('failed', actionId, a, besluit, String(e && e.message || e)); meld('actie:' + actionId, e); throw e; });
      if (a.idempotent) { pending[key] = werk; werk.then(klaar, klaar); }
      function klaar() { delete pending[key]; }
      return werk;
    }
    return { allowed: allowed, publish: publish, subscribe: subscribe, registerAction: registerAction, run: run,
      destroy: function () { dood = true; acties = Object.create(null); luisteraars = Object.create(null); pending = Object.create(null); } };
  };
})(window);
