/* RTG WORKSPACE CONTINUITY.

   Alleen compositie reist mee: modulevolgorde, zichtbaarheid, actieve module en
   dichtheid. Geen formulierinhoud, tokens, berichten of brondata. Lokaal is de
   snelle start; een accountkopie maakt dezelfde ruimte op een ander toestel. */
(function (w) {
  'use strict';
  var KEY = 'rtg.interface.workspace.v2', OUD = 'rtg.interface.second-screen.v1';

  function ids(lijst) {
    var gezien = Object.create(null), uit = [];
    (Array.isArray(lijst) ? lijst : []).forEach(function (id) {
      id = String(id || '');
      if (/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(id) && !gezien[id] && uit.length < 40) {
        gezien[id] = true; uit.push(id);
      }
    });
    return uit;
  }
  function schoon(invoer, beschikbaar) {
    var x = invoer || {}, alle = ids(beschikbaar), order = ids(x.order);
    order = order.filter(function (id) { return alle.indexOf(id) >= 0; });
    alle.forEach(function (id) { if (order.indexOf(id) < 0) order.push(id); });
    var hidden = ids(x.hidden).filter(function (id) { return order.indexOf(id) >= 0; });
    var active = order.indexOf(x.active) >= 0 && hidden.indexOf(x.active) < 0 ? x.active : null;
    return { version: 2, order: order, hidden: hidden, active: active,
      density: x.density === 'compact' ? 'compact' : 'comfortable',
      updatedAt: /^\d{4}-\d\d-\d\dT/.test(String(x.updatedAt || '')) ? x.updatedAt : null };
  }
  function lokaalLees(alle) {
    var waarde = null;
    try { waarde = JSON.parse(w.localStorage.getItem(KEY) || 'null'); } catch (e) {}
    if (!waarde) {
      try { waarde = JSON.parse(w.localStorage.getItem(OUD) || 'null'); } catch (e) {}
    }
    return schoon(waarde, alle);
  }
  function lokaalSchrijf(x) {
    try { w.localStorage.setItem(KEY, JSON.stringify(x)); } catch (e) {}
  }
  function token() { try { return w.localStorage.getItem('rtg_member_token') || ''; } catch (e) { return ''; } }
  function post(url, body) {
    var t = token(); if (!t) return Promise.reject(new Error('signed-out'));
    return w.fetch(url, { method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
      body: JSON.stringify(body || {}) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.error || 'sync-failed'); return j;
      });
    });
  }

  w.RTGWorkspaceContinuity = function (opties) {
    var o = opties || {}, alle = [], huidig = null, gesynchroniseerd = false, bezig = null, timer = null;
    function meld(x) { if (typeof o.onChange === 'function') o.onChange(x); }
    function load(beschikbaar) { alle = ids(beschikbaar); huidig = lokaalLees(alle); return huidig; }
    function bewaar(x, alleenLokaal) {
      huidig = schoon(x, alle); huidig.updatedAt = new Date().toISOString(); lokaalSchrijf(huidig);
      if (alleenLokaal || !gesynchroniseerd) return huidig;
      clearTimeout(timer); timer = setTimeout(function () {
        post('/api/ik/workspace/zet', { workspace: huidig }).then(function (j) {
          if (j.workspace) { huidig = schoon(j.workspace, alle); lokaalSchrijf(huidig); }
        }).catch(function () { /* lokaal blijft de waarheid tot de volgende verbinding */ });
      }, 250);
      return huidig;
    }
    function sync(beschikbaar) {
      alle = ids(beschikbaar || alle); if (bezig) return bezig;
      bezig = post('/api/ik/workspace', {}).then(function (j) {
        gesynchroniseerd = true;
        var server = schoon(j.workspace, alle), local = schoon(huidig || lokaalLees(alle), alle);
        var s = Date.parse(server.updatedAt || 0), l = Date.parse(local.updatedAt || 0);
        huidig = s > l ? server : local; lokaalSchrijf(huidig);
        if (l > s && local.updatedAt) bewaar(local, false);
        meld(huidig); return huidig;
      }).catch(function () { return huidig || lokaalLees(alle); }).finally(function () { bezig = null; });
      return bezig;
    }
    function destroy() { clearTimeout(timer); timer = null; }
    return { load: load, save: bewaar, sync: sync, current: function () { return huidig; }, destroy: destroy };
  };
})(window);
