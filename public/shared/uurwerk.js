/* Het lopende werk: een klein uurwerk-hart dat de hele site deelt. Het
   RTG-horloge (shared/klok.js) heeft een gangreserve; dit script houdt die
   veer bij als een doorlopend verhaal over alle pagina's heen. Aanwezigheid
   windt het werk op (rondkijken, scrollen, tikken), stilte laat het in 42 uur
   leeglopen, en wie het horloge zelf aanraakt draait als het ware aan de
   kroon: het binnenwerk versnelt speels en de veer vult sneller.
   Op pagina's zonder horloge vertelt een haarfijn gouden lijntje boven in
   beeld stiekem hetzelfde verhaal: de lengte is de reserve, het puntje klopt
   op het ritme van de onrust (3 Hz) en klopt sneller zodra er leven is.
   Puur decor: geen bediening, geen tekst, en wie minder beweging wil
   (prefers-reduced-motion) ziet het lijntje stilstaan. */
(function () {
  'use strict';
  if (window.RTGUurwerk) return;
  var RUSTIG = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var RES_UUR = 42; // de volle veer: 42 uur, als bij een echt uurwerk
  var KEY = 'rtg_gangreserve';
  function laadUurwerkStijl(pad) {
    if (document.getElementById('rtgUurwerkCss')) return;
    var uurwerkStijl = document.createElement('link');
    uurwerkStijl.id = 'rtgUurwerkCss'; uurwerkStijl.rel = 'stylesheet'; uurwerkStijl.href = pad;
    document.head.appendChild(uurwerkStijl);
  }
  laadUurwerkStijl('/ds/uurwerk.css');

  /* ---- de veer: lezen (met het leeglopen sinds het vorige bezoek) ---- */
  function lees() {
    try {
      var d = JSON.parse(localStorage.getItem(KEY) || '');
      if (d && typeof d.p === 'number' && typeof d.t === 'number') {
        var leeg = (Date.now() - d.t) / (RES_UUR * 3600000);
        return Math.max(0, Math.min(1, d.p - Math.max(0, leeg)));
      }
    } catch (e) {}
    return 0.62; // een nieuw bezoek begint gedragen: half opgewonden, niet leeg
  }
  var p = lees();
  var tempo = 1;
  var bewaardOp = 0;
  function bewaar(nu) {
    try { localStorage.setItem(KEY, JSON.stringify({ p: Number(p.toFixed(4)), t: Date.now() })); } catch (e) {}
    bewaardOp = nu || performance.now();
  }
  // de rest van het huis (klok.js) leest hier de veer en het tempo
  window.RTGUurwerk = {
    reserve: function () { return p; },
    tempo: function () { return tempo; },
    RES_UUR: RES_UUR
  };

  /* ---- opwinden: aanwezigheid is de kroon ---- */
  var actiefTot = 0;   // tot wanneer er "leven" op de pagina is
  var opKroon = false; // de bezoeker raakt het horloge zelf aan
  function beweeg() { actiefTot = performance.now() + 2000; }
  ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach(function (t) {
    window.addEventListener(t, beweeg, { passive: true, capture: true });
  });
  function raaktRing(doel) { return !!(doel && doel.closest && doel.closest('.rtg-ring')); }
  document.addEventListener('pointerover', function (ev) { opKroon = raaktRing(ev.target); }, true);
  document.addEventListener('touchstart', function (ev) { if (raaktRing(ev.target)) opKroon = true; }, { passive: true, capture: true });
  document.addEventListener('touchend', function () { opKroon = false; }, true);
  document.addEventListener('touchcancel', function () { opKroon = false; }, true);

  /* ---- het haarlijntje: alleen op pagina's zonder het horloge zelf ---- */
  var lijn = null, punt = null;
  function bouwLijn() {
    if (document.querySelector('[data-rtg-klok="ring"]')) return;
    lijn = document.createElement('div');
    lijn.id = 'rtgGanglijn';
    lijn.setAttribute('aria-hidden', 'true');
    punt = document.createElement('i');
    lijn.appendChild(punt);
    document.body.appendChild(lijn);
  }
  var vorigeBreedte = '', vorigeKlop = null;
  function teken(actief) {
    if (!lijn) return;
    // de veer beweegt glaciaal (42 uur voor een volle lengte): alleen
    // schrijven als er op het scherm echt een andere breedte staat
    var b = (p * 100).toFixed(2) + '%';
    if (b !== vorigeBreedte) { vorigeBreedte = b; lijn.style.width = b; }
    if (RUSTIG || !punt) return;
    // de klop zelf is CSS (rtgKlop); hier alleen het ritme kiezen
    if (actief !== vorigeKlop) { vorigeKlop = actief; punt.classList.toggle('actief', actief); }
  }

  /* ---- de gang: winden, leeglopen, versnellen ----
     Dit liep als requestAnimationFrame-lus op 60 tellen per seconde, op elke
     pagina van het huis (188 stuks laden dit script) -- voor een veer die er
     42 uur over doet om leeg te lopen. De fysica is een integratie over dt en
     maalt dus niet om de tiklengte: vier tikken per seconde geven exact
     dezelfde veer. Het kloppende puntje, het enige dat echt vloeiend moest,
     is naar een CSS-animatie verhuisd. In een verborgen tabblad slaat de tik
     alleen de boekhouding over die er dan niet toe doet. */
  var vorige = 0;
  function gang() {
    var nu = performance.now();
    var dt = Math.min(0.25, Math.max(0, (nu - vorige) / 1000));
    vorige = nu;
    var actief = nu < actiefTot;
    p -= dt / (RES_UUR * 3600); // de veer ontspant altijd, heel langzaam
    if (actief) p += dt / (opKroon ? 25 : 90); // aan de kroon windt het vier keer zo hard
    p = Math.max(0, Math.min(1, p));
    var doel = (!RUSTIG && opKroon && actief) ? 5 : 1; // het speelse versnellen bij aanraking
    tempo += (doel - tempo) * Math.min(1, dt * 3);
    if (nu - bewaardOp > 5000) bewaar(nu);
    if (!document.hidden) teken(actief);
  }
  function start() {
    bouwLijn();
    vorige = performance.now();
    gang();
    var tik = setInterval(gang, 250);
    if (tik && tik.unref) tik.unref();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  window.addEventListener('pagehide', function () { bewaar(); });
  // een ander tabblad dat windt telt hier direct mee: een huis, een veer
  window.addEventListener('storage', function (ev) { if (ev.key === KEY) p = lees(); });
})();
