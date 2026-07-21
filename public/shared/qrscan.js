/* RTG QR-scanner (beeld-decoder): van een grijswaardebeeld naar tekst, i.p.v.
   een extern scan-pakket. Vindt de drie zoekpatronen (de 1:1:3:1:1-verhouding),
   bepaalt de rastermaat en de grid-afmeting, sampelt elke module en geeft de
   matrix aan onze eigen QR-codec (public/shared/qr.js) om te decoderen.

   Werkt op ELK beeld: een gerenderde QR (voor de tests) of een camerabeeld
   (public/shared/scanner.js voert de videoframes hierin). Bewust voor een recht
   voor de camera gehouden code (as-uitgelijnd, milde rotatie ok); zware
   perspectiefcorrectie is een latere stap. Puur JS, geen DOM. */
(function (root) {
  'use strict';
  var QR = (typeof require !== 'undefined') ? require('./qr') : root.RTGQR;

  // grijswaarden -> zwart/wit met een gemiddelde-drempel (genoeg voor een
  // gerenderde code; scanner.js kan later Otsu doen voor lastig licht)
  function binariseer(gray, w, h) {
    var som = 0, i;
    for (i = 0; i < w * h; i++) som += gray[i];
    var drempel = som / (w * h);
    var bits = new Uint8Array(w * h);
    for (i = 0; i < w * h; i++) bits[i] = gray[i] < drempel ? 1 : 0; // 1 = donker
    return bits;
  }

  function past(a, b, c, d, e, mod) {
    var t = mod * 0.6;
    return mod >= 1 && Math.abs(a - mod) <= t && Math.abs(b - mod) <= t && Math.abs(c - 3 * mod) <= 3 * mod * 0.5 &&
      Math.abs(d - mod) <= t && Math.abs(e - mod) <= t;
  }
  // verticale bevestiging in kolom cx rond rij cy: een echt zoekpatroon heeft
  // ook verticaal de 1:1:3:1:1-verhouding (data-ruis vrijwel nooit allebei).
  function verticaalOk(bits, w, h, cx, cy) {
    cx = Math.round(cx);
    if (cx < 0 || cx >= w) return null;
    var runs = [], cur = bits[cx], len = 0, y;
    for (y = 0; y <= h; y++) { var v = y < h ? bits[y * w + cx] : -1; if (v === cur) { len++; } else { runs.push({ v: cur, len: len, end: y }); cur = v; len = 1; } }
    var idx = -1;
    for (var i = 0; i < runs.length; i++) { if (cy < runs[i].end) { idx = i; break; } }
    if (idx < 2 || idx + 2 >= runs.length) return null;
    if (runs[idx].v !== 1 || runs[idx - 1].v !== 0 || runs[idx - 2].v !== 1 || runs[idx + 1].v !== 0 || runs[idx + 2].v !== 1) return null;
    var c = runs[idx].len, b = runs[idx - 1].len, a = runs[idx - 2].len, d = runs[idx + 1].len, e = runs[idx + 2].len;
    var mod = (a + b + c + d + e) / 7;
    if (!past(a, b, c, d, e, mod)) return null;
    return runs[idx].end - runs[idx].len / 2; // verticaal midden = echte y van het patroon
  }

  // zoek per rij het patroon donker:licht:donker:licht:donker (1:1:3:1:1),
  // en bevestig elk kandidaat-midden ook verticaal
  function vindKandidaten(bits, w, h) {
    var kand = [];
    for (var y = 0; y < h; y++) {
      var runs = [], cur = bits[y * w], len = 0, x;
      for (x = 0; x <= w; x++) {
        var v = x < w ? bits[y * w + x] : -1;
        if (v === cur) { len++; } else { runs.push({ v: cur, len: len, end: x }); cur = v; len = 1; }
      }
      for (var i = 0; i + 4 < runs.length; i++) {
        if (runs[i].v !== 1 || runs[i + 1].v !== 0 || runs[i + 2].v !== 1 || runs[i + 3].v !== 0 || runs[i + 4].v !== 1) continue;
        var a = runs[i].len, b = runs[i + 1].len, c = runs[i + 2].len, d = runs[i + 3].len, e = runs[i + 4].len;
        var mod = (a + b + c + d + e) / 7;
        if (!past(a, b, c, d, e, mod)) continue;
        var cx = runs[i + 2].end - runs[i + 2].len / 2;
        var cy = verticaalOk(bits, w, h, cx, y + 0.5);
        if (cy == null) continue;
        kand.push({ x: cx, y: cy, mod: mod });
      }
    }
    return kand;
  }

  // groepeer de kandidaten in clusters (per zoekpatroon vele rij-treffers)
  function clusters(kand) {
    var cl = [];
    for (var i = 0; i < kand.length; i++) {
      var k = kand[i], gevonden = null;
      for (var j = 0; j < cl.length; j++) {
        var c = cl[j], dx = c.x - k.x, dy = c.y - k.y;
        if (Math.sqrt(dx * dx + dy * dy) < Math.max(3 * k.mod, 6)) { gevonden = c; break; }
      }
      if (gevonden) { gevonden.x = (gevonden.x * gevonden.n + k.x) / (gevonden.n + 1); gevonden.y = (gevonden.y * gevonden.n + k.y) / (gevonden.n + 1); gevonden.mod = (gevonden.mod * gevonden.n + k.mod) / (gevonden.n + 1); gevonden.n++; }
      else cl.push({ x: k.x, y: k.y, mod: k.mod, n: 1 });
    }
    cl.sort(function (p, q) { return q.n - p.n; });
    return cl;
  }

  function afstand(p, q) { var dx = p.x - q.x, dy = p.y - q.y; return Math.sqrt(dx * dx + dy * dy); }

  // kies uit de kandidaat-centra het drietal dat het best een rechthoekige,
  // gelijkbenige driehoek vormt met gelijke rastermaat: de drie echte
  // zoekpatronen scoren vrijwel nul, elk drietal met een valse treffer uit het
  // datavlak scoort veel slechter. Zo winnen niet simpelweg de meeste rij-hits.
  function drieluik(kand) {
    var beste = null, besteScore = Infinity, n = kand.length;
    for (var i = 0; i < n; i++) for (var j = i + 1; j < n; j++) for (var k = j + 1; k < n; k++) {
      var trio = [kand[i], kand[j], kand[k]];
      for (var t = 0; t < 3; t++) {
        var TL = trio[t], e1 = trio[(t + 1) % 3], e2 = trio[(t + 2) % 3];
        var v1x = e1.x - TL.x, v1y = e1.y - TL.y, v2x = e2.x - TL.x, v2y = e2.y - TL.y;
        var l1 = Math.sqrt(v1x * v1x + v1y * v1y), l2 = Math.sqrt(v2x * v2x + v2y * v2y);
        if (l1 < 2 || l2 < 2) continue;
        var legdiff = Math.abs(l1 - l2) / Math.max(l1, l2);           // benen even lang
        var cosang = Math.abs((v1x * v2x + v1y * v2y) / (l1 * l2));   // benen loodrecht
        var mmin = Math.min(TL.mod, e1.mod, e2.mod), mmax = Math.max(TL.mod, e1.mod, e2.mod);
        var modspread = (mmax - mmin) / ((mmin + mmax) / 2);          // gelijke rastermaat
        var score = legdiff * 2 + cosang * 2 + modspread;
        if (score < besteScore) { besteScore = score; beste = { TL: TL, e1: e1, e2: e2, score: score }; }
      }
    }
    return beste;
  }

  function decodeImage(gray, w, h) {
    var bits = binariseer(gray, w, h);
    var cl = clusters(vindKandidaten(bits, w, h));
    // houd de clusters met genoeg rij-treffers over (een echt zoekpatroon geeft
    // er vele) en beperk tot de sterkste, zodat het drietal-zoeken klein blijft
    var kand = cl.filter(function (c) { return c.n >= 2; });
    if (kand.length < 3) kand = cl;
    if (kand.length < 3) return null;
    if (kand.length > 16) kand = kand.slice(0, 16);
    var d = drieluik(kand);
    if (!d) return null;
    var TL = d.TL, X = d.e1, Y = d.e2;
    // X en Y zijn de twee beenpunten; het kruisproduct bepaalt welke rechtsboven
    // en welke linksonder ligt (met de y-as naar beneden hoort (tr-TL) x (bl-TL)
    // positief te zijn)
    var tr, bl;
    var cross = (X.x - TL.x) * (Y.y - TL.y) - (X.y - TL.y) * (Y.x - TL.x);
    if (cross > 0) { tr = X; bl = Y; } else { tr = Y; bl = X; }
    var mod = (TL.mod + tr.mod + bl.mod) / 3;
    if (mod < 1) return null;
    // afmeting: de zoekpatroon-centra staan op module (3,3),(3,dim-4),(dim-4,3)
    var dim = Math.round(afstand(TL, tr) / mod) + 7;
    // ronde af naar een geldige QR-maat (17+4v)
    dim = Math.round((dim - 17) / 4) * 4 + 17;
    if (dim < 21) dim = 21;
    var v = (dim - 17) / 4;
    if (v < 1 || v > 40) return null;
    // sampel elke module via een affiene afbeelding vanaf TL
    var span = dim - 7; // modules tussen de zoekpatroon-centra
    function sample(r, c) {
      var fx = (c - 3) / span, fy = (r - 3) / span;
      var px = TL.x + fx * (tr.x - TL.x) + fy * (bl.x - TL.x);
      var py = TL.y + fx * (tr.y - TL.y) + fy * (bl.y - TL.y);
      var xi = Math.round(px), yi = Math.round(py);
      if (xi < 0 || yi < 0 || xi >= w || yi >= h) return 0;
      return bits[yi * w + xi];
    }
    var matrix = [];
    for (var r = 0; r < dim; r++) { var rij = []; for (var c = 0; c < dim; c++) rij.push(sample(r, c)); matrix.push(rij); }
    try { return QR.decode({ size: dim, versie: v, matrix: matrix }); } catch (e) { return null; }
  }

  // hulp: een matrix naar een grijswaardebeeld (voor de tests en als referentie
  // voor de UI-renderer). schaal = pixels per module, quiet = stille rand.
  function render(matrix, schaal, quiet) {
    schaal = schaal || 4; quiet = quiet == null ? 4 : quiet;
    var n = matrix.length, W = (n + quiet * 2) * schaal;
    var gray = new Uint8Array(W * W); gray.fill(255);
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (matrix[r][c]) {
      for (var dy = 0; dy < schaal; dy++) for (var dx = 0; dx < schaal; dx++) {
        var py = (r + quiet) * schaal + dy, px = (c + quiet) * schaal + dx;
        gray[py * W + px] = 0;
      }
    }
    return { gray: gray, w: W, h: W };
  }

  var api = { decodeImage: decodeImage, render: render, binariseer: binariseer };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RTGQRScan = api;
})(typeof self !== 'undefined' ? self : this);
