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

  /* ---- de horlogetaal: de taal van de klok als stille laag op ELKE pagina.
     Geen herbouw per app, maar vaste kleine details: tekstselectie in het
     gedempte goud, dunne haarlijn-scrollbalken, echte tabelcijfers voor alle
     getallen (niets danst meer), elke hr als haarlijn, en een minuutbaan-klasse
     (rtg-minuutbaan) die een kop de streepband van de wijzerplaat geeft. ---- */
  function bouwTaal() {
    if (document.getElementById('rtg-horlogetaal')) return;
    var st = document.createElement('style');
    st.id = 'rtg-horlogetaal';
    st.textContent =
      '::selection{background:color-mix(in srgb, var(--gold,#C9A24B) 32%, transparent);}' +
      'body{font-variant-numeric:tabular-nums;}' +
      'hr{border:none;height:1px;background:color-mix(in srgb, var(--gold,#C9A24B) 25%, transparent);}' +
      '*{scrollbar-width:thin;scrollbar-color:color-mix(in srgb, var(--gold,#C9A24B) 40%, transparent) transparent;}' +
      '::-webkit-scrollbar{width:6px;height:6px;}' +
      '::-webkit-scrollbar-track{background:transparent;}' +
      '::-webkit-scrollbar-thumb{background:color-mix(in srgb, var(--gold,#C9A24B) 38%, transparent);border-radius:999px;}' +
      // de minuutbaan: zestig fijne strepen met een gouden accent op de vijf,
      // zoals de streepband van de RTG-klok; voor sectiekoppen en scheidingen
      '.rtg-minuutbaan{position:relative;padding-bottom:0.55rem;}' +
      '.rtg-minuutbaan::after{content:"";position:absolute;left:0;bottom:0;width:7.5rem;max-width:60%;height:5px;' +
      'background-image:repeating-linear-gradient(90deg, color-mix(in srgb, var(--gold,#C9A24B) 70%, transparent) 0 1px, transparent 1px 25px),' +
      'repeating-linear-gradient(90deg, color-mix(in srgb, var(--gold,#C9A24B) 30%, transparent) 0 1px, transparent 1px 5px);' +
      'background-size:100% 5px, 100% 3px;background-position:left bottom, left bottom;background-repeat:no-repeat;}';
    document.head.appendChild(st);
  }

  /* ---- het haarlijntje: alleen op pagina's zonder het horloge zelf ---- */
  var lijn = null, punt = null;
  function bouwLijn() {
    if (document.querySelector('[data-rtg-klok="ring"]')) return;
    var st = document.createElement('style');
    st.id = 'rtg-uurwerk-stijl';
    st.textContent = '#rtgGanglijn{position:fixed;top:0;left:0;height:2px;z-index:9991;pointer-events:none;opacity:0.55;' +
      'background:linear-gradient(90deg,transparent,color-mix(in srgb, var(--gold,#C9A24B) 70%, transparent));}' +
      '#rtgGanglijn i{position:absolute;right:-2px;top:-1.5px;width:5px;height:5px;border-radius:50%;' +
      'background:var(--gold,#C9A24B);box-shadow:0 0 6px var(--gold,#C9A24B);}';
    document.head.appendChild(st);
    lijn = document.createElement('div');
    lijn.id = 'rtgGanglijn';
    lijn.setAttribute('aria-hidden', 'true');
    punt = document.createElement('i');
    lijn.appendChild(punt);
    document.body.appendChild(lijn);
  }
  function teken(nu, actief) {
    if (!lijn) return;
    lijn.style.width = (p * 100).toFixed(2) + '%';
    if (RUSTIG || !punt) return;
    var hz = actief ? 4.5 : 3; // de onrust klopt sneller zodra er leven is
    var f = 0.55 + 0.45 * Math.abs(Math.sin(nu / 1000 * Math.PI * hz));
    punt.style.opacity = f.toFixed(2);
    punt.style.transform = 'scale(' + (0.8 + 0.5 * f).toFixed(2) + ')';
  }

  /* ---- de gang: winden, leeglopen, versnellen; een tel per beeldje ---- */
  var vorige = 0;
  function gang(nu) {
    var dt = Math.min(0.25, Math.max(0, (nu - vorige) / 1000));
    vorige = nu;
    var actief = nu < actiefTot;
    p -= dt / (RES_UUR * 3600); // de veer ontspant altijd, heel langzaam
    if (actief) p += dt / (opKroon ? 25 : 90); // aan de kroon windt het vier keer zo hard
    p = Math.max(0, Math.min(1, p));
    var doel = (!RUSTIG && opKroon && actief) ? 5 : 1; // het speelse versnellen bij aanraking
    tempo += (doel - tempo) * Math.min(1, dt * 3);
    if (nu - bewaardOp > 5000) bewaar(nu);
    teken(nu, actief);
    requestAnimationFrame(gang);
  }
  function start() {
    bouwTaal();
    bouwLijn();
    requestAnimationFrame(function (t) { vorige = t; requestAnimationFrame(gang); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  window.addEventListener('pagehide', function () { bewaar(); });
  // een ander tabblad dat windt telt hier direct mee: een huis, een veer
  window.addEventListener('storage', function (ev) { if (ev.key === KEY) p = lees(); });
})();
