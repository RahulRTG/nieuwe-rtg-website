(function (w) {
  'use strict';
  function haptic(win) {
    try { if (win.navigator && win.navigator.vibrate) win.navigator.vibrate(8); } catch (e) {}
  }
  function prepare(rt, action) {
    ['.rtg-edge-menu', '.rtg-edge-ai', '.rtg-edge-state', '.rtg-edge-2-context-button'].forEach(function (selector) {
      var button = rt.edge.root.querySelector(selector + '[aria-expanded="true"]');
      if (button) button.click();
    });
    if (action !== 'ai') {
      var context = rt.edge.root.querySelector('.rtg-edge-2-context-button');
      if (context) context.click();
    }
  }
  function closeContext(rt) {
    var button = rt.edge.root.querySelector('.rtg-edge-2-context-button[aria-expanded="true"]');
    if (button) button.click();
    if (rt.contextPanel) rt.contextPanel.hidden = true;
    if (rt.sheet.contains(rt.doc.activeElement)) {
      var target = rt.bar.querySelector('[data-rtg-adaptive-action="context"],[data-rtg-adaptive-action="menu"]');
      if (target) target.focus();
    }
  }
  function reflect(rt) {
    rt.sheet.id = 'rtgAdaptiveActions';
    rt.bar.querySelectorAll('button').forEach(function (button) {
      var action = button.dataset.rtgAdaptiveAction;
      if (rt.edge.onEdgeAction && /^(menu|worlds|context|primary|connect)$/.test(action)) {
        var open = String(!!rt.customPanel && rt.customPanel.focus === button);
        if (button.getAttribute('aria-expanded') !== open) button.setAttribute('aria-expanded', open);
        if (button.getAttribute('aria-controls') !== rt.sheet.id) button.setAttribute('aria-controls', rt.sheet.id);
        return;
      }
      var selector = { menu: '.rtg-edge-menu', worlds: '.rtg-edge-menu', ai: '.rtg-edge-ai' }[action];
      var source = selector && rt.edge.root.querySelector(selector);
      var sheet = action === 'context' || action === 'primary' || action === 'ai' &&
        !!rt.doc.querySelector('#rtgCommand .cmd-vraagvorm,#rvRahul');
      if (!sheet && !source) return;
      var expanded = sheet ? String(rt.model.state === 'expanded') : source.getAttribute('aria-expanded') || 'false';
      var controls = sheet ? rt.sheet.id : source.getAttribute('aria-controls');
      if (button.getAttribute('aria-expanded') !== expanded) button.setAttribute('aria-expanded', expanded);
      if (controls && button.getAttribute('aria-controls') !== controls) button.setAttribute('aria-controls', controls);
    });
  }
  /* De drempels staan in de grammatica (EDGE.md par. 11); zonder tabel zijn de
     gebaren op de balk uit en blijven tik, Cmd+K en Alt+pijl werken. */
  function drempels(rt) { var g = rt.win.RTGGrammatica; return g && g.DREMPELS || null; }
  function busy(rt) {
    if (rt.host.dataset.rtgSurface) return true;
    var owner = rt.win.RTGEdge2;
    if (owner && owner.isBusy) return owner.isBusy(rt.doc, false);
    var active = rt.doc.activeElement;
    return !!(rt.customPanel || rt.host.contains(active) || active &&
      (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)));
  }
  function bind(rt, handlers) {
    var down = false, x = 0, y = 0, lastX = 0, lastY = 0, timer = null, held = false, blockClickUntil = 0;
    var scrollTimer = null, positions = new WeakMap(), listeners = [];
    function listen(target, type, callback, options) {
      target.addEventListener(type, callback, options); listeners.push([target, type, callback, options]);
    }
    var D = null;
    listen(rt.bar, 'pointerdown', function (event) {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      D = drempels(rt);
      if (!D) return;
      down = true; held = false; x = lastX = event.clientX; y = lastY = event.clientY;
      timer = rt.win.setTimeout(function () {
        if (!down) return;
        held = true;
        if (!rt.win.RTGOrb || !rt.win.RTGOrb.open()) handlers.rahul();
        haptic(rt.win);
      }, D.lang);
    });
    listen(rt.bar, 'pointermove', function (event) {
      if (!down) return;
      lastX = event.clientX; lastY = event.clientY;
      if (Math.abs(event.clientX - x) + Math.abs(event.clientY - y) > D.stil) {
        rt.win.clearTimeout(timer);
        try { rt.bar.setPointerCapture(event.pointerId); } catch (e) {}
      }
      var dx = Math.max(-32, Math.min(32, (event.clientX - x) * .2));
      rt.bar.style.setProperty('--rtg-adaptive-drag', dx + 'px');
    });
    function stop(event) {
      if (!down) return;
      down = false; rt.win.clearTimeout(timer); rt.bar.style.removeProperty('--rtg-adaptive-drag');
      if (held) { blockClickUntil = Date.now() + 400; return; }
      var dx = (event ? event.clientX : lastX) - x, dy = (event ? event.clientY : lastY) - y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > D.veeg) blockClickUntil = Date.now() + 400;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > D.veeg) handlers.deck(dx < 0 ? 1 : -1);
      else if (-dy >= D.omhoog) {
        /* Een host met een eigen paneel (de landing, de sitepagina's) krijgt
           eerst de vraag; de kernlijst is alleen voor wie er geen heeft. */
        var depth = rt.win.RTGDiepte, adapt = rt.win.RTGAdaptief;
        if (depth && adapt && adapt.voorNu().length) {
          handlers.state('dock');
          if (-dy >= D.diep) depth.tweede(); else depth.eerste();
        } else if (!rt.edge.onEdgeAction || !handlers.action('context')) handlers.state('expanded');
      }
      else if (dy > D.veeg) handlers.state('peek');
    }
    listen(rt.bar, 'pointerup', stop);
    listen(rt.bar, 'pointercancel', function () { stop(null); });
    listen(rt.bar, 'click', function (event) {
      if (Date.now() < blockClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    listen(rt.doc, 'keydown', function (event) {
      var input = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target && event.target.tagName || '');
      if (!input && (event.metaKey || event.ctrlKey) && String(event.key).toLowerCase() === 'k') {
        event.preventDefault(); handlers.rahul();
      } else if (!input && event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault(); handlers.deck(event.key === 'ArrowRight' ? 1 : -1);
      } else if (event.key === 'Escape') handlers.escape();
    });
    // Only fresh user gestures fold the bar; programmatic scrolling must not.
    // Gesture ownership stays with Edge 2, including nested app scrollers.
    var e2 = rt.win.RTGEdge2, gebaar = null;
    if (e2 && e2.gestureBind && e2.gestureFresh) { gebaar = { events: [] }; e2.gestureBind(gebaar, rt.win); }
    positions.set(rt.doc, rt.win.scrollY || 0);
    listen(rt.doc, 'focusin', function (event) {
      var target = event.target;
      if (rt.model.state === 'peek' && !rt.host.contains(target) &&
          (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) {
        handlers.state('dock');
      }
    });
    listen(rt.doc, 'scroll', function (event) {
      var target = event.target;
      if (target !== rt.doc && (!(target instanceof rt.win.Element) || rt.edge.root.contains(target))) return;
      var now = target === rt.doc ? rt.win.scrollY || 0 : target.scrollTop;
      var delta = now - (positions.get(target) || 0); positions.set(target, now);
      if (Math.abs(delta) < 8 || rt.manual || rt.model.state === 'expanded' || busy(rt)) return;
      if (gebaar && !e2.gestureFresh(gebaar)) return;
      handlers.state(delta > 0 ? 'peek' : 'dock', 'auto'); rt.win.clearTimeout(scrollTimer);
      scrollTimer = rt.win.setTimeout(function () {
        if (!rt.manual && rt.model.state === 'peek') handlers.state('dock', 'auto');
      }, 900);
    }, { passive: true, capture: true });
    // Capture nested app scrollers as well as document scroll; a panel being
    // used never folds itself away. Destroy/start must not retain old listeners.
    return function () {
      rt.win.clearTimeout(timer); rt.win.clearTimeout(scrollTimer);
      listeners.concat(gebaar ? gebaar.events : []).forEach(function (item) {
        item[0].removeEventListener(item[1], item[2], item[3]);
      });
    };
  }
  // Public stories can use the same sheet without constructing a second bar.
  function closePanel(rt) {
    if (!rt || !rt.customPanel) return;
    var panel = rt.customPanel;
    panel.node.hidden = true; panel.parent.insertBefore(panel.node, panel.next && panel.next.parentNode === panel.parent ? panel.next : null);
    rt.customPanel = null; delete rt.sheet.dataset.rtgCustomPanel; if (panel.onClose) panel.onClose(); reflect(rt); rt.sheetList.hidden = false;
    if (rt.controls) rt.controls.hidden = false;
    if (panel.focus && panel.focus.isConnected) panel.focus.focus({ preventScroll: true });
  }
  function openPanel(rt, node, options, setState) {
    if (!rt || !node || node.ownerDocument !== rt.doc || !node.parentNode) return false;
    if (rt.customPanel && rt.customPanel.node === node) { setState('dock'); return true; }
    if (rt.host.contains(node)) return false;
    closePanel(rt); setState('expanded'); rt.sheet.dataset.rtgCustomPanel = 'true';
    rt.customPanel = { node: node, parent: node.parentNode, next: node.nextSibling, focus: rt.doc.activeElement, onClose: options && options.onClose };
    /* Het paneel van de host vervangt de lijst: een lege melding van daarvoor hoort
       er niet verborgen onder te blijven staan (stap 17, test/experience-rtg.e2e.js). */
    rt.sheetList.textContent = ''; rt.sheetList.hidden = true; if (rt.controls) rt.controls.hidden = true;
    rt.sheetTitle.textContent = String(options && options.title || 'RTG');
    rt.sheetCopy.textContent = String(options && options.copy || '');
    node.hidden = false; rt.sheet.appendChild(node);
    reflect(rt);
    var focus = node.querySelector('input:not(:disabled),button:not(:disabled),a,select:not(:disabled),summary') || rt.sheet.querySelector('[data-rtg-adaptive-close]');
    if (focus) focus.focus({ preventScroll: true });
    return true;
  }
  w.RTGAdaptiveEdgeInput = Object.freeze({ bind: bind, busy: busy, openPanel: openPanel, closePanel: closePanel, haptic: haptic, prepare: prepare, closeContext: closeContext, reflect: reflect });
}(window));
