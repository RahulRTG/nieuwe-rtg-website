/* de zigzag: de bits in de QR-matrix leggen */
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
