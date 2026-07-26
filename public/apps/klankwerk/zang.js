/* RTG Klankwerk: de zangstem.

   WAT DIT IS. Een klinker is akoestisch niet meer dan een bron (de stembanden)
   die door een paar RESONANTIES gaat (de vorm van je mond en keel). Die
   resonanties heten formanten, en ze liggen voor elke klinker ergens anders:
   een "a" heeft zijn eerste twee rond 800 en 1150 Hz, een "ie" rond 350 en
   2000. Zet je een zaagtand op de juiste toonhoogte door drie smalle filters op
   die frequenties, dan hoor je die klinker. Dat is geen truc en geen sample --
   dat is hoe spraak werkelijk in elkaar zit.

   WAT DIT NIET IS. Het gaat niet klinken als een zanger. Suno en de zijne
   draaien op een getraind model dat een echte stem nabootst; zoiets kunnen wij
   hier niet draaien en we doen ook niet alsof. Dit klinkt als een koor, een
   vocoder, een instrument dat woorden vormt. Dat staat ook op het scherm, want
   een studio die dat verzwijgt verkoopt een illusie.

   WAT HET WEL GEEFT, EN WAAROM HET ERTOE DOET. Het zingt UW woorden op UW
   melodie, uitgerekend op uw eigen toestel, zonder dat er ergens een licentie
   van iemand anders in zit. Daarom mag het mee naar uw clip en naar de uitgave,
   terwijl een ingekochte zangpartij dat niet mag. */
