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

  window.RTGGlyf = { svg: svg, svgHTML: svgHTML, tekst: tekst, heeft: function (n) { return !!P[n]; } };
})();
