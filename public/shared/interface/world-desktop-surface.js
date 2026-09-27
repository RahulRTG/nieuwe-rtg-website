/* Keep the original nodes, listeners and screen state inside the common frame.
   Embedded apps use their parent's frame; only the outer document owns Edge. */
(function (w, d) {
  'use strict';
  var overlays = 'script,style,link,template,dialog,[role="dialog"],.scrim,.palet,.melding,.toast,.skip,.skip-link,.vis-verborgen,.rtg-edge-chrome,.rtg-adaptive-shell,.rtg-adaptive-bar,.rnd-toets,.rnd-hint,.ios-thuis,.rtg-spring,#rtfOnb';
  function prepare() {
    if (d.body.dataset.worldHome) return d.querySelector('main');
    var surface = d.createElement('div');
    surface.className = 'wd-page';
    surface.dataset.rtgScreenSurface = '';
    surface.setAttribute('role', 'region');
    surface.setAttribute('aria-label', d.title || 'RTG');
    var nodes = Array.from(d.body.children).filter(function (el) {
      return !el.matches(overlays) && !el.className.toString().startsWith('rtg-edge-') && !el.className.toString().startsWith('rtg-adaptive-');
    });
    d.body.prepend(surface);
    nodes.forEach(function (el) { surface.appendChild(el); });
    var canvas = w.RTGHeritageRegistry && w.RTGHeritageRegistry.canvas[w.location.pathname];
    if (canvas) surface.dataset.rtgCanvasSurface = 'true';
    return surface;
  }
  function guard(root, home) {
    var locked = false, oldHidden = false;
    function sync() {
      var gate = d.getElementById('rtf-toegang-slot');
      if (gate && d.documentElement.classList.contains('rtf-toegang-dicht')) {
        if (gate.tagName === 'DIALOG') {
          if (gate.open) gate.close();
          var panel = d.createElement('section'); panel.id = gate.id;
          panel.setAttribute('role', 'alert');
          while (gate.firstChild) panel.appendChild(gate.firstChild);
          gate.replaceWith(panel); gate = panel;
        }
        if (!locked) { oldHidden = home.hidden; locked = true; }
        home.hidden = true; home.inert = true;
        d.body.dataset.rtgDesktopAccess = 'locked';
        if (gate.parentNode !== root) {
          // The permission gate remains the only usable content. Navigation
          // may leave the room; it never unlocks the protected page.
          root.appendChild(gate);
          gate.classList.add('wd-access'); gate.style.cssText = '';
        }
      } else if (locked) {
        home.hidden = oldHidden; home.inert = false; locked = false;
        delete d.body.dataset.rtgDesktopAccess;
      }
    }
    var watch = new MutationObserver(sync);
    watch.observe(d.documentElement, { attributes:true, attributeFilter:['class'] });
    watch.observe(d.body, { childList:true });
    sync(); w.addEventListener('pagehide', function () { watch.disconnect(); });
  }
  w.RTGDesktopSurface = { prepare: prepare, guard: guard };
})(window, document);
