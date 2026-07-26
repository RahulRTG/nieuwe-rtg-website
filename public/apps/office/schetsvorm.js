/* RTG Office, de schets: het TEKENEN van de vormen. Kader, ovaal, ruit,
   pijl en losse tekst, plus de formaatgrepen van de gekozen vorm. De
   bediening (slepen, kiezen, grepen pakken, ongedaan maken) woont in
   schets.js; dit bestand weet alleen hoe een vorm eruitziet.

   Levert window.RTGOfficeSchetsVorm. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var GEREEDSCHAP = [['kader', 'Kader'], ['ovaal', 'Ovaal'], ['ruit', 'Ruit'], ['pijl', 'Pijl'], ['tekst', 'Tekst']];

  function el(naam, at) {
    var e = document.createElementNS(NS, naam);
    for (var k in at) e.setAttribute(k, at[k]);
    return e;
  }

  function maakDefs() {
    var defs = el('defs', {});
    var punt = el('marker', { id: 'sPijlpunt', viewBox: '0 0 10 10', refX: 9, refY: 5,
      markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
    punt.appendChild(el('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: '#0C0C0B' }));
    defs.appendChild(punt);
    return defs;
  }

  function tekenVorm(v, i, aan) {
    var g = el('g', { 'data-i': i, 'class': aan ? 'sv aan' : 'sv' });
    var lijn = { fill: '#FFFFFF', stroke: aan ? '#7F1634' : '#0C0C0B', 'stroke-width': aan ? 3 : 2 };
    var mx = v.x + (v.b || 0) / 2, my = v.y + (v.h || 0) / 2;
    if (v.soort === 'kader') g.appendChild(el('rect', Object.assign({ x: v.x, y: v.y, width: v.b, height: v.h }, lijn)));
    else if (v.soort === 'ovaal') g.appendChild(el('ellipse', Object.assign({ cx: mx, cy: my, rx: v.b / 2, ry: v.h / 2 }, lijn)));
    else if (v.soort === 'ruit') g.appendChild(el('polygon', Object.assign({ points:
      mx + ',' + v.y + ' ' + (v.x + v.b) + ',' + my + ' ' + mx + ',' + (v.y + v.h) + ' ' + v.x + ',' + my }, lijn)));
    else if (v.soort === 'pijl') {
      g.appendChild(el('line', { x1: v.x, y1: v.y, x2: v.x2, y2: v.y2, stroke: lijn.stroke,
        'stroke-width': lijn['stroke-width'], 'marker-end': 'url(#sPijlpunt)' }));
      mx = (v.x + v.x2) / 2; my = (v.y + v.y2) / 2 - 8;
    } else { mx = v.x; my = v.y; }
    if (v.tekst || v.soort === 'tekst') {
      var t = el('text', { x: mx, y: my + (v.soort === 'pijl' || v.soort === 'tekst' ? 0 : 5),
        'text-anchor': v.soort === 'tekst' ? 'start' : 'middle', fill: '#0C0C0B',
        'font-size': 20, 'font-family': 'Inter, sans-serif' });
      t.textContent = v.tekst || '(dubbelklik voor tekst)';
      g.appendChild(t);
    }
    return g;
  }

  /* De formaatgrepen van een vorm: vier hoeken, of bij een pijl zijn twee
     uiteinden. Losse tekst heeft geen maat, dus geen grepen. */
  function grepenVan(v) {
    if (v.soort === 'tekst') return [];
    if (v.soort === 'pijl') return [{ h: 'a', x: v.x, y: v.y }, { h: 'b', x: v.x2, y: v.y2 }];
    return [{ h: 'nw', x: v.x, y: v.y }, { h: 'no', x: v.x + v.b, y: v.y },
      { h: 'zw', x: v.x, y: v.y + v.h }, { h: 'zo', x: v.x + v.b, y: v.y + v.h }];
  }
  function tekenGreep(gr) {
    return el('rect', { x: gr.x - 6, y: gr.y - 6, width: 12, height: 12, 'data-h': gr.h,
      'class': 'sgreep', fill: '#7F1634', stroke: '#FFFFFF', 'stroke-width': 2 });
  }

  window.RTGOfficeSchetsVorm = { NS: NS, GEREEDSCHAP: GEREEDSCHAP, el: el, maakDefs: maakDefs,
    tekenVorm: tekenVorm, grepenVan: grepenVan, tekenGreep: tekenGreep };
})();
