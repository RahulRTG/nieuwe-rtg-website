/* RTG Sterrenhemel: een diepe, levende sterrenkoepel in huisstijl - de rust van
   een Rolls-Royce Starlight-hemel, maar dan een heel firmament, en op de plek
   waar je echt bent.

   - Een vast, heel dicht stofveld van duizenden minuscule punten geeft de
     indruk van ontelbaar veel sterren; daaroverheen draait heel traag een bol
     met helderder punten, met echte diepte.
   - Sterren lichten af en toe kort op; af en toe trekt een vallende ster over.
   - En de echte sterrenbeelden staan waar ze op DIT moment vanaf JOUW plek aan
     de hemel staan: met je locatie (na toestemming) en de tijd rekenen we per
     beeld de hoogte en het kompaskwadrant uit. Wat onder de horizon staat, laten
     we weg; wie op het zuidelijk halfrond kijkt, ziet het Zuiderkruis, wie in
     het noorden kijkt de Grote Beer. Zonder locatie vallen we terug op een
     schatting uit je tijdzone.

   Gebruik:  RTGSterren.hang(elementOfSelector, { dichtheid, helderheid });
   Geen afhankelijkheden, geen extern beeld. */
(function () {
  if (window.RTGSterren) return;
  var RAD = Math.PI / 180;

  var KLEUREN = [
    { c: [237, 231, 218], w: 0.70 },
    { c: [201, 162, 75], w: 0.22 },
    { c: [194, 58, 94], w: 0.08 }
  ];
  function kies(r) { var s = 0; for (var i = 0; i < KLEUREN.length; i++) { s += KLEUREN[i].w; if (r <= s) return KLEUREN[i].c; } return KLEUREN[0].c; }

  /* De echte sterrenbeelden: hun plek aan de hemel (ra in uren, dec in graden,
     J2000) en hun herkenbare vorm als genormaliseerde 2D-punten (0..1) met de
     verbindingslijnen. De vorm wordt op het scherm gezet rond de berekende
     hoogte/azimut; "grootte" is de hoogte in graden aan de hemel. */
  var BEELDEN = [
    { naam: 'Orion', ra: 5.55, dec: 2, grootte: 22,
      s: [[0.75,0.13],[0.28,0.18],[0.62,0.49],[0.50,0.52],[0.38,0.55],[0.70,0.86],[0.30,0.88],[0.52,0.02]],
      l: [[1,0],[0,7],[1,7],[1,2],[2,3],[3,4],[4,0],[2,5],[4,6],[5,6]] },
    { naam: 'Grote Beer', ra: 11.3, dec: 54, grootte: 26,
      s: [[0.08,0.22],[0.10,0.44],[0.30,0.46],[0.32,0.29],[0.53,0.23],[0.73,0.17],[0.93,0.10]],
      l: [[0,1],[1,2],[2,3],[3,0],[3,4],[4,5],[5,6]] },
    { naam: 'Cassiopeia', ra: 0.9, dec: 62, grootte: 16,
      s: [[0.05,0.42],[0.28,0.13],[0.50,0.47],[0.72,0.13],[0.95,0.42]],
      l: [[0,1],[1,2],[2,3],[3,4]] },
    { naam: 'Leeuw', ra: 10.6, dec: 16, grootte: 22,
      s: [[0.92,0.30],[0.74,0.24],[0.60,0.30],[0.60,0.52],[0.30,0.58],[0.08,0.66],[0.44,0.70],[0.74,0.40]],
      l: [[0,1],[1,2],[2,3],[3,7],[7,1],[3,4],[4,6],[6,5],[4,5]] },
    { naam: 'Schorpioen', ra: 16.8, dec: -30, grootte: 24,
      s: [[0.14,0.08],[0.24,0.14],[0.36,0.16],[0.46,0.26],[0.52,0.44],[0.56,0.62],[0.66,0.76],[0.80,0.82],[0.90,0.72],[0.86,0.58]],
      l: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9]] },
    { naam: 'Zwaan', ra: 20.6, dec: 42, grootte: 20,
      s: [[0.5,0.05],[0.5,0.42],[0.5,0.7],[0.5,0.95],[0.18,0.34],[0.82,0.5]],
      l: [[0,1],[1,2],[2,3],[4,1],[1,5]] },
    { naam: 'Zuiderkruis', ra: 12.45, dec: -60, grootte: 9,
      s: [[0.50,0.04],[0.50,0.96],[0.14,0.52],[0.86,0.48]],
      l: [[0,1],[2,3]] }
  ];

  // sterrentijd en hoogte/azimut: waar staat een ra/dec nu, vanaf lat/lon?
  function lstGraden(lon, nu) {
    var jd = nu.getTime() / 86400000 + 2440587.5;
    var d = jd - 2451545.0;
    var gmst = 280.46061837 + 360.98564736629 * d;
    return ((gmst + lon) % 360 + 360) % 360;
  }
  function altAz(raUur, decGr, latGr, lonGr, nu) {
    var ha = (lstGraden(lonGr, nu) - raUur * 15) * RAD;
    var dec = decGr * RAD, lat = latGr * RAD;
    var alt = Math.asin(Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha));
    var az = Math.atan2(-Math.cos(dec) * Math.sin(ha), Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(ha));
    return { alt: alt / RAD, az: ((az / RAD) % 360 + 360) % 360 };
  }

  function hang(doel, opts) {
    doel = typeof doel === 'string' ? document.querySelector(doel) : doel;
    if (!doel) return null;
    opts = opts || {};
    var rustig = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    var cv = document.createElement('canvas');
    cv.className = 'rtg-sterren';
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;display:block;';
    if (getComputedStyle(doel).position === 'static') doel.style.position = 'relative';
    doel.insertBefore(cv, doel.firstChild);
    var g = cv.getContext('2d');
    var stof = document.createElement('canvas');
    var sg = stof.getContext('2d');

    var sterren = [], meteoren = [], flonkers = [];
    var breedte = 0, hoogte = 0, straal = 0, cx = 0, cy = 0;
    var CAM = 2.4, helder = (opts.helderheid == null ? 1 : opts.helderheid);

    // de waarnemer: eerst een schatting uit de tijdzone, daarna (na toestemming)
    // de echte locatie. Op het noordelijk halfrond kijken we naar het zuiden,
    // op het zuidelijk halfrond naar het noorden -- daar staan de mooiste beelden.
    var obs = { lat: 50, lon: -(new Date().getTimezoneOffset() / 60) * 15 };
    function facing() { return obs.lat >= 0 ? 180 : 0; }
    if (navigator.geolocation) {
      try {
        navigator.geolocation.getCurrentPosition(function (p) {
          obs = { lat: p.coords.latitude, lon: p.coords.longitude };
        }, function () {}, { enableHighAccuracy: false, timeout: 8000, maximumAge: 3600000 });
      } catch (e) {}
    }

    function zaaiStof() {
      stof.width = cv.width; stof.height = cv.height;
      sg.clearRect(0, 0, stof.width, stof.height);
      var n = Math.round(Math.min(stof.width * stof.height / 260, 9000) * (opts.dichtheid || 1));
      for (var i = 0; i < n; i++) {
        var r = Math.random(), k = kies(r);
        sg.fillStyle = 'rgba(' + k[0] + ',' + k[1] + ',' + k[2] + ',' + ((0.05 + Math.random() * 0.33) * helder).toFixed(3) + ')';
        sg.fillRect(Math.random() * stof.width, Math.random() * stof.height, (r > 0.985 ? 1.5 : 0.65) * dpr, (r > 0.985 ? 1.5 : 0.65) * dpr);
      }
    }
    function zaai() {
      var n = Math.round(Math.min(breedte * hoogte / 1100, 1300) * (opts.dichtheid || 1));
      sterren = [];
      for (var i = 0; i < n; i++) {
        var u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u), r = Math.random();
        sterren.push({ x: s * Math.cos(th), y: u, z: s * Math.sin(th), kleur: kies(r),
          mag: 0.35 + Math.random() * (r > 0.94 ? 1.5 : 0.7), fase: Math.random() * Math.PI * 2, flonker: 0.5 + Math.random() * 0.9 });
      }
    }
    function meet() {
      var r = doel.getBoundingClientRect();
      breedte = Math.max(1, r.width); hoogte = Math.max(1, r.height);
      cv.width = Math.round(breedte * dpr); cv.height = Math.round(hoogte * dpr);
      cx = cv.width / 2; cy = cv.height / 2;
      straal = Math.hypot(cv.width, cv.height) * 0.62;
      zaai(); zaaiStof();
    }

    var rotCa = 1, rotSa = 0, TILT = 0.32, ct = Math.cos(TILT), stt = Math.sin(TILT);
    function projSter(p) {
      var x1 = p[0] * rotCa + p[2] * rotSa, z1 = -p[0] * rotSa + p[2] * rotCa;
      var y2 = p[1] * ct - z1 * stt, z2 = p[1] * stt + z1 * ct, d = CAM - z2;
      return { x: cx + (x1 / d) * straal, y: cy + (y2 / d) * straal, z: z2 };
    }
    // een hoogte/azimut naar een schermpunt: azimut om de kijkrichting, hoogte
    // van (bijna) horizon onderin tot zenit bovenin
    var FOV = 230;
    function projHemel(alt, az) {
      var rel = ((az - facing() + 540) % 360) - 180;
      if (Math.abs(rel) > FOV / 2 || alt < 2) return null;
      return { x: cv.width * (0.5 + rel / FOV), y: cv.height * (0.93 - 0.86 * Math.min(1, alt / 90)) };
    }

    function spawnMeteoor() {
      var vanaf = Math.random(), x = (0.1 + Math.random() * 0.8) * cv.width, y = Math.random() * 0.35 * cv.height;
      var hoek = Math.PI / 4 + (Math.random() - 0.5) * 0.5, snel = (7 + Math.random() * 6) * dpr;
      meteoren.push({ x: x, y: y, vx: Math.cos(hoek) * snel * (vanaf < 0.5 ? 1 : -1), vy: Math.sin(hoek) * snel, leven: 0, duur: 42 + Math.random() * 26, lengte: (90 + Math.random() * 80) * dpr });
    }
    var volgendeMeteoor = 90 + Math.random() * 260;

    function verf(t) {
      g.clearRect(0, 0, cv.width, cv.height);
      g.drawImage(stof, 0, 0);

      var a = t * 0.000045; rotCa = Math.cos(a); rotSa = Math.sin(a);
      for (var i = 0; i < sterren.length; i++) {
        var p = sterren[i], pr = projSter([p.x, p.y, p.z]);
        if (pr.x < -4 || pr.y < -4 || pr.x > cv.width + 4 || pr.y > cv.height + 4) continue;
        var diep = (pr.z + 1) / 2, fl = rustig ? 1 : (0.62 + 0.38 * Math.sin(p.fase + t * 0.0011 * p.flonker));
        var alpha = Math.min(0.92, (0.14 + 0.5 * diep) * fl * p.mag * helder);
        if (alpha <= 0.012) continue;
        var maat = (0.42 + 1.15 * diep) * p.mag * dpr, k = p.kleur;
        if (p.mag > 1.15 && diep > 0.6) {
          var grad = g.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, maat * 3.4);
          grad.addColorStop(0, 'rgba(' + k[0] + ',' + k[1] + ',' + k[2] + ',' + (alpha * 0.5).toFixed(3) + ')');
          grad.addColorStop(1, 'rgba(' + k[0] + ',' + k[1] + ',' + k[2] + ',0)');
          g.fillStyle = grad; g.beginPath(); g.arc(pr.x, pr.y, maat * 3.4, 0, Math.PI * 2); g.fill();
        }
        g.fillStyle = 'rgba(' + k[0] + ',' + k[1] + ',' + k[2] + ',' + alpha.toFixed(3) + ')';
        g.beginPath(); g.arc(pr.x, pr.y, maat, 0, Math.PI * 2); g.fill();
      }

      if (!rustig) {
        if (Math.random() < 0.05 && flonkers.length < 14 && sterren.length) {
          var s0 = sterren[(Math.random() * sterren.length) | 0];
          flonkers.push({ p: [s0.x, s0.y, s0.z], leven: 0, duur: 34 + Math.random() * 30, kleur: s0.kleur });
        }
        for (var f = flonkers.length - 1; f >= 0; f--) {
          var fo = flonkers[f]; fo.leven++; var e = fo.leven / fo.duur;
          if (e >= 1) { flonkers.splice(f, 1); continue; }
          var pf = projSter(fo.p), puls = Math.sin(e * Math.PI), kf = fo.kleur, mf = (2.6 + 3.4 * puls) * dpr;
          var gg = g.createRadialGradient(pf.x, pf.y, 0, pf.x, pf.y, mf);
          gg.addColorStop(0, 'rgba(' + kf[0] + ',' + kf[1] + ',' + kf[2] + ',' + (0.85 * puls * helder).toFixed(3) + ')');
          gg.addColorStop(1, 'rgba(' + kf[0] + ',' + kf[1] + ',' + kf[2] + ',0)');
          g.fillStyle = gg; g.beginPath(); g.arc(pf.x, pf.y, mf, 0, Math.PI * 2); g.fill();
        }
      }

      // de echte sterrenbeelden, op hun werkelijke plek aan de hemel
      var nu = new Date();
      for (var b = 0; b < BEELDEN.length; b++) {
        var B = BEELDEN[b], aa = altAz(B.ra, B.dec, obs.lat, obs.lon, nu), mid = projHemel(aa.alt, aa.az);
        if (!mid) continue;
        var px = (B.grootte / FOV) * cv.width; // schaal in schermpixels
        var proj = [];
        for (var q = 0; q < B.s.length; q++) proj.push({ x: mid.x + (B.s[q][0] - 0.5) * px, y: mid.y + (B.s[q][1] - 0.5) * px });
        g.lineWidth = Math.max(1, 0.7 * dpr);
        var lijnA = Math.min(0.3, 0.12 + 0.2 * Math.min(1, aa.alt / 60)) * helder;
        g.strokeStyle = 'rgba(201,162,75,' + lijnA.toFixed(3) + ')';
        for (var L = 0; L < B.l.length; L++) {
          var p1 = proj[B.l[L][0]], p2 = proj[B.l[L][1]];
          g.beginPath(); g.moveTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.stroke();
        }
        for (var s2 = 0; s2 < proj.length; s2++) {
          var twk = rustig ? 1 : (0.72 + 0.28 * Math.sin(t * 0.002 + s2 + b));
          g.fillStyle = 'rgba(237,231,218,' + (0.82 * twk * helder).toFixed(3) + ')';
          g.beginPath(); g.arc(proj[s2].x, proj[s2].y, 1.7 * dpr, 0, Math.PI * 2); g.fill();
        }
      }

      if (!rustig) {
        if (--volgendeMeteoor <= 0) { spawnMeteoor(); volgendeMeteoor = 90 + Math.random() * 320; }
        for (var m = meteoren.length - 1; m >= 0; m--) {
          var mo = meteoren[m]; mo.leven++; mo.x += mo.vx; mo.y += mo.vy;
          var me = mo.leven / mo.duur;
          if (me >= 1 || mo.y > cv.height + 40) { meteoren.splice(m, 1); continue; }
          var fade = Math.sin(me * Math.PI), len = Math.hypot(mo.vx, mo.vy) || 1;
          var tx = mo.x - mo.vx / len * mo.lengte, ty = mo.y - mo.vy / len * mo.lengte;
          var mg = g.createLinearGradient(mo.x, mo.y, tx, ty);
          mg.addColorStop(0, 'rgba(255,248,224,' + (0.9 * fade).toFixed(3) + ')');
          mg.addColorStop(0.4, 'rgba(201,162,75,' + (0.4 * fade).toFixed(3) + ')');
          mg.addColorStop(1, 'rgba(201,162,75,0)');
          g.strokeStyle = mg; g.lineWidth = 1.6 * dpr; g.lineCap = 'round';
          g.beginPath(); g.moveTo(mo.x, mo.y); g.lineTo(tx, ty); g.stroke();
          g.fillStyle = 'rgba(255,250,235,' + (0.95 * fade).toFixed(3) + ')';
          g.beginPath(); g.arc(mo.x, mo.y, 1.6 * dpr, 0, Math.PI * 2); g.fill();
        }
      }
    }

    meet();
    var stop = false;
    var hermeet = function () { if (!stop) meet(); };
    window.addEventListener('resize', hermeet);
    if (rustig) { verf(8000); }
    else (function lus() { if (stop) return; if (cv.offsetParent !== null) verf(performance.now()); requestAnimationFrame(lus); })();

    return { stop: function () { stop = true; window.removeEventListener('resize', hermeet); if (cv.parentNode) cv.parentNode.removeChild(cv); } };
  }

  window.RTGSterren = { hang: hang };
})();
