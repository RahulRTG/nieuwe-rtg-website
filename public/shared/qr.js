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
    var n = M.n, idx = 0, dir = -1, col = n - 1;
    while (col > 0) {
      if (col === 6) col--; // sla timing-kolom over
      for (var t = 0; t < n; t++) {
        var row = dir === -1 ? n - 1 - t : t;
        for (var s = 0; s < 2; s++) {
          var cc = col - s;
          if (!M.res[row][cc]) { M.m[row][cc] = idx < bits.length ? bits[idx] : 0; idx++; }
        }
      }
      dir = -dir; col -= 2;
    }
  }
  function pasMask(M, k) {
    var fn = maskFn(k), out = [];
    for (var r = 0; r < M.n; r++) { out.push(M.m[r].slice()); for (var c = 0; c < M.n; c++) if (!M.res[r][c] && fn(r, c)) out[r][c] ^= 1; }
    return out;
  }
  function straf(grid) {
    var n = grid.length, p = 0, r, c;
    for (r = 0; r < n; r++) for (c = 0; c < n; c++) {
      if (c <= n - 5) { var v = grid[r][c], run = 1; while (c + run < n && grid[r][c + run] === v) run++; if (run >= 5) p += 3 + (run - 5); }
    }
    for (c = 0; c < n; c++) for (r = 0; r <= n - 5; r++) { var v2 = grid[r][c], run2 = 1; while (r + run2 < n && grid[r + run2][c] === v2) run2++; if (run2 >= 5) { p += 3 + (run2 - 5); r += run2 - 1; } }
    var donker = 0; for (r = 0; r < n; r++) for (c = 0; c < n; c++) donker += grid[r][c];
    var pct = donker * 100 / (n * n); p += Math.floor(Math.abs(pct - 50) / 5) * 10;
    return p;
  }

  /* ---------------- publieke encode ---------------- */
  function naarBytes(input) {
    if (typeof input !== 'string') return input;
    var out = []; for (var i = 0; i < input.length; i++) { var cp = input.charCodeAt(i); if (cp < 128) out.push(cp); else { var e = unescape(encodeURIComponent(input.charAt(i))); for (var j = 0; j < e.length; j++) out.push(e.charCodeAt(j)); } }
    return out;
  }
  function kiesVersie(len, modus, lvl) {
    for (var v = 1; v <= 10; v++) {
      var cap = dataCodewords(v, lvl) * 8;
      var overhead = 4 + telIndicator(v, modus);
      var nodig = modus === 'numeric' ? (overhead + Math.ceil(len / 3) * 10) : (overhead + len * 8);
      if (nodig <= cap) return v;
    }
    return null;
  }
  function encode(input, opts) {
    opts = opts || {};
    var lvl = opts.ecc || 'M';
    var numeriek = typeof input === 'string' && /^[0-9]+$/.test(input) && opts.modus !== 'byte';
    var modus = numeriek ? 'numeric' : 'byte';
    var payload = numeriek ? input : naarBytes(input);
    var len = numeriek ? input.length : payload.length;
    var v = opts.versie || kiesVersie(len, modus, lvl);
    if (!v) throw new Error('QR: te veel data voor versie 1-10 op niveau ' + lvl);
    var cw = maakData(payload, modus, v, lvl);
    var full = interleave(cw, v, lvl);
    var M = nieuweMatrix(v); zetFunctie(M, v); zetVersie(M, v);
    plaatsData(M, full);
    var beste = 0, besteStraf = Infinity, besteGrid = null;
    for (var k = 0; k < 8; k++) { var g = pasMask(M, k); zetFormatOp(g, M, lvl, k); var s = straf(g); if (s < besteStraf) { besteStraf = s; beste = k; besteGrid = g; } }
    return { size: M.n, versie: v, niveau: lvl, mask: beste, matrix: besteGrid };
  }
  // format-info op een concrete grid zetten (na masken)
  function zetFormatOp(grid, M, lvl, mask) {
    var f = bch15((NIVEAU_BITS[lvl] << 3) | mask), bitsArr = [];
    for (var i = 14; i >= 0; i--) bitsArr.push((f >> i) & 1);
    var coordsA = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
    for (var a = 0; a < 15; a++) grid[coordsA[a][0]][coordsA[a][1]] = bitsArr[a];
    for (var b = 0; b < 7; b++) grid[M.n - 1 - b][8] = bitsArr[b];
    for (var c = 0; c < 8; c++) grid[8][M.n - 8 + c] = bitsArr[7 + c];
  }

  /* ---------------- decode (voor de tests / offline fallback) ---------------- */
  function leesFormat(grid, n) {
    var bitsArr = [];
    var coordsA = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
    for (var a = 0; a < 15; a++) bitsArr.push(grid[coordsA[a][0]][coordsA[a][1]]);
    var val = 0; for (var i = 0; i < 15; i++) val = (val << 1) | bitsArr[i];
    val ^= 0x5412;
    // vind de geldige format-string met de kleinste Hamming-afstand
    var beste = -1, bestD = 99;
    for (var d = 0; d < 32; d++) { var cand = bch15(d) ^ 0x5412; var x = cand ^ val, cnt = 0; while (x) { cnt += x & 1; x >>= 1; } if (cnt < bestD) { bestD = cnt; beste = d; } }
    var lvlBits = beste >> 3, mask = beste & 7;
    var lvl = Object.keys(NIVEAU_BITS).filter(function (k) { return NIVEAU_BITS[k] === lvlBits; })[0];
    return { lvl: lvl, mask: mask };
  }
  function decode(res) {
    var grid = res.matrix, n = res.size, v = (n - 17) / 4;
    var fmt = leesFormat(grid, n);
    var M = nieuweMatrix(v); zetFunctie(M, v);
    var fn = maskFn(fmt.mask);
    // unmask + lees de databits in dezelfde zigzag-volgorde
    var bits = [], dir = -1, col = n - 1;
    while (col > 0) {
      if (col === 6) col--;
      for (var t = 0; t < n; t++) {
        var row = dir === -1 ? n - 1 - t : t;
        for (var s = 0; s < 2; s++) {
          var cc = col - s;
          if (!M.res[row][cc]) { var bit = grid[row][cc] ^ (fn(row, cc) ? 1 : 0); bits.push(bit); }
        }
      }
      dir = -dir; col -= 2;
    }
    // naar codewoorden
    var cw = []; for (var i = 0; i + 8 <= bits.length; i += 8) { var byte = 0; for (var b = 0; b < 8; b++) byte = (byte << 1) | bits[i + b]; cw.push(byte); }
    // de-interleave
    var lvl = fmt.lvl, groups = TAB[v][lvl].g, ec = TAB[v][lvl].ec, aantal = telBlokken(v, lvl);
    var dataLens = [], ecLens = [];
    groups.forEach(function (grp) { for (var i2 = 0; i2 < grp[0]; i2++) { dataLens.push(grp[1]); ecLens.push(ec); } });
    var maxData = Math.max.apply(null, dataLens);
    var blokken = dataLens.map(function () { return []; });
    var idx = 0;
    for (var c2 = 0; c2 < maxData; c2++) for (var b2 = 0; b2 < aantal; b2++) if (c2 < dataLens[b2]) { blokken[b2].push(cw[idx]); idx++; }
    // (EC-codewoorden negeren we bij het uitlezen; round-trip zonder ruis)
    var alleData = [];
    blokken.forEach(function (bl) { alleData = alleData.concat(bl); });
    // bitstroom terug
    var db = []; alleData.forEach(function (x) { for (var b3 = 7; b3 >= 0; b3--) db.push((x >> b3) & 1); });
    var p = 0; function neem(k) { var val = 0; for (var i3 = 0; i3 < k; i3++) val = (val << 1) | db[p++]; return val; }
    var modus = neem(4);
    if (modus === 4) { // byte
      var cnt = neem(telIndicator(v, 'byte')), bytes = [];
      for (var q = 0; q < cnt; q++) bytes.push(neem(8));
      return { tekst: bytesNaarStr(bytes), bytes: bytes, versie: v, niveau: lvl };
    } else if (modus === 1) { // numeric
      var cnt2 = neem(telIndicator(v, 'numeric')), uit = '';
      while (cnt2 > 0) { var g = Math.min(3, cnt2); var bitsN = g === 3 ? 10 : (g === 2 ? 7 : 4); var val2 = neem(bitsN); uit += String(val2).padStart(g, '0'); cnt2 -= g; }
      return { tekst: uit, versie: v, niveau: lvl };
    }
    return { tekst: null, versie: v, niveau: lvl };
  }
  function bytesNaarStr(bytes) {
    var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    try { return decodeURIComponent(escape(s)); } catch (e) { return s; }
  }

  var api = { encode: encode, decode: decode, rsEC: rsEC, _TAB: TAB };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RTGQR = api;
})(typeof self !== 'undefined' ? self : this);
