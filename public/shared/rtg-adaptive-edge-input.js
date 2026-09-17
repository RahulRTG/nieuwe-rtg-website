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
  function bind(rt, handlers) {
    var down = false, x = 0, y = 0, timer = null, held = false, blockClickUntil = 0;
    var scrollTimer = null, lastScroll = rt.win.scrollY || 0;
    rt.bar.addEventListener('pointerdown', function (event) {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      down = true; held = false; x = event.clientX; y = event.clientY;
      timer = rt.win.setTimeout(function () {
        if (!down) return;
        held = true;
        if (!rt.win.RTGOrb || !rt.win.RTGOrb.open()) handlers.rahul();
        haptic(rt.win);
      }, 620);
    });
    rt.bar.addEventListener('pointermove', function (event) {
      if (!down) return;
      if (Math.abs(event.clientX - x) + Math.abs(event.clientY - y) > 8) {
        rt.win.clearTimeout(timer);
        try { rt.bar.setPointerCapture(event.pointerId); } catch (e) {}
      }
      var dx = Math.max(-32, Math.min(32, (event.clientX - x) * .2));
      rt.bar.style.setProperty('--rtg-adaptive-drag', dx + 'px');
    });
    function stop(event) {
      if (!down) return;
      down = false; rt.win.clearTimeout(timer); rt.bar.style.removeProperty('--rtg-adaptive-drag');
      if (held || !event) { blockClickUntil = Date.now() + 400; return; }
      var dx = event.clientX - x, dy = event.clientY - y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 36) blockClickUntil = Date.now() + 400;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 36) handlers.deck(dx < 0 ? 1 : -1);
      else if (dy < -36) {
        var depth = rt.win.RTGDiepte, adapt = rt.win.RTGAdaptief;
        if (depth && adapt && adapt.voorNu().length) {
          handlers.state('dock');
          if (-dy >= depth.DREMPELS.tweede) depth.tweede(); else depth.eerste();
        } else handlers.state('expanded');
      }
      else if (dy > 36) handlers.state('peek');
    }
    rt.bar.addEventListener('pointerup', stop);
    rt.bar.addEventListener('pointercancel', function () { stop(null); });
    rt.bar.addEventListener('click', function (event) {
      if (Date.now() < blockClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    rt.doc.addEventListener('keydown', function (event) {
      var input = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target && event.target.tagName || '');
      if (!input && (event.metaKey || event.ctrlKey) && String(event.key).toLowerCase() === 'k') {
        event.preventDefault(); handlers.rahul();
      } else if (!input && event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault(); handlers.deck(event.key === 'ArrowRight' ? 1 : -1);
      } else if (event.key === 'Escape') handlers.escape();
    });
    rt.win.addEventListener('scroll', function () {
      var now = rt.win.scrollY || 0, moved = Math.abs(now - lastScroll); lastScroll = now;
      if (moved < 8 || rt.manual || rt.model.state === 'expanded') return;
      handlers.state('peek', 'auto'); rt.win.clearTimeout(scrollTimer);
      scrollTimer = rt.win.setTimeout(function () {
        if (!rt.manual && rt.model.state === 'peek') handlers.state('dock', 'auto');
      }, 520);
    }, { passive: true });
  }
  // Public stories can use the same sheet without constructing a second bar.
  function closePanel(rt) {
    if (!rt || !rt.customPanel) return;
    var panel = rt.customPanel;
    panel.node.hidden = true; panel.parent.insertBefore(panel.node, panel.next && panel.next.parentNode === panel.parent ? panel.next : null);
    rt.customPanel = null; reflect(rt); rt.sheetList.hidden = false;
    if (rt.controls) rt.controls.hidden = false;
    if (panel.focus && panel.focus.isConnected) panel.focus.focus({ preventScroll: true });
  }
  function openPanel(rt, node, options, setState) {
    if (!rt || !node || node.ownerDocument !== rt.doc || !node.parentNode) return false;
    if (rt.customPanel && rt.customPanel.node === node) { setState('dock'); return true; }
    if (rt.host.contains(node)) return false;
    closePanel(rt); setState('expanded');
    rt.customPanel = { node: node, parent: node.parentNode, next: node.nextSibling, focus: rt.doc.activeElement };
    rt.sheetList.hidden = true; if (rt.controls) rt.controls.hidden = true;
    rt.sheetTitle.textContent = String(options && options.title || 'RTG');
    rt.sheetCopy.textContent = String(options && options.copy || '');
    node.hidden = false; rt.sheet.appendChild(node);
    reflect(rt);
    var focus = node.querySelector('input:not(:disabled),button:not(:disabled),a,select:not(:disabled),summary') || rt.sheet.querySelector('[data-rtg-adaptive-close]');
    if (focus) focus.focus({ preventScroll: true });
    return true;
  }
  w.RTGAdaptiveEdgeInput = Object.freeze({ bind: bind, openPanel: openPanel, closePanel: closePanel, haptic: haptic, prepare: prepare, closeContext: closeContext, reflect: reflect });
}(window));
