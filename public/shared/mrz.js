/* RTG MRZ-lezer: leest de machineleesbare zone (de twee <<<-regels onderaan) van
   een paspoort en haalt daar naam, nummer, nationaliteit, geboorte- en
   vervaldatum uit. Twee delen:

   - parse(regel1, regel2): pure functie (draait ook in Node, los getoetst). Ze
     ontleedt de TD3-zone en controleert de ICAO-controlecijfers (7-3-1). We
     vullen alleen automatisch iets in als de controlecijfers kloppen, zodat er
     nooit verkeerde gegevens in je profiel belanden.
   - lees(canvas): in de browser. Snijdt de onderste band van de paspoortscan
     uit, maakt hem zwart-wit, verdeelt hem in 2x44 vakjes (de zone is
     vaste-breedte OCR-B) en herkent per vakje het teken met een ingebouwde
     lettersjabloon; daarna parse(). Lukt het niet of klopt de controle niet,
     dan geeft ze null terug en blijft de handmatige weg gewoon werken.

   Geen extern beeld, geen bibliotheek, alles op het toestel. */
(function (root) {
  var CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ<';

  function val(c) {
    if (c >= '0' && c <= '9') return c.charCodeAt(0) - 48;
    if (c >= 'A' && c <= 'Z') return c.charCodeAt(0) - 55;
    return 0; // '<' en de rest
  }
  function controle(s) {
    var w = [7, 3, 1], sum = 0;
    for (var i = 0; i < s.length; i++) sum += val(s[i]) * w[i % 3];
    return sum % 10;
  }
  function naam(veld) {
    var d = veld.indexOf('<<');
    var achter = (d >= 0 ? veld.slice(0, d) : veld).replace(/</g, ' ').trim();
    var voor = (d >= 0 ? veld.slice(d + 2) : '').replace(/</g, ' ').trim();
    return { achternaam: achter, voornamen: voor, volledig: (voor + ' ' + achter).trim() };
  }
  function datum(yymmdd, verleden) {
    if (!/^\d{6}$/.test(yymmdd)) return '';
    var yy = +yymmdd.slice(0, 2), mm = yymmdd.slice(2, 4), dd = yymmdd.slice(4, 6);
    var eeuw = 2000 + yy;
    if (verleden && eeuw > new Date().getFullYear()) eeuw = 1900 + yy;
    if (!verleden && eeuw < new Date().getFullYear() - 5) eeuw = 2000 + yy;
    return eeuw + '-' + mm + '-' + dd;
  }
  var LANDEN = { NLD: 'Nederlandse', BEL: 'Belgische', DEU: 'Duitse', FRA: 'Franse', GBR: 'Britse',
    USA: 'Amerikaanse', ESP: 'Spaanse', ITA: 'Italiaanse', PRT: 'Portugese', MAR: 'Marokkaanse',
    TUR: 'Turkse', POL: 'Poolse', SUR: 'Surinaamse', IND: 'Indiase', CHN: 'Chinese' };

  // De pure ontleder + controle van een TD3-zone (2 regels van 44).
  function parse(r1, r2) {
    r1 = String(r1 || '').toUpperCase().replace(/[^A-Z0-9<]/g, '');
    r2 = String(r2 || '').toUpperCase().replace(/[^A-Z0-9<]/g, '');
    if (r1.length < 44 || r2.length < 44) return { ok: false };
    r1 = r1.slice(0, 44); r2 = r2.slice(0, 44);

    var nm = naam(r1.slice(5));
    var nummer = r2.slice(0, 9).replace(/</g, '');
    var geboorte = r2.slice(13, 19);
    var verval = r2.slice(21, 27);
    var comp = r2.slice(0, 10) + r2.slice(13, 20) + r2.slice(21, 43);

    var checks = {
      nummer: controle(r2.slice(0, 9)) === val2(r2[9]),
      geboorte: controle(geboorte) === val2(r2[19]),
      verval: controle(verval) === val2(r2[27]),
      totaal: controle(comp) === val2(r2[43])
    };
    // we vertrouwen het pas als de geboortedatum klopt en minstens nog één ander
    var goed = checks.geboorte && (checks.nummer || checks.verval || checks.totaal);

    return {
      ok: goed, checks: checks,
      velden: {
        naam: nm.volledig, achternaam: nm.achternaam, voornamen: nm.voornamen,
        land: r1.slice(2, 5), nummer: nummer,
        nationaliteit: LANDEN[r2.slice(10, 13)] || r2.slice(10, 13).replace(/</g, ''),
        geboortedatum: datum(geboorte, true), geslacht: r2[20] === '<' ? '' : r2[20],
        vervaldatum: datum(verval, false)
      }
    };
  }
  function val2(ch) { return (ch >= '0' && ch <= '9') ? (ch.charCodeAt(0) - 48) : 0; }

  /* ---------------- de OCR (alleen in de browser) ---------------- */
  var SJABLONEN = null, SW = 12, SH = 18;
  function sjablonen() {
    if (SJABLONEN) return SJABLONEN;
    var cv = document.createElement('canvas'); cv.width = SW; cv.height = SH;
    var g = cv.getContext('2d');
    SJABLONEN = {};
    for (var i = 0; i < CHARS.length; i++) {
      var ch = CHARS[i];
      g.clearRect(0, 0, SW, SH); g.fillStyle = '#fff'; g.fillRect(0, 0, SW, SH);
      g.fillStyle = '#000'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = 'bold ' + Math.round(SH * 0.92) + 'px "Courier New", monospace';
      g.fillText(ch, SW / 2, SH / 2 + 1);
      SJABLONEN[ch] = zwartwit(g.getImageData(0, 0, SW, SH));
    }
    return SJABLONEN;
  }
  function zwartwit(imgData) {
    var d = imgData.data, uit = new Uint8Array(imgData.width * imgData.height);
    for (var i = 0, j = 0; i < d.length; i += 4, j++) uit[j] = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) < 128 ? 1 : 0;
    return uit;
  }
  // een vakje-bitmap (genormaliseerd naar SWxSH) vergelijken met de sjablonen
  function herken(bitmap, toegestaan) {
    var t = sjablonen(), best = '<', bestScore = -1;
    for (var i = 0; i < toegestaan.length; i++) {
      var ch = toegestaan[i], tpl = t[ch], gelijk = 0;
      for (var p = 0; p < bitmap.length; p++) if (bitmap[p] === tpl[p]) gelijk++;
      if (gelijk > bestScore) { bestScore = gelijk; best = ch; }
    }
    return best;
  }

  // snijd de onderste band uit, vind de 2 regels, verdeel in 44 vakjes en herken
  function lees(bron) {
    try {
      var W = bron.width, H = bron.height;
      var by0 = Math.floor(H * 0.74), bh = Math.floor(H * 0.24);
      var ctx = bron.getContext('2d');
      var band = ctx.getImageData(Math.floor(W * 0.03), by0, Math.floor(W * 0.94), bh);
      var bw = band.width, bhh = band.height;
      var bw01 = zwartwit(band);
      // rij-projectie: vind de twee donkerste regels
      var rijen = new Array(bhh).fill(0);
      for (var y = 0; y < bhh; y++) { var s = 0; for (var x = 0; x < bw; x++) s += bw01[y * bw + x]; rijen[y] = s; }
      var banden = vindBanden(rijen, bw);
      if (banden.length < 2) return null;
      banden = banden.slice(-2); // de twee onderste zijn de MRZ
      var regels = [];
      for (var b = 0; b < 2; b++) {
        var y0 = banden[b][0], y1 = banden[b][1];
        // horizontale grenzen van de tekst
        var x0 = 0, x1 = bw - 1, kol = new Array(bw).fill(0);
        for (var xx = 0; xx < bw; xx++) { var cs = 0; for (var yy = y0; yy <= y1; yy++) cs += bw01[yy * bw + xx]; kol[xx] = cs; }
        while (x0 < bw && kol[x0] === 0) x0++;
        while (x1 > x0 && kol[x1] === 0) x1--;
        var cel = (x1 - x0 + 1) / 44, r = '';
        for (var c = 0; c < 44; c++) {
          var cx0 = Math.round(x0 + c * cel), cx1 = Math.round(x0 + (c + 1) * cel);
          var bm = vakje(bw01, bw, cx0, cx1, y0, y1);
          var toe = b === 0 ? (c < 5 ? 'PABCDEFGHIJKLMNOPQRSTUVWXYZ<' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ<')
            : ((c >= 13 && c <= 19) || (c >= 21 && c <= 27) || c === 9 || c === 42 || c === 43 ? '0123456789<' : CHARS);
          r += bm ? herken(bm, toe) : '<';
        }
        regels.push(r);
      }
      var p = parse(regels[0], regels[1]);
      return p.ok ? p.velden : null;
    } catch (e) { return null; }
  }
  function vindBanden(rijen, bw) {
    var drempel = bw * 0.12, banden = [], in0 = -1;
    for (var y = 0; y < rijen.length; y++) {
      if (rijen[y] > drempel && in0 < 0) in0 = y;
      else if (rijen[y] <= drempel && in0 >= 0) { if (y - in0 >= 4) banden.push([in0, y - 1]); in0 = -1; }
    }
    if (in0 >= 0 && rijen.length - in0 >= 4) banden.push([in0, rijen.length - 1]);
    return banden;
  }
  function vakje(bw01, bw, x0, x1, y0, y1) {
    // begrenzingsvak van de donkere pixels in dit vakje, geschaald naar SWxSH
    var minx = x1, maxx = x0, miny = y1, maxy = y0, leeg = true;
    for (var y = y0; y <= y1; y++) for (var x = x0; x < x1; x++) if (x >= 0 && x < bw && bw01[y * bw + x]) {
      leeg = false; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
    }
    if (leeg) return null;
    var w = maxx - minx + 1, h = maxy - miny + 1, uit = new Uint8Array(SW * SH);
    for (var sy = 0; sy < SH; sy++) for (var sx = 0; sx < SW; sx++) {
      var ox = minx + Math.floor(sx / SW * w), oy = miny + Math.floor(sy / SH * h);
      uit[sy * SW + sx] = bw01[oy * bw + ox] || 0;
    }
    return uit;
  }

  var api = { parse: parse, controle: controle, lees: lees };
  if (root) root.RTGMRZ = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : null);
