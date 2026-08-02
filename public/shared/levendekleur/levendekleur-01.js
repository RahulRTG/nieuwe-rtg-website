/* De levende grond van de hele ROS. Dezelfde ademende kleur als het inlogscherm,
   maar nu doorgetrokken over het complete leden-OS: een ingetogen was boven- en
   onderin die met het moment meebeweegt. De KLOK zet de boog van de dag (diepe
   nacht -> dageraad -> middaglicht -> gouden uur -> schemering), het SEIZOEN de
   kleurfamilie en de DAG-VAN-HET-JAAR een fijne eigen draai -- zo is geen moment
   hetzelfde. De kleur schuift continu (elke animatieframe een tikje), maar we
   schrijven alleen naar het scherm als de tint echt verandert, dus het kost
   vrijwel niets.

   Drie ROS-thema's kiezen de familie waarbinnen die was leeft:
   - donker    : de vertrouwde diepe RTG-grond (zoals het inlogscherm nu)
   - champagne : een licht, werkbaar parelmoer met een warme gouden gloed
   - bordeaux  : een diepe wijnrode grond
   En de RTFoundation-app draait op een eigen familie: pastelblauw.

   De familie komt uit data-pas-thema op <html> (standaard->donker,
   parelmoer->champagne, bordeaux->bordeaux) of wordt vast gezet met
   data-levend="pastel". Elke [data-levendegrond] krijgt de was als achtergrond.
   Zonder JavaScript blijft de gewone huisstijl gewoon staan.

   Testen: ?uur=18.5 &dag=200 &seizoen=zomer in de adresbalk (voor screenshots). */
