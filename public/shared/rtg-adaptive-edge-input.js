(function (w) {
  'use strict';
  function haptic(win) {
    try { if (win.navigator && win.navigator.vibrate) win.navigator.vibrate(8); } catch (e) {}
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
  w.RTGAdaptiveEdgeInput = Object.freeze({ bind: bind, haptic: haptic });
}(window));
