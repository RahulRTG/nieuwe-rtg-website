/* Houdt de centrale Heritage-materialen als laatste stijlblad in de cascade.
   Schermen mogen na de eerste paint een functioneel blad bijladen; dat blad
   mag de eigen geometrie houden, maar niet ongemerkt de gezamenlijke
   wereldtokens en systeemmaterialen terugdraaien. De bestaande link wordt
   alleen verplaatst, nooit gekloond of opnieuw opgevraagd. */
(function (g, fabriek) {
  'use strict';
  var api = fabriek();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (g && g.document) { g.RTGHeritageOrder = api; api.boot(g.document, g); }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var waarnemer = null;

  function heritageLink(doc) {
    return doc && (doc.getElementById('rtgHeritageCss') ||
      doc.querySelector('link[href^="/shared/rtg-heritage.css"]'));
  }

  function laatsteStijl(head) {
    if (!head || !head.querySelectorAll) return null;
    var stijlen = head.querySelectorAll('style,link[rel~="stylesheet"]');
    return stijlen.length ? stijlen[stijlen.length - 1] : null;
  }

  function herstel(doc) {
    var head = doc && doc.head, heritage = heritageLink(doc);
    if (!head || !heritage || heritage.parentNode !== head) return false;
    if (laatsteStijl(head) === heritage) return false;
    head.appendChild(heritage);
    return true;
  }

  function start(doc, win) {
    if (!doc || !doc.head) return null;
    herstel(doc);
    if (waarnemer) waarnemer.disconnect();
    if (win && win.MutationObserver) {
      waarnemer = new win.MutationObserver(function (mutaties) {
        for (var i = 0; i < mutaties.length; i++) {
          if (mutaties[i].type === 'childList' && mutaties[i].addedNodes.length) {
            herstel(doc); break;
          }
        }
      });
      waarnemer.observe(doc.head, { childList: true });
    }
    return waarnemer;
  }

  function boot(doc, win) {
    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', function () { start(doc, win); }, { once: true });
    } else start(doc, win);
  }

  function stop() { if (waarnemer) waarnemer.disconnect(); waarnemer = null; }

  return Object.freeze({ ensureLast: herstel, lastStyle: laatsteStijl,
    start: start, boot: boot, stop: stop });
}));
