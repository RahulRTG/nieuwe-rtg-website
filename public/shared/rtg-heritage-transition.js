/* Een overgang verbindt dezelfde inhoud voor en na een bestaande handeling.
   De route blijft eigenaar van de update; animatie mag die nooit blokkeren. */
(function (w, d) {
  'use strict';
  var active = null, cleanupActive = null, generation = 0;
  function allowed() {
    return !d.documentElement.classList.contains('rtg-stil') && !w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function run(source, target, update) {
    var ticket=++generation;
    if (active) { active.skipTransition(); cleanupActive(); return update(); }
    if (!d.startViewTransition || !allowed() || !source || !source.getClientRects().length) return update();
    var name = 'rtg-content-detail', before = source.style.viewTransitionName, after, old;
    source.style.viewTransitionName = name;
    var transition = d.startViewTransition(function () {
      if(ticket!==generation)return;
      source.style.viewTransitionName = before;
      var result = update();
      after = typeof target === 'string' ? d.querySelector(target) : target;
      if (after) { old = after.style.viewTransitionName; after.style.viewTransitionName = name; }
      return result;
    });
    active = transition; cleanupActive = cleanup;
    transition.ready.catch(function () {});
    transition.finished.then(cleanup, cleanup);
    function cleanup() {
      if (active !== transition) return;
      source.style.viewTransitionName = before;
      if (after) after.style.viewTransitionName = old;
      active = null; cleanupActive = null;
    }
    return transition;
  }
  w.addEventListener('pageswap', function (event) {
    if (!event.viewTransition || !allowed() || !event.activation) return;
    var to = new URL(event.activation.entry.url).pathname;
    var portals = Array.from(d.querySelectorAll('.wrooster-kaart[href],[data-rtg-component="WorldPortal"][href]'));
    var portal = portals.find(function (a) { return new URL(a.href, w.location.href).pathname === to; });
    if (portal) {
      var hero = d.querySelector('[data-rtg-transition="world"]');
      if (hero) hero.style.viewTransitionName = 'none';
      portal.style.viewTransitionName = 'rtg-world-stage';
      function reset() { portal.style.viewTransitionName = ''; if (hero) hero.style.viewTransitionName = ''; }
      event.viewTransition.finished.then(reset, reset);
    }
  });
  w.RTGHeritageTransition = { run: run, allowed: allowed };
}(window, document));
