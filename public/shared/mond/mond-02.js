    /* ---- 2D-terugval: hetzelfde gezicht, dezelfde spraak, zonder WebGL ----
       Ook hier is de tekenlus opnieuw opgezet: kleuren worden gegroepeerd
       getekend (één fillStyle per kleur in plaats van per puntje) en de alpha
       gaat in vier stappen. Dat scheelt duizenden statewissels per frame --
       precies wat een oudere telefoon liet stotteren. */
    var mctx = canvas.getContext('2d');
    if (!mctx) return { praat: praat };
    var dpr2 = Math.min(2, root.devicePixelRatio || 1);
    canvas.width = 440 * (dpr2 / 2) * 2; canvas.height = 200 * (dpr2 / 2) * 2;
    var GROEP = {};                              // kleur -> [punten], alpha in 4 banden
    for (var gi = 0; gi < PUNTEN.length; gi++) { var gp = PUNTEN[gi]; (GROEP[gp.kleur] = GROEP[gp.kleur] || []).push(gp); }
    var kleuren = Object.keys(GROEP);
    var k2 = 0, kv2 = 0, br2 = 0, du2 = 0, sc2 = 0, vorig2 = 0;
    function verf(t) {
      var dt = vorig2 ? Math.min(0.05, (t - vorig2) / 1000) : 0.016; vorig2 = t;
      var doel = mondStand(t, praatTot);
      kv2 += (doel.kaak - k2) * 260 * dt - kv2 * 26 * dt; k2 += kv2 * dt;
      var volg = Math.min(1, dt * 14);
      br2 += (doel.breed - br2) * volg; du2 += (doel.duw - du2) * volg; sc2 += (doel.scheef - sc2) * volg;
      mctx.setTransform(1, 0, 0, 1, 0, 0);
      mctx.clearRect(0, 0, canvas.width, canvas.height);
      mctx.scale(canvas.width / 220, canvas.height / 100);
      /* De WebGL-tekenaar draait om y=52, deze om het midden van 0..100 (dus
         50). Zonder deze twee eenheden staat dezelfde mond in de terugval twee
         eenheden hoger dan in de hoofdweg -- klein, maar dan is het niet meer
         dezelfde mond. */
      mctx.translate(0, -2);
      var golf = ((t / 4200) % 1) * 260 - 20;
      for (var ki = 0; ki < kleuren.length; ki++) {
        var lijst = GROEP[kleuren[ki]];
        for (var band = 0; band < 4; band++) {
          mctx.globalAlpha = 0.25 + band * 0.25;
          mctx.fillStyle = kleuren[ki];
          var begonnen = false;
          for (var i = 0; i < lijst.length; i++) {
            var p = lijst[i];
            /* Zelfde veeg als in de WebGL-weg (mond-01b.js): smaller (/150) en een
               derde van de alpha. Wijkt deze af, dan heeft dezelfde mond twee
               gezichten -- en dan zie je op een oud toestel iets anders. */
            var gloed = Math.exp(-Math.pow(p.x - golf, 2) / 150);
            if (gloed > 0.45) continue;                       // die zitten in de gloed-pas hieronder
            var a = Math.min(1, (0.45 + 0.4 * Math.sin(p.fase + t / 700)) * (p.rand == null ? 1 : p.rand) + gloed * 0.30);
            if (Math.min(3, Math.floor(a * 4)) !== band) continue;
            var hoek = 1 - Math.min(1, Math.abs(p.x - 110) / 60), mid = hoek * hoek * (3 - 2 * hoek);
            var open = k2 * mid;
            var x = 110 + (p.x - 110) * (1 + br2 * 0.12 * (1 - mid * 0.4));
            var y = 52 + (p.y - 52) * (1 - br2 * 0.13 * mid) + sc2 * mid * 6 * (p.x > 110 ? 1 : 0.2);
            if (p.lip === 'o') y += open * (16 + 18 * p.diep);
            mctx.fillRect(x, y, p.maat, p.maat);
            begonnen = true;
          }
          if (!begonnen) continue;
        }
      }
      // de gouden lichtgolf als aparte, korte pas (weinig punten, dus goedkoop)
      mctx.globalAlpha = 0.26; mctx.fillStyle = '#F5E6B8';
      for (var j = 0; j < PUNTEN.length; j++) {
        var q = PUNTEN[j];
        if (Math.exp(-Math.pow(q.x - golf, 2) / 150) <= 0.45) continue;
        var h2 = 1 - Math.min(1, Math.abs(q.x - 110) / 60), m2 = h2 * h2 * (3 - 2 * h2);
        var qy = 52 + (q.y - 52) * (1 - br2 * 0.13 * m2);
        if (q.lip === 'o') qy += k2 * m2 * (16 + 18 * q.diep);
        mctx.fillRect(110 + (q.x - 110) * (1 + br2 * 0.12 * (1 - m2 * 0.4)), qy, q.maat, q.maat);
      }
      mctx.globalAlpha = 1;
    }
    if (RUSTIG) { verf(0); return { praat: praat }; }
    var lus2 = function () {
      loopt = true;
      if (!inBeeld || document.hidden) { loopt = false; return; }
      var t = performance.now();
      verf(t);
      if (t > praatTot && k2 < 0.004 && Math.abs(kv2) < 0.02) { loopt = false; return; }
      requestAnimationFrame(lus2);
    };
    wek = function () { if (!loopt && inBeeld && !document.hidden) requestAnimationFrame(lus2); };
    requestAnimationFrame(lus2);
    return { praat: function (ms) { praat(ms); wek(); } };
  }

  /* De mond als knop-icoon: HET vaste gezicht van Rahul, overal hetzelfde. Geef
     een knop mee; er komt een klein mond-canvas in (met een toegankelijk label
     op de knop zelf). Geeft { praat } terug zodat de knop kan "meepraten". */
  function fab(knop, hoogte) {
    if (!knop || knop.dataset.rtgMondFab) return { praat: function () {} };
    knop.dataset.rtgMondFab = '1';
    var c = document.createElement('canvas');
    c.width = 440; c.height = 200;
    c.style.cssText = 'display:block;width:' + (hoogte ? hoogte * 2.2 : 3.4) + 'rem;height:auto;pointer-events:none;';
    c.setAttribute('aria-hidden', 'true');
    knop.textContent = '';
    knop.appendChild(c);
    return maak(c);
  }

  root.RTGMond = { maak: maak, fab: fab, puntenVeld: puntenVeld, mondStand: mondStand };
})(typeof self !== 'undefined' ? self : this);
