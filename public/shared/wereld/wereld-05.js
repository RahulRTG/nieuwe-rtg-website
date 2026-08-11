
  /* ---------- de levende grond ----------
     Achter alles ligt een canvas dat per wereld een ander motief ademt: golven
     bij Reizen, bouwlijnen bij Kantoor, geometrie bij Geld, stadslichten bij
     Media. Het staat bewust op de rand van zichtbaar. Dat is de bedoeling --
     je hoort het pas na een week te merken, en dan als "die achtergrond klopt
     bij waar ik ben", niet als "kijk, een animatie".

     DRIE REGELS DIE HIER NIET ONDERHANDELBAAR ZIJN:
     1. Het draagt geen betekenis. Alles wat je moet WETEN staat in tekst; deze
        laag is sfeer. Daarom is het canvas voor een schermlezer niet aanwezig
        en vangt het geen tikken.
     2. Het luistert naar de schuif Beweging (window.RTGBeweging) en naar
        prefers-reduced-motion. Op stil wordt er EEN beeld getekend en verder
        niets -- geen lus die stilletjes door blijft draaien.
     3. Het staat stil zodra het tabblad weg is. Een achtergrond die op een
        onzichtbare pagina batterij verstookt, is geen sfeer maar een lek. */
  var MOTIEVEN = {
    'map-reizen': golven,
    'map-geld': geometrie,
    'map-salon': verbindingen,
    'map-huis': ringen,
    'map-media': stadslichten,
    'map-werk': bouwlijnen,
    'map-veilig': raster,
    'map-rtf': organisch
  };
  var grond = { cv: null, ctx: null, motief: null, t: 0, laatst: 0, tik: null, kleur: '#C9A24B' };

  function bouwGrond() {
    if (grond.cv) return;
    var cv = d.createElement('canvas');
    cv.className = 'os-wereld-grond';
    cv.setAttribute('aria-hidden', 'true');
    el.scherm.insertBefore(cv, el.scherm.firstChild);
    grond.cv = cv;
    grond.ctx = cv.getContext && cv.getContext('2d');
    el.grond = cv;
    /* DE MAAT VOLGT HET ELEMENT, NIET EEN MOMENT.

       Hier stond een eenmalige meting plus een resize-listener, en dat is een
       klassieke halve maatregel: op het moment dat het canvas wordt aangemaakt
       heeft de indeling nog niet gedraaid, dus clientWidth is 0 en het canvas
       werd 2 bij 2 pixels. Daarna kwam er geen resize meer -- het venster
       veranderde immers niet -- en bleef het zo. Gemeten: nul getekende pixels,
       een achtergrond die er wel was en niets deed.

       Een waarnemer op het element zelf heeft dat probleem niet: hij vuurt
       zodra de indeling het canvas een maat geeft, en daarna bij elke wijziging
       (venster, toetsenbord dat opkomt, de wingpanelen die openschuiven). */
    try {
      if (w.ResizeObserver) { new w.ResizeObserver(grondMaat).observe(cv); }
      else w.addEventListener('resize', grondMaat);
    } catch (e) { try { w.addEventListener('resize', grondMaat); } catch (e2) {} }
    grondMaat();
    try { d.addEventListener('visibilitychange', function () { if (!d.hidden) grondStart(); }); } catch (e) {}
  }

  function grondMaat() {
    if (!grond.cv) return;
    var r = Math.min(2, w.devicePixelRatio || 1);
    var b = grond.cv.clientWidth, h = grond.cv.clientHeight;
    if (!b || !h) return;                 // nog geen indeling: dan ook niet meten
    var nb = Math.round(b * r), nh = Math.round(h * r);
    if (nb === grond.cv.width && nh === grond.cv.height) return;
    grond.cv.width = nb; grond.cv.height = nh;
    grondFrame();
  }

  // welk motief hoort bij de wereld waar je staat? Ingezoomd blijft het motief
  // van de wereld staan -- je bent er nog steeds, alleen dieper.
  function grondKies() {
    var sleutel = st.diep
      ? (st.werelden[st.wereldIdx] || {}).sleutel
      : ((huidige() || {}).sleutel);
    grond.motief = MOTIEVEN[sleutel] || golven;
    try {
      var g = getComputedStyle(d.documentElement).getPropertyValue('--gold').trim();
      if (g) grond.kleur = g;
    } catch (e) {}
    grondFrame();
  }

  function beweegFactor() {
    if (RUSTIG) return 0;
    try { if (w.RTGBeweging && w.RTGBeweging.factor) return w.RTGBeweging.factor(); } catch (e) {}
    return 0.6;
  }

  function grondFrame() {
    if (!grond.ctx || !grond.motief) return;
    var cv = grond.cv, ctx = grond.ctx;
    var W = cv.width, H = cv.height;
    if (!W || !H) return;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.strokeStyle = grond.kleur;
    ctx.fillStyle = grond.kleur;
    ctx.lineWidth = Math.max(1, W / 620);
    /* De dekking is laag EN hangt aan de schuif: wie Beweging op stil zet, wil
       geen bewegingloze-maar-wel-opvallende achtergrond, hij wil rust. */
    ctx.globalAlpha = 0.05 + 0.05 * Math.min(1, beweegFactor());
    try { grond.motief(ctx, W, H, grond.t); } catch (e) { /* een motief mag het scherm nooit kosten */ }
    ctx.restore();
  }

  function grondStart() {
    if (grond.tik || !st.aan) return;
    if (beweegFactor() === 0) { grondFrame(); return; }   // stil: EEN beeld, geen lus
    var stap = function (nu) {
      grond.tik = null;
      if (!st.aan || d.hidden || beweegFactor() === 0) return;
      // ~20 beelden per seconde is voor deze traagheid ruim genoeg, en scheelt
      // twee derde van het werk tegenover een volle rAF-lus
      if (nu - grond.laatst > 48) {
        grond.laatst = nu;
        grond.t += 0.006 * beweegFactor();
        grondFrame();
      }
      grond.tik = w.requestAnimationFrame(stap);
    };
    grond.tik = w.requestAnimationFrame(stap);
  }
  function grondStop() { if (grond.tik) { w.cancelAnimationFrame(grond.tik); grond.tik = null; } }

  /* ---------- de acht motieven ----------
     Elk is een handvol lijnen. Ze hoeven niet mooi te zijn als je ernaar kijkt;
     ze horen te kloppen als je er NIET naar kijkt. */
  function golven(c, W, H, t) {                    // Reizen: water en afstand
    for (var i = 0; i < 5; i++) {
      c.beginPath();
      for (var x = 0; x <= W; x += W / 60) {
        var y = H * (0.36 + i * 0.09) + Math.sin(x / (W / 5) + t + i * 0.7) * H * 0.022;
        if (x === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    }
  }
  function geometrie(c, W, H, t) {                 // Geld: orde, opbouw, ritme
    var n = 7, b = W / (n + 1);
    for (var i = 0; i < n; i++) {
      var h = H * (0.14 + 0.1 * ((i * 3 + 1) % 5)) * (1 + 0.06 * Math.sin(t + i));
      c.strokeRect(b * (i + 0.5), H * 0.72 - h, b * 0.5, h);
    }
  }
  function verbindingen(c, W, H, t) {              // Sociaal: mensen en lijnen
    var p = [];
    for (var i = 0; i < 9; i++) {
      p.push([W * (0.12 + 0.76 * ((i * 7) % 9) / 8) + Math.sin(t + i) * W * 0.012,
        H * (0.2 + 0.6 * ((i * 5) % 9) / 8) + Math.cos(t * 0.8 + i) * H * 0.012]);
    }
    for (var a = 0; a < p.length; a++) {
      c.beginPath(); c.arc(p[a][0], p[a][1], W / 300, 0, 6.284); c.fill();
      var b2 = p[(a + 2) % p.length];
      c.beginPath(); c.moveTo(p[a][0], p[a][1]); c.lineTo(b2[0], b2[1]); c.stroke();
    }
  }
  function ringen(c, W, H, t) {                    // Leven: een haard, van binnenuit
    for (var i = 0; i < 5; i++) {
      c.beginPath();
      c.arc(W / 2, H * 0.52, W * (0.1 + i * 0.11) * (1 + 0.02 * Math.sin(t + i)), 0, 6.284);
      c.stroke();
    }
  }
  function stadslichten(c, W, H, t) {              // Media: een stad die aanstaat
    for (var i = 0; i < 46; i++) {
      var x = W * ((i * 37) % 100) / 100, y = H * (0.3 + 0.62 * ((i * 53) % 100) / 100);
      var a = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.6 + i));
      c.save(); c.globalAlpha *= a;
      c.fillRect(x, y, W / 210, W / 210);
      c.restore();
    }
  }
  function bouwlijnen(c, W, H, t) {                // Kantoor: structuur en verdieping
    var v = 6;
    for (var i = 0; i <= v; i++) {
      var y = H * (0.2 + i * 0.1) + Math.sin(t * 0.5 + i) * 1.5;
      c.beginPath(); c.moveTo(W * 0.08, y); c.lineTo(W * 0.92, y); c.stroke();
    }
    for (var j = 0; j <= 4; j++) {
      var x2 = W * (0.08 + j * 0.21);
      c.beginPath(); c.moveTo(x2, H * 0.2); c.lineTo(x2, H * 0.8); c.stroke();
    }
  }
  function raster(c, W, H, t) {                    // Veilig: een rustige wacht
    var s = W / 9;
    for (var x = s / 2; x < W; x += s) {
      for (var y = s / 2; y < H; y += s) {
        var r = s * 0.13 * (1 + 0.25 * Math.sin(t * 1.2 + (x + y) / s));
        c.beginPath(); c.arc(x, y, r, 0, 6.284); c.stroke();
      }
    }
  }
  function organisch(c, W, H, t) {                 // RTFoundation: groei, geen raster
    for (var i = 0; i < 6; i++) {
      c.beginPath();
      for (var s2 = 0; s2 <= 1.001; s2 += 0.05) {
        var x = W * (0.1 + 0.8 * s2);
        var y = H * (0.5 + 0.26 * Math.sin(s2 * 3.1 + i * 1.05 + t * 0.7) * (1 - s2 * 0.45));
        if (s2 === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    }
  }
