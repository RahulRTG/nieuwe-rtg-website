    // ---- toegepaste baton-indexen (AP), dubbel op 12 ----
    var idx = E('g');
    uurHoeken().forEach(function (hoek) {
      function baton(off, w, len) {
        var top = opKlok(hoek, 344, C, C);
        var b = E('rect', { x: (top.x - w / 2 + off).toFixed(2), y: (top.y - 0).toFixed(2), width: w, height: len, rx: 2, fill: 'url(#rtghGoudRand)', stroke: '#4C3A12', 'stroke-width': '1' });
        b.setAttribute('transform', 'rotate(' + hoek + ' ' + top.x.toFixed(2) + ' ' + top.y.toFixed(2) + ')');
        idx.appendChild(b);
      }
      if (hoek === 0) { baton(-9, 11, 46); baton(9, 11, 46); }   // dubbele index op 12
      else baton(0, 15, 40);
    });
    svg.appendChild(idx);

    // ---- datum met cycloop (Rolex) op 3 uur ----
    var dpos = opKlok(90, 250, C, C);
    var datum = E('g', { class: 'rtgh-datum' });
    datum.appendChild(E('rect', { x: dpos.x - 42, y: dpos.y - 32, width: 84, height: 64, rx: 8, fill: '#F3ECDD', stroke: 'url(#rtghGoudRand)', 'stroke-width': '4' }));
    var dt = E('text', { x: dpos.x, y: dpos.y + 20, 'text-anchor': 'middle', 'font-family': 'Inter,system-ui,sans-serif', 'font-weight': '700', 'font-size': '52', fill: '#141013' });
    datum.appendChild(dt);
    // de loep (cycloop): licht vergrootglas-bolling
    datum.appendChild(E('circle', { cx: dpos.x, cy: dpos.y, r: 46, fill: 'url(#rtghGlas)', stroke: 'rgba(255,255,255,0.28)', 'stroke-width': '2' }));
    svg.appendChild(datum);

    // ---- de RTG-signatuur (hoog in de 12-zone, met een dunne donkere rand voor
    // leesbaarheid over het opengewerkte werk) ----
    var merk = E('g', { 'paint-order': 'stroke', stroke: 'rgba(18,12,8,0.85)', 'stroke-width': '4', 'stroke-linejoin': 'round' });
    var t1 = E('text', { x: C, y: 258, 'text-anchor': 'middle', 'font-family': "'Bodoni Moda',Georgia,serif", 'font-weight': '600', 'font-size': '52', fill: '#EFDDA2', 'letter-spacing': '5' }); t1.textContent = 'RTG';
    var t2 = E('text', { x: C, y: 286, 'text-anchor': 'middle', 'font-family': 'Inter,system-ui,sans-serif', 'font-weight': '600', 'font-size': '15', fill: '#E6D6A0', 'stroke-width': '3', 'letter-spacing': '3.5' }); t2.textContent = 'RAHUL TRAVEL GROUP';
    merk.appendChild(t1); merk.appendChild(t2);
    svg.appendChild(merk);

    // ---- robijnen (jewels) op de spil-punten van het gaande werk ----
    // (NDC-posities van de raderen; hieronder in het WebGL-deel gelijkgehouden)
    // de spil-punten (gelijk aan de raderposities in het WebGL-gaande werk)
    var jewels = [[0.0, 0.0], [0.205, -0.119], [0.365, -0.253], [0.345, -0.425], [-0.243, 0.243], [0.0, -0.46]];
    var jg = E('g');
    jewels.forEach(function (n) {
      var vx = C + n[0] * C, vy = C - n[1] * C;
      jg.appendChild(E('circle', { cx: vx, cy: vy, r: 11, fill: 'none', stroke: 'url(#rtghGoudRand)', 'stroke-width': '3' }));
      jg.appendChild(E('circle', { cx: vx, cy: vy, r: 7.5, fill: 'url(#rtghRobijn)' }));
    });
    svg.appendChild(jg);

    // ---- de drie wijzers (Rolex-vulling, AP-baton) ----
    function wijzer(len, staart, breed, klasse, punt) {
      var g = E('g', { class: klasse });
      // gevulde baton met een lichte lume-gleuf
      var b = breed / 2;
      var body = [
        { x: C - b, y: C - len * 0.16 }, { x: C - b * 0.7, y: C - len }, { x: C + b * 0.7, y: C - len }, { x: C + b, y: C - len * 0.16 },
        { x: C + b * 0.9, y: C + staart }, { x: C - b * 0.9, y: C + staart }
      ];
      g.appendChild(E('path', { d: pad(body, true), fill: 'url(#rtghWijzer)', stroke: '#3E2E0C', 'stroke-width': '1.4', 'stroke-linejoin': 'round' }));
      g.appendChild(E('path', { d: pad([{ x: C, y: C - len * 0.2 }, { x: C, y: C - len * 0.92 }], false), stroke: '#EDE0B4', 'stroke-width': breed * 0.34, 'stroke-linecap': 'round' }));
      if (punt) {
        // bordeaux secondepunt (Porsche-accent) + tegengewicht
        g.appendChild(E('line', { x1: C, y1: C - len * 0.62, x2: C, y2: C - len, stroke: '#9E1C40', 'stroke-width': breed * 0.9, 'stroke-linecap': 'round' }));
        g.appendChild(E('circle', { cx: C, cy: C + staart, r: breed * 1.7, fill: '#9E1C40', stroke: '#4E0C1E', 'stroke-width': '1' }));
      }
      return g;
    }
    var gUur = wijzer(232, 44, 30, 'rtgh-uur'), gMin = wijzer(330, 58, 22, 'rtgh-min');
    var gSec = wijzer(348, 96, 7, 'rtgh-sec', true);
    svg.appendChild(gUur); svg.appendChild(gMin); svg.appendChild(gSec);
    // de gouden centrale kap
    svg.appendChild(E('circle', { cx: C, cy: C, r: 16, fill: 'url(#rtghGoud)', stroke: '#4C3A12', 'stroke-width': '2' }));
    svg.appendChild(E('circle', { cx: C, cy: C, r: 5, fill: '#2A1F0A' }));

