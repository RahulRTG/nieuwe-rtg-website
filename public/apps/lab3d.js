/* Het Onderzoekslab, de Prototypehal: alle projecten als een levende 3D-hal
   op de huiseigen Drie-motor (zero-dependency WebGL, huisstijl). Elk project
   is een blok: de hoogte groeit met de fase in de keten, de kleur hoort bij
   het onderzoeksveld, en op het nieuwste project staat een gouden pin.
   Slepen = ronddraaien. Geen WebGL? Dan verdwijnt de kaart stil en blijft de
   gewone lijst gewoon staan -- nooit een zwart vlak. */
(function () {
  'use strict';
  var R = null, hoek = 0.8, kantel = 0.55, afstand = 46, sleep = null, draai = true;
  // premium: de presentatiemodus -- de camera glijdt van project naar project
  var HAL = [];            // [{x, z, h, titel, sub}] zoals laatst getoond
  var tour = null;         // { ix, tot } zolang de presentatie loopt
  var kijk = [0, 2, 0];    // het geanimeerde kijkdoel
  var basisTekst = '';     // de uitleg om na de presentatie terug te zetten

  var PALET = [[0.62, 0.11, 0.25], [0.66, 0.55, 0.16], [0.32, 0.55, 0.45], [0.36, 0.42, 0.58], [0.55, 0.35, 0.5], [0.45, 0.45, 0.4]];
  function kleurVan(naam, lijst) {
    var ix = lijst.indexOf(naam);
    if (ix < 0) { ix = 0; for (var i = 0; i < naam.length; i++) ix = (ix + naam.charCodeAt(i)) % PALET.length; }
    return PALET[ix % PALET.length];
  }

  // de renderer leest canvas.width/height zelf; wij zetten ze scherp (retina)
  function maat(canvas) {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var b = canvas.clientWidth || 640;
    canvas.width = Math.round(b * dpr);
    canvas.height = Math.round(b * 0.56 * dpr);
  }

  function start() {
    var canvas = document.getElementById('lab3d');
    if (!canvas || !window.Drie || !Drie.maakRenderer) return false;
    maat(canvas);
    window.addEventListener('resize', function () { maat(canvas); });
    R = Drie.maakRenderer(canvas, {});
    if (!R) { var k = document.getElementById('lab3dKaart'); if (k) k.hidden = true; return false; }
    canvas.addEventListener('pointerdown', function (e) { sleep = { x: e.clientX, y: e.clientY }; draai = false; if (tour) presentatie(); canvas.setPointerCapture(e.pointerId); });
    var knop = document.getElementById('lab3dTour');
    if (knop) knop.addEventListener('click', presentatie);
    canvas.addEventListener('pointermove', function (e) {
      if (!sleep) return;
      hoek += (e.clientX - sleep.x) * 0.008;
      kantel = Math.min(1.3, Math.max(0.15, kantel + (e.clientY - sleep.y) * 0.005));
      sleep = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointerup', function () { sleep = null; });
    (function lus() {
      var doel = [0, 2, 0], afDoel = 46;
      if (tour && HAL.length) {
        var s = HAL[tour.ix % HAL.length];
        doel = [s.x, s.h * 0.6, s.z]; afDoel = 15;
        hoek += 0.004; // in de presentatie iets vlotter om het werk heen
        if (Date.now() > tour.tot) { tour.ix = (tour.ix + 1) % HAL.length; tour.tot = Date.now() + 5200; tourTekst(); }
      } else if (draai) hoek += 0.0022; // rustig meedraaien tot je zelf het stuur pakt
      // de camera glijdt zacht naar zijn doel, nooit een harde sprong
      kijk[0] += (doel[0] - kijk[0]) * 0.05; kijk[1] += (doel[1] - kijk[1]) * 0.05; kijk[2] += (doel[2] - kijk[2]) * 0.05;
      afstand += (afDoel - afstand) * 0.05;
      var oog = [kijk[0] + Math.cos(hoek) * afstand * Math.cos(kantel), kijk[1] + Math.sin(kantel) * afstand, kijk[2] + Math.sin(hoek) * afstand * Math.cos(kantel)];
      try { R.teken(oog, kijk); } catch (e) {}
      requestAnimationFrame(lus);
    })();
    return true;
  }

  // de presentatie aan/uit; slepen of nogmaals klikken stopt hem
  function presentatie() {
    var knop = document.getElementById('lab3dTour');
    var uitleg = document.getElementById('lab3dUitleg');
    if (tour) {
      tour = null;
      if (knop) knop.textContent = 'Presentatie';
      if (uitleg && basisTekst) uitleg.textContent = basisTekst;
      return;
    }
    if (!HAL.length) return;
    tour = { ix: 0, tot: Date.now() + 5200 };
    if (knop) knop.textContent = 'Stop presentatie';
    tourTekst();
  }
  function tourTekst() {
    var uitleg = document.getElementById('lab3dUitleg');
    if (!uitleg || !tour || !HAL.length) return;
    var s = HAL[tour.ix % HAL.length];
    uitleg.textContent = 'Presentatie ' + ((tour.ix % HAL.length) + 1) + '/' + HAL.length + ' -- ' + s.titel + ' (' + s.sub + '). Slepen stopt de rondgang.';
  }

  // projecten -> de hal: raster van blokken, hoogte = fase-trede, pin op de nieuwste
  function toon(projecten, velden) {
    if (!R && !start()) return;
    var veldIds = (velden || []).map(function (v) { return v.veld; });
    var fasen = [];
    (projecten || []).forEach(function (p) { if (p.fase && fasen.indexOf(p.fase) < 0) fasen.push(p.fase); });
    R.wis();
    R.voegToe(Drie.vlak(30, [0.055, 0.055, 0.052]), { raster: true });
    var hal = Drie.leegMesh();
    var n = Math.max(1, (projecten || []).length);
    var perRij = Math.ceil(Math.sqrt(n)), stap = 7;
    HAL = [];
    (projecten || []).forEach(function (p, i) {
      var rij = Math.floor(i / perRij), kol = i % perRij;
      var cx = (kol - (perRij - 1) / 2) * stap;
      var cz = (rij - (Math.ceil(n / perRij) - 1) / 2) * stap;
      var trede = Math.max(0, fasen.indexOf(p.fase));
      var h = 2.2 + trede * 1.9;
      Drie.doos(hal, cx, cz, 3.2, h, 3.2, kleurVan(String(p.veld || ''), veldIds), true);
      if (i === 0) Drie.pin(hal, cx, cz, h + 2.2, [0.96, 0.82, 0.32]); // het nieuwste werk
      HAL.push({ x: cx, z: cz, h: h, titel: String(p.titel || 'Project'), sub: String(p.veldNaam || p.veld || '') + ' - ' + String(p.fase || '') });
    });
    R.voegToe(hal, {});
    var echt = (projecten || []).length;
    basisTekst = echt ? echt + ' project(en) in de hal. Hoe hoger het blok, hoe verder in de keten' +
      (fasen.length ? ' (' + fasen.join(' > ') + ')' : '') + '. Slepen om rond te lopen.'
      : 'De hal staat klaar; het eerste project krijgt het eerste blok.';
    var uitleg = document.getElementById('lab3dUitleg');
    if (uitleg && !tour) uitleg.textContent = basisTekst;
    var knop = document.getElementById('lab3dTour');
    if (knop) knop.hidden = echt < 2; // een presentatie heeft pas zin met meer werk
  }

  window.Lab3D = { toon: toon, presentatie: presentatie };
})();
