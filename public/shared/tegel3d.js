/* De gedeelde 3D-tegellaag voor de werk-apps (kantoor, leverancier, overheid).
   Twee lichte, efficiente verrijkingen die een KPI-tegel laten leven zonder een
   zware 3D-scene per tegel:

   1. Diepte + kantel: een tegel met [data-tegel3d] (of de klasse kpi-tegel) krijgt
      een zachte perspectief-kanteling die met de muis meebeweegt en een lichte
      schaduw, alsof hij iets van de plaat af ligt. Op touch/coarse pointer en bij
      prefers-reduced-motion gebeurt er niets (rustig en zuinig).
   2. 3D-vonk: een <canvas data-vonk3d="3,5,4,8,6"> tekent een klein isometrisch
      staaf- of lijn-grafiekje (2.5D op een gewoon 2D-canvas, dus geen WebGL-
      context per tegel: goedkoop en overal betrouwbaar), in de huiskleuren.

   De pure meetkunde (isometrische projectie + de staafvlakken) draait ook in Node
   en is los getoetst (test/tegel3d.test.js). Zelf-installerend; werkt op later
   gerenderde tegels via een rustige, ontdubbelde observer. */
(function (root) {
  'use strict';

  /* ---- pure kern (ook in Node) ---- */
  // schuine (kabinet-)projectie voor een 2.5D-staafgrafiek: x is de horizontale
  // plek (vlakke basislijn: x raakt Y niet), y is de hoogte omhoog, z is de diepte
  // die het beeld schuin naar linksboven duwt (achterkant boven).
  var ISOX = 0.55, ISOY = 0.55;
  function iso(x, y, z, ox, oy) { return { X: ox + x - z * ISOX, Y: oy - y - z * ISOY }; }

  // de zichtbare vlakken (top, voor, zij) van elke staaf, op schermcoordinaten
  function staafVlakken(waarden, opts) {
    opts = opts || {};
    var n = waarden.length; if (!n) return [];
    var breed = opts.breedte || 100, hoog = opts.hoogte || 40, diepte = opts.diepte || 6, marge = opts.marge || 3;
    var max = Math.max.apply(null, waarden.map(function (v) { return Math.max(0, +v || 0); })) || 1;
    var ox = marge + diepte * ISOX, oy = hoog - marge;             // basislijn linksonder, ruimte voor de diepte
    var beschikbaarH = hoog - marge * 2 - diepte * ISOY;
    var gleuf = (breed - marge * 2 - diepte * ISOX) / n;           // ruimte per staaf incl. tussenruimte
    var bw = gleuf * 0.62;
    var uit = [];
    for (var i = 0; i < n; i++) {
      var v = Math.max(0, +waarden[i] || 0), h = (v / max) * beschikbaarH;
      var x0 = i * gleuf, x1 = x0 + bw, z0 = 0, z1 = diepte, y0 = 0, y1 = h;
      var P = function (x, y, z) { return iso(x, y, z, ox, oy); };
      uit.push({
        top: [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)],
        voor: [P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0)],
        zij: [P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0)],
        hoogte: h, waarde: v
      });
    }
    return uit;
  }

  // een muispositie (0..1) -> nette kantelhoeken (graden), begrensd
  function kantel(px, py, max) {
    max = max || 7;
    return { rx: (0.5 - py) * 2 * max, ry: (px - 0.5) * 2 * max };
  }

  var api = { iso: iso, staafVlakken: staafVlakken, kantel: kantel };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  /* ---- browser ---- */
  if (!root || !root.document) return;
  if (root.RTGTegel3D) return;
  var doc = root.document;
  var RUSTIG = (root.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) ||
    (root.matchMedia && matchMedia('(pointer: coarse)').matches);

  function kleurBij(el, val, terug) {
    try { var c = getComputedStyle(el).getPropertyValue(val); if (c && c.trim()) return c.trim(); } catch (e) {}
    return terug;
  }

  /* 1. diepte + kantel */
  function kantelbaar(el) {
    if (el.dataset.tegel3d === 'aan') return; el.dataset.tegel3d = 'aan';
    if (RUSTIG) return;
    el.style.transition = 'transform .18s ease, box-shadow .18s ease';
    el.style.willChange = 'transform';
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect(); if (!r.width) return;
      var k = kantel((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, 7);
      el.style.transform = 'perspective(680px) rotateX(' + k.rx.toFixed(2) + 'deg) rotateY(' + k.ry.toFixed(2) + 'deg) translateZ(6px)';
      el.style.boxShadow = '0 14px 30px rgba(0,0,0,.38)';
    });
    var terug = function () { el.style.transform = ''; el.style.boxShadow = ''; };
    el.addEventListener('pointerleave', terug);
    el.addEventListener('pointercancel', terug);
  }

  /* 2. 3D-vonk: een klein isometrisch grafiekje op een 2D-canvas */
  function tekenVonk(canvas) {
    if (canvas.dataset.vonkKlaar === '1') return; canvas.dataset.vonkKlaar = '1';
    var waarden = (canvas.dataset.vonk3d || '').split(',').map(Number).filter(function (v) { return isFinite(v); });
    if (!waarden.length) return;
    var soort = canvas.dataset.vonkSoort || 'staaf';
    var ctx = canvas.getContext('2d'); if (!ctx) return;
    var dpr = Math.min(2, root.devicePixelRatio || 1);
    var wCss = canvas.clientWidth || 110, hCss = canvas.clientHeight || 42;
    canvas.width = Math.round(wCss * dpr); canvas.height = Math.round(hCss * dpr);
    var goud = kleurBij(canvas, '--gold', '#C9A24B'), burg = kleurBij(canvas, '--burgundy-on-dark', '#C23A5E');
    var opts = { breedte: wCss, hoogte: hCss, diepte: 5, marge: 3 };

    function vlak(pts, vul) { ctx.beginPath(); ctx.moveTo(pts[0].X * dpr, pts[0].Y * dpr); for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].X * dpr, pts[i].Y * dpr); ctx.closePath(); ctx.fillStyle = vul; ctx.fill(); }
    function teken(vooruit) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      var vlakken = staafVlakken(waarden.map(function (v) { return v * vooruit; }), opts);   // laat de staafjes opgroeien
      if (soort === 'lijn') {
        // 2.5D lijn: een gouden pad over de staaftoppen (voorbovenhoek van elke staaf)
        ctx.beginPath();
        vlakken.forEach(function (s, i) { var p = s.top[0]; i ? ctx.lineTo(p.X * dpr, p.Y * dpr) : ctx.moveTo(p.X * dpr, p.Y * dpr); });
        ctx.strokeStyle = goud; ctx.lineWidth = 1.6 * dpr; ctx.lineJoin = 'round'; ctx.stroke();
        vlakken.forEach(function (s) { var p = s.top[0]; ctx.beginPath(); ctx.arc(p.X * dpr, p.Y * dpr, 1.4 * dpr, 0, 7); ctx.fillStyle = goud; ctx.fill(); });
        return;
      }
      vlakken.forEach(function (s) {
        vlak(s.voor, burg);                 // voorvlak (bordeaux)
        vlak(s.zij, 'rgba(0,0,0,.35)');     // zijvlak donker
        vlak(s.top, goud);                  // bovenvlak (goud, licht)
      });
    }
    if (RUSTIG) { teken(1); return; }
    var t0 = null;
    (function anim(ts) {
      if (t0 == null) t0 = ts; var p = Math.min(1, (ts - t0) / 550);
      teken(p * (2 - p));                 // ease-out: staafjes groeien op
      if (p < 1) requestAnimationFrame(anim);
    })(performance.now());
  }

  function verrijk(root2) {
    var scope = root2 || doc;
    try {
      scope.querySelectorAll('[data-tegel3d], .kpi-tegel').forEach(kantelbaar);
      scope.querySelectorAll('canvas[data-vonk3d]').forEach(tekenVonk);
    } catch (e) {}
  }
  root.RTGTegel3D = { verrijk: verrijk, vonk: tekenVonk, kantelbaar: kantelbaar };

  function start() {
    verrijk(doc);
    // later gerenderde tegels: een rustige, ontdubbelde observer
    var wacht = null;
    try {
      new MutationObserver(function () { if (wacht) return; wacht = setTimeout(function () { wacht = null; verrijk(doc); }, 250); })
        .observe(doc.body || doc.documentElement, { childList: true, subtree: true });
    } catch (e) {}
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})(typeof self !== 'undefined' ? self : this);
