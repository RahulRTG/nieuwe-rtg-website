/* RTG Sterrenhemel: een diepe, levende sterrenkoepel in huisstijl - de rust van
   een Rolls-Royce Starlight-hemel, maar dan een heel firmament.

   - Een vast, heel dicht stofveld van duizenden minuscule punten (ooit getekend
     op een eigen laag) geeft de indruk van ontelbaar veel sterren.
   - Daaroverheen draait heel traag een bol van helderder punten met echte
     diepte; enkele lichten af en toe kort op (een flonkering die uitgroeit).
   - Af en toe trekt een vallende ster over het beeld.
   - En er staan echte sterrenbeelden in: Orion, de Grote Beer (steelpan),
     Cassiopeia en het Zuiderkruis, met fijne verbindingslijnen.

   De kleuren komen uit het logo: gedempt wit, goud en een enkele bordeaux
   gloed, op een transparante grond. Wie minder beweging wil
   (prefers-reduced-motion) krijgt een stilstaand veld zonder vallende sterren.

   Gebruik:  RTGSterren.hang(elementOfSelector, { dichtheid, helderheid });
   Geen afhankelijkheden, geen extern beeld. */
(function () {
  if (window.RTGSterren) return;

  var KLEUREN = [
    { c: [237, 231, 218], w: 0.70 },   // gedempt wit (parelmoer)
    { c: [201, 162, 75], w: 0.22 },    // goud
    { c: [194, 58, 94], w: 0.08 }      // bordeaux op donker
  ];
  function kies(r) { var s = 0; for (var i = 0; i < KLEUREN.length; i++) { s += KLEUREN[i].w; if (r <= s) return KLEUREN[i].c; } return KLEUREN[0].c; }

  /* De echte sterrenbeelden: genormaliseerde 2D-vormen (0..1) plus de lijnen
     ertussen. Ze worden op een gekozen richting op de bol geplakt, zodat ze
     meedraaien met de hemel. De vormen zijn herkenbaar getekend. */
  var BEELDEN = [
    { naam: 'Orion', dir: [0.15, 0.10], span: 0.55,
      s: [[0.75,0.13],[0.28,0.18],[0.62,0.49],[0.50,0.52],[0.38,0.55],[0.70,0.86],[0.30,0.88],[0.52,0.02]],
      l: [[1,0],[0,7],[1,7],[1,2],[2,3],[3,4],[4,0],[2,5],[4,6],[5,6]] },
    { naam: 'Grote Beer', dir: [2.5, 0.55], span: 0.6,
      s: [[0.08,0.22],[0.10,0.44],[0.30,0.46],[0.32,0.29],[0.53,0.23],[0.73,0.17],[0.93,0.10]],
      l: [[0,1],[1,2],[2,3],[3,0],[3,4],[4,5],[5,6]] },
    { naam: 'Cassiopeia', dir: [4.1, -0.35], span: 0.5,
      s: [[0.05,0.42],[0.28,0.13],[0.50,0.47],[0.72,0.13],[0.95,0.42]],
      l: [[0,1],[1,2],[2,3],[3,4]] },
    { naam: 'Zuiderkruis', dir: [5.4, 0.7], span: 0.34,
      s: [[0.50,0.04],[0.50,0.96],[0.14,0.52],[0.86,0.48]],
      l: [[0,1],[2,3]] }
  ];

  // een richting (theta om y-as, phi hoogte) naar een eenheidsvector
  function richting(theta, phi) {
    var cp = Math.cos(phi);
    return [cp * Math.cos(theta), Math.sin(phi), cp * Math.sin(theta)];
  }
  function normeer(v) { var d = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0]/d, v[1]/d, v[2]/d]; }
  function kruis(a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }

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

    // een tweede, verborgen laag voor het vaste dichte stofveld (1x getekend)
    var stof = document.createElement('canvas');
    var sg = stof.getContext('2d');

    var sterren = [];        // de draaiende, helderder punten
    var beeldsterren = [];   // de sterren van de sterrenbeelden (3D-eenheidsvectoren)
    var flonkers = [];       // tijdelijk oplichtende sterren
    var meteoren = [];       // vallende sterren
    var breedte = 0, hoogte = 0, straal = 0, cx = 0, cy = 0;
    var CAM = 2.4;
    var helder = (opts.helderheid == null ? 1 : opts.helderheid);

    function zaaiStof() {
      // duizenden minuscule, vaste puntjes: het gevoel van ontelbaar veel sterren
      stof.width = cv.width; stof.height = cv.height;
      sg.clearRect(0, 0, stof.width, stof.height);
      var opp = stof.width * stof.height;
      var n = Math.round(Math.min(opp / 260, 9000) * (opts.dichtheid || 1));
      for (var i = 0; i < n; i++) {
        var r = Math.random();
        var k = kies(r);
        var a = (0.05 + Math.random() * 0.33) * helder;
        var maat = (r > 0.985 ? 1.5 : 0.65) * dpr;
        sg.fillStyle = 'rgba(' + k[0] + ',' + k[1] + ',' + k[2] + ',' + a.toFixed(3) + ')';
        sg.fillRect(Math.random() * stof.width, Math.random() * stof.height, maat, maat);
      }
    }
    function zaai() {
      var opp = breedte * hoogte;
      var n = Math.round(Math.min(opp / 1100, 1300) * (opts.dichtheid || 1));
      sterren = [];
      for (var i = 0; i < n; i++) {
        var u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
        var r = Math.random();
        sterren.push({ x: s * Math.cos(th), y: u, z: s * Math.sin(th),
          kleur: kies(r), mag: 0.35 + Math.random() * (r > 0.94 ? 1.5 : 0.7),
          fase: Math.random() * Math.PI * 2, flonker: 0.5 + Math.random() * 0.9 });
      }
      // de sterrenbeelden op de bol plakken
      beeldsterren = [];
      for (var b = 0; b < BEELDEN.length; b++) {
        var B = BEELDEN[b];
        var mid = richting(B.dir[0], B.dir[1]);
        var oost = normeer(kruis([0, 1, 0], mid)); if (!isFinite(oost[0])) oost = [1, 0, 0];
        var noord = normeer(kruis(mid, oost));
        var punten = [];
        for (var j = 0; j < B.s.length; j++) {
          var du = (B.s[j][0] - 0.5) * B.span, dv = (0.5 - B.s[j][1]) * B.span;
          var p = normeer([mid[0] + du*oost[0] + dv*noord[0], mid[1] + du*oost[1] + dv*noord[1], mid[2] + du*oost[2] + dv*noord[2]]);
          punten.push(p);
        }
        beeldsterren.push({ punten: punten, lijnen: B.l });
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

    // de rotatie + projectie van een eenheidsvector naar het scherm
    var rotCa = 1, rotSa = 0, TILT = 0.32, ct = Math.cos(TILT), st = Math.sin(TILT);
    function project(p) {
      var x1 = p[0] * rotCa + p[2] * rotSa;
      var z1 = -p[0] * rotSa + p[2] * rotCa;
      var y2 = p[1] * ct - z1 * st;
      var z2 = p[1] * st + z1 * ct;
      var d = CAM - z2;
      return { x: cx + (x1 / d) * straal, y: cy + (y2 / d) * straal, z: z2, d: d };
    }

    function spawnMeteoor() {
      // start ergens bovenin, schuin naar beneden, korte felle streep
      var vanaf = Math.random();
      var x = (0.1 + Math.random() * 0.8) * cv.width;
      var y = (Math.random() * 0.35) * cv.height;
      var hoek = (Math.PI / 4) + (Math.random() - 0.5) * 0.5; // ~45 graden
      var snel = (7 + Math.random() * 6) * dpr;
      meteoren.push({ x: x, y: y, vx: Math.cos(hoek) * snel * (vanaf < 0.5 ? 1 : -1), vy: Math.sin(hoek) * snel,
        leven: 0, duur: 42 + Math.random() * 26, lengte: (90 + Math.random() * 80) * dpr });
    }
    var volgendeMeteoor = 90 + Math.random() * 260;

    function verf(t) {
      g.clearRect(0, 0, cv.width, cv.height);
      // 1) het vaste stofveld eronder
      g.drawImage(stof, 0, 0);

      // 2) de draaiende heldere sterren
      var a = t * 0.000045;
      rotCa = Math.cos(a); rotSa = Math.sin(a);
      for (var i = 0; i < sterren.length; i++) {
        var p = sterren[i];
        var pr = project([p.x, p.y, p.z]);
        if (pr.x < -4 || pr.y < -4 || pr.x > cv.width + 4 || pr.y > cv.height + 4) continue;
        var diep = (pr.z + 1) / 2;
        var fl = rustig ? 1 : (0.62 + 0.38 * Math.sin(p.fase + t * 0.0011 * p.flonker));
        var alpha = Math.min(0.92, (0.14 + 0.5 * diep) * fl * p.mag * helder);
        if (alpha <= 0.012) continue;
        var maat = (0.42 + 1.15 * diep) * p.mag * dpr;
        var k = p.kleur;
        if (p.mag > 1.15 && diep > 0.6) {
          var grad = g.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, maat * 3.4);
          grad.addColorStop(0, 'rgba(' + k[0] + ',' + k[1] + ',' + k[2] + ',' + (alpha * 0.5).toFixed(3) + ')');
          grad.addColorStop(1, 'rgba(' + k[0] + ',' + k[1] + ',' + k[2] + ',0)');
          g.fillStyle = grad;
          g.beginPath(); g.arc(pr.x, pr.y, maat * 3.4, 0, Math.PI * 2); g.fill();
        }
        g.fillStyle = 'rgba(' + k[0] + ',' + k[1] + ',' + k[2] + ',' + alpha.toFixed(3) + ')';
        g.beginPath(); g.arc(pr.x, pr.y, maat, 0, Math.PI * 2); g.fill();
      }

      // 3) de flonkeringen: af en toe licht een ster kort op
      if (!rustig) {
        if (Math.random() < 0.05 && flonkers.length < 14 && sterren.length) {
          var s0 = sterren[(Math.random() * sterren.length) | 0];
          flonkers.push({ p: [s0.x, s0.y, s0.z], leven: 0, duur: 34 + Math.random() * 30, kleur: s0.kleur });
        }
        for (var f = flonkers.length - 1; f >= 0; f--) {
          var fo = flonkers[f]; fo.leven++;
          var e = fo.leven / fo.duur;
          if (e >= 1) { flonkers.splice(f, 1); continue; }
          var pf = project(fo.p);
          var puls = Math.sin(e * Math.PI);          // op en weer af
          var kf = fo.kleur, af = 0.85 * puls * helder;
          var mf = (2.6 + 3.4 * puls) * dpr;
          var gg = g.createRadialGradient(pf.x, pf.y, 0, pf.x, pf.y, mf);
          gg.addColorStop(0, 'rgba(' + kf[0] + ',' + kf[1] + ',' + kf[2] + ',' + af.toFixed(3) + ')');
          gg.addColorStop(1, 'rgba(' + kf[0] + ',' + kf[1] + ',' + kf[2] + ',0)');
          g.fillStyle = gg; g.beginPath(); g.arc(pf.x, pf.y, mf, 0, Math.PI * 2); g.fill();
        }
      }

      // 4) de sterrenbeelden: fijne gouden lijnen + iets helderder sterren
      for (var b = 0; b < beeldsterren.length; b++) {
        var bs = beeldsterren[b];
        var proj = [];
        for (var q = 0; q < bs.punten.length; q++) proj.push(project(bs.punten[q]));
        // lijnen (alleen als het beeld naar de kijker staat)
        g.lineWidth = Math.max(1, 0.7 * dpr);
        for (var L = 0; L < bs.lijnen.length; L++) {
          var p1 = proj[bs.lijnen[L][0]], p2 = proj[bs.lijnen[L][1]];
          var zichtbaar = (bs.punten[bs.lijnen[L][0]] && p1.z > -0.15 && p2.z > -0.15);
          if (!zichtbaar) continue;
          var lijnA = Math.min(0.28, 0.12 + 0.16 * ((p1.z + p2.z) / 2 + 1) / 2) * helder;
          g.strokeStyle = 'rgba(201,162,75,' + lijnA.toFixed(3) + ')';
          g.beginPath(); g.moveTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.stroke();
        }
        for (var s2 = 0; s2 < proj.length; s2++) {
          var ps = proj[s2]; if (ps.z <= -0.15) continue;
          var maat2 = (1.5 + 1.1 * ((ps.z + 1) / 2)) * dpr;
          var twk = rustig ? 1 : (0.7 + 0.3 * Math.sin(t * 0.002 + s2 + b));
          g.fillStyle = 'rgba(237,231,218,' + (0.8 * twk * helder).toFixed(3) + ')';
          g.beginPath(); g.arc(ps.x, ps.y, maat2, 0, Math.PI * 2); g.fill();
        }
      }

      // 5) vallende sterren
      if (!rustig) {
        if (--volgendeMeteoor <= 0) { spawnMeteoor(); volgendeMeteoor = 90 + Math.random() * 320; }
        for (var m = meteoren.length - 1; m >= 0; m--) {
          var mo = meteoren[m]; mo.leven++;
          mo.x += mo.vx; mo.y += mo.vy;
          var me = mo.leven / mo.duur;
          if (me >= 1 || mo.y > cv.height + 40) { meteoren.splice(m, 1); continue; }
          var fade = Math.sin(me * Math.PI);
          var tx = mo.x - mo.vx / Math.hypot(mo.vx, mo.vy) * mo.lengte;
          var ty = mo.y - mo.vy / Math.hypot(mo.vx, mo.vy) * mo.lengte;
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
    else (function lus() {
      if (stop) return;
      if (cv.offsetParent !== null) verf(performance.now());
      requestAnimationFrame(lus);
    })();

    return { stop: function () { stop = true; window.removeEventListener('resize', hermeet); if (cv.parentNode) cv.parentNode.removeChild(cv); } };
  }

  window.RTGSterren = { hang: hang };
})();
