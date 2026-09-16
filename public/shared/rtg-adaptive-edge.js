(function (w, d) {
  'use strict';
  if (w.RTGAdaptiveEdge) return;
  var K = w.RTGAdaptiveEdgeCore, Input = w.RTGAdaptiveEdgeInput, rt = null;
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }
  function icon(name) {
    var paths = w.RTGEdgeIcons || {};
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (paths[name] || paths.spark || '') + '</svg>';
  }
  function lips() {
    return '<svg class="rtg-adaptive-lips" viewBox="0 0 100 58" aria-hidden="true"><path d="M3 31C20 26 31 6 49 17C67 5 79 26 97 31C79 52 66 57 49 47C32 57 19 52 3 31Z"/><path d="M13 31C29 34 39 29 49 29C61 29 71 34 87 31"/></svg>';
  }
  function button(spec, slot) {
    var b = d.createElement('button');
    b.type = 'button'; b.className = 'rtg-adaptive-item';
    b.dataset.rtgAdaptiveSlot = String(slot); b.dataset.rtgAdaptiveAction = spec[0];
    b.setAttribute('aria-label', spec[1]);
    b.innerHTML = (spec[0] === 'ai' ? lips() : icon(spec[3])) + '<small>' + esc(spec[2] || spec[1]) + '</small>';
    b.addEventListener('click', function () { execute(spec[0]); });
    return b;
  }
  function legacy(selector) {
    var node = rt.edge.root.querySelector(selector);
    if (node) { node.click(); return true; }
    return false;
  }
  function execute(action) {
    if (rt.edge.onEdgeAction && rt.edge.onEdgeAction(action) === true) return true;
    if (action === 'context' || action === 'primary' || (action === 'ai' && d.querySelector('#rtgCommand .cmd-vraagvorm,#rvRahul'))) {
      setDeck(action === 'ai' ? 'rahul' : 'actions');
      Input.prepare(rt, action); setState('expanded'); return true;
    }
    setState('dock');
    var custom = rt.model.registry[action];
    if (custom && custom.run) { if (K.allowed(custom)) { custom.run(); return true; } return false; }
    if (action === 'home') { w.location.href = rt.edge.cfg.home; return true; }
    if (action === 'back') { w.history.back(); return true; }
    if (action === 'worlds') return legacy('.rtg-edge-worlds-trigger');
    if (action === 'menu') return legacy('.rtg-edge-menu');
    if (action === 'status') return legacy('.rtg-edge-state');
    if (action === 'ai') return legacy('.rtg-edge-ai');
    if (action === 'presence') return rt.model.presence && rt.model.presence.action ? execute(rt.model.presence.action) : false;
    if (action === 'connect') {
      var event = new w.CustomEvent('rtg-adaptive-connect', { bubbles: true, cancelable: true });
      return rt.host.dispatchEvent(event) ? legacy('.rtg-edge-menu') : true;
    }
    return false;
  }
  function renderSheet() {
    if (rt.customPanel) return;
    var items = K.actions(rt.model), continuation = rt.model.continuation;
    rt.sheetTitle.textContent = continuation && continuation.title || rt.edge.ctx.title || d.title || 'Wat wilt u doen?';
    rt.sheetCopy.textContent = continuation && continuation.copy || 'Wat wilt u doen?';
    rt.sheetList.textContent = '';
    items.forEach(function (item) {
      var b = d.createElement('button'); b.type = 'button'; b.className = 'rtg-adaptive-sheet-action';
      b.dataset.rtgAdaptiveAction = item.id; b.textContent = item.label;
      b.addEventListener('click', function () { execute(item.id); }); rt.sheetList.appendChild(b);
    });
    if (!items.length) {
      var empty = d.createElement('p'); empty.className = 'rtg-adaptive-empty';
      empty.textContent = 'Voor deze context zijn geen veilige acties beschikbaar.'; rt.sheetList.appendChild(empty);
    }
    if (rt.renderControls) rt.renderControls();
  }
  function renderDeck() {
    rt.bar.textContent = '';
    K.SPECS[rt.model.deck].forEach(function (spec, index) { rt.bar.appendChild(button(spec, index)); });
    rt.host.dataset.rtgAdaptiveDeck = rt.model.deck;
    rt.caption.textContent = rt.model.deck === 'home' ? rt.edge.cfg.kaart || 'Home' :
      ({ context: 'Context', actions: 'Acties', connect: 'Connect', rahul: 'Rahul' })[rt.model.deck];
    rt.bar.children[2].setAttribute('aria-current', rt.model.deck === 'rahul' ? 'page' : 'false');
    renderSheet();
  }
  function setState(state, source) {
    if (!rt) return false;
    if (state !== 'expanded') { closePanel(); Input.closeContext(rt); }
    rt.model.state = K.normState(state); rt.host.dataset.rtgAdaptiveState = rt.model.state;
    d.body.dataset.rtgAdaptiveState = rt.model.state; rt.sheet.hidden = rt.model.state !== 'expanded';
    rt.sheet.setAttribute('aria-hidden', String(rt.model.state !== 'expanded'));
    rt.caption.hidden = rt.model.state === 'peek';
    if (rt.model.state === 'expanded') renderSheet();
    if (source !== 'auto') rt.manual = rt.model.state === 'deck' || rt.model.state === 'expanded';
    return true;
  }
  function setDeck(deck) {
    if (!rt) return false;
    closePanel();
    rt.model.deck = K.normDeck(deck); renderDeck(); setState('deck'); Input.haptic(w); return true;
  }
  function closePanel() { Input.closePanel(rt); }
  function openPanel(node, options) { return Input.openPanel(rt, node, options, setState); }
  function registerAction(item) { var ok = rt && K.register(rt.model, item); if (ok) renderSheet(); return !!ok; }
  function setProjection(input) {
    if (!rt) return false;
    var deck = K.setProjection(rt.model, input); if (!deck) return false;
    if (input.open) { rt.model.deck = deck; renderDeck(); setState('expanded'); }
    else if (deck === rt.model.deck) renderSheet(); return true;
  }
  function setPresence(input) {
    if (!rt) return false;
    rt.model.presence = input && input.label ? { label: String(input.label).slice(0, 100), action: input.action || null } : null;
    rt.presenceButton.hidden = !rt.model.presence;
    rt.presenceText.textContent = rt.model.presence ? rt.model.presence.label : ''; return true;
  }
  function setIdentity(input) {
    if (!rt) return false;
    var person = String(input && input.person || 'U').slice(0, 40), acting = String(input && input.actingFor || '').slice(0, 50);
    rt.model.identity = acting ? person + ' → ' + acting : null;
    rt.identity.textContent = rt.model.identity || ''; rt.identity.hidden = !rt.model.identity; return true;
  }
  function continueWith(input) {
    if (!rt) return false;
    rt.model.continuation = input && input.title ? { title: String(input.title).slice(0, 100), copy: String(input.copy || '').slice(0, 180) } : null;
    if (input && input.presence) setPresence({ label: input.presence, action: input.action });
    renderSheet(); return true;
  }
  function build() {
    var host = d.createElement('section'); host.className = 'rtg-adaptive-edge'; host.setAttribute('aria-label', 'RTG Adaptive Edge');
    host.innerHTML = '<button class="rtg-adaptive-presence" type="button" hidden><i></i><span></span></button><div class="rtg-adaptive-identity" hidden></div>' +
      '<section class="rtg-adaptive-sheet" hidden aria-hidden="true"><div class="rtg-adaptive-sheet-head"><div><small>VEILIGE VOLGENDE STAP</small><h2></h2><p></p></div><button type="button" data-rtg-adaptive-close aria-label="Sluiten">×</button></div><div class="rtg-adaptive-sheet-list"></div></section>' +
      '<div class="rtg-adaptive-caption"></div><nav class="rtg-adaptive-bar" aria-label="Home, Context, Acties, Connect en Rahul"></nav>';
    rt.edge.root.appendChild(host); rt.host = host; rt.bar = host.querySelector('.rtg-adaptive-bar');
    rt.sheet = host.querySelector('.rtg-adaptive-sheet'); rt.sheetTitle = host.querySelector('h2');
    rt.sheetCopy = host.querySelector('.rtg-adaptive-sheet-head p'); rt.sheetList = host.querySelector('.rtg-adaptive-sheet-list');
    rt.caption = host.querySelector('.rtg-adaptive-caption'); rt.identity = host.querySelector('.rtg-adaptive-identity');
    rt.presenceButton = host.querySelector('.rtg-adaptive-presence'); rt.presenceText = rt.presenceButton.querySelector('span');
    host.querySelector('[data-rtg-adaptive-close]').addEventListener('click', function () { setState('dock'); });
    rt.presenceButton.addEventListener('click', function () { execute('presence'); });
    renderDeck(); Input.bind(rt, { state: setState, action: execute,
      deck: function (delta) { setDeck(K.nextDeck(rt.model.deck, delta)); },
      rahul: function () { rt.model.deck = 'rahul'; renderDeck(); setState('deck'); execute('ai'); },
      escape: function () { if (rt.model.state === 'expanded') setState('dock'); } });
  }
  function start(doc, win, host) {
    var edge = host || (w.RTGEdge && w.RTGEdge.active);
    if (rt || doc !== d || win !== w || !K || !Input || !d.body || !edge || !edge.root || !edge.cfg || !edge.ctx) return rt;
    rt = { doc: d, win: w, edge: edge, model: K.model(), manual: false };
    K.defaults(rt.model); build(); d.body.dataset.rtgAdaptiveReady = 'true'; setState('dock', 'auto');
    w.RTGAdaptiveEdgeControls.start(rt);
    if (w.MutationObserver) rt.observer = new w.MutationObserver(function () {
      var state = d.body.getAttribute('data-rtg-edge-2-state');
      if (d.body.getAttribute('data-rtg-edge-venster-open') === 'true') return;
      if (state === 'focus') setState('dock', 'auto');
      else if (state === 'compact') setState('peek', 'auto');
      else if (state === 'overview' && rt.model.state === 'peek') setState('dock', 'auto');
    });
    if (rt.observer) rt.observer.observe(d.body, { attributes: true, attributeFilter: ['data-rtg-edge-2-state', 'data-rtg-edge-venster-open'] });
    return rt;
  }
  function destroy() {
    if (!rt) return;
    closePanel();
    if (rt.observer) rt.observer.disconnect();
    if (rt.controlsStop) rt.controlsStop();
    if (rt.host && rt.host.parentNode) rt.host.parentNode.removeChild(rt.host);
    d.body.removeAttribute('data-rtg-adaptive-ready'); d.body.removeAttribute('data-rtg-adaptive-state'); rt = null;
  }
  w.RTGAdaptiveEdge = Object.freeze({ start: start, setState: setState, setDeck: setDeck,
    registerAction: registerAction, setProjection: setProjection, openPanel: openPanel, setPresence: setPresence,
    setIdentity: setIdentity, continueWith: continueWith, destroy: destroy });
}(window, document));
