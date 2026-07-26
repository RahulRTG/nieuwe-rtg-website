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

  window.RTGGlyf = { svg: svg, svgHTML: svgHTML, heeft: function (n) { return !!P[n]; } };
})();
