/* RTG Heritage Motion: koppelt declaratieve actiestatus aan toegankelijke
   betekenis. Geen klik-, sleep- of routegedrag; de bestaande app houdt gezag. */
(function (g, fabriek) {
  'use strict';
  var api = fabriek();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (g && g.document) {
    g.RTGHeritageMotion = api;
    api.boot(g.document, g);
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SELECTOR = '[data-rtg-morph-action]';
  var STATES = Object.freeze(['idle', 'pending', 'success', 'error']);
  var observer = null;

  function normaliseer(waarde) {
    waarde = String(waarde || 'idle').toLowerCase();
    return STATES.indexOf(waarde) >= 0 ? waarde : null;
  }

  function isActie(element) {
    return !!(element && element.matches && element.matches(SELECTOR));
  }

  function kopieVoor(element, staat) {
    var kopieen = element.querySelectorAll('[data-rtg-action-copy-for]');
    var gekozen = null;
    for (var i = 0; i < kopieen.length; i++) {
      if (kopieen[i].getAttribute('data-rtg-action-copy-for') === staat) gekozen = kopieen[i];
    }
    return { alle: kopieen, gekozen: gekozen };
  }

  function synchroniseer(element) {
    if (!isActie(element)) return false;
    var staat = normaliseer(element.getAttribute('data-rtg-action-state')) || 'idle';
    if (element.getAttribute('data-rtg-action-state') !== staat) {
      element.setAttribute('data-rtg-action-state', staat);
    }
    var kopie = kopieVoor(element, staat);
    /* Geen groene rand met een oude tekst: een ontbrekende statuskopie is geen
       bewijs en valt daarom terug naar de neutrale toestand. */
    if (!kopie.gekozen && staat !== 'idle') {
      staat = 'idle';
      element.setAttribute('data-rtg-action-state', staat);
      kopie = kopieVoor(element, staat);
    }
    var zichtbaar = kopie.gekozen ? staat : 'idle';
    for (var i = 0; i < kopie.alle.length; i++) {
      kopie.alle[i].setAttribute('aria-hidden', String(kopie.alle[i] !== kopie.gekozen));
    }
    element.setAttribute('data-rtg-action-copy-state', zichtbaar);
    element.setAttribute('data-rtg-action-bound', 'true');
    element.setAttribute('aria-busy', String(staat === 'pending'));
    if (staat !== 'pending' && element.getAttribute('data-rtg-action-progress') !== null) {
      zetVoortgang(element, null);
    }
    var houder = element.querySelector('[data-rtg-action-copy]');
    if (houder) {
      if (!houder.getAttribute('aria-live')) houder.setAttribute('aria-live', 'polite');
      if (!houder.getAttribute('aria-atomic')) houder.setAttribute('aria-atomic', 'true');
    }
    return staat;
  }

  function bindAlles(wortel) {
    if (!wortel) return 0;
    var acties = [];
    if (isActie(wortel)) acties.push(wortel);
    if (wortel.querySelectorAll) acties = acties.concat([].slice.call(wortel.querySelectorAll(SELECTOR)));
    for (var i = 0; i < acties.length; i++) synchroniseer(acties[i]);
    return acties.length;
  }

  function zetStatus(element, staat, opties) {
    staat = normaliseer(staat);
    if (!isActie(element) || !staat) return false;
    if (!kopieVoor(element, staat).gekozen) return false;
    opties = opties || {};
    element.setAttribute('data-rtg-action-state', staat);
    if (Object.prototype.hasOwnProperty.call(opties, 'progress')) zetVoortgang(element, opties.progress);
    else if (staat !== 'pending') zetVoortgang(element, null);
    synchroniseer(element);
    return true;
  }

  function zetVoortgang(element, waarde) {
    if (!isActie(element) || !element.style) return false;
    if (waarde === null || typeof waarde === 'undefined') {
      element.removeAttribute('data-rtg-action-progress');
      element.style.removeProperty('--rtg-action-progress');
      return true;
    }
    var getal = Number(waarde);
    if (!Number.isFinite(getal) || element.getAttribute('data-rtg-action-state') !== 'pending') return false;
    getal = Math.max(0, Math.min(1, getal));
    element.setAttribute('data-rtg-action-progress', String(getal));
    element.style.setProperty('--rtg-action-progress', String(getal));
    return true;
  }

  function bewegingToegestaan(win, doc) {
    try {
      if (doc && doc.documentElement && doc.documentElement.classList.contains('rtg-stil')) return false;
      return !(win && win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return true; }
  }

  function start(doc, win) {
    if (!doc) return null;
    bindAlles(doc);
    if (observer) observer.disconnect();
    if (win && win.MutationObserver && doc.documentElement) {
      observer = new win.MutationObserver(function (mutaties) {
        for (var i = 0; i < mutaties.length; i++) {
          var mutatie = mutaties[i];
          if (mutatie.type === 'attributes') synchroniseer(mutatie.target);
          else for (var j = 0; j < mutatie.addedNodes.length; j++) bindAlles(mutatie.addedNodes[j]);
        }
      });
      observer.observe(doc.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['data-rtg-action-state']
      });
    }
    return observer;
  }

  function boot(doc, win) {
    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', function () { start(doc, win); }, { once: true });
    } else start(doc, win);
  }

  function stop() {
    if (observer) observer.disconnect();
    observer = null;
  }

  return Object.freeze({
    STATES: STATES,
    normalizeState: normaliseer,
    syncAction: synchroniseer,
    bindAll: bindAlles,
    setAction: zetStatus,
    setProgress: zetVoortgang,
    allowsMotion: bewegingToegestaan,
    start: start,
    boot: boot,
    stop: stop
  });
}));
