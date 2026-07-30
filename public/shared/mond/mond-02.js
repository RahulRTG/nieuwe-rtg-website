    // ---- 2D-terugval: exact het bestaande beeld ----
    var mctx = canvas.getContext('2d');
    if (!mctx) return { praat: praat };
    function verf(t) {
      mctx.clearRect(0, 0, 440, 200);
      mctx.save();
      mctx.scale(2, 2);
      var golf = ((t / 4200) % 1) * 260 - 20;
      var spreek = t < praatTot ? Math.sin(t / 1000 * Math.PI * 4.4) : 0;
      for (var i = 0; i < PUNTEN.length; i++) {
        var p = PUNTEN[i];
        var gloed = Math.exp(-Math.pow(p.x - golf, 2) / 420);
        var twinkel = 0.45 + 0.4 * Math.sin(p.fase + t / 700);
        mctx.globalAlpha = Math.min(1, twinkel * (p.rand == null ? 1 : p.rand) + gloed * 0.9);
        mctx.fillStyle = gloed > 0.45 ? '#F5E6B8' : p.kleur;
        mctx.fillRect(p.x, p.lip === 'o' ? p.y + spreek * 4 * p.diep : p.y, p.maat, p.maat);
      }
      mctx.restore();
    }
    if (RUSTIG) verf(0);
    else (function lus() {
      if (canvas.offsetParent) { verf(performance.now()); requestAnimationFrame(lus); }
      else setTimeout(lus, 600);
    })();
    return { praat: praat };
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

  root.RTGMond = { maak: maak, fab: fab, puntenVeld: puntenVeld };
})(typeof self !== 'undefined' ? self : this);
