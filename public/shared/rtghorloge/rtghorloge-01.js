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

