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
  function token() { try { return w.localStorage.getItem('rtg_member_token') || ''; } catch (e) { return ''; } }
  function lokaalLees(alle, owner) {
    var box = null;
    try {
      var raw = w.localStorage.getItem(KEY);
      box = raw && raw.length < 20000 ? JSON.parse(raw) : null;
    } catch (e) {}
    return schoon(owner && box && box.owner === owner ? box.workspace : null, alle);
  }
  function lokaalSchrijf(x, owner) {
    if (!owner) return;
    try { w.localStorage.setItem(KEY, JSON.stringify({ owner: owner, workspace: x })); } catch (e) {}
  }
  function eigenaar(t) {
    if (!t || !w.crypto || !w.crypto.subtle || typeof TextEncoder !== 'function') return Promise.resolve('');
    return w.crypto.subtle.digest('SHA-256', new TextEncoder().encode('rtg-workspace:' + t)).then(function (digest) {
      return Array.from(new Uint8Array(digest), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    }).catch(function () { return ''; });
  }
  w.RTGWorkspaceContinuity = function (opties) {
    var o = opties || {}, alle = [], huidig = null, gesynchroniseerd = false, bezig = null, timer = null;
    var gestartMet = token(), owner = '', dood = false, vervallen = false, revision = 0;
    function geldig() {
      if (dood || vervallen) return false;
      if (gestartMet && token() === gestartMet) return true;
      vervallen = true; clearTimeout(timer); timer = null; huidig = schoon(null, alle); return false;
    }
    function meld(x) { if (geldig() && typeof o.onChange === 'function') o.onChange(x); }
    function post(url, body) {
      if (!geldig()) return Promise.reject(new Error('session-changed'));
      return w.fetch(url, { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + gestartMet },
        body: JSON.stringify(body || {}) }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!geldig()) throw new Error('session-changed');
          if (!r.ok) throw new Error(j.error || 'sync-failed'); return j;
        });
      });
    }
    var gebonden = eigenaar(gestartMet).then(function (ref) {
      if (!geldig()) return;
      owner = ref;
      // Oude ongebonden indelingen hebben geen aantoonbare eigenaar.
      try { w.localStorage.removeItem(OUD); } catch (e) {}
      if (revision) lokaalSchrijf(huidig, owner);
      else { var lokaal = lokaalLees(alle, owner); if (lokaal.updatedAt) { huidig = lokaal; meld(huidig); } }
    });
    function load(beschikbaar) { alle = ids(beschikbaar); huidig = schoon(null, alle); return huidig; }
    function bewaar(x, alleenLokaal) {
      if (!geldig()) return schoon(null, alle);
      revision += 1; huidig = schoon(x, alle); huidig.updatedAt = new Date().toISOString();
      lokaalSchrijf(huidig, owner);
      if (alleenLokaal || !gesynchroniseerd) return huidig;
      clearTimeout(timer); timer = setTimeout(function () {
        if (!geldig()) return;
        var verzonden = revision;
        post('/api/ik/workspace/zet', { workspace: huidig }).then(function (j) {
          if (geldig() && revision === verzonden && j.workspace) {
            huidig = schoon(j.workspace, alle); lokaalSchrijf(huidig, owner);
          }
        }).catch(function () { /* het eigen lokale concept blijft beschikbaar */ });
      }, 250);
      return huidig;
    }
    function sync(beschikbaar) {
      alle = ids(beschikbaar || alle); if (bezig) return bezig;
      var gelezen;
      bezig = gebonden.then(function () {
        gelezen = revision; return post('/api/ik/workspace', {});
      }).then(function (j) {
        if (!geldig()) return schoon(null, alle);
        gesynchroniseerd = true;
        var server = schoon(j.workspace, alle), local = schoon(huidig, alle);
        var s = Date.parse(server.updatedAt || '') || 0, l = Date.parse(local.updatedAt || '') || 0;
        var lokaalWint = revision !== gelezen || l > s || !server.updatedAt;
        huidig = lokaalWint ? local : server; lokaalSchrijf(huidig, owner);
        if (lokaalWint && local.updatedAt) bewaar(local, false);
        meld(huidig); return huidig;
      }).catch(function () { return geldig() ? huidig : schoon(null, alle); }).finally(function () { bezig = null; });
      return bezig;
    }
    function changed() { if (!geldig() && typeof o.onChange === 'function') o.onChange(schoon(null, alle)); }
    if (w.addEventListener) w.addEventListener('storage', changed);
    function destroy() {
      dood = true; clearTimeout(timer); timer = null;
      if (w.removeEventListener) w.removeEventListener('storage', changed);
    }
    return { load: load, save: bewaar, sync: sync,
      current: function () { return geldig() ? huidig : schoon(null, alle); }, destroy: destroy };
  };
})(window);
