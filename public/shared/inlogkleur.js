/* De levende inlogkleur. Elk inlogscherm (met data-inlogkleur) krijgt een
   ambient gloed die met het moment meebeweegt: de KLOK zet de boog van de dag
   (diepe nacht -> dageraad -> middaglicht -> gouden uur -> schemering), het
   SEIZOEN zet de kleurfamilie (winter ijsblauw, lente camelia-groen, zomer
   goud/azuur, herfst cognac) en de DAG-VAN-HET-JAAR een fijne eigen draai, zo
   is geen uur en geen dag hetzelfde, het hele jaar door. Het blijft altijd
   de donkere RTG-grond met een enkele wijnrode verankering onderin; de gloed
   is een ingetogen was, nooit schreeuwerig, zodat het scherm kaal en netjes
   blijft. Zonder JavaScript blijft de gewone donkere huisstijl staan.

   Testen: ?uur=18.5 &dag=200 &seizoen=zomer in de adresbalk (voor screenshots). */
(function (w, d) {
  'use strict';

  // ---- rekenhulp ----
  function dagVanJaar(dt) {
    var start = new Date(dt.getFullYear(), 0, 0);
    return Math.floor((dt - start) / 86400000);
  }
  // kortste weg over de kleurschijf: meng hue a naar b met gewicht t (0..1)
  function mengHue(a, b, t) {
    var diff = ((b - a + 540) % 360) - 180;
    return (a + diff * t + 360) % 360;
  }
  function hsl(h, s, l, a) {
    h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
    function f(n) {
      var k = (n + h / 30) % 12;
      var c = s * Math.min(l, 1 - l);
      return Math.round(255 * (l - c * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    }
    return 'rgba(' + f(0) + ',' + f(8) + ',' + f(4) + ',' + a + ')';
  }

  // ---- de dagboog: negen ijkpunten, waartussen we vloeiend overgaan ----
  // th = tijd-hue, meng = hoeveel de tijd de seizoenkleur overstemt,
  // licht = helderheid van de gloed (dag helderder dan nacht),
  // gloed = alpha van de was (altijd ingetogen).
  var UREN = [
    { u: 0,  th: 244, meng: 0.78, licht: 0.14, gloed: 0.17 }, // diepe nacht, indigo
    { u: 5,  th: 258, meng: 0.62, licht: 0.22, gloed: 0.22 }, // laatste nacht
    { u: 7,  th: 344, meng: 0.55, licht: 0.40, gloed: 0.32 }, // dageraad, roze
    { u: 9,  th: 48,  meng: 0.28, licht: 0.62, gloed: 0.33 }, // ochtend, warm
    { u: 12, th: 30,  meng: 0.06, licht: 0.90, gloed: 0.28 }, // middag, seizoen puur
    { u: 15, th: 42,  meng: 0.30, licht: 0.78, gloed: 0.31 }, // namiddag
    { u: 18, th: 30,  meng: 0.55, licht: 0.55, gloed: 0.38 }, // gouden uur, amber
    { u: 20, th: 344, meng: 0.62, licht: 0.36, gloed: 0.34 }, // schemering, bordeaux
    { u: 22, th: 258, meng: 0.70, licht: 0.22, gloed: 0.22 }, // avond, indigo
    { u: 24, th: 244, meng: 0.78, licht: 0.14, gloed: 0.17 }  // = 0
  ];
  function boog(uur) {
    for (var i = 1; i < UREN.length; i++) {
      if (uur <= UREN[i].u) {
        var a = UREN[i - 1], b = UREN[i], t = (uur - a.u) / (b.u - a.u);
        return {
          th: mengHue(a.th, b.th, t),
          meng: a.meng + (b.meng - a.meng) * t,
          licht: a.licht + (b.licht - a.licht) * t,
          gloed: a.gloed + (b.gloed - a.gloed) * t
        };
      }
    }
    return UREN[0];
  }

  // ---- het seizoen: kleurfamilie + verzadiging (noordelijk halfrond) ----
  var SEIZOEN = {
    winter: { hue: 212, sat: 0.30 }, // ijsblauw / staal
    lente:  { hue: 152, sat: 0.42 }, // camelia-groen
    zomer:  { hue: 40,  sat: 0.60 }, // goud / azuur
    herfst: { hue: 22,  sat: 0.55 }  // cognac / roest
  };
  function seizoenVan(maand) {
    return maand >= 2 && maand <= 4 ? 'lente'
      : maand >= 5 && maand <= 7 ? 'zomer'
      : maand >= 8 && maand <= 10 ? 'herfst' : 'winter';
  }

  function palet(nu) {
    nu = nu || new Date();
    var q = null; try { q = new URLSearchParams(w.location.search); } catch (e) {}
    var uur = q && q.get('uur') != null ? parseFloat(q.get('uur')) : nu.getHours() + nu.getMinutes() / 60;
    var dag = q && q.get('dag') != null ? parseInt(q.get('dag'), 10) : dagVanJaar(nu);
    var seiz = (q && q.get('seizoen')) || seizoenVan(nu.getMonth());
    if (!SEIZOEN[seiz]) seiz = seizoenVan(nu.getMonth());
    if (isNaN(uur)) uur = nu.getHours() + nu.getMinutes() / 60;
    uur = ((uur % 24) + 24) % 24;

    var s = SEIZOEN[seiz], b = boog(uur);
    // de hue: seizoenkleur, door de tijd naar de tijd-hue getrokken...
    var hue = mengHue(s.hue, b.th, b.meng);
    // ...en per dag een fijne eigen draai, zo is geen dag gelijk
    hue = (hue + Math.sin(dag * 2.399963) * 9 + 360) % 360;
    var sat = Math.max(0.22, Math.min(0.72, s.sat * (0.7 + b.licht * 0.55)));

    // bovengloed draagt de tijd- en seizoenkleur; ondergloed is de vaste
    // wijnrode verankering van RTG, licht meegekleurd met het moment
    var top = hsl(hue, sat, 0.46 + b.licht * 0.20, b.gloed.toFixed(3));
    var onder = hsl(mengHue(hue, 344, 0.55), Math.min(0.62, sat + 0.12), 0.32 + b.licht * 0.10, (b.gloed * 0.72).toFixed(3));
    var basis = hsl(hue, 0.16, 0.042, 1);           // vrijwel zwart, heel licht getint
    var accent = hsl(hue, Math.min(0.7, sat + 0.18), 0.60, 1);
    return { top: top, onder: onder, basis: basis, accent: accent, hue: hue, seizoen: seiz, uur: uur };
  }

  // ---- toepassen: een gedeelde stijlregel + variabelen op :root ----
  var STIJL_ID = 'inlogkleur-stijl';
  function verf() {
    if (!d.querySelector('[data-inlogkleur]')) return;
    var p = palet();
    var r = d.documentElement.style;
    r.setProperty('--inlog-top', p.top);
    r.setProperty('--inlog-onder', p.onder);
    r.setProperty('--inlog-basis', p.basis);
    r.setProperty('--inlog-accent', p.accent);
    if (!d.getElementById(STIJL_ID)) {
      var st = d.createElement('style');
      st.id = STIJL_ID;
      st.textContent = '[data-inlogkleur]{background:' +
        'radial-gradient(155% 78% at 50% -6%, var(--inlog-top), transparent 60%),' +
        'radial-gradient(135% 68% at 50% 116%, var(--inlog-onder), transparent 62%),' +
        'var(--inlog-basis) !important;}';
      (d.head || d.documentElement).appendChild(st);
    }
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', verf);
  else verf();
  // de dag draait door: elke minuut opnieuw, zodat de kleur meeschuift
  var timer = setInterval(verf, 60000);
  if (timer && timer.unref) timer.unref();
  w.Inlogkleur = { palet: palet, verf: verf };
})(window, document);
