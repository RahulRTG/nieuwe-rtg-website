  /* De <svg>-jas als string (voor code die HTML samenstelt i.p.v. DOM-nodes).
     opties: { fill:true } vult het glyf (bv. een actief hartje) i.p.v. lijnen. */
  function svgHTML(naam, opt) {
    var d = P[naam];
    if (!d) return '';
    opt = opt || {};
    return '<svg viewBox="0 0 24 24" ' +
      (opt.fill ? 'fill="currentColor" stroke="currentColor"' : 'fill="none" stroke="currentColor"') +
      ' stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="rtg-glyf' +
      (opt.klasse ? ' ' + opt.klasse : '') + '">' + d + '</svg>';
  }

  function svg(naam) {
    var d = P[naam];
    if (!d) return null;
    var el = document.createElementNS(NS, 'svg');
    el.setAttribute('viewBox', '0 0 24 24');
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke', 'currentColor');
    el.setAttribute('stroke-width', '1.6');
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round');
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('class', 'rtg-glyf');
    el.innerHTML = d;
    return el;
  }

  /* Een glyfNAAM die uit de server komt ('paneel', 'stad', 'logboek') hoort een
     pictogram te worden en geen woord in de tekst. Schermen die hun lijsten met
     stringplakwerk opbouwen hadden daar een eigen hulpje voor nodig, en dat ging
     twee keer mis: de app-bundels zijn BYTE-plakken van een bestand en geen losse
     scopes, dus een functie boven in plak 06 bestaat niet in plak 07. En dit
     bestand is zelf ook een bundel, dus een reparatie in glyf.js werd door de
     eerstvolgende build weer overschreven. Vandaar hier, in de bron, een keer.

     Onbekende naam? Dan blijft staan wat er stond, netjes ontsmet. Zo kan deze
     omzetting nooit iets weghalen dat het wel deed. */
  function tekst(naam) {
    var n = naam == null ? '' : String(naam);
    if (P[n]) return svgHTML(n, { klasse: 'gl-inline' });
    return n.replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  /* VUL DE TEGELS. `data-glyf="spelen"` op een leeg vak, en dit zet het
     pictogram erin. Dat attribuut bestond al (apps/office schreef zijn eigen
     lusje ervoor), maar er was nergens een gedeelde vuller -- en daardoor stond
     de Foundation-hub met zesenvijftig LEGE icoonvakken op het scherm terwijl
     deze set er compleet naast lag. Een iconenset die niemand aanroept is geen
     iconenset.

     Twee dingen die deze functie met opzet NIET doet. Hij overschrijft niets:
     zit er al een <svg> in, dan laat hij hem staan, zodat een pagina die zijn
     eigen vulling doet (office) niet twee pictogrammen krijgt, in welke
     volgorde de scripts ook laden. En hij haalt niets weg bij een onbekende
     naam: dan blijft het vak leeg zoals het was, want stil iets wissen is
     erger dan stil niets doen. */
  function vul(wortel) {
    var lijst = (wortel || document).querySelectorAll('[data-glyf]');
    for (var i = 0; i < lijst.length; i++) {
      var el = lijst[i];
      if (el.querySelector('svg')) continue;
      var node = svg(el.getAttribute('data-glyf'));
      if (node) el.appendChild(node);
    }
  }

  window.RTGGlyf = { svg: svg, svgHTML: svgHTML, tekst: tekst, vul: vul,
    heeft: function (n) { return !!P[n]; } };

  /* Zelf aanslaan, zodat een pagina alleen het blad hoeft te laden. Staat de
     DOM er al (script onderaan, of async), dan meteen. */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { vul(); });
  } else { vul(); }
})();
