(function(w,d){
  'use strict';
  var APP='.wd-output,.connection-edge,.wos-dock,.wos-rail,.rtgdeel-balk,.rv-tabs,body>nav.balk,.wd-page>nav.balk,.rtg-edge-owned-bar,.rtm-nav,.mv-navigatie,.roomrail,.rolechoice,.rtd-dossieracties,.rtd-besluitacties,.rtg-v4-route-actions';
  var R=APP+',.cmd-balk,[data-rtg-edge-controls],.rtgsprong-greep,.ios-nav-acties,.ios-nav-extra';

  function lbl(el){return(el.getAttribute('aria-label')||el.title||el.innerText||el.textContent||'').replace(/\s+/g,' ').trim()}
  function avail(el,root){
    var view=el.ownerDocument.defaultView||w;
    for(var p=el;p;p=p.parentElement){
      if(p.hidden||p.inert||p.getAttribute('aria-hidden')==='true')return false
      if(p!==root&&!root.hasAttribute('data-rtg-edge-controls')&&!root.contains(p)&&!p.matches('.rtg-edge-bottom,.rtg-edge-appslot,[data-rtg-v4-legacy-header="true"]')&&view.getComputedStyle(p).display==='none')return false
      if(p===el&&p!==root&&!el.matches('.cmd-balkblad,.cmd-balksluit')&&view.getComputedStyle(p).display==='none')return false
    }
    return el.isConnected
  }
  function srcButtons(doc,embed,items){
    var out=[],tabs=new Set(),actions=new Set((items||[]).map(function(item){return item.id}));
    (doc||d).querySelectorAll(R+(embed?',body>header,.ios-nav,.rtg-duimbalk,[data-rtg-edge-bar]':'')).forEach(function(root){
      var controls=root.matches('button')?[root]:root.querySelectorAll('button,a[href]');
      controls.forEach(function(el){
        if (el.matches('.cmd-actie,.cmd-meer,.cmd-anker,.cmd-lade,.cmd-mondknop,.cmd-vraagstuur,.rtg-edge-2-context-button,.amn-knop,#osMenuBtn,.rtg-rahul-tab')) return;
        var tab = root.matches('.wos-dock,.wos-rail') && el.getAttribute('data-tab');
        var action = el.getAttribute('data-rtg-action-key');
        if (lbl(el) && avail(el, root) && (!tab || !tabs.has(tab)) && (!action || !actions.has(action)) && !out.some(function (x) { return x.el === el; })) {
          out.push({el:el,root:root,app:root.matches(APP)||el.matches('.rtguitvoer-knop')});if(tab)tabs.add(tab);if(action)actions.add(action);
        }
      });
    });
    return out;
  }
  function close(){w.RTGAdaptiveEdge.setState('dock')}
  function cur(){
    if(w.RTGEdgeBlikveld)return w.RTGEdgeBlikveld.acties();
    var A=w.RTGAdaptief,items=A&&A.voorNu?A.voorNu():[],command=d.getElementById('rtgCommand');
    return items.length||A&&A.context().acties.length?items:command&&command.rtgEdgeItems?command.rtgEdgeItems():[]
  }
  function render(rt){
    w.RTGAdaptiveEdgeInput.reflect(rt);
    var c = rt.controls;
    if (!c) {
      c = d.createElement('div'); c.className = 'rtg-adaptive-controls';
      c.setAttribute('role', 'group'); c.setAttribute('aria-label', 'Handelingen van dit scherm');
      rt.sheet.appendChild(c); rt.controls = c;
    }
    var focus = c.contains(d.activeElement) ? d.activeElement.dataset.cap : '', sx = c.scrollLeft;
    c.textContent = '';
    if (w.RTGDesktopFrame) w.RTGDesktopFrame.controls(c, srcButtons);
    var A = w.RTGAdaptief;
    if (A && A.context().titel) rt.sheetTitle.textContent = A.context().titel;
    var primary = d.querySelector('.rtg-edge-action');
    if (primary && primary.parentElement !== rt.sheet) {
      rt.primaryParent = primary.parentElement; rt.primarySlot = primary; rt.sheet.appendChild(primary);
    }
    var panel = d.querySelector('.rtg-edge-2-context');
    if (panel && panel.parentElement !== rt.sheet) {
      rt.contextParent = panel.parentElement; rt.contextPanel = panel;
      rt.sheet.appendChild(panel);
    }
    if (panel && rt.model.state === 'expanded') panel.hidden = false;
    var vraag = d.getElementById('rvRahul');
    if (vraag && !rt.travelQuestion) {
      rt.travelQuestion = vraag; rt.travelQuestionParent = vraag.parentElement;
      rt.sheet.prepend(vraag);
    }
    if (vraag) vraag.hidden = rt.model.deck !== 'rahul';
    var items = cur();
    if (items.length && w.RTGAdaptiefBalkKnoppen) {
      var buttons = w.RTGAdaptiefBalkKnoppen({ items: function () { return items; }, titel: function () { return A.context().titel; } });
      items.forEach(function (item) {
        var b = buttons.knop(item); b.classList.add('rtg-adaptive-sheet-action');
        b.addEventListener('click', function (event) {
          var current = cur().find(function (x) { return x.id === item.id; });
          event.stopImmediatePropagation();
          if (!current) { refreshLater(); return; }
          if (current.aan === undefined) close();
          buttons.voer(current);
        }, true);
        b.textContent = item.naam; c.appendChild(b);
      });
    }
    var srcs = srcButtons(d, false, items), frame = d.querySelector('#rtgCommand .cmd-pane.actief iframe');
    try {
      if (frame && frame.contentDocument && frame.contentDocument.body)
        srcs = srcs.concat(srcButtons(frame.contentDocument, true, items));
    } catch (e) {}
    srcs.forEach(function (src) {
      var el = src.el, b = d.createElement('button'); b.type = 'button';
      var action = el.getAttribute('data-rtg-action-key');
      b.className = 'rtg-adaptive-sheet-action'; b.textContent = lbl(el);
      if (src.app) b.dataset.rtgAdaptiveControl = 'app';
      if (action) b.dataset.rtgActionKey = action;
      if (el.id) b.dataset.rtgAdaptiveSource = el.id;
      if (el.hasAttribute('data-tab')) b.dataset.rtgAdaptiveTab = el.getAttribute('data-tab');
      b.disabled = el.disabled || el.getAttribute('aria-disabled') === 'true';
      ['aria-current', 'aria-pressed', 'aria-haspopup'].forEach(function (name) {
        if (el.hasAttribute(name)) b.setAttribute(name, el.getAttribute(name));
      });
      if (el.hasAttribute('aria-selected')) b.setAttribute('aria-pressed', el.getAttribute('aria-selected'));
      b.addEventListener('click', function () {
        if (!avail(el, src.root) || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
        el.click(); close();
      });
      c.appendChild(b);
    });
    if (focus) c.querySelectorAll('[data-cap]').forEach(function (b) {
      if (b.dataset.cap === focus) b.focus({ preventScroll: true });
    });
    c.scrollLeft = sx;
    function refreshLater() { rt.win.requestAnimationFrame(function () { render(rt); }); }
    var command = d.querySelector('#rtgCommand .cmd-vraagvorm');
    if (command && rt.model.deck === 'rahul') {
      var form = d.createElement('form'); form.className = 'rtg-adaptive-question';
      var input = d.createElement('input'); input.type = 'text'; input.maxLength = 300;
      input.setAttribute('aria-label', 'Vraag Rahul'); input.placeholder = 'Vraag Rahul…';
      var send = d.createElement('button'); send.type = 'submit'; send.textContent = 'Versturen';
      form.appendChild(input); form.appendChild(send); c.prepend(form);
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var original = d.querySelector('#rtgCommand .cmd-vraagvorm');
        var field = original && original.querySelector('input');
        if (!field || !input.value.trim()) return;
        var mouth = d.querySelector('#rtgCommand .cmd-mondknop');
        rt.questionOwner = mouth && mouth.closest('.cmd-balk');
        if (mouth && !rt.questionOwner.classList.contains('vraagt')) mouth.click();
        field.value = input.value; original.requestSubmit(); input.value = ''; close();
        var reply = d.querySelector('#rtgCommand .cmd-praat');
        if (reply && reply.children.length) reply.hidden = false;
      });
      c.appendChild(w.RTGAdaptiveEdgeServices.secureConversation(close));
    }
    if(w.RTGAdaptiveEdgeCinema)w.RTGAdaptiveEdgeCinema.render(c,rt.model);
  }
  function start(rt){
    if (w.RTGAdaptiveEdgeClaim) w.RTGAdaptiveEdgeClaim.claim(d, w);
    rt.renderControls = function () { render(rt); };
    function primaryClick(event) {
      var button = event.target.closest && event.target.closest('[data-rtg-edge-primary]');
      if (button && !button.disabled && button.getAttribute('aria-disabled') !== 'true') close();
    }
    rt.sheet.addEventListener('click', primaryClick, true);
    var frame = 0;
    function refresh() {
      if (frame || rt.model.state !== 'expanded' || (rt.controls && rt.controls.contains(d.activeElement) && d.activeElement.tagName === 'INPUT')) return;
      frame = w.requestAnimationFrame(function () { frame = 0; render(rt); });
    }
    var obs = new w.MutationObserver(function (records) {
      w.RTGAdaptiveEdgeInput.reflect(rt);
      if (w.RTGAdaptiveEdgeClaim) w.RTGAdaptiveEdgeClaim.claim(d, w);
      var bar = d.querySelector('#rtgCommand .cmd-balk');
      if (bar && bar.classList.contains('vraagt')) {
        if (rt.questionOwner !== bar) {
          rt.questionOwner = bar;
          w.RTGAdaptiveEdge.setDeck('rahul'); w.RTGAdaptiveEdge.setState('expanded');
        }
      } else rt.questionOwner = null;
      if(records.some(function(r){
        if(rt.host.contains(r.target))return false;
        if(r.type==='attributes')return r.target.matches&&r.target.matches(R);
        return r.target.closest&&r.target.closest(R)||[].some.call(r.addedNodes,function(n){return n.matches&&(n.matches(R)||n.querySelector(R))})
      }))refresh();
    });
    obs.observe(d.body, { subtree: true, childList: true, attributes: true,
      attributeFilter: ['disabled', 'hidden', 'class', 'aria-disabled', 'aria-current', 'aria-pressed', 'aria-expanded'] });
    var unsubscribe = w.RTGAdaptief && w.RTGAdaptief.opContext(refresh);
    rt.controlsStop = function () {
      rt.sheet.removeEventListener('click', primaryClick, true);
      obs.disconnect(); if (frame) w.cancelAnimationFrame(frame);
      if (typeof unsubscribe === 'function') unsubscribe();
      if (rt.primarySlot && rt.primaryParent) rt.primaryParent.appendChild(rt.primarySlot);
      if (rt.contextPanel && rt.contextParent) {
        rt.contextPanel.hidden = true; rt.contextParent.appendChild(rt.contextPanel);
      }
      if (rt.travelQuestion && rt.travelQuestionParent) {
        rt.travelQuestion.hidden = false; rt.travelQuestionParent.appendChild(rt.travelQuestion);
      }
    };
    render(rt);
  }
  w.RTGAdaptiveEdgeControls = Object.freeze({ start: start });
}(window, document));
