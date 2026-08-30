/* DE MOTOR: een lus, en niet per scene een luisteraar.

   WAAROM DIT ZO. Twintig componenten met elk een `scroll`-listener is twintig
   keer per frame de pagina opmeten, en dat is de klassieke manier om een mooi
   ontwerp op een telefoon te laten haperen. Hier is er EEN passieve luisteraar,
   EEN requestAnimationFrame, en daarbinnen: eerst alles LEZEN, dan alles
   SCHRIJVEN. Lezen en schrijven door elkaar heen dwingt de browser midden in
   een frame opnieuw in te delen (layout thrashing); die volgorde is dus geen
   nettigheid maar de reden dat dit werkt.

   Levert window.RTGBeweging: .neem(scene), .laat(scene), .stand().
   De rekenregels staan in shared/beweging.js en worden hier alleen toegepast. */
(function () {
  'use strict';
  if (window.RTGBeweging) return;
  var leer = window.RTGBewegingLeer;
  if (!leer) { console.warn('[beweging] shared/beweging.js hoort eerst geladen te zijn'); return; }

  var scenes = [];        /* {el, decl, doelen:Map, laatste:number} */
  var omg = leer.omgeving();
  var wacht = false;
  var aan = false;

  /* -------------------------------------------------------------- lezen -- */
  function voortgangVan(el) {
    var rect = el.getBoundingClientRect();
    var loop = el.offsetHeight - window.innerHeight;
    if (loop <= 0) return rect.top <= 0 ? 1 : 0;
    return leer.klem(-rect.top / loop, 0, 1);
  }

  /* ---------------------------------------------------------- schrijven -- */
  function zet(el, stand) {
    if (stand.transform != null) el.style.transform = stand.transform;
    if (stand.opacity != null) el.style.opacity = stand.opacity;
    if (stand.clipPath != null) el.style.clipPath = stand.clipPath;
  }

  function render() {
    wacht = false;
    var metingen = [];
    /* 1. lezen -- niets in deze lus raakt style aan. */
    for (var i = 0; i < scenes.length; i++) {
      var s = scenes[i];
      metingen.push(omg.rustig ? 1 : voortgangVan(s.el));
    }
    /* 2. schrijven. */
    for (var j = 0; j < scenes.length; j++) {
      var scene = scenes[j];
      var p = metingen[j];
      /* Een scene die niet bewoog, schrijft niet. Op een pagina met acht
         scenes scheelt dat zeven keer schrijven per frame. */
      if (scene.laatste != null && Math.abs(scene.laatste - p) < 0.0005) continue;
      scene.laatste = p;
      scene.el.style.setProperty('--voortgang', String(Math.round(p * 1000) / 1000));
      (scene.decl.bewegingen || []).forEach(function (b) {
        var doel = scene.doelen.get(b.element);
        if (!doel) return;
        zet(doel, leer.rekenStand(b, p, omg));
      });
      if (typeof scene.decl.bij === 'function') scene.decl.bij(p, scene.el, omg);
    }
  }

  function tik() {
    if (wacht) return;
    wacht = true;
    requestAnimationFrame(render);
  }

  function start() {
    if (aan) return;
    aan = true;
    window.addEventListener('scroll', tik, { passive: true });
    window.addEventListener('resize', function () {
      omg = leer.omgeving();
      scenes.forEach(function (s) { s.laatste = null; hoogte(s); });
      tik();
    }, { passive: true });
    /* Rustig? Dan wordt er eenmalig de EINDSTAND gezet en verder niets. De
       pagina staat dan af, en dat is de bedoeling -- zie grens 2 in de leer. */
    tik();
  }

  function hoogte(s) {
    if (omg.rustig) { s.el.style.minHeight = ''; return; }
    s.el.style.minHeight = leer.sceneHoogte(s.decl, omg.vorm) + 'vh';
  }

  /* ------------------------------------------------------------- opnemen -- */
  function neem(el, decl) {
    var uitslag = leer.keur(decl);
    if (!uitslag.deugt) {
      /* Een scene die niet deugt beweegt niet, maar staat er wel: de inhoud
         blijft leesbaar en de reden staat in de console. Een animatiefout mag
         nooit een leeg scherm opleveren. */
      console.warn('[beweging] scene geweigerd:\n- ' + uitslag.fouten.join('\n- '));
      el.setAttribute('data-beweging', 'geweigerd');
      return null;
    }
    var doelen = new Map();
    (decl.bewegingen || []).forEach(function (b) {
      var d = el.querySelector('[data-beweeg="' + b.element + '"]');
      if (d) doelen.set(b.element, d);
      else console.warn('[beweging] geen element data-beweeg="' + b.element + '" in deze scene');
    });
    var s = { el: el, decl: decl, doelen: doelen, laatste: null };
    scenes.push(s);
    el.setAttribute('data-beweging', omg.rustig ? 'rustig' : 'aan');
    hoogte(s);
    start();
    tik();
    return s;
  }

  function laat(s) {
    var i = scenes.indexOf(s);
    if (i >= 0) scenes.splice(i, 1);
  }

  /* ------------------------------------------------- eenvoudige onthulling --
     Niet alles hoeft frame voor frame bestuurd. "Komt dit in beeld?" is een
     andere vraag dan "waar sta ik binnen deze animatie", en hoort dus ook een
     ander instrument te hebben. Alles met class `onthul` krijgt `zichtbaar`
     zodra het in beeld komt; de overgang staat in beweging.css. */
  var kijker = null;
  function onthullen(wortel) {
    var lijst = (wortel || document).querySelectorAll('.onthul:not(.zichtbaar)');
    if (omg.rustig || !('IntersectionObserver' in window)) {
      lijst.forEach(function (n) { n.classList.add('zichtbaar'); });
      return;
    }
    if (!kijker) {
      kijker = new IntersectionObserver(function (regels) {
        regels.forEach(function (r) {
          if (!r.isIntersecting) return;
          r.target.classList.add('zichtbaar');
          kijker.unobserve(r.target);
        });
      }, { rootMargin: '0px 0px -10% 0px' });
    }
    lijst.forEach(function (n) { kijker.observe(n); });
  }

  /* -------------------------------------------------------------- media --
     Video's laden pas als ze in de buurt komen, en spelen pas als ze te zien
     zijn. Een pagina die bij het openen elke video van elke scene ophaalt,
     kost een bezoeker met databundel echt geld. */
  function media(wortel) {
    var videos = (wortel || document).querySelectorAll('video[data-bron]');
    if (!videos.length) return;
    if (!('IntersectionObserver' in window)) {
      videos.forEach(function (v) { v.src = v.dataset.bron; });
      return;
    }
    var mk = new IntersectionObserver(function (regels) {
      regels.forEach(function (r) {
        var v = r.target;
        if (r.isIntersecting) {
          if (!v.src) { v.src = v.dataset.bron; v.load(); }
          if (!omg.rustig) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        } else if (!v.paused) v.pause();
      });
    }, { rootMargin: '200px' });
    videos.forEach(function (v) { mk.observe(v); });
  }

  window.RTGBeweging = {
    neem: neem,
    laat: laat,
    onthullen: onthullen,
    media: media,
    stand: function () { return { omgeving: omg, scenes: scenes.length }; }
  };
})();
