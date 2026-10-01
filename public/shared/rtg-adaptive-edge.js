(function (w, d) {
  'use strict';
  if(w.RTGAdaptiveEdge)return;
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
    return '<svg class="rtg-adaptive-lips" viewBox="0 0 100 58" aria-hidden="true"><path d="M2 30C18 28 30 18 43 10C48 7 52 13 56 15C60 13 65 7 70 10C82 18 91 27 98 30C80 34 68 34 55 31C42 34 23 35 2 30Z"/><path d="M3 31C22 34 39 33 55 31C71 34 84 34 97 31C85 42 73 51 55 52C36 50 17 42 3 31Z"/><path d="M8 31C25 35 40 33 55 31C70 34 83 34 92 31"/></svg>';
  }
  function button(spec, slot) {
    var b = d.createElement('button');
    b.type='button'; b.className='rtg-adaptive-item';
    b.dataset.rtgAdaptiveSlot=slot; b.dataset.rtgAdaptiveAction=spec[0];
    b.setAttribute('aria-label',spec[1]);
    b.innerHTML=(spec[0]==='ai'?lips():icon(spec[3]))+'<span class="rtg-adaptive-item-copy"><small>'+
      esc(spec[0]==='ai'?'Vraag of regel iets':spec[2]||spec[1])+'</small><b>'+esc(K.detail(spec[0]))+'</b></span>';
    b.onclick=function(){execute(spec[0]);};
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
    if (action === 'home') { if (w.dispatchEvent(new w.CustomEvent('rtg-edge-home', { cancelable: true }))) w.location.href = rt.edge.cfg.home; return true; }
    if (action === 'back') { w.history.back(); return true; }
    if (action === 'worlds') return legacy('.rtg-edge-worlds-trigger');
    if (action === 'menu') return legacy('.rtg-edge-menu');
    if (action === 'status') return legacy('.rtg-edge-state');
    if (action === 'ai') {
      if (w.RTGMetgezel && typeof w.RTGMetgezel.rahul === 'function' && d.querySelector('.rtg-rahul-page')) { w.RTGMetgezel.rahul(); return true; }
      return legacy('.rtg-edge-ai');
    }
    if (action === 'presence') return rt.model.presence && rt.model.presence.action ? execute(rt.model.presence.action) : false;
    if (action === 'connect') return legacy('.rtg-edge-menu');
    return false;
  }
  function renderSheet() {
    if (rt.customPanel) return;
    var continuation = rt.model.continuation;
    rt.sheetTitle.textContent = continuation && continuation.title || rt.edge.ctx.title || d.title || 'Wat wilt u doen?';
    rt.sheetCopy.textContent = continuation && continuation.copy || 'Wat wilt u doen?';
    rt.sheetList.textContent = '';
    if (rt.renderControls) rt.renderControls();
    if (!(rt.controls && rt.controls.children.length) && !rt.primarySlot) {
      var empty = d.createElement('p'); empty.className = 'rtg-adaptive-empty';
      empty.textContent = 'Voor deze context zijn geen veilige acties beschikbaar.'; rt.sheetList.appendChild(empty);
    }
  }
  function renderDeck() {
    rt.bar.textContent = '';
    K.SPECS[rt.model.deck].forEach(function (spec, index) { rt.bar.appendChild(button(spec, index)); });
    var dots = d.createElement('span'); dots.className = 'rtg-adaptive-deck-dots'; dots.setAttribute('aria-hidden', 'true');
    K.DECKS.forEach(function (deck) { var dot = d.createElement('i'); if (deck === rt.model.deck) dot.dataset.active = 'true'; dots.appendChild(dot); });
    rt.bar.appendChild(dots);
    rt.host.dataset.rtgAdaptiveDeck = rt.model.deck;
    rt.bar.children[2].setAttribute('aria-current', rt.model.deck === 'rahul' ? 'page' : 'false');
    renderSheet();
  }
  function setState(state, source) {
    if (!rt) return false;
    if (source === 'auto' && (rt.manual || Input.busy(rt))) return false;
    if (state !== 'expanded') { closePanel(); Input.closeContext(rt); }
    rt.model.state = K.normState(state); rt.host.dataset.rtgAdaptiveState = rt.model.state;
    rt.host.dataset.rtgAdaptiveMotion = source === 'auto' && rt.model.state === 'peek' ? 'reading' : 'available';
    d.body.dataset.rtgAdaptiveState = rt.model.state; rt.sheet.hidden = rt.model.state !== 'expanded';
    rt.sheet.setAttribute('aria-hidden', String(rt.model.state !== 'expanded'));
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
      '<section class="rtg-adaptive-sheet" hidden aria-hidden="true"><div class="rtg-adaptive-sheet-head"><div><button type="button" class="rtg-adaptive-sheet-mouth" data-rtg-sheet-action="ai" aria-label="Praat met Rahul">' + lips() + '</button><h2></h2><p></p></div><button type="button" data-rtg-adaptive-close aria-label="Sluiten">×</button></div><div class="rtg-adaptive-guard"><i></i><span>Uw volgende handeling</span><b>Controle bij uitvoering</b></div><div class="rtg-adaptive-sheet-list"></div></section>' +
      '<nav class="rtg-adaptive-bar" aria-label="Home, Context, Acties, Connect en Rahul"></nav>';
    function find(selector) { return host.querySelector(selector); }
    rt.edge.root.appendChild(host); rt.host = host; rt.bar = find('.rtg-adaptive-bar');
    rt.sheet = find('.rtg-adaptive-sheet'); rt.sheetTitle = find('h2');
    rt.sheetCopy = find('.rtg-adaptive-sheet-head p'); rt.sheetList = find('.rtg-adaptive-sheet-list');
    rt.identity = find('.rtg-adaptive-identity');
    rt.presenceButton = find('.rtg-adaptive-presence'); rt.presenceText = rt.presenceButton.querySelector('span');
    find('[data-rtg-adaptive-close]').addEventListener('click', function () { setState('dock'); });
    [['[data-rtg-sheet-action]', 'ai'], ['.rtg-adaptive-presence', 'presence']].forEach(function (item) {
      find(item[0]).onclick = function () { execute(item[1]); };
    });
    renderDeck(); rt.inputStop = Input.bind(rt, { state: setState, action: execute,
      deck: function (delta) { setDeck(K.nextDeck(rt.model.deck, delta)); },
      rahul: function () { rt.model.deck = 'rahul'; renderDeck(); setState('deck'); execute('ai'); },
      escape: function () { if (rt.model.state === 'expanded') setState('dock'); } });
  }
  function start(doc, win, host) {
    var edge = host || (w.RTGEdge && w.RTGEdge.active);
    if (rt || doc !== d || win !== w || !K || !Input || !d.body || !edge || !edge.root || !edge.cfg || !edge.ctx) return rt;
    rt = { doc: d, win: w, edge: edge, model: K.model(), manual: false };
    build(); d.body.dataset.rtgAdaptiveReady = 'true'; setState('dock', 'auto');
    if (w.RTGAdaptiveEdgeSurface) rt.surfaceStop = w.RTGAdaptiveEdgeSurface.start(rt);
    w.RTGAdaptiveEdgeControls.start(rt);
    w.dispatchEvent(new w.CustomEvent('rtg-adaptive-ready'));
    if (w.MutationObserver) rt.observer = new w.MutationObserver(function () {
      var state = d.body.dataset.rtgEdge2State;
      if (d.body.dataset.rtgEdgeVensterOpen === 'true') return;
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
    ['surfaceStop', 'inputStop', 'controlsStop'].forEach(function (key) { if (rt[key]) rt[key](); });
    if (rt.observer) rt.observer.disconnect();
    if (rt.host) rt.host.remove();
    delete d.body.dataset.rtgAdaptiveReady; delete d.body.dataset.rtgAdaptiveState; rt = null;
  }
  w.RTGAdaptiveEdge = Object.freeze({ start: start, setState: setState, setDeck: setDeck,
    openPanel: openPanel, mountSurface: function (node, options) { return w.RTGAdaptiveEdgeSurface && w.RTGAdaptiveEdgeSurface.mount(node, options); }, setPresence: setPresence,
    setIdentity: setIdentity, continueWith: continueWith, destroy: destroy });
}(window, document));
