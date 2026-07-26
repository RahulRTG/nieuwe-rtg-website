/* RTG QR: een eigen QR-code-codec (encode + decode), i.p.v. een extern pakket.
   Genoeg voor onze eigen doelen: een RTG Zegel of code als ECHTE, scanbare QR
   tonen (byte- en numerieke modus, EC-niveau L en M, versie 1-10). Puur JS,
   geen DOM in de kern: encode() geeft een booleaanse matrix terug; een dunne
   renderer (svg/canvas) zit apart. decode() leest een matrix weer uit, zodat we
   de encoder waterdicht kunnen round-trippen in de tests.

   Geen eigen cryptografie of magie: gewoon de QR-spec (ISO/IEC 18004) nagebouwd
   -- Galois-veld GF(256), Reed-Solomon, BCH voor de format/versie-info, de acht
   maskers met straf-score. Werkt zowel in de browser als in Node. */
(function (root) {
  'use strict';

  /* ---------------- GF(256), primitieve veelterm 0x11D ---------------- */
  var EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();
  function gfMul(a, b) { return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]]; }

  // generator-veelterm voor n EC-codewoorden
  function rsGen(n) {
    var g = [1];
    for (var i = 0; i < n; i++) {
      var ng = new Array(g.length + 1).fill(0);
      for (var j = 0; j < g.length; j++) {
        ng[j] ^= gfMul(g[j], EXP[i]);
        ng[j + 1] ^= g[j];
      }
      g = ng;
    }
    return g;
  }
  function rsEC(data, n) {
    // rsGen geeft de monische generator (oplopend in graad, met de leidende 1
    // achteraan); de rest-berekening wil de niet-leidende coefficienten in
    // AFLOPENDE graad. Dus: leidende term eraf en omdraaien.
    var g = rsGen(n).slice(0, n).reverse();
    var res = new Array(n).fill(0);
    for (var i = 0; i < data.length; i++) {
      var factor = data[i] ^ res[0];
      res.shift(); res.push(0);
      for (var j = 0; j < n; j++) res[j] ^= gfMul(g[j], factor);
    }
    return res;
  }

  /* ---------------- versie-tabellen (v1-10, niveau L en M) ---------------- */
  // per [versie][niveau]: { ec: EC-codewoorden per blok, groups: [[aantalBlokken, dataPerBlok], ...] }
  var TAB = {
    1: { L: { ec: 7, g: [[1, 19]] }, M: { ec: 10, g: [[1, 16]] } },
    2: { L: { ec: 10, g: [[1, 34]] }, M: { ec: 16, g: [[1, 28]] } },
    3: { L: { ec: 15, g: [[1, 55]] }, M: { ec: 26, g: [[1, 44]] } },
    4: { L: { ec: 20, g: [[1, 80]] }, M: { ec: 18, g: [[2, 32]] } },
    5: { L: { ec: 26, g: [[1, 108]] }, M: { ec: 24, g: [[2, 43]] } },
    6: { L: { ec: 18, g: [[2, 68]] }, M: { ec: 16, g: [[4, 27]] } },
    7: { L: { ec: 20, g: [[2, 78]] }, M: { ec: 18, g: [[4, 31]] } },
    8: { L: { ec: 24, g: [[2, 97]] }, M: { ec: 22, g: [[2, 38], [2, 39]] } },
    9: { L: { ec: 30, g: [[2, 116]] }, M: { ec: 22, g: [[3, 36], [2, 37]] } },
    10: { L: { ec: 18, g: [[2, 68], [2, 69]] }, M: { ec: 26, g: [[4, 43], [1, 44]] } }
  };
  var ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
    7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };
  // versie-informatie (18 bits) voor v7+ (BCH), als vaste strings uit de spec
  var VERSIE_INFO = { 7: '000111110010010100', 8: '001000010110111100', 9: '001001101010011001', 10: '001010010011010011' };

  function dataCodewords(v, lvl) { var s = 0; TAB[v][lvl].g.forEach(function (b) { s += b[0] * b[1]; }); return s; }
  function telBlokken(v, lvl) { var n = 0; TAB[v][lvl].g.forEach(function (b) { n += b[0]; }); return n; }
  function grootte(v) { return 17 + 4 * v; }

  /* ---------------- bitbuffer ---------------- */
  function Bits() { this.arr = []; }
  Bits.prototype.push = function (val, len) { for (var i = len - 1; i >= 0; i--) this.arr.push((val >> i) & 1); };
  Bits.prototype.lengte = function () { return this.arr.length; };

  function telIndicator(v, modus) {
    if (modus === 'numeric') return v <= 9 ? 10 : (v <= 26 ? 12 : 14);
    return v <= 9 ? 8 : 16; // byte
  }

  // maak het databit-blok voor een gegeven versie
  function maakData(bytes, modus, v, lvl) {
    var b = new Bits();
    if (modus === 'numeric') {
      b.push(1, 4); // 0001
      b.push(bytes.length, telIndicator(v, 'numeric'));
      var s = bytes; // hier is bytes een string van cijfers
      for (var i = 0; i < s.length; i += 3) {
        var groep = s.substr(i, 3);
        b.push(parseInt(groep, 10), groep.length === 3 ? 10 : (groep.length === 2 ? 7 : 4));
      }
    } else {
      b.push(4, 4); // 0100 byte
      b.push(bytes.length, telIndicator(v, 'byte'));
      for (var k = 0; k < bytes.length; k++) b.push(bytes[k], 8);
    }
    var totaal = dataCodewords(v, lvl) * 8;
    // terminator
    var rest = totaal - b.lengte();
    b.push(0, Math.min(4, Math.max(0, rest)));
    // uitvullen tot byte-grens
    while (b.lengte() % 8 !== 0) b.arr.push(0);
    // opvul-bytes 0xEC, 0x11
    var pad = [0xEC, 0x11], pi = 0;
    while (b.lengte() < totaal) { b.push(pad[pi % 2], 8); pi++; }
    // naar codewoorden
    var cw = [];
    for (var m = 0; m < b.arr.length; m += 8) { var byte = 0; for (var n = 0; n < 8; n++) byte = (byte << 1) | b.arr[m + n]; cw.push(byte); }
    return cw;
  }

  // splits in blokken, bereken EC, en interleave
  function interleave(cw, v, lvl) {
    var groups = TAB[v][lvl].g, ec = TAB[v][lvl].ec;
    var dataBlokken = [], ecBlokken = [], idx = 0;
    groups.forEach(function (grp) {
      for (var i = 0; i < grp[0]; i++) {
        var d = cw.slice(idx, idx + grp[1]); idx += grp[1];
        dataBlokken.push(d);
        ecBlokken.push(rsEC(d, ec));
      }
    });
    var uit = [];
    var maxData = Math.max.apply(null, dataBlokken.map(function (d) { return d.length; }));
    for (var c = 0; c < maxData; c++) for (var b2 = 0; b2 < dataBlokken.length; b2++) if (c < dataBlokken[b2].length) uit.push(dataBlokken[b2][c]);
    for (var e = 0; e < ec; e++) for (var b3 = 0; b3 < ecBlokken.length; b3++) uit.push(ecBlokken[b3][e]);
    return uit;
  }

  /* ---------------- matrix + functiepatronen ---------------- */
  function nieuweMatrix(v) {
    var n = grootte(v), m = [], res = [];
    for (var i = 0; i < n; i++) { m.push(new Array(n).fill(0)); res.push(new Array(n).fill(0)); }
    return { n: n, m: m, res: res }; // res: gereserveerd (functiepatroon)
  }
  function zetFinder(M, r, c) {
    for (var dr = -1; dr <= 7; dr++) for (var dc = -1; dc <= 7; dc++) {
      var rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= M.n || cc >= M.n) continue;
      var rand = (dr === -1 || dr === 7 || dc === -1 || dc === 7);
      var binnen = (dr >= 1 && dr <= 5 && dc >= 1 && dc <= 5);
      var kern = (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4);
      M.m[rr][cc] = (kern || (!binnen && !rand)) ? 1 : 0;
      M.res[rr][cc] = 1;
    }
  }
  function zetFunctie(M, v) {
    zetFinder(M, 0, 0); zetFinder(M, 0, M.n - 7); zetFinder(M, M.n - 7, 0);
    // timing
    for (var i = 8; i < M.n - 8; i++) { var b = i % 2 === 0 ? 1 : 0; M.m[6][i] = b; M.res[6][i] = 1; M.m[i][6] = b; M.res[i][6] = 1; }
    // alignment
    var pos = ALIGN[v];
    for (var a = 0; a < pos.length; a++) for (var b2 = 0; b2 < pos.length; b2++) {
      var r = pos[a], c = pos[b2];
      if (M.res[r][c]) continue; // botst met finder
      for (var dr = -2; dr <= 2; dr++) for (var dc = -2; dc <= 2; dc++) {
        var mag = Math.max(Math.abs(dr), Math.abs(dc));
        M.m[r + dr][c + dc] = (mag === 1) ? 0 : 1; M.res[r + dr][c + dc] = 1;
      }
    }
    // donkere module + gereserveerde format/versie-zones
    M.m[M.n - 8][8] = 1; M.res[M.n - 8][8] = 1;
    for (var k = 0; k < 9; k++) { if (!M.res[8][k]) M.res[8][k] = 2; if (!M.res[k][8]) M.res[k][8] = 2; }
    for (var k2 = 0; k2 < 8; k2++) { M.res[8][M.n - 1 - k2] = 2; M.res[M.n - 1 - k2][8] = 2; }
    if (v >= 7) for (var r2 = 0; r2 < 6; r2++) for (var c2 = 0; c2 < 3; c2++) { M.res[r2][M.n - 11 + c2] = 3; M.res[M.n - 11 + c2][r2] = 3; }
  }

  /* ---------------- format- en versie-info (BCH) ---------------- */
  function bch15(data5) {
    var d = data5 << 10, g = 0x537;
    for (var i = 14; i >= 10; i--) if ((d >> i) & 1) d ^= g << (i - 10);
    return ((data5 << 10) | (d & 0x3FF)) ^ 0x5412;
  }
  var NIVEAU_BITS = { L: 1, M: 0, Q: 3, H: 2 };
  function zetFormat(M, lvl, mask) {
    var f = bch15((NIVEAU_BITS[lvl] << 3) | mask);
    var bitsArr = []; for (var i = 14; i >= 0; i--) bitsArr.push((f >> i) & 1);
    // rond linksboven
    var coordsA = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
    for (var a = 0; a < 15; a++) { M.m[coordsA[a][0]][coordsA[a][1]] = bitsArr[a]; }
    // gespiegeld
    for (var b = 0; b < 7; b++) M.m[M.n - 1 - b][8] = bitsArr[b];
    for (var c = 0; c < 8; c++) M.m[8][M.n - 8 + c] = bitsArr[7 + c];
  }
  function zetVersie(M, v) {
    if (v < 7) return;
    var s = VERSIE_INFO[v]; if (!s) return;
    var bitsArr = s.split('').map(Number); // 18 bits, MSB eerst
    // spec: bit i (0=LSB) op posities; we plaatsen volgens de standaardvolgorde
    var idx = 17;
    for (var c = 0; c < 6; c++) for (var r = 0; r < 3; r++) {
      var bit = bitsArr[idx]; idx--;
      M.m[c][M.n - 11 + r] = bit; M.m[M.n - 11 + r][c] = bit;
    }
  }

  /* ---------------- masking ---------------- */
  function maskFn(k) {
    return [
      function (r, c) { return (r + c) % 2 === 0; },
      function (r, c) { return r % 2 === 0; },
      function (r, c) { return c % 3 === 0; },
      function (r, c) { return (r + c) % 3 === 0; },
      function (r, c) { return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; },
      function (r, c) { return (r * c) % 2 + (r * c) % 3 === 0; },
      function (r, c) { return ((r * c) % 2 + (r * c) % 3) % 2 === 0; },
      function (r, c) { return ((r + c) % 2 + (r * c) % 3) % 2 === 0; }
    ][k];
  }
  function plaatsData(M, codewords) {
    var bits = []; for (var i = 0; i < codewords.length; i++) for (var b = 7; b >= 0; b--) bits.push((codewords[i] >> b) & 1);
