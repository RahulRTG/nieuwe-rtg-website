/* De gedeelde uitleg-techniek. Levert een klein "?"-knopje dat bij een tik een
   pop-up met uitleg toont, en sluit weer bij een tik ernaast of Escape. Overal
   te gebruiken:
     - in code:  knop.appendChild(RTGUitleg.knop('Waarom dit zo is...'));
     - in HTML:  <span data-uitleg="Waarom dit zo is...">Label</span>
                 (er komt dan automatisch een ?-knop achter)
   Zo blijft de UI rustig maar is de reden altijd één tik weg. Geen inline
   handlers (nonce-CSP). Insluiten met shared/uitleg.css. */
(function (w, d) {
  'use strict';
  var open = null;

  function sluit() {
    if (!open) return;
    if (open.pop && open.pop.parentNode) open.pop.parentNode.removeChild(open.pop);
    if (open.scrim && open.scrim.parentNode) open.scrim.parentNode.removeChild(open.scrim);
    if (open.knop) open.knop.setAttribute('aria-expanded', 'false');
    open = null;
  }

  function toon(knop, tekst) {
    sluit();
    var scrim = d.createElement('div'); scrim.className = 'uitleg-scrim';
    var pop = d.createElement('div'); pop.className = 'uitleg-pop';
    pop.setAttribute('role', 'tooltip');
    pop.textContent = tekst;
    d.body.appendChild(scrim);
    d.body.appendChild(pop);

    // positioneer onder de knop, binnen het scherm; anders erboven
    var r = knop.getBoundingClientRect();
    var pw = pop.offsetWidth, ph = pop.offsetHeight;
    var left = Math.min(Math.max(8, r.left + r.width / 2 - pw / 2), w.innerWidth - pw - 8);
    var top = r.bottom + 8;
    if (top + ph > w.innerHeight - 8) top = Math.max(8, r.top - ph - 8);
    pop.style.left = Math.round(left) + 'px';
    pop.style.top = Math.round(top) + 'px';

    scrim.addEventListener('click', sluit);
    knop.setAttribute('aria-expanded', 'true');
    open = { pop: pop, scrim: scrim, knop: knop };
  }

  function knop(tekst, label) {
    var b = d.createElement('button');
    b.type = 'button'; b.className = 'uitleg-knop'; b.textContent = '?';
    b.setAttribute('aria-label', label || 'Uitleg');
    b.setAttribute('aria-expanded', 'false');
    b.addEventListener('click', function (e) {
      e.stopPropagation(); e.preventDefault();
      if (open && open.knop === b) sluit(); else toon(b, tekst);
    });
    return b;
  }

  // elk element met data-uitleg krijgt automatisch een ?-knop erachter
  function init(root) {
    var lijst = (root || d).querySelectorAll('[data-uitleg]');
    for (var i = 0; i < lijst.length; i++) {
      var el = lijst[i];
      if (el.__uitleg) continue;
      el.__uitleg = 1;
      el.appendChild(knop(el.getAttribute('data-uitleg')));
    }
  }

  d.addEventListener('keydown', function (e) { if (e.key === 'Escape') sluit(); });
  w.addEventListener('resize', sluit);
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { init(); });
  else init();

  w.RTGUitleg = { knop: knop, toon: toon, sluit: sluit, init: init };
})(window, document);
