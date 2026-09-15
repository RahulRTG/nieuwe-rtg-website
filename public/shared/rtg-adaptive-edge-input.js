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
      if (!input && event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault(); handlers.deck(event.key === 'ArrowRight' ? 1 : -1);
      } else if (event.key === 'Escape') handlers.escape();
    });
  }
  w.RTGAdaptiveEdgeInput = Object.freeze({ bind: bind, haptic: haptic, prepare: prepare, closeContext: closeContext, reflect: reflect });
}(window));
