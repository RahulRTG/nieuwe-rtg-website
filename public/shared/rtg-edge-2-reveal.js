/* Herstelgrepen en toestelmeta voor de automatische Edge-leesstand. */
(function (w) {
  'use strict';

  function start(d, win) {
    var b = d.body, e = win.RTGEdge && win.RTGEdge.active;
    var root = e && e.root, h = d.head || d.documentElement;
    if (!b || !root) return false;
    if (!root.querySelector('.rtg-edge-2-edge-reveal')) {
      [['top', 'bovenrand'], ['bottom', 'onderrand']].forEach(function (kant) {
        var knop = d.createElement('button');
        knop.type = 'button';
        knop.className = 'rtg-edge-2-edge-reveal rtg-edge-2-edge-reveal--' + kant[0];
        knop.setAttribute('aria-label', 'Bediening tonen via de ' + kant[1]);
        knop.addEventListener('click', function () {
          if (win.RTGEdge2) win.RTGEdge2.setState('overview', { source: 'edge' });
        });
        root.appendChild(knop);
      });
    }
    if (win.getComputedStyle) {
      var kleur = win.getComputedStyle(b).getPropertyValue('--edge-bar-bg').trim();
      var meta = d.querySelector('meta[name="theme-color"]');
      if (kleur) {
        if (!meta) { meta = d.createElement('meta'); meta.name = 'theme-color'; h.appendChild(meta); }
        meta.content = kleur;
      }
    }
    return true;
  }

  w.RTGEdge2Reveal = Object.freeze({ start: start });
})(window);