(function () {
  'use strict';
  if (window.RTGStudioZang) return;

  /* De formanten per klinker: [F1, F2, F3] in Hz. Dit zijn de gemiddelden voor
     een volwassen stem; ze staan hier zodat je ze kunt nalezen en bijstellen. */
  var KLINKERS = {
    a:  [800, 1150, 2900],
    aa: [750, 1250, 2900],
    e:  [500, 1550, 2550],
    ee: [400, 1900, 2600],
    i:  [400, 1900, 2550],
    ie: [300, 2200, 2900],
    o:  [500, 900, 2600],
    oo: [400, 800, 2600],
    u:  [400, 1100, 2200],
    oe: [300, 700, 2400],
    uu: [300, 1700, 2200],
    eu: [400, 1400, 2200],
    ij: [400, 1800, 2600],
    ui: [400, 1300, 2300],
    ou: [600, 900, 2600]
  };
  var STIL = [500, 1500, 2500];         // de "uh": waar we op terugvallen

  // Medeklinkers die we hoorbaar maken. De rest laten we door de aanzet van de
  // klinker zelf doen -- meer nabootsen dan dit wordt karikatuur.
  var SIS = 'szfvchgsj';
  var PLOF = 'ptkbdg';

  /* Uit een lettergreep halen wat we nodig hebben: welke klinker, en of er een
     medeklinker voor staat die je hoort. "zon" -> sis + o. "lief" -> ie. */
  function ontleed(tekst) {
    var t = String(tekst || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!t) return { klinker: STIL, aanzet: null, leeg: true };
    var beste = null, waar = -1;
    // eerst de tweeklanken, want "ie" is iets anders dan "i" gevolgd door "e"
    Object.keys(KLINKERS).forEach(function (k) {
      if (k.length < 2) return;
      var i = t.indexOf(k);
      if (i >= 0 && (waar < 0 || i < waar || (i === waar && k.length > beste.length))) { beste = k; waar = i; }
    });
    if (!beste) {
      for (var i = 0; i < t.length; i++) {
        if (KLINKERS[t[i]]) { beste = t[i]; waar = i; break; }
      }
    }
    var kop = waar > 0 ? t[waar - 1] : (waar === 0 ? '' : t[0]);
    var aanzet = null;
    if (kop && SIS.indexOf(kop) >= 0) aanzet = 'sis';
    else if (kop && PLOF.indexOf(kop) >= 0) aanzet = 'plof';
    return { klinker: KLINKERS[beste] || STIL, aanzet: aanzet, leeg: false };
  }

  var hz = function (n) { return 440 * Math.pow(2, (n - 69) / 12); };

  /* Eén gezongen noot. `kleur` is solo, koor of zacht.

     De opbouw: een zaagtand op de toonhoogte (de stembanden), met een trilling
     erin want een stem die exact stilstaat klinkt dood; daarnaast een beetje
     ruis (adem). Dat geheel gaat door drie smalle filters op de formanten van
     de klinker. Bij een koor doen we het drie keer, licht ontstemd -- dat is
     ook precies wat een koor is. */
  function zingNoot(ctx, uit, t0, len, toon, tekst, kleur) {
    var vorm = ontleed(tekst);
    var stemmen = kleur === 'koor' ? 3 : 1;
    var zacht = kleur === 'zacht';
    var piek = (zacht ? 0.16 : 0.3) / Math.sqrt(stemmen);
    var aan = zacht ? 0.09 : 0.045;
    var los = Math.min(0.22, len * 0.35);
    var vast = Math.max(0.03, len - aan - los);

    // de aanzet: een sisklank of een plofje vóór de klinker
    if (vorm.aanzet) medeklinker(ctx, uit, t0, vorm.aanzet, piek);

    for (var v = 0; v < stemmen; v++) {
      var ontstem = stemmen === 1 ? 0 : (v - 1) * 7;   // centen
      var f = hz(toon) * Math.pow(2, ontstem / 1200);

      var bron = ctx.createOscillator();
      bron.type = zacht ? 'triangle' : 'sawtooth';
      bron.frequency.value = f;

      // de trilling in de stem (vibrato), die pas op gang komt
      var lfo = ctx.createOscillator(), lfoG = ctx.createGain();
      lfo.frequency.value = 5 + v * 0.4;
      lfoG.gain.setValueAtTime(0, t0);
      lfoG.gain.linearRampToValueAtTime(f * 0.006, t0 + Math.min(0.25, len * 0.5));
      lfo.connect(lfoG); lfoG.connect(bron.frequency);
      lfo.start(t0); lfo.stop(t0 + len + 0.3);

      var omhul = ctx.createGain();
      omhul.gain.setValueAtTime(0.0001, t0);
      omhul.gain.linearRampToValueAtTime(piek, t0 + aan);
      omhul.gain.setValueAtTime(piek, t0 + aan + vast);
      omhul.gain.exponentialRampToValueAtTime(0.0001, t0 + aan + vast + los);
      bron.connect(omhul);

      // adem: zonder een beetje ruis klinkt een stem als een orgel
      var adem = ruis(ctx, len + 0.1);
      var ademF = ctx.createBiquadFilter();
      ademF.type = 'bandpass'; ademF.frequency.value = 2600; ademF.Q.value = 0.8;
      var ademG = ctx.createGain(); ademG.gain.value = (zacht ? 0.05 : 0.02) * piek;
      adem.connect(ademF); ademF.connect(ademG); ademG.connect(omhul);
      adem.start(t0); adem.stop(t0 + len + 0.1);

      // de drie formanten: dit is wat er een klinker van maakt
      var sterkte = [1, 0.55, 0.28];
      for (var k = 0; k < 3; k++) {
        var fil = ctx.createBiquadFilter();
        fil.type = 'bandpass';
        fil.frequency.value = vorm.klinker[k];
        fil.Q.value = k === 0 ? 9 : 11;
        var g = ctx.createGain(); g.gain.value = sterkte[k];
        omhul.connect(fil); fil.connect(g); g.connect(uit);
      }
      bron.start(t0); bron.stop(t0 + aan + vast + los + 0.05);
    }
  }

  function ruis(ctx, len) {
    var b = ctx.createBuffer(1, Math.max(1, Math.ceil(ctx.sampleRate * len)), ctx.sampleRate);
    var d = b.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    var s = ctx.createBufferSource(); s.buffer = b; s.loop = false; return s;
  }
  function medeklinker(ctx, uit, t0, soort, piek) {
    var len = soort === 'sis' ? 0.07 : 0.02;
    var n = ruis(ctx, len);
    var f = ctx.createBiquadFilter();
    f.type = soort === 'sis' ? 'highpass' : 'bandpass';
    f.frequency.value = soort === 'sis' ? 4200 : 1800;
    if (soort === 'plof') f.Q.value = 1.2;
    var g = ctx.createGain();
    g.gain.setValueAtTime(piek * (soort === 'sis' ? 0.5 : 0.7), Math.max(0, t0 - len));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.01);
    n.connect(f); f.connect(g); g.connect(uit);
    n.start(Math.max(0, t0 - len)); n.stop(t0 + 0.02);
  }

  window.RTGStudioZang = { zingNoot: zingNoot, ontleed: ontleed, KLINKERS: KLINKERS };
})();
