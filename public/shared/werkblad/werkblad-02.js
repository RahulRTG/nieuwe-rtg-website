  /* ---------- de grepen tussen de vlakken ----------
     Slepen verandert de fr-verhouding, niet de pixels: zo blijft de indeling
     kloppen als het venster van maat verandert. */
  function grepen(b, ind) {
    if (ind.kolommen === 2) maakGreep(b, 'x', ind);
    if (ind.rijen === 2) maakGreep(b, 'y', ind);
  }
  function maakGreep(b, as, ind) {
    var g = document.createElement('div');
    g.className = 'wb-greep wb-greep-' + as;
    g.setAttribute('role', 'separator');
    g.setAttribute('aria-label', as === 'x' ? 'Breedte van de vlakken' : 'Hoogte van de vlakken');
    var zetPlek = function () {
      var deel = as === 'x' ? staat.kolom : staat.rij;
      var pct = deel[0] / (deel[0] + deel[1]) * 100;
      if (as === 'x') g.style.left = pct + '%'; else g.style.top = pct + '%';
    };
    zetPlek();
    b.appendChild(g);

    var neer = null;
    g.addEventListener('pointerdown', function (e) {
      neer = true; g.classList.add('wb-sleept');
      try { g.setPointerCapture(e.pointerId); } catch (er) {}
    });
    g.addEventListener('pointermove', function (e) {
      if (!neer) return;
      var r = b.getBoundingClientRect();
      var f = as === 'x' ? (e.clientX - r.left) / r.width : (e.clientY - r.top) / r.height;
      f = Math.max(0.15, Math.min(0.85, f));      // nooit een vlak wegdrukken
      var deel = as === 'x' ? staat.kolom : staat.rij;
      deel[0] = Math.round(f * 100) / 100; deel[1] = Math.round((1 - f) * 100) / 100;
      b.style[as === 'x' ? 'gridTemplateColumns' : 'gridTemplateRows'] = deel[0] + 'fr ' + deel[1] + 'fr';
      zetPlek();
      e.preventDefault();
    });
    var los = function () { if (neer) { neer = null; g.classList.remove('wb-sleept'); bewaar(); } };
    g.addEventListener('pointerup', los);
    g.addEventListener('pointercancel', los);
    if (ind.vlakken === 3 && as === 'y') { /* het derde vlak ligt onder; de greep klopt */ }
  }

  root.RTGWerkblad = {
    start: function (opties) {
      var o = opties || {};
      schermen = (o.schermen || []).filter(function (s) { return s && s.naam && s.url; });
      balk = o.balk || null;
      if (!bureau()) { if (balk) balk.hidden = true; return false; }
      lees();
      teken();
      /* Wisselt iemand van breed naar smal (venster kleiner, tweede monitor
         weg), dan valt het blad weg en staat de pagina er weer gewoon. */
      try {
        root.matchMedia('(min-width: 1100px)').addEventListener('change', function (m) {
          if (!m.matches && blad) { zetEigenTerug(); blad.remove(); blad = null; document.body.classList.remove('wb-aan'); }
          else if (m.matches) teken();
        });
      } catch (e) {}
      return true;
    },
    indeling: function (id) { if (INDELINGEN[id]) { staat.indeling = id; bewaar(); teken(); } },
    INDELINGEN: INDELINGEN
  };
})(typeof self !== 'undefined' ? self : this);
