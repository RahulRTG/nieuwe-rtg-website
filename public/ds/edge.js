/* RTG Design System: de Edge, de vorm en het wisselen.

   Een modus is een functie die de balk vult (/ds/edge-modi.js). Een scherm
   wisselt met RTGDs.edge.modus(naam, opties) en gaat terug met .terug(). Zo
   houdt een lid zijn plek: Rahul openen op een hotelpagina en weer sluiten
   laat de pagina, het formulier en de scrollpositie staan. De Edge
   presenteert bevoegdheid en verleent haar nooit (EDGE.md): een handeling is
   altijd een functie van het scherm, en de server beslist. */
(function (w, d) {
  'use strict';
  var R = w.RTGDs;
  if (!R || R.edge) return;
  var h = R.hulp, el = h.el, svg = h.svg;
  var MODI = {};
  var edge = null, balk = null, blad = null, modusNaam = null, vorige = [], terugFocus = null;

  function knop(naam, label, icoon, extra) {
    var b = el('button', 'ds-edge__knop' + (extra ? ' ' + extra : ''), { type: 'button', 'data-ds-edge': naam });
    b.innerHTML = icoon + '<span></span>';
    b.querySelector('span').textContent = label;
    return b;
  }
  function linkKnop(href, label, icoon) {
    var a = el('a', 'ds-edge__knop', { href: href });
    a.innerHTML = icoon + '<span></span>';
    a.querySelector('span').textContent = label;
    return a;
  }
  function rahulKnop() {
    var b = el('button', 'ds-edge__knop ds-edge__knop--rahul', { type: 'button', 'data-ds-edge': 'rahul', 'aria-label': 'Vraag Rahul' });
    b.innerHTML = svg(h.LIPPEN);
    b.addEventListener('click', function () { api.modus('rahul'); });
    return b;
  }
  function bladKnop(naam, label, icoon, titel, vul) {
    var b = knop(naam, label, icoon);
    b.setAttribute('aria-controls', 'dsEdgeBlad');
    b.setAttribute('aria-expanded', 'false');
    b.addEventListener('click', function () {
      if (!blad.hidden) return sluitBlad();
      openBlad(titel, b, vul());
    });
    return b;
  }

  function openBlad(titel, bron, inhoud) {
    terugFocus = bron || d.activeElement;
    blad.textContent = '';
    var kop = el('h2', 'ds-edge__bladtitel', { id: 'dsEdgeBladTitel' });
    kop.textContent = titel;
    blad.appendChild(kop);
    blad.appendChild(inhoud);
    blad.hidden = false;
    if (bron) bron.setAttribute('aria-expanded', 'true');
    var eerste = blad.querySelector('a,button,input,textarea');
    if (eerste) eerste.focus();
  }
  function sluitBlad() {
    if (!blad || blad.hidden) return;
    blad.hidden = true;
    blad.textContent = '';
    var open = balk.querySelector('[aria-expanded="true"]');
    if (open) open.setAttribute('aria-expanded', 'false');
    if (terugFocus && terugFocus.isConnected) terugFocus.focus();
    terugFocus = null;
  }
  function lijst(regels) {
    var ul = el('ul', 'ds-edge__lijst');
    regels.forEach(function (r) {
      var li = el('li');
      var x = r.href ? el('a', 'ds-edge__regel', { href: r.href }) : el('button', 'ds-edge__regel', { type: 'button' });
      x.innerHTML = (r.icoon ? svg(r.icoon) : '') + '<span></span>';
      x.querySelector('span').textContent = r.label;
      if (r.doe) x.addEventListener('click', function () { sluitBlad(); r.doe(); });
      li.appendChild(x);
      ul.appendChild(li);
    });
    return ul;
  }

  function maak() {
    if (edge || d.body.hasAttribute('data-ds-geen-edge')) return;
    edge = el('div', 'ds-edge');
    blad = el('section', 'ds-edge__blad', { id: 'dsEdgeBlad', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'dsEdgeBladTitel' });
    blad.hidden = true;
    balk = el('nav', 'ds-edge__balk', { 'aria-label': 'RTG Edge' });
    edge.appendChild(blad);
    edge.appendChild(balk);
    d.body.appendChild(edge);
    d.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      if (!blad.hidden) sluitBlad();
      else if (vorige.length) api.terug();
    });
    zet(MODI.navigatie ? 'navigatie' : null);
  }
  function zet(naam, opties) {
    if (!balk || !naam) return;
    if (!MODI[naam]) throw new Error('RTGDs.edge: onbekende modus ' + naam);
    sluitBlad();
    balk.textContent = '';
    balk.setAttribute('data-ds-modus', naam);
    modusNaam = naam;
    MODI[naam](opties);
  }

  var api = {
    modus: function (naam, opties) {
      if (!edge) maak();
      if (modusNaam && modusNaam !== naam) vorige.push(modusNaam);
      zet(naam, opties);
    },
    terug: function () { zet(vorige.pop() || 'navigatie'); },
    huidig: function () { return modusNaam; },
    modi: function () { return Object.keys(MODI); },
    /* Voor /ds/edge-modi.js: een modus registreren en de bouwstenen lenen. */
    registreer: function (naam, vul) {
      MODI[naam] = vul;
      if (balk && !modusNaam && naam === 'navigatie') zet('navigatie');
    },
    delen: {
      balk: function () { return balk; }, knop: knop, linkKnop: linkKnop, rahulKnop: rahulKnop,
      bladKnop: bladKnop, openBlad: openBlad, sluitBlad: sluitBlad, lijst: lijst
    }
  };
  R.edge = api;
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', maak, { once: true });
  else maak();
}(window, document));
