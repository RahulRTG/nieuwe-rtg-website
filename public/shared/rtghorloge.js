/* Het RTG-signatuurhorloge: een compleet, opengewerkt (skeleton) horloge dat
   naast de Rahul-lippen het tweede gezicht van RTG wordt. Een eigen concept in
   de taal van drie scholen tegelijk:
     - Audemars Piguet  -> het achthoekige cassement met acht schroeven, de
       toegepaste baton-index en het volledig opengewerkte uurwerk;
     - Rolex            -> de leesbaarheid: een heldere minutenbaan, een datum op
       3 uur met een cycloop-loep, forse gevulde wijzers;
     - Porsche          -> de techniek: matte, donkere diepte, een strak
       instrument-ritme en een enkele bordeaux secondepunt als accent.

   Wiskundig kloppend (foutmarge 0,0): de wijzers en het gaande werk lopen op
   public/shared/horlogewerk.js -- de exacte, in Node getoetste mechaniek. De
   secondewijzer en het secondewiel draaien in exact hetzelfde tempo, de balans
   klopt op precies 4 Hz (28.800 halveslagen/uur).

   Techniek, bewust gesplitst zodat elk stuk zijn sterkste kant laat zien:
     - WebGL tekent het LEVENDE, belichte 3D-uurwerk in de wijzerplaat-holte
       (tandwielen die op de echte tijd draaien, een kloppende balans, de veer)
       plus het saffierglas met een meeschuivende reflectie;
     - SVG legt er haarscherp de vaste onderdelen overheen: het achthoekige
       cassement met schroeven, de minutenbaan, de toegepaste indexen, de drie
       wijzers, de datum met cycloop, de robijnen (jewels) en de RTG-signatuur.

   Zonder WebGL of bij prefers-reduced-motion valt het terug op een volledig
   leesbaar, stilstaand SVG-horloge -- nooit een lege plek.

   Zelf-installerend op elk element met [data-rtg-horloge]. */
