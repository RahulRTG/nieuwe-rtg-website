/* Connection Edge rendert serverprojecties in de bestaande fysieke Edge. De
   productschil voert een geprojecteerde tik uit; deze laag kent geen domeinregel. */
(function (g, fabriek) {
  'use strict';
  var kern = typeof module === 'object' && module.exports ? require('./connection-edge-core.js') : g && g.RTGConnectionEdgeCore;
  var invoer = typeof module === 'object' && module.exports ? require('./connection-edge-input.js') : g && g.RTGConnectionEdgeInput;
  var api = kern && invoer && fabriek(kern, invoer);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (g && g.document && api) g.RTGConnectionEdge = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (kern, invoer) {
  'use strict';
  function maak(opties) {
    var o = opties || {}, d = o.document || (typeof document !== 'undefined' ? document : null);
    var w = o.window || (typeof window !== 'undefined' ? window : null);
    if (!d || !w || !['vonk', 'rendezvous'].includes(o.product) || typeof o.load !== 'function') return null;
    var ingebed = false;
    try { ingebed = w.self !== w.top || new URLSearchParams(w.location.search).get('embed') === '1'; } catch (e) { ingebed = true; }
    var staat = { product:o.product, huidig:'root', context:{ kind:'root' }, model:null, root:null,
      kind:null, kindContext:null, gekozen:'', teller:0, weg:false, sleutel:'' };
    var host = d.createElement('div'); host.className = 'connection-edge connection-edge--' + o.product + (ingebed ? ' is-embedded' : ''); host.hidden = true;
    host.setAttribute('role', 'navigation');
    host.setAttribute('aria-label', o.product === 'vonk' ? 'Vonk bediening' : 'Rendez-vous bediening');
    host.setAttribute('data-i18n-aria', 'connection.edge.label.' + o.product);
    var kop = d.createElement('div'); kop.className = 'connection-edge__context'; kop.setAttribute('aria-hidden', 'true');
    var rail = d.createElement('div'); rail.className = 'connection-edge__rail'; rail.setAttribute('role', 'toolbar');
    var status = d.createElement('span'); status.className = 'connection-edge__status'; status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite'); status.setAttribute('aria-atomic', 'true');
    host.appendChild(kop); host.appendChild(rail);
    /* Geen capability: de vaste systeemuitgang die de buitenste embed al bezit. */
    if (!ingebed) {
      var uitgang = d.createElement('a'); uitgang.className = 'connection-edge__exit';
      uitgang.href = '/apps/app.html'; uitgang.setAttribute('data-rtg-safe-exit', '');
      uitgang.setAttribute('aria-label', 'Terug naar RTG'); uitgang.textContent = 'RTG';
      host.appendChild(uitgang);
    }
    host.appendChild(status); d.body.appendChild(host);
    d.body.setAttribute(ingebed ? 'data-connection-edge-embedded' : 'data-connection-edge', o.product);
    var plaatser = null, valTerug = w.setTimeout(function () { host.hidden = !staat.model; }, 1800);
    function plaats() {
      var adaptief = ingebed ? null : d.querySelector('.rtg-adaptive-edge');
      var voet = ingebed ? d.querySelector('#tabs.dating-tabs') : adaptief || d.querySelector('.rtg-edge-bottom'); if (!voet) return false;
      var vorige = host.parentElement;
      if (vorige && vorige !== voet) vorige.classList.remove('connection-edge-owner');
      if (host.parentNode !== voet) voet.appendChild(host);
      if (ingebed) voet.hidden = false;
      else voet.classList.add('connection-edge-owner');
      host.hidden = !staat.model;
      if ((ingebed || adaptief) && plaatser) { plaatser.disconnect(); plaatser = null; }
      if (ingebed || adaptief) w.clearTimeout(valTerug);
      return true;
    }
    var eerstePlaats = plaats();
    if ((!eerstePlaats || (!ingebed && !d.querySelector('.rtg-adaptive-edge'))) && w.MutationObserver) {
      plaatser = new w.MutationObserver(plaats); plaatser.observe(d.body, { childList:true, subtree:true });
    }
    function tekst(actie) {
      var bron = kern.LABELS[actie.id] || actie.id.replace(/_/g, ' ');
      return w.RTGi18n && w.RTGi18n.t ? w.RTGi18n.t(actie.labelKey, bron) : bron;
    }
    function spreek(zin) { status.textContent = ''; w.setTimeout(function () { status.textContent = zin; }, 20); }
    function teken() {
      var actief = d.activeElement && d.activeElement.getAttribute && d.activeElement.getAttribute('data-connection-action');
      rail.replaceChildren(); var model = staat.model;
      if (!model || !model.actions.length) { host.hidden = true; return; }
      host.hidden = false; host.setAttribute('data-surface', model.surface); host.setAttribute('data-state', model.state);
      kop.textContent = staat.huidig === 'child' ? (staat.context.label || model.state) : (o.product === 'vonk' ? 'Vonk' : 'Rendez-vous');
      model.actions.forEach(function (actie, index) {
        var b = d.createElement('button'); b.type = 'button'; b.className = 'connection-edge__action';
        b.setAttribute('data-connection-action', actie.id); b.setAttribute('data-capability', actie.capability);
        b.setAttribute('data-i18n', actie.labelKey); b.setAttribute('data-i18n-source', kern.LABELS[actie.id] || actie.id);
        b.setAttribute('aria-current', staat.gekozen === actie.id ? 'page' : 'false');
        b.tabIndex = index === 0 || staat.gekozen === actie.id ? 0 : -1;
        var merk = d.createElement('span'); merk.className = 'connection-edge__mark'; merk.setAttribute('aria-hidden', 'true');
        var label = d.createElement('span'); label.className = 'connection-edge__label'; label.textContent = tekst(actie);
        b.appendChild(merk); b.appendChild(label); rail.appendChild(b);
      });
      var terug = actief && rail.querySelector('[data-connection-action="' + CSS.escape(actief) + '"]');
      if (terug) terug.focus({ preventScroll:true });
    }
    function meldFout(fout) {
      if (typeof o.onError === 'function') o.onError(fout);
      else spreek(fout && fout.message ? fout.message : 'De actuele bediening kon niet worden geladen.');
    }
    async function laad(context, soort, forceer) {
      if (staat.weg) return null;
      var ctx = context || { kind:'root' }, sleutel = String(ctx.kind || 'root') + ':' + String(ctx.id || '');
      if (!forceer && soort === staat.huidig && staat.model && staat.sleutel === sleutel) { teken(); return staat.model; }
      var beurt = ++staat.teller;
      try {
        var model = kern.viewModel(o.product, await o.load(ctx));
        if (beurt !== staat.teller || !model) return null;
        staat.huidig = soort; staat.context = ctx; staat.model = model; staat.sleutel = sleutel;
        if (soort === 'root') staat.root = { model:model, context:ctx };
        else { staat.kind = { model:model, context:ctx }; staat.kindContext = ctx; }
        teken(); return model;
      } catch (fout) {
        if (beurt !== staat.teller) return null;
        if (soort === 'child' && staat.root) { staat.huidig = 'root'; staat.context = staat.root.context;
          staat.model = staat.root.model; staat.sleutel = 'root:'; teken(); }
        else { staat.model = null; teken(); }
        meldFout(fout); return null;
      }
    }
    async function voerUit(actie) {
      if (!staat.model || !staat.model.actions.some(function (x) { return x.id === actie.id; })) return;
      invoer.haptic(w);
      try { if (typeof o.onAction === 'function') await o.onAction({ action:actie, context:staat.context,
        projection:staat.model, refresh:ververs }); }
      catch (fout) { if (kern.shouldReconcile(fout)) { spreek('De bediening is bijgewerkt.'); await ververs(true); }
        else meldFout(fout); }
    }
    function klik(event) {
      var b = event.target.closest('[data-connection-action]'); if (!b || !rail.contains(b)) return;
      var actie = staat.model && staat.model.actions.find(function (x) { return x.id === b.dataset.connectionAction; });
      if (actie) voerUit(actie);
    }
    rail.addEventListener('click', klik);
    function ververs(forceer) { return laad(staat.context, staat.huidig, forceer !== false); }
    function naarRoot() { return laad({ kind:'root' }, 'root', true); }
    function openLaag(context) { return laad(context, 'child', false); }
    var ruimToets = invoer.bindKeyboard(rail, d, { layer:function () { return staat.huidig; } }, naarRoot);
    var ruimHaal = invoer.bindSwipe(host, w, { layer:function () { return staat.huidig; },
      hasChild:function () { return !!staat.kindContext; } }, naarRoot, function () { openLaag(staat.kindContext); });
    var ruimScroll = invoer.bindScroll(host, w);
    function gekozen(id) { staat.gekozen = String(id || ''); teken(); }
    function revision(id) { return staat.huidig === 'child' && (!id || String(staat.context.id) === String(id))
      ? staat.model && staat.model.stateRevision : ''; }
    function clear() { staat.model = null; host.hidden = true; rail.replaceChildren(); }
    function bijZicht() { if (!d.hidden) ververs(true); }
    d.addEventListener('visibilitychange', bijZicht); w.addEventListener('focus', bijZicht);
    var peil = w.setInterval(function () { if (!d.hidden && staat.model) ververs(true); }, 3500);
    return Object.freeze({ setRoot:naarRoot, openLayer:openLaag, refresh:ververs, select:gekozen, revision:revision,
      clear:clear, inspect:function () { return { embedded:ingebed, layer:staat.huidig, context:staat.context, projection:staat.model }; },
      destroy:function () { staat.weg = true; w.clearInterval(peil); w.clearTimeout(valTerug); ruimToets(); ruimHaal(); ruimScroll();
        rail.removeEventListener('click', klik); w.removeEventListener('focus', bijZicht); d.removeEventListener('visibilitychange', bijZicht);
        if (plaatser) plaatser.disconnect(); var voet = host.closest('.rtg-edge-bottom,.rtg-adaptive-edge');
        if (voet) voet.classList.remove('connection-edge-owner'); host.remove(); d.body.removeAttribute('data-connection-edge');
        d.body.removeAttribute('data-connection-edge-embedded'); }
    });
  }
  return Object.freeze({ LABELS:kern.LABELS, viewModel:kern.viewModel, shouldReconcile:kern.shouldReconcile,
    layerAfterSwipe:kern.layerAfterSwipe, create:maak });
}));