(function (w, d) {
  'use strict';

  function dagVanJaar(dt) { var s = new Date(dt.getFullYear(), 0, 0); return Math.floor((dt - s) / 86400000); }
  function mengHue(a, b, t) { var diff = ((b - a + 540) % 360) - 180; return (a + diff * t + 360) % 360; }
  function hsl(h, s, l, a) {
    h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
    function f(n) { var k = (n + h / 30) % 12, c = s * Math.min(l, 1 - l);
      return Math.round(255 * (l - c * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); }
    return 'rgba(' + f(0) + ',' + f(8) + ',' + f(4) + ',' + a + ')';
  }

  // de dagboog: negen ijkpunten waartussen we vloeiend overgaan (gelijk aan het inlogscherm)
  var UREN = [
    { u: 0,  th: 244, meng: 0.78, licht: 0.14, gloed: 0.17 },
    { u: 5,  th: 258, meng: 0.62, licht: 0.22, gloed: 0.22 },
    { u: 7,  th: 344, meng: 0.55, licht: 0.40, gloed: 0.32 },
    { u: 9,  th: 48,  meng: 0.28, licht: 0.62, gloed: 0.33 },
    { u: 12, th: 30,  meng: 0.06, licht: 0.90, gloed: 0.28 },
    { u: 15, th: 42,  meng: 0.30, licht: 0.78, gloed: 0.31 },
    { u: 18, th: 30,  meng: 0.55, licht: 0.55, gloed: 0.38 },
    { u: 20, th: 344, meng: 0.62, licht: 0.36, gloed: 0.34 },
    { u: 22, th: 258, meng: 0.70, licht: 0.22, gloed: 0.22 },
    { u: 24, th: 244, meng: 0.78, licht: 0.14, gloed: 0.17 }
  ];
  function boog(uur) {
    for (var i = 1; i < UREN.length; i++) {
      if (uur <= UREN[i].u) {
        var a = UREN[i - 1], b = UREN[i], t = (uur - a.u) / (b.u - a.u);
        return { th: mengHue(a.th, b.th, t), meng: a.meng + (b.meng - a.meng) * t,
          licht: a.licht + (b.licht - a.licht) * t, gloed: a.gloed + (b.gloed - a.gloed) * t };
      }
    }
    return UREN[0];
  }
  var SEIZOEN = { winter: { hue: 212, sat: 0.30 }, lente: { hue: 152, sat: 0.42 }, zomer: { hue: 40, sat: 0.60 }, herfst: { hue: 22, sat: 0.55 } };
  function seizoenVan(m) { return m >= 2 && m <= 4 ? 'lente' : m >= 5 && m <= 7 ? 'zomer' : m >= 8 && m <= 10 ? 'herfst' : 'winter'; }

  /* Per familie: het anker (waarheen we de bewegende tint trekken zodat de
     grond op-merk blijft), of het een lichte of donkere grond is, en hoe sterk
     de was mag zijn. champagne/pastel zijn licht en heel ingetogen (werkbaar);
     donker/bordeaux zijn diep. */
  var FAMILIES = {
    donker:    { anker: null, licht: false, basisL: 0.045, basisS: 0.16, topL: 0.50, onderL: 0.33, was: 1.00 },
    champagne: { anker: 44,   licht: true,  basisL: 0.935, basisS: 0.16, topL: 0.86, onderL: 0.82, was: 0.55 },
    bordeaux:  { anker: 344,  licht: false, basisL: 0.070, basisS: 0.42, topL: 0.32, onderL: 0.20, was: 0.85 },
    // pastelblauw voor de RTFoundation-app: een diepe blauwe grond (de app is
    // donker met lichte tekst) met een zachte, pastelblauwe was erboven
    pastel:    { anker: 210,  licht: false, basisL: 0.075, basisS: 0.34, topL: 0.60, onderL: 0.44, was: 0.80 }
  };

  /* ---- beweging: snelheid + intensiteit van de levende grond, met een knopje ----
     Een voorkeur (0..100) die de grond rustiger of levendiger maakt: hoe hoger,
     hoe sterker de gloed en hoe sneller de zachte 'ademhaling'. 0 = stil. Wordt
     per toestel onthouden en gedeeld door al je RTG-schermen. */
  var BKEY = 'rtg_beweging';
  var RUSTIG = false; try { RUSTIG = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  /* De voorkeur wordt gecachet: localStorage.getItem is een synchrone gang naar
     de opslag en dit werd per beeldframe gelezen. De cache vervalt alleen als
     de waarde echt kan zijn veranderd: bij bZet() hier, of via het
     storage-event als een ander tabblad de schuif verzet. */
  var bCache = null;
  try { w.addEventListener('storage', function (ev) { if (ev.key === BKEY) { bCache = null; vorige = ''; } }); } catch (e) {}
  function bWaarde() {
    if (bCache != null) return bCache;
    try { var v = localStorage.getItem(BKEY); if (v != null && v !== '') return (bCache = Math.max(0, Math.min(100, +v))); } catch (e) {}
    return (bCache = (RUSTIG ? 12 : 35)); // standaard rustig/ontspannen; op te draaien tot Levendig
  }
  function bFactor() { return bWaarde() / 60; } // 60 -> 1.0, bereik 0 .. 1.67
  function bNiveau() { var v = bWaarde(); return v < 8 ? 'stil' : v < 40 ? 'rustig' : v < 82 ? 'normaal' : 'levendig'; }
  function bPas() {
    d.documentElement.style.setProperty('--beweging', bFactor().toFixed(3));
    d.documentElement.setAttribute('data-beweging', bNiveau());
  }
  function bZet(v) {
    try { localStorage.setItem(BKEY, String(Math.max(0, Math.min(100, +v)))); } catch (e) {}
    bCache = Math.max(0, Math.min(100, +v));
    bPas(); vorige = ''; bMerk();
    try { w.dispatchEvent(new Event('rtg-beweging')); } catch (e) {}
  }

  // de zoekbalk-parameters veranderen niet zolang de pagina staat: één keer
  // ontleden, niet per beeldframe opnieuw (dit zat in het hete pad van verf())
  var VASTE_Q = null; try { VASTE_Q = new URLSearchParams(w.location.search); } catch (e) {}
  function palet(familie, nu, beweeg, sh) {
    if (beweeg == null) beweeg = 1;
    if (sh == null) sh = 0;
    var F = FAMILIES[familie] || FAMILIES.donker;
    nu = nu || new Date();
    var q = VASTE_Q;
    var uur = q && q.get('uur') != null ? parseFloat(q.get('uur')) : nu.getHours() + nu.getMinutes() / 60 + nu.getSeconds() / 3600;
    var dag = q && q.get('dag') != null ? parseInt(q.get('dag'), 10) : dagVanJaar(nu);
    var seiz = (q && q.get('seizoen')) || seizoenVan(nu.getMonth());
    if (!SEIZOEN[seiz]) seiz = seizoenVan(nu.getMonth());
    if (isNaN(uur)) uur = nu.getHours() + nu.getMinutes() / 60;
    uur = ((uur % 24) + 24) % 24;

    var s = SEIZOEN[seiz], b = boog(uur);
    var mh = mengHue(s.hue, b.th, b.meng);
    mh = (mh + Math.sin(dag * 2.399963) * 9 + 360) % 360;
    // naar het familie-anker trekken zodat de grond herkenbaar op-merk blijft
    var hue = F.anker == null ? mh : mengHue(mh, F.anker, 0.62);
    // de zachte ademhaling: een fijne slinger op tint en gloed, sterker en sneller
    // naarmate de beweging hoger staat (0 = helemaal stil)
    hue = (hue + sh * 4 * beweeg + 360) % 360;
    var sat = Math.max(0.20, Math.min(0.72, s.sat * (0.7 + b.licht * 0.55)));
    // de grond blijft altijd zichtbaar (stil = geen beweging, niet uit); alleen de
    // ademhaling schaalt mee, met een fijne extra rijkdom naar 'levendig' toe
    var glowBasis = 0.88 + Math.min(1.2, beweeg) * 0.2;
    var g = Math.max(0, b.gloed * F.was * glowBasis * (1 + sh * 0.14 * beweeg));

    var top, onder, basis;
    if (F.licht) {
      // lichte grond: de was is een warme, lichte gloed die het scherm laat ademen
      top = hsl(hue, Math.min(0.5, sat + 0.06), F.topL, (g * 0.9).toFixed(3));
      onder = hsl(mengHue(hue, F.anker, 0.3), Math.min(0.5, sat), F.onderL, (g * 0.75).toFixed(3));
      basis = hsl(hue, F.basisS, F.basisL, 1);
    } else {
      top = hsl(hue, sat, F.topL + b.licht * 0.14, g.toFixed(3));
      onder = hsl(mengHue(hue, F.anker == null ? 344 : F.anker, 0.5), Math.min(0.62, sat + 0.1), F.onderL + b.licht * 0.08, (g * 0.72).toFixed(3));
      basis = hsl(hue, F.basisS, F.basisL + b.licht * 0.006, 1);
    }
    return { top: top, onder: onder, basis: basis, hue: hue };
  }

