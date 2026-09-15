/* App controls are projected into the shared Edge panel. The original DOM
   stays with its owner: delegated handlers, current permissions and forms
   remain authoritative. Declared capabilities use the existing weight gate. */
(function (w, d) {
  'use strict';
  var ROOTS = '.cmd-balk,.wos-dock,.wos-rail,.rtgdeel-balk,.rv-tabs,body>nav.balk[aria-label="Hoofdnavigatie"],.rtg-edge-owned-bar';
  function label(el) { return (el.getAttribute('aria-label') || el.title || el.textContent || '').replace(/\s+/g, ' ').trim(); }
  function available(el, root) {
    for (var p = el; p; p = p.parentElement) {
      if (p.hidden || p.inert || p.getAttribute('aria-hidden') === 'true') return false;
      if (p !== root && !root.contains(p) && !p.matches('.rtg-edge-bottom,.rtg-edge-appslot') && w.getComputedStyle(p).display === 'none') return false;
      if (p === el && !el.matches('.cmd-balkblad,.cmd-balksluit') && w.getComputedStyle(p).display === 'none') return false;
    }
    return el.isConnected;
  }
  function sourceButtons() {
    var out = [], tabs = new Set();
    d.querySelectorAll(ROOTS).forEach(function (root) {
      root.querySelectorAll('button,a[href]').forEach(function (el) {
        if (el.matches('.cmd-actie,.cmd-meer,.cmd-anker,.cmd-lade,.cmd-mondknop,.cmd-vraagstuur,.rtg-edge-2-context-button')) return;
        var tab = root.matches('.wos-dock,.wos-rail') && el.getAttribute('data-tab');
        if (label(el) && available(el, root) && (!tab || !tabs.has(tab))) {
          out.push({ el: el, root: root }); if (tab) tabs.add(tab);
        }
      });
    });
    return out;
  }
  function close() { w.RTGAdaptiveEdge.setState('dock'); }
  function currentItems() {
    var A = w.RTGAdaptief, items = A && A.voorNu ? A.voorNu() : [];
    var command = d.getElementById('rtgCommand');
    return items.length || A && A.context().acties.length ? items : command && command.rtgEdgeItems ? command.rtgEdgeItems() : [];
  }
  function render(rt) {
    w.RTGAdaptiveEdgeInput.reflect(rt);
    var container = rt.controls;
    if (!container) {
      container = d.createElement('div'); container.className = 'rtg-adaptive-controls';
      container.setAttribute('role', 'group'); container.setAttribute('aria-label', 'Handelingen van dit scherm');
      rt.sheet.appendChild(container); rt.controls = container;
    }
    var focused = container.contains(d.activeElement) ? d.activeElement.dataset.cap : '';
    container.textContent = '';
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
    var travelQuestion = d.getElementById('rvRahul');
    if (travelQuestion && !rt.travelQuestion) {
      rt.travelQuestion = travelQuestion; rt.travelQuestionParent = travelQuestion.parentElement;
      rt.sheet.prepend(travelQuestion);
    }
    if (travelQuestion) travelQuestion.hidden = rt.model.deck !== 'rahul';
    var items = currentItems();
    if (items.length && w.RTGAdaptiefBalkKnoppen) {
      var buttons = w.RTGAdaptiefBalkKnoppen({ items: function () { return items; }, titel: function () { return A.context().titel; } });
      items.forEach(function (item) {
        var b = buttons.knop(item); b.classList.add('rtg-adaptive-sheet-action');
        b.addEventListener('click', function (event) {
          var current = currentItems().find(function (x) { return x.id === item.id; });
          if (!current) { event.stopImmediatePropagation(); refreshLater(); return; }
          event.stopImmediatePropagation();
          if (current.aan === undefined) close();
          buttons.voer(current);
        }, true);
        b.textContent = item.naam; container.appendChild(b);
      });
    }
    sourceButtons().forEach(function (source) {
      var el = source.el, b = d.createElement('button'); b.type = 'button';
      b.className = 'rtg-adaptive-sheet-action'; b.textContent = label(el);
      if (el.id) b.dataset.rtgAdaptiveSource = el.id;
      if (el.hasAttribute('data-tab')) b.dataset.rtgAdaptiveTab = el.getAttribute('data-tab');
      b.disabled = el.disabled || el.getAttribute('aria-disabled') === 'true';
      ['aria-current', 'aria-pressed'].forEach(function (name) {
        if (el.hasAttribute(name)) b.setAttribute(name, el.getAttribute(name));
      });
      if (el.hasAttribute('aria-selected')) b.setAttribute('aria-pressed', el.getAttribute('aria-selected'));
      b.addEventListener('click', function () {
        if (!available(el, source.root) || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
        close(); el.click();
      });
      container.appendChild(b);
    });
    if (focused) container.querySelectorAll('[data-cap]').forEach(function (b) {
      if (b.dataset.cap === focused) b.focus({ preventScroll: true });
    });
    function refreshLater() { rt.win.requestAnimationFrame(function () { render(rt); }); }
    var command = d.querySelector('#rtgCommand .cmd-vraagvorm');
    if (command && rt.model.deck === 'rahul') {
      var form = d.createElement('form'); form.className = 'rtg-adaptive-question';
      var input = d.createElement('input'); input.type = 'text'; input.maxLength = 300;
      input.setAttribute('aria-label', 'Vraag Rahul'); input.placeholder = 'Vraag Rahul…';
      var send = d.createElement('button'); send.type = 'submit'; send.textContent = 'Versturen';
      form.appendChild(input); form.appendChild(send); container.prepend(form);
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var original = d.querySelector('#rtgCommand .cmd-vraagvorm');
        var field = original && original.querySelector('input');
        if (!field || !input.value.trim()) return;
        var mouth = d.querySelector('#rtgCommand .cmd-mondknop');
        rt.questionOwner = mouth && mouth.closest('.cmd-balk');
        if (mouth && !mouth.closest('.cmd-balk').classList.contains('vraagt')) mouth.click();
        field.value = input.value; original.requestSubmit(); input.value = ''; close();
        var reply = d.querySelector('#rtgCommand .cmd-praat');
        if (reply && reply.children.length) reply.hidden = false;
      });
    }
  }
  function start(rt) {
    rt.renderControls = function () { render(rt); };
    var frame = 0;
    function refresh() {
      if (frame || rt.model.state !== 'expanded' || (rt.controls && rt.controls.contains(d.activeElement) && d.activeElement.tagName === 'INPUT')) return;
      frame = w.requestAnimationFrame(function () { frame = 0; render(rt); });
    }
    var observer = new w.MutationObserver(function (records) {
      w.RTGAdaptiveEdgeInput.reflect(rt);
      var commandBar = d.querySelector('#rtgCommand .cmd-balk');
      if (commandBar && commandBar.classList.contains('vraagt')) {
        if (rt.questionOwner !== commandBar) {
          rt.questionOwner = commandBar;
          w.RTGAdaptiveEdge.setDeck('rahul'); w.RTGAdaptiveEdge.setState('expanded');
        }
      } else rt.questionOwner = null;
      if (records.some(function (r) { return !rt.host.contains(r.target) &&
        (r.target.closest && r.target.closest(ROOTS)); })) refresh();
    });
    observer.observe(d.body, { subtree: true, childList: true, attributes: true,
      attributeFilter: ['disabled', 'hidden', 'class', 'aria-disabled', 'aria-current', 'aria-pressed', 'aria-expanded'] });
    var unsubscribe = w.RTGAdaptief && w.RTGAdaptief.opContext(refresh);
    rt.controlsStop = function () {
      observer.disconnect(); if (frame) w.cancelAnimationFrame(frame);
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
