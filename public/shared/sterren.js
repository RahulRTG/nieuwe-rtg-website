/* RTG Sterrenhemel: een heel subtiele, driedimensionale sterrenkoepel in
   huisstijl - de rust van een Rolls-Royce Starlight-hemel, maar dan in RTG.

   Geen goedkope glinstering: een bol van kleine lichtpunten die traag om je
   heen draait, met echte diepte (verre punten dieper weg en zachter, nabije
   punten iets groter en helderder). De kleuren komen uit het logo: gedempt
   wit, goud en een enkele bordeaux gloed op een (transparante) donkere grond,
   zodat de achtergrond van de pagina de bodem blijft.

   Gebruik:  RTGSterren.hang(elementOfSelector, { dichtheid, helderheid });
   Het canvas gaat achter de inhoud staan (position:absolute, inset:0) en
   beweegt heel langzaam. Wie minder beweging wil (prefers-reduced-motion),
   krijgt een stilstaand veld. Geen afhankelijkheden, geen extern beeld. */
(function () {
  if (window.RTGSterren) return;

  var KLEUREN = [
    { c: [237, 231, 218], w: 0.70 },   // gedempt wit (parelmoer)
    { c: [201, 162, 75], w: 0.22 },    // goud
    { c: [194, 58, 94], w: 0.08 }      // bordeaux op donker
  ];
  function kies(r) { var s = 0; for (var i = 0; i < KLEUREN.length; i++) { s += KLEUREN[i].w; if (r <= s) return KLEUREN[i].c; } return KLEUREN[0].c; }

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

    // een bol van punten rondom de kijker; elk punt een richting op de eenheidsbol
    var sterren = [];
    var breedte = 0, hoogte = 0, straal = 0, cx = 0, cy = 0;
    var CAM = 2.4;                       // afstand van de camera tot het midden
    function zaai() {
      var opp = breedte * hoogte;
      var n = Math.round(Math.min(opp / 2600, 520) * (opts.dichtheid || 1));
      sterren = [];
      for (var i = 0; i < n; i++) {
        // gelijkmatig over de bol (behoudt de rust; geen klonten)
        var u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
        var r = Math.random();
        sterren.push({ x: s * Math.cos(th), y: u, z: s * Math.sin(th),
          kleur: kies(r), mag: 0.35 + Math.random() * (r > 0.94 ? 1.5 : 0.7),
          fase: Math.random() * Math.PI * 2, flonker: 0.5 + Math.random() * 0.9 });
      }
    }
    function meet() {
      var r = doel.getBoundingClientRect();
      breedte = Math.max(1, r.width); hoogte = Math.max(1, r.height);
      cv.width = Math.round(breedte * dpr); cv.height = Math.round(hoogte * dpr);
      cx = cv.width / 2; cy = cv.height / 2;
      straal = Math.hypot(cv.width, cv.height) * 0.62;   // lichte overscan: randen blijven gevuld
      zaai();
    }

    var helder = (opts.helderheid == null ? 1 : opts.helderheid);
    function verf(t) {
      g.clearRect(0, 0, cv.width, cv.height);
      var a = t * 0.000045;                 // heel traag: een hele omwenteling duurt minuten
      var ca = Math.cos(a), sa = Math.sin(a);
      var tilt = 0.32, ct = Math.cos(tilt), st = Math.sin(tilt);   // vaste kleine kanteling voor diepte
      for (var i = 0; i < sterren.length; i++) {
        var p = sterren[i];
        // draai om de y-as, daarna een vaste kanteling om de x-as
        var x1 = p.x * ca + p.z * sa;
        var z1 = -p.x * sa + p.z * ca;
        var y2 = p.y * ct - z1 * st;
        var z2 = p.y * st + z1 * ct;
        var d = CAM - z2;                    // perspectief: verder weg = kleiner en zachter
        var sx = cx + (x1 / d) * straal;
        var sy = cy + (y2 / d) * straal;
        if (sx < -4 || sy < -4 || sx > cv.width + 4 || sy > cv.height + 4) continue;
        var diep = (z2 + 1) / 2;             // 0 achter .. 1 voor
        var fl = rustig ? 1 : (0.62 + 0.38 * Math.sin(p.fase + t * 0.0011 * p.flonker));
        var alpha = Math.min(0.9, (0.14 + 0.5 * diep) * fl * p.mag * helder);
        if (alpha <= 0.012) continue;
        var maat = (0.42 + 1.15 * diep) * p.mag * dpr;
        var k = p.kleur;
        if (p.mag > 1.15 && diep > 0.6) {   // een enkele heldere ster krijgt een zachte halo
          var grad = g.createRadialGradient(sx, sy, 0, sx, sy, maat * 3.4);
          grad.addColorStop(0, 'rgba(' + k[0] + ',' + k[1] + ',' + k[2] + ',' + (alpha * 0.5).toFixed(3) + ')');
          grad.addColorStop(1, 'rgba(' + k[0] + ',' + k[1] + ',' + k[2] + ',0)');
          g.fillStyle = grad;
          g.beginPath(); g.arc(sx, sy, maat * 3.4, 0, Math.PI * 2); g.fill();
        }
        g.fillStyle = 'rgba(' + k[0] + ',' + k[1] + ',' + k[2] + ',' + alpha.toFixed(3) + ')';
        g.beginPath(); g.arc(sx, sy, maat, 0, Math.PI * 2); g.fill();
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