(function (root) {
  'use strict';

  /* ---- pure meetkunde (ook in Node; los getoetst in test/rtghorloge.test.js) ---- */
  // een klok-hoek (graden, 0 = 12 uur, met de klok mee) -> punt op straal r
  function opKlok(hoek, r, cx, cy) {
    var a = hoek * Math.PI / 180;
    return { x: (cx || 0) + r * Math.sin(a), y: (cy || 0) - r * Math.cos(a) };
  }
  // de acht hoekpunten van het achthoekige cassement (met een platte kant boven)
  function achthoek(r, cx, cy) {
    var p = [];
    for (var k = 0; k < 8; k++) p.push(opKlok(22.5 + k * 45, r, cx, cy));
    return p;
  }
  // de twaalf uur-hoeken (graden)
  function uurHoeken() { var u = []; for (var i = 0; i < 12; i++) u.push(i * 30); return u; }

  var api = { opKlok: opKlok, achthoek: achthoek, uurHoeken: uurHoeken };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  /* ---- browser ---- */
  if (!root || !root.document) return;
  if (root.RTGHorloge) return;
  var doc = root.document;
  var RUSTIG = root.matchMedia && (matchMedia('(prefers-reduced-motion: reduce)').matches);
  var W = root.RTGHorlogewerk;   // de exacte mechaniek (horlogewerk.js)

  var HUISGOUD = [0.83, 0.66, 0.30], STAAL = [0.62, 0.67, 0.72], BORDEAUX = [0.62, 0.12, 0.22];

  /* ================= SVG: het vaste, haarscherpe horloge ================= */
  var SVGNS = 'http://www.w3.org/2000/svg';
  function E(naam, at) { var e = doc.createElementNS(SVGNS, naam); if (at) for (var k in at) e.setAttribute(k, at[k]); return e; }
  function pad(pts, dicht) { var d = ''; for (var i = 0; i < pts.length; i++) d += (i ? 'L' : 'M') + pts[i].x.toFixed(2) + ' ' + pts[i].y.toFixed(2) + ' '; return d + (dicht ? 'Z' : ''); }

  // een vlak SVG-tandwiel voor de terugval (zonder WebGL): een gouden schijf met
  // tandjes op de rand en open spaken
  function platTandwiel(cx, cy, r, tanden, kleur) {
    var g = E('g');
    g.appendChild(E('circle', { cx: cx, cy: cy, r: r, fill: 'none', stroke: kleur, 'stroke-width': r * 0.16 }));
    for (var t = 0; t < tanden; t++) { var a = t / tanden * 360, p1 = opKlok(a, r, cx, cy), p2 = opKlok(a, r + r * 0.14, cx, cy); g.appendChild(E('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, stroke: kleur, 'stroke-width': r * 0.12, 'stroke-linecap': 'round' })); }
    for (var s = 0; s < 4; s++) { var b = s / 4 * 360, e0 = opKlok(b, r * 0.16, cx, cy), e1 = opKlok(b, r * 0.86, cx, cy); g.appendChild(E('line', { x1: e0.x, y1: e0.y, x2: e1.x, y2: e1.y, stroke: kleur, 'stroke-width': r * 0.12, 'stroke-linecap': 'round' })); }
    g.appendChild(E('circle', { cx: cx, cy: cy, r: r * 0.2, fill: 'none', stroke: kleur, 'stroke-width': r * 0.1 }));
    return g;
  }

  function bouwPlaat(host, webActief) {
    var C = 500;
    var svg = E('svg', { viewBox: '0 0 1000 1000', class: 'rtgh-plaat', 'aria-hidden': 'true' });
    svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;';

    // ---- verlopen ----
    var defs = E('defs');
    defs.innerHTML =
      // gelaagd goud voor het cassement (champagne-hoogsel, rosé-midden, brons-schaduw)
      '<radialGradient id="rtghGoud" cx="40%" cy="30%" r="82%">' +
      '<stop offset="0%" stop-color="#FBEFC6"/><stop offset="28%" stop-color="#E7CB84"/>' +
      '<stop offset="58%" stop-color="#BE9646"/><stop offset="82%" stop-color="#856427"/>' +
      '<stop offset="100%" stop-color="#4E3A13"/></radialGradient>' +
      // gepolijste binnenrand van het cassement
      '<linearGradient id="rtghGoudRand" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#7E5F1E"/><stop offset="46%" stop-color="#F2DC97"/><stop offset="54%" stop-color="#EAD08A"/><stop offset="100%" stop-color="#54400F"/></linearGradient>' +
      // schroefkop (witgoud/staal)
      '<radialGradient id="rtghSchroef" cx="38%" cy="34%" r="72%">' +
      '<stop offset="0%" stop-color="#FBF7EC"/><stop offset="45%" stop-color="#CFC9B8"/>' +
      '<stop offset="100%" stop-color="#7C745E"/></radialGradient>' +
      // de donkere holte achter het uurwerk (Porsche-techniek)
      '<radialGradient id="rtghHolte" cx="50%" cy="46%" r="62%">' +
      '<stop offset="0%" stop-color="#241A1C"/><stop offset="58%" stop-color="#160F11"/><stop offset="100%" stop-color="#0A0708"/></radialGradient>' +
      // goud voor de wijzers
      '<linearGradient id="rtghWijzer" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0%" stop-color="#7C5C1C"/><stop offset="45%" stop-color="#F1DA98"/><stop offset="55%" stop-color="#F1DA98"/><stop offset="100%" stop-color="#7C5C1C"/></linearGradient>' +
      // robijn (jewel)
      '<radialGradient id="rtghRobijn" cx="38%" cy="34%" r="70%">' +
      '<stop offset="0%" stop-color="#E3577B"/><stop offset="55%" stop-color="#9E1C40"/><stop offset="100%" stop-color="#4E0C1E"/></radialGradient>' +
      // saffier-sheen bovenop (heel licht)
      '<radialGradient id="rtghGlas" cx="36%" cy="30%" r="75%">' +
      '<stop offset="0%" stop-color="rgba(255,255,255,0.20)"/><stop offset="34%" stop-color="rgba(255,255,255,0.05)"/><stop offset="100%" stop-color="rgba(255,255,255,0)"/></radialGradient>';
    svg.appendChild(defs);

    // ---- terugval zonder WebGL: een donkere holte + een stil skelet, zodat de
    // opening nooit leeg is (met WebGL levert die laag de holte + draaiende raderen) ----
    if (!webActief) {
      svg.appendChild(E('circle', { cx: C, cy: C, r: 360, fill: 'url(#rtghHolte)' }));
      var stil = E('g', { opacity: '0.9' });
      stil.appendChild(platTandwiel(C - 150, C + 140, 92, 22, '#7C6122'));
      stil.appendChild(platTandwiel(C + 12, C + 6, 78, 18, '#8A8F98'));
      stil.appendChild(platTandwiel(C + 150, C - 60, 60, 15, '#7C6122'));
      stil.appendChild(platTandwiel(C + 90, C - 200, 40, 12, '#8A8F98'));
      stil.appendChild(platTandwiel(C, C + 210, 108, 3, '#8A8F98'));   // de balans
      svg.appendChild(stil);
    }

    // ---- het achthoekige cassement (AP): een ring met een gat, zodat het
    // opengewerkte 3D-uurwerk (WebGL, eronder) in het midden zichtbaar blijft ----
    var caseOut = achthoek(492, C, C), bezelIn = achthoek(372, C, C);
    svg.appendChild(E('path', { d: pad(caseOut, true) + ' ' + pad(bezelIn, true), 'fill-rule': 'evenodd', fill: 'url(#rtghGoud)', stroke: '#5A4413', 'stroke-width': '2', 'stroke-linejoin': 'miter' }));
    // de gepolijste schuine binnenrand + de donkere rehaut rond de opening
    svg.appendChild(E('path', { d: pad(achthoek(452, C, C), true), fill: 'none', stroke: 'url(#rtghGoudRand)', 'stroke-width': '10', 'stroke-linejoin': 'miter' }));
    svg.appendChild(E('path', { d: pad(bezelIn, true), fill: 'none', stroke: '#3A2C10', 'stroke-width': '6', 'stroke-linejoin': 'miter' }));

    // ---- de acht zeshoekige schroeven (AP) op de cassement-hoeken ----
    for (var s = 0; s < 8; s++) {
      var mid = opKlok(22.5 + s * 45, 422, C, C);
      var hex = [];
      for (var h = 0; h < 6; h++) { var hp = opKlok(30 + h * 60, 20, mid.x, mid.y); hex.push(hp); }
      var g = E('g');
      g.appendChild(E('path', { d: pad(hex, true), fill: 'url(#rtghSchroef)', stroke: '#5B5545', 'stroke-width': '1.4' }));
      // de gleuf: alle schroeven in dezelfde richting (netjes, zoals AP dat doet)
      var a = opKlok(58, 12, mid.x, mid.y), b = opKlok(58 + 180, 12, mid.x, mid.y);
      g.appendChild(E('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: 'rgba(40,36,26,0.75)', 'stroke-width': '2.4', 'stroke-linecap': 'round' }));
      svg.appendChild(g);
    }

    // ---- de minutenbaan (Rolex-leesbaarheid, Porsche-instrument) ----
    var baan = E('g');
    for (var m = 0; m < 60; m++) {
      var hoek = m * 6, vijf = (m % 5 === 0);
      var p1 = opKlok(hoek, 366, C, C), p2 = opKlok(hoek, vijf ? 350 : 358, C, C);
      baan.appendChild(E('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, stroke: vijf ? '#E7CE86' : 'rgba(210,196,150,0.5)', 'stroke-width': vijf ? '3' : '1.4', 'stroke-linecap': 'round' }));
    }
    svg.appendChild(baan);

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

    // ---- een heel lichte saffier-sheen bovenop alles ----
    svg.appendChild(E('circle', { cx: C, cy: C, r: 372, fill: 'url(#rtghGlas)', 'pointer-events': 'none' }));

    host.appendChild(svg);
    return { svg: svg, gUur: gUur, gMin: gMin, gSec: gSec, dt: dt };
  }

  /* ================= WebGL: het levende 3D-uurwerk + saffierglas ================= */
  function ident() { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
  function mul(a, b) { var o = new Array(16); for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; }
  function T(x, y, z) { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]; }
  function S(s) { return [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1]; }
  function Rz(a) { var c = Math.cos(a), s = Math.sin(a); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
  function Rx(a) { var c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; }
  function persp(f, asp, n, ver) { var nf = 1 / (n - ver); return [f / asp, 0, 0, 0, 0, f, 0, 0, 0, 0, (ver + n) * nf, -1, 0, 0, 2 * ver * n * nf, 0]; }

  function M() { return { pos: [], nor: [] }; }
  function hoek(m, p, nn) { m.pos.push(p[0], p[1], p[2]); m.nor.push(nn[0], nn[1], nn[2]); }
  function tri(m, a, na, b, nb, c, nc) { hoek(m, a, na); hoek(m, b, nb); hoek(m, c, nc); }
  function quad(m, a, b, c, d, nn) { tri(m, a, nn, b, nn, c, nn); tri(m, a, nn, c, nn, d, nn); }
  function klaar(m) { return { pos: new Float32Array(m.pos), nor: new Float32Array(m.nor), n: m.pos.length / 3 }; }

  // een opengewerkt tandwiel op eenheidsmaat (tip-straal 1): geslepen tanden,
  // open spaken en een naaf met gat -> skelet
  function tandwiel(tanden, dik, spaken) {
    var m = M(), rTip = 1.0, rRoot = 0.80, rIn = 0.70, rHub = 0.26, rGat = 0.12;
    spaken = spaken || 5;
    var sB = Math.sin(0.85), cB = Math.cos(0.85);
    function pol(r, a, z) { return [r * Math.cos(a), r * Math.sin(a), z]; }
    // band rIn..rRoot boven
    var seg = tanden * 3;
    for (var i = 0; i < seg; i++) { var a0 = i / seg * 6.2831853, a1 = (i + 1) / seg * 6.2831853; quad(m, pol(rIn, a0, dik), pol(rRoot, a0, dik), pol(rRoot, a1, dik), pol(rIn, a1, dik), [0, 0, 1]); }
    // tanden
    for (var t = 0; t < tanden; t++) {
      var b = t / tanden * 6.2831853, w = 6.2831853 / tanden;
      var aR0 = b + w * 0.12, aT0 = b + w * 0.30, aT1 = b + w * 0.70, aR1 = b + w * 0.88;
      var nO0 = [Math.cos((aT0 + aR0) / 2) * sB, Math.sin((aT0 + aR0) / 2) * sB, cB];
      var nO1 = [Math.cos((aT1 + aR1) / 2) * sB, Math.sin((aT1 + aR1) / 2) * sB, cB];
      var nT = [Math.cos((aT0 + aT1) / 2) * sB * 0.5, Math.sin((aT0 + aT1) / 2) * sB * 0.5, Math.sqrt(1 - sB * sB * 0.25)];
      tri(m, pol(rRoot, aR0, dik), nO0, pol(rTip, aT0, dik * 0.55), nT, pol(rTip, aT1, dik * 0.55), nT);
      tri(m, pol(rRoot, aR0, dik), nO0, pol(rTip, aT1, dik * 0.55), nT, pol(rRoot, aR1, dik), nO1);
      quad(m, pol(rTip, aT0, dik * 0.55), pol(rTip, aT0, -dik), pol(rTip, aT1, -dik), pol(rTip, aT1, dik * 0.55), [Math.cos((aT0 + aT1) / 2), Math.sin((aT0 + aT1) / 2), 0]);
    }
    // spaken
    for (var sp = 0; sp < spaken; sp++) {
      var sa = sp / spaken * 6.2831853, c = Math.cos(sa), si = Math.sin(sa), px = -si, py = c, hw = 0.11;
      (function () { function pt(r, o) { return [r * c + px * o, r * si + py * o, dik]; } quad(m, pt(rHub, -hw), pt(rIn, -hw), pt(rIn, hw), pt(rHub, hw), [0, 0, 1]); })();
    }
    // naaf
    for (var j = 0; j < 36; j++) {
      var b0 = j / 36 * 6.2831853, b1 = (j + 1) / 36 * 6.2831853;
      quad(m, pol(rGat, b0, dik), pol(rHub, b0, dik), pol(rHub, b1, dik), pol(rGat, b1, dik), [0, 0, 1]);
      quad(m, pol(rGat, b0, dik), pol(rGat, b0, -dik), pol(rGat, b1, -dik), pol(rGat, b1, dik), [-Math.cos(b0), -Math.sin(b0), 0]);
    }
    return klaar(m);
  }
  // gladde geslepen ring (onrust/cassement-detail)
  function ringMesh(rIn, dik, seg) {
    var m = M(); seg = seg || 120; var sB = Math.sin(0.85), cB = Math.cos(0.85), rMid = (rIn + 1) / 2;
    function pol(r, a, z) { return [r * Math.cos(a), r * Math.sin(a), z]; }
    for (var i = 0; i < seg; i++) {
      var a0 = i / seg * 6.2831853, a1 = (i + 1) / seg * 6.2831853;
      var nO0 = [Math.cos(a0) * sB, Math.sin(a0) * sB, cB], nO1 = [Math.cos(a1) * sB, Math.sin(a1) * sB, cB];
      var nI0 = [-Math.cos(a0) * sB, -Math.sin(a0) * sB, cB], nI1 = [-Math.cos(a1) * sB, -Math.sin(a1) * sB, cB];
      tri(m, pol(1, a0, 0), nO0, pol(rMid, a0, dik), [0, 0, 1], pol(rMid, a1, dik), [0, 0, 1]);
      tri(m, pol(1, a0, 0), nO0, pol(rMid, a1, dik), [0, 0, 1], pol(1, a1, 0), nO1);
      tri(m, pol(rMid, a0, dik), [0, 0, 1], pol(rIn, a0, 0), nI0, pol(rIn, a1, 0), nI1);
      tri(m, pol(rMid, a0, dik), [0, 0, 1], pol(rIn, a1, 0), nI1, pol(rMid, a1, dik), [0, 0, 1]);
    }
    return klaar(m);
  }
  function onrustMesh() {
    var ring = ringMesh(0.82, 0.05, 96), mm = { pos: Array.prototype.slice.call(ring.pos), nor: Array.prototype.slice.call(ring.nor) };
    for (var s = 0; s < 3; s++) { var sa = s / 3 * 6.2831853, c = Math.cos(sa), si = Math.sin(sa), px = -si, py = c, hw = 0.06; (function () { function pt(r, o) { return [r * c + px * o, r * si + py * o, 0.03]; } quad(mm, pt(0, -hw), pt(0.88, -hw), pt(0.88, hw), pt(0, hw), [0, 0, 1]); })(); }
    return klaar(mm);
  }
  function spiraalMesh(winding) {
    var m = M(), seg = winding * 44, w = 0.014;
    function pt(k) { var a = k / 44 * 6.2831853, r = 0.06 + 0.022 * (k / 44); return [r * Math.cos(a), r * Math.sin(a)]; }
    for (var i = 0; i < seg; i++) { var p0 = pt(i), p1 = pt(i + 1), dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * w, ny = dx / l * w; quad(m, [p0[0] - nx, p0[1] - ny, 0.02], [p0[0] + nx, p0[1] + ny, 0.02], [p1[0] + nx, p1[1] + ny, 0.02], [p1[0] - nx, p1[1] - ny, 0.02], [0, 0, 1]); }
    return klaar(m);
  }
  // een vlakke, licht bolle schijf: de donkere wijzerplaat-holte achter het werk
  function schijfMesh(r, seg) {
    var m = M(); seg = seg || 120;
    for (var i = 0; i < seg; i++) {
      var a0 = i / seg * 6.2831853, a1 = (i + 1) / seg * 6.2831853;
      tri(m, [0, 0, 0.06], [0, 0, 1], [r * Math.cos(a0), r * Math.sin(a0), 0], [Math.cos(a0) * 0.3, Math.sin(a0) * 0.3, 0.95], [r * Math.cos(a1), r * Math.sin(a1), 0], [Math.cos(a1) * 0.3, Math.sin(a1) * 0.3, 0.95]);
    }
    return klaar(m);
  }
  // een geslepen skelet-brug (balk met afgeschuinde bovenkant)
  function brugMesh(len, br, dik) {
    var m = M(), hx = len / 2, hy = br / 2, top = [0, 0, 1];
    quad(m, [-hx, -hy * 0.6, dik], [hx, -hy * 0.6, dik], [hx, hy * 0.6, dik], [-hx, hy * 0.6, dik], top);
    quad(m, [-hx, -hy, 0], [hx, -hy, 0], [hx, -hy * 0.6, dik], [-hx, -hy * 0.6, dik], [0, -0.7, 0.7]);
    quad(m, [-hx, hy * 0.6, dik], [hx, hy * 0.6, dik], [hx, hy, 0], [-hx, hy, 0], [0, 0.7, 0.7]);
    return klaar(m);
  }

  var VERT = 'attribute vec3 aPos;attribute vec3 aNor;uniform mat4 uMVP;uniform mat4 uModel;varying vec3 vN;varying vec3 vP;' +
    'void main(){vN=mat3(uModel)*aNor;vec4 wp=uModel*vec4(aPos,1.0);vP=wp.xyz;gl_Position=uMVP*vec4(aPos,1.0);}';
  var FRAG = 'precision mediump float;varying vec3 vN;varying vec3 vP;uniform vec3 uLicht;uniform vec3 uKleur;' +
    'void main(){vec3 n=normalize(vN);vec3 l=normalize(uLicht);float d=max(dot(n,l),0.0);' +
    'vec3 v=normalize(vec3(0.0,0.0,3.2)-vP);vec3 h=normalize(l+v);float sp=pow(max(dot(n,h),0.0),36.0);' +
    'vec3 k=uKleur*(0.22+0.72*d)+vec3(1.0,0.95,0.84)*sp*0.5;gl_FragColor=vec4(k,1.0);}';
  var VGLAS = 'attribute vec2 aPos;varying vec2 vP;void main(){vP=aPos;gl_Position=vec4(aPos,0.0,1.0);}';
  var FGLAS = 'precision mediump float;varying vec2 vP;uniform vec2 uGlans;uniform float uR;' +
    'void main(){float rr=length(vP);if(rr>uR)discard;' +
    'float streep=smoothstep(0.62,0.0,distance(vP,uGlans))*0.10;' +
    'float rand=smoothstep(uR,uR-0.12,rr)*0.08;float koepel=smoothstep(uR,0.15,rr)*0.035;' +
    'vec3 k=vec3(0.80,0.89,1.0)*streep+vec3(0.90,0.95,1.0)*(rand+koepel);' +
    'gl_FragColor=vec4(k,streep+rand+koepel);}';
  function shader(gl, t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; }
  function prog(gl, v, f) { var a = shader(gl, gl.VERTEX_SHADER, v), b = shader(gl, gl.FRAGMENT_SHADER, f); if (!a || !b) return null; var p = gl.createProgram(); gl.attachShader(p, a); gl.attachShader(p, b); gl.linkProgram(p); return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null; }
  function buffer(gl, arr) { var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); return b; }

  function bouwWebGL(host) {
    if (RUSTIG) return null;
    var canvas = doc.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    var gl = null;
    try { gl = canvas.getContext('webgl', { alpha: true, antialias: true, depth: true, preserveDrawingBuffer: true }); } catch (e) { gl = null; }
    if (!gl) return null;
    var pM = prog(gl, VERT, FRAG), pG = prog(gl, VGLAS, FGLAS);
    if (!pM || !pG) return null;
    // het canvas onder de wijzerplaat-SVG (die tekent er het glas/holte overheen)
    host.insertBefore(canvas, host.firstChild);

    var G = {
      schijf: gpu(schijfMesh(0.94)),
      barrel: gpu(tandwiel(60, 0.05, 6)), midden: gpu(tandwiel(40, 0.05, 5)),
      derde: gpu(tandwiel(24, 0.045, 4)), vierde: gpu(tandwiel(21, 0.045, 4)),
      escape: gpu(tandwiel(15, 0.04, 3)), onrust: gpu(onrustMesh()), veer: gpu(spiraalMesh(5)),
      brug: gpu(brugMesh(1.0, 0.14, 0.05))
    };
    function gpu(mesh) { return { p: buffer(gl, mesh.pos), n: buffer(gl, mesh.nor), c: mesh.n }; }
    var quadBuf = buffer(gl, new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]));

    // het gaande werk: de middelpunten liggen op EXACT meshende afstand -- voor
    // elk grijpend paar geldt afstand = steekstraal_a + steekstraal_b (steekstraal
    // ~ 0,82 x de tip-straal r). Zo raken de tandkransen elkaar echt. Buren draaien
    // bovendien tegengesteld (omk), zodat het als een echt treintje ineengrijpt.
    // Keten: veer(barrel) -> midden -> derde -> vierde(seconde) -> anker -> balans.
    var trein = [
      { g: G.barrel, r: 0.25, x: -0.243, y: 0.243, kleur: HUISGOUD, bron: 'uur', omk: -1 },
      { g: G.midden, r: 0.17, x: 0.000, y: 0.000, kleur: STAAL, bron: 'midden', omk: 1 },
      { g: G.derde, r: 0.12, x: 0.205, y: -0.119, kleur: HUISGOUD, bron: 'derde', omk: 1 },
      { g: G.vierde, r: 0.135, x: 0.365, y: -0.253, kleur: STAAL, bron: 'vierde', omk: 1 },
      { g: G.escape, r: 0.075, x: 0.345, y: -0.425, kleur: HUISGOUD, bron: 'anker', omk: 1 }
    ];
    var balans = { r: 0.24, x: 0.0, y: -0.46 };
    // skelet-bruggen liggen langs de as tussen twee spillen (houden het werk vast)
    var bruggen = [
      { x: -0.12, y: 0.122, rot: -0.785, len: 0.42 },
      { x: 0.183, y: -0.126, rot: -0.606, len: 0.50 },
      { x: 0.190, y: -0.424, rot: -0.25, len: 0.34 }
    ];

    var uMVP = gl.getUniformLocation(pM, 'uMVP'), uModel = gl.getUniformLocation(pM, 'uModel'), uLicht = gl.getUniformLocation(pM, 'uLicht'), uKleur = gl.getUniformLocation(pM, 'uKleur');
    var aP = gl.getAttribLocation(pM, 'aPos'), aN = gl.getAttribLocation(pM, 'aNor');
    var uGlans = gl.getUniformLocation(pG, 'uGlans'), uR = gl.getUniformLocation(pG, 'uR'), aPG = gl.getAttribLocation(pG, 'aPos');

    function maat() { var dpr = Math.min(2, root.devicePixelRatio || 1), w = Math.max(1, Math.round(host.clientWidth * dpr)), h = Math.max(1, Math.round(host.clientHeight * dpr)); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } }
    try { new ResizeObserver(maat).observe(host); } catch (e) {}
    maat();

    // camera: recht van voren met een heel lichte kanteling zodat het reliëf leeft
    var P = persp(3.05, 1, 0.1, 40), V = mul(T(0, 0.06, -3.2), Rx(-0.14));
    var VP = mul(P, V);

    function tekenMesh(buf, model, kleur, licht) {
      gl.uniformMatrix4fv(uMVP, false, new Float32Array(mul(VP, model)));
      gl.uniformMatrix4fv(uModel, false, new Float32Array(model));
      gl.uniform3fv(uLicht, new Float32Array(licht)); gl.uniform3fv(uKleur, new Float32Array(kleur));
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.p); gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.n); gl.enableVertexAttribArray(aN); gl.vertexAttribPointer(aN, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, buf.c);
    }

    function teken(d) {
      maat();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.disable(gl.BLEND);
      gl.useProgram(pM);
      var nu = d.getTime() / 1000, hoekL = nu * 0.5;
      var licht = [Math.cos(hoekL) * 0.8, 0.5 + Math.sin(hoekL) * 0.3, 1.0];
      var rad = W ? W.radHoeken(d) : { midden: 0, derde: 0, vierde: 0, anker: 0, uur: 0 };
      // de donkere wijzerplaat-holte achter het uurwerk (Porsche-diepte)
      tekenMesh(G.schijf, mul(T(0, -0.04, -0.30), S(1)), [0.115, 0.055, 0.07], licht);
      // skelet-bruggen (achter de raderen, in goud, laag)
      for (var bi = 0; bi < bruggen.length; bi++) { var br = bruggen[bi]; tekenMesh(G.brug, mul(mul(mul(T(br.x, br.y, -0.06), Rz(br.rot)), S(br.len)), S(1)), [0.55, 0.43, 0.18], licht); }
      // het gaande werk op de exacte hoeken
      for (var i = 0; i < trein.length; i++) {
        var g = trein[i], deg = (rad[g.bron] || 0) * (g.omk || 1);
        tekenMesh(g.g, mul(mul(T(g.x, g.y, 0.02 + i * 0.012), Rz(deg * Math.PI / 180)), S(g.r)), g.kleur, licht);
      }
      // de balans: exact 4 Hz (onrust), met de haarveer
      var slag = (W ? W.onrust(d, 150) : 0) * Math.PI / 180;
      tekenMesh(G.veer, mul(mul(T(balans.x, balans.y, 0.03), Rz(slag)), S(balans.r * 0.7)), HUISGOUD, licht);
      tekenMesh(G.onrust, mul(mul(T(balans.x, balans.y, 0.05), Rz(slag)), S(balans.r)), STAAL, licht);
      // saffierglas (additief, geen diepte)
      gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(pG);
      gl.uniform1f(uR, 0.80); gl.uniform2f(uGlans, Math.cos(hoekL) * 0.36, 0.30 + Math.sin(hoekL) * 0.30);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf); gl.enableVertexAttribArray(aPG); gl.vertexAttribPointer(aPG, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    return { canvas: canvas, teken: teken };
  }

  /* ================= samenstellen + laten lopen ================= */
  function maak(host) {
    if (!host || host.dataset.rtghKlaar === '1') return; host.dataset.rtghKlaar = '1';
    host.style.position = host.style.position || 'relative';
    var web = bouwWebGL(host);         // eerst (onderop), daarna de scherpe SVG erover
    var P = bouwPlaat(host, !!web);

    // de wijzers + datum + het 3D-werk op de exacte tijd zetten
    function stel(d) {
      var w = W ? W.wijzerHoeken(d) : { seconde: 0, minuut: 0, uur: 0 };
      P.gUur.setAttribute('transform', 'rotate(' + w.uur.toFixed(3) + ' 500 500)');
      P.gMin.setAttribute('transform', 'rotate(' + w.minuut.toFixed(3) + ' 500 500)');
      P.gSec.setAttribute('transform', 'rotate(' + w.seconde.toFixed(3) + ' 500 500)');
      P.dt.textContent = String(d.getDate());
      if (web) web.teken(d);
    }
    stel(new Date());

    if (RUSTIG) return;   // stilstaand maar volledig leesbaar
    (function lus() {
      if (host.offsetParent !== null || host.getClientRects().length) { stel(new Date()); requestAnimationFrame(lus); }
      else setTimeout(lus, 700);
    })();

    // zachte parallax-kanteling met de muis (3D-gevoel, ook zonder WebGL);
    // niets op grof aanwijzen (touch) of bij minder beweging
    if (!(root.matchMedia && matchMedia('(pointer: coarse)').matches)) {
      host.style.transformStyle = 'preserve-3d';
      host.addEventListener('pointermove', function (e) {
        var r = host.getBoundingClientRect(); if (!r.width) return;
        var px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        host.style.transform = 'perspective(1400px) rotateX(' + (-py * 9).toFixed(2) + 'deg) rotateY(' + (px * 9).toFixed(2) + 'deg)';
      });
      host.addEventListener('pointerleave', function () { host.style.transform = 'perspective(1400px)'; });
    }
  }

  function alles() { try { doc.querySelectorAll('[data-rtg-horloge]').forEach(maak); } catch (e) {} }
  root.RTGHorloge = { maak: maak, alles: alles };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', alles);
  else alles();
})(typeof self !== 'undefined' ? self : this);
