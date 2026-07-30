/* RTG Atelier, het Ontwerp-podium: elk ontwerp als eigen 3D-sculptuur op de
   huiseigen Drie-motor. De vorm wordt afgeleid uit de naam (deterministisch:
   hetzelfde ontwerp geeft altijd dezelfde sculptuur) en de kleuren zijn de
   ECHTE ontwerpkleuren uit het atelier. Draait rustig rond; slepen om zelf
   te sturen. Zonder WebGL verdwijnt het podium stil. */
(function () {
  'use strict';
  var R = null, hoek = 0.6, kantel = 0.5, sleep = null, draai = true, huidige = null;
  var show = null; // de modeshow-timer: elke paar tellen het volgende ontwerp op het podium

  function hexRgb(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return [0.62, 0.11, 0.25];
    var n = parseInt(m[1], 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  function zaad(tekst) {
    var z = 7; String(tekst || '').split('').forEach(function (c) { z = (z * 31 + c.charCodeAt(0)) % 9973; });
    return function () { z = (z * 137 + 71) % 9973; return z / 9973; };
  }

  // de renderer leest canvas.width/height zelf; wij zetten ze scherp (retina)
  function maat(canvas) {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var b = canvas.clientWidth || 640;
    canvas.width = Math.round(b * dpr);
    canvas.height = Math.round(b * 0.6 * dpr);
  }

  function start() {
    var canvas = document.getElementById('atelier3d');
    if (!canvas || !window.Drie || !Drie.maakRenderer) return false;
    maat(canvas);
    window.addEventListener('resize', function () { maat(canvas); });
    R = Drie.maakRenderer(canvas, {});
    if (!R) { var k = document.getElementById('atelier3dKaart'); if (k) k.hidden = true; return false; }
    canvas.addEventListener('pointerdown', function (e) { sleep = { x: e.clientX, y: e.clientY }; draai = false; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', function (e) {
      if (!sleep) return;
      hoek += (e.clientX - sleep.x) * 0.008;
      kantel = Math.min(1.25, Math.max(0.15, kantel + (e.clientY - sleep.y) * 0.005));
      sleep = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointerup', function () { sleep = null; });
    (function lus() {
      if (draai) hoek += 0.003;
      var oog = [Math.cos(hoek) * 26 * Math.cos(kantel), Math.sin(kantel) * 26, Math.sin(hoek) * 26 * Math.cos(kantel)];
      try { R.teken(oog, [0, 4, 0]); } catch (e) {}
      requestAnimationFrame(lus);
    })();
    return true;
  }

  // een ontwerp -> zijn sculptuur: sokkel, een gedraaide stapel in de eigen
  // kleuren, en een gouden ruit als kroon
  function sculptuur(o) {
    if (!R && !start()) return;
    huidige = o;
    var r = zaad(o.naam || o.id || 'ontwerp');
    var kleuren = (o.kleuren && o.kleuren.length ? o.kleuren : [{ hex: '#7F1634' }, { hex: '#857007' }]).map(function (k) { return hexRgb(k.hex); });
    R.wis();
    R.voegToe(Drie.vlak(16, [0.055, 0.055, 0.052]), { raster: true });
    var m = Drie.leegMesh();
    Drie.doos(m, 0, 0, 9, 0.8, 9, [0.12, 0.11, 0.1], false); // de sokkel
    var lagen = 3 + Math.floor(r() * 3), y = 0.8;
    for (var i = 0; i < lagen; i++) {
      var b = 6.5 - i * (4.5 / lagen) * (0.7 + r() * 0.6);
      var h = 1.4 + r() * 2.4;
      var kl = kleuren[i % kleuren.length];
      // elke laag iets verschoven: dat maakt de stapel een sculptuur, geen toren
      var dx = (r() - 0.5) * 1.6, dz = (r() - 0.5) * 1.6;
      Drie.doos(m, dx, dz, Math.max(1.2, b), h, Math.max(1.2, b), kl, true);
      // Drie.doos bouwt op y=0; til de laag op door de posities te verschuiven
      tilOp(m, y);
      y += h;
    }
    Drie.pin(m, 0, 0, y + 1.2, [0.96, 0.82, 0.32]);
    R.voegToe(m, {});
    var uitleg = document.getElementById('atelier3dUitleg');
    if (uitleg) uitleg.textContent = (o.naam || 'Ontwerp') + ' als sculptuur, in de eigen ontwerpkleuren. Slepen om te draaien.';
  }
  // til de zojuist toegevoegde laag (laatste blok) omhoog naar zijn plank
  function tilOp(m, y) {
    var per = 20 * 3; // een doos = 5 vlakken x 4 hoekpunten x 3 coordinaten
    var vanaf = m.posities.length - per;
    if (vanaf < 0) return;
    for (var i = vanaf + 1; i < m.posities.length; i += 3) m.posities[i] += y;
  }

  /* de modeshow: het podium wisselt vanzelf van ontwerp, als een rustige
     defile. Nogmaals klikken (of zelf een ontwerp kiezen) stopt hem. */
  function modeshow() {
    var kies = document.getElementById('atelier3dKies');
    var knop = document.getElementById('atelier3dShow');
    if (show) {
      clearInterval(show); show = null;
      if (knop) knop.textContent = 'Modeshow';
      return;
    }
    if (!kies || !podium.lijst || podium.lijst.length < 2) return;
    if (knop) knop.textContent = 'Stop modeshow';
    show = setInterval(function () {
      var n = podium.lijst.length;
      var ix = ((Number(kies.value) || 0) + 1) % n;
      kies.value = String(ix);
      draai = true; // op de show draait het podium altijd
      sculptuur(podium.lijst[ix]);
    }, 6000);
  }

  // het podium: kies-lijst vullen en het eerste ontwerp neerzetten
  function podium(ontwerpen) {
    var kies = document.getElementById('atelier3dKies');
    if (!kies || !ontwerpen || !ontwerpen.length) return;
    // weer tonen na een leeg filter; bij een WebGL-val verbergt start() hem direct weer
    var kaart = document.getElementById('atelier3dKaart');
    if (kaart) kaart.hidden = false;
    var vorige = kies.value;
    kies.innerHTML = ontwerpen.map(function (o, i) { return '<option value="' + i + '">' + String(o.naam || 'Ontwerp ' + (i + 1)).replace(/[<>&]/g, '') + '</option>'; }).join('');
    if (!kies.dataset.aan) {
      kies.dataset.aan = '1';
      kies.addEventListener('change', function (e) {
        if (e.isTrusted && show) modeshow(); // zelf kiezen = de show is klaar
        var o = podium.lijst[Number(kies.value) || 0]; if (o) sculptuur(o);
      });
      var knop = document.getElementById('atelier3dShow');
      if (knop) knop.addEventListener('click', modeshow);
    }
    podium.lijst = ontwerpen;
    var knop2 = document.getElementById('atelier3dShow');
    if (knop2) knop2.hidden = ontwerpen.length < 2;
    if (vorige && ontwerpen[Number(vorige)]) kies.value = vorige;
    sculptuur(ontwerpen[Number(kies.value) || 0]);
  }

  window.Atelier3D = { podium: podium, sculptuur: sculptuur, modeshow: modeshow };
})();
