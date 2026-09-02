/* De presentatie-adapter boven de Workspace Runtime. Namen en interactiehulp
   blijven hier, zodat Dynamic Layer niet met het platformfundament versmelt. */
(function (w) {
  'use strict';
  w.RTGWorkspaceExperience = {
    productName: 'Adaptive Workspace', surfaceName: 'Dynamic Layer',
    glyph: function (button, naam) {
      var g = w.RTGGlyf && w.RTGGlyf.svg(naam);
      if (g) { g.classList.add('rtg-ss-mode-glyf'); button.insertBefore(g, button.firstChild); } return button;
    },
    focusable: function (root) {
      return [].slice.call(root.querySelectorAll('button:not([hidden]):not([disabled]),a[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])'))
        .filter(function (n) { return n.offsetParent !== null; });
    },
    trapTab: function (event, root) {
      var f = this.focusable(root); if (!f.length) return false;
      var first = f[0], last = f[f.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); return true; }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); return true; }
      return false;
    },
    applyBlueprint: function (composer, mq, setState, blueprint) {
      var r = composer.applyBlueprint(blueprint);
      if (r && r.ok) { var focus = r.blueprint.layout.find(function (x) { return x.state === 'focus'; });
        setState(focus ? 'focus' : (mq.matches ? 'workspace' : 'panel')); }
      return r;
    }
  };
})(window);
