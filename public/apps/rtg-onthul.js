/* RTG Onthul: het signatuur-onthuleffect (zie rtg-onthul.css). Een drop-in:
   neem de css + dit script op en kaarten/tegels onthullen zich vanzelf, ook de
   inhoud die later via fetch in de DOM komt. Respecteert prefers-reduced-motion
   en valt stil terug (alles blijft staan) als er iets niet kan. */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window) || !('MutationObserver' in window)) return;

  // de tegels/kaarten die meedoen (de bouwstenen van de nieuwe pagina's)
  var SEL = '.kaart, .item, .reis, .resto, .boutiek, .genre, .fr, .kpi, .ev';
  var stagger = 0;
  var io = new IntersectionObserver(function (ents) {
    for (var i = 0; i < ents.length; i++) {
      if (ents[i].isIntersecting) { ents[i].target.classList.add('in'); io.unobserve(ents[i].target); }
    }
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.04 });

  function bereid(el) {
    if (!el || el.__onthul) return;
    el.__onthul = true;
    el.classList.add('onthul');
    el.style.setProperty('--od', ((stagger++ % 6) * 45) + 'ms');
    io.observe(el);
  }
  function scan(root) {
    var scope = root && root.querySelectorAll ? root : document;
    if (scope.matches && scope.matches(SEL)) bereid(scope);
    var els = scope.querySelectorAll ? scope.querySelectorAll(SEL) : [];
    for (var i = 0; i < els.length; i++) bereid(els[i]);
  }

  function start() {
    scan(document.querySelector('main') || document.body);
    // inhoud die later wordt bijgeladen (na een fetch) ook onthullen
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++) if (added[j].nodeType === 1) scan(added[j]);
      }
    }).observe(document.querySelector('main') || document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
