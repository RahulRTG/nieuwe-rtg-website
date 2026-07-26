/* RTG Studio: de klankmotor.

   Elke klank wordt hier opgewekt uit oscillatoren en ruis -- er wordt niets
   ingeladen, want er is niets om in te laden (zie server/kern/muziek-
   instrumenten.js). Dezelfde klanktaal als RTG Sound (shared/geluid.js), maar
   dan bespeelbaar in plaats van generatief.

   EEN PLANNER, TWEE GEBRUIKEN. `plan()` schrijft een heel stuk in een
   AudioContext; die context is live (je hoort het) of offline (je exporteert
   het). Daardoor KAN de export niet anders klinken dan wat je hoorde -- er is
   maar één plek waar staat wat er gebeurt. Twee aparte paden zouden vroeg of
   laat uit elkaar lopen, en dan levert de knop "opnemen" iets anders op dan de
   knop "afspelen". */
(function () {
  'use strict';
  if (window.RTGStudioMotor) return;

  var hz = function (n) { return 440 * Math.pow(2, (n - 69) / 12); };

  // Een ruisbron van `len` seconden, uitdovend. Buffers zijn klein en kortlevend.
  function ruisBron(ctx, len, dood) {
    var b = ctx.createBuffer(1, Math.max(1, Math.ceil(ctx.sampleRate * len)), ctx.sampleRate);
    var d = b.getChannelData(0);
    for (var i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * (dood === false ? 1 : Math.pow(1 - i / d.length, 2));
    }
    var s = ctx.createBufferSource(); s.buffer = b; return s;
  }
  function env(ctx, t0, aan, vast, uit, piek) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(piek, t0 + aan);
    g.gain.setValueAtTime(piek, t0 + aan + vast);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + aan + vast + uit);
    return g;
  }
  function filter(ctx, type, freq, q) {
    var f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    if (q) f.Q.value = q; return f;
  }

  /* De instrumenten. Elke functie schrijft één klank in de context, op tijd t0.
     De namen zijn precies die van de server; wat daar niet in staat, komt hier
     nooit binnen (de kern gooit een onbekend instrument weg). */
  var SLAG = {
    kick: function (ctx, uit, t0, vol) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(150, t0);
      o.frequency.exponentialRampToValueAtTime(44, t0 + 0.12);
      g.gain.setValueAtTime(0.9 * vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.24);
      o.connect(g); g.connect(uit); o.start(t0); o.stop(t0 + 0.26);
    },
    snare: function (ctx, uit, t0, vol) {
      var n = ruisBron(ctx, 0.18), f = filter(ctx, 'highpass', 1600);
      var g = env(ctx, t0, 0.002, 0.01, 0.16, 0.5 * vol);
      n.connect(f); f.connect(g); g.connect(uit); n.start(t0);
      var o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 185;
      var og = env(ctx, t0, 0.002, 0.01, 0.1, 0.25 * vol);
      o.connect(og); og.connect(uit); o.start(t0); o.stop(t0 + 0.14);
    },
    clap: function (ctx, uit, t0, vol) {
      for (var i = 0; i < 3; i++) {
        var t = t0 + i * 0.012;
        var n = ruisBron(ctx, 0.09), f = filter(ctx, 'bandpass', 1300, 1.4);
        var g = env(ctx, t, 0.001, 0.004, 0.08, (i === 2 ? 0.45 : 0.22) * vol);
        n.connect(f); f.connect(g); g.connect(uit); n.start(t);
      }
    },
    hihat: function (ctx, uit, t0, vol) {
      var n = ruisBron(ctx, 0.05), f = filter(ctx, 'highpass', 8000);
      var g = env(ctx, t0, 0.001, 0.004, 0.04, 0.28 * vol);
      n.connect(f); f.connect(g); g.connect(uit); n.start(t0);
    },
    tom: function (ctx, uit, t0, vol) {
      var o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(210, t0);
      o.frequency.exponentialRampToValueAtTime(90, t0 + 0.25);
      var g = env(ctx, t0, 0.003, 0.02, 0.28, 0.6 * vol);
      o.connect(g); g.connect(uit); o.start(t0); o.stop(t0 + 0.34);
    }
  };
  // Melodisch: golfvorm, filter en omhullende per instrument.
  var TOON = {
    bas:   { golf: 'sawtooth', laag: 420, aan: 0.006, uit: 0.10, vol: 0.55 },
    toets: { golf: 'triangle', laag: 2200, aan: 0.005, uit: 0.28, vol: 0.42 },
    snaar: { golf: 'sawtooth', laag: 900, aan: 0.16, uit: 0.45, vol: 0.24 },
    pluk:  { golf: 'triangle', laag: 3200, aan: 0.002, uit: 0.16, vol: 0.34 },
    lead:  { golf: 'square', laag: 2600, aan: 0.008, uit: 0.14, vol: 0.20 }
  };
  function toonKlank(ctx, uit, naam, t0, len, noot, vol) {
    var s = TOON[naam] || TOON.toets;
    var vast = Math.max(0.02, len - s.aan - s.uit * 0.5);
    var o = ctx.createOscillator(); o.type = s.golf; o.frequency.value = hz(noot);
    var f = filter(ctx, 'lowpass', s.laag);
    var g = env(ctx, t0, s.aan, vast, s.uit, s.vol * vol);
    o.connect(f); f.connect(g); g.connect(uit);
    o.start(t0); o.stop(t0 + s.aan + vast + s.uit + 0.05);
    // De bas krijgt een octaaf eronder mee; dat is wat hem body geeft.
    if (naam === 'bas') {
      var o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = hz(noot - 12);
      var g2 = env(ctx, t0, s.aan, vast, s.uit, s.vol * vol * 0.6);
      o2.connect(g2); g2.connect(uit); o2.start(t0); o2.stop(t0 + s.aan + vast + s.uit + 0.05);
    }
  }

  /* De uitgang: per kanaal een volume en een plek in het stereobeeld, dan alles
     samen door een compressor. Zonder die compressor tikt een vol raster tegen
     het plafond en klinkt het goedkoop. */
  function uitgang(ctx, kanaal) {
    var g = ctx.createGain();
    g.gain.value = kanaal.stil ? 0 : (kanaal.volume != null ? kanaal.volume : 0.8);
    var laatste = g;
    if (ctx.createStereoPanner && kanaal.pan) {
      var p = ctx.createStereoPanner(); p.pan.value = kanaal.pan;
      g.connect(p); laatste = p;
    }
    return { in: g, uit: laatste };
  }
  function bus(ctx) {
    var master = ctx.createGain(); master.gain.value = 0.8;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.004;
    master.connect(comp); comp.connect(ctx.destination);
    return master;
  }

  var stapDuur = function (bpm) { return 60 / bpm / 4; };

  /* Een heel stuk in een context schrijven, beginnend op t0. Geeft de duur in
     seconden terug, zodat de aanroeper weet wanneer het klaar is. */
  function plan(ctx, master, track, t0) {
    var sd = stapDuur(track.bpm);
    var stappen = track.stappen || (16 * track.maten);
    var kanalen = track.kanalen || [];
    for (var i = 0; i < kanalen.length; i++) {
      var k = kanalen[i];
      if (k.stil) continue;
      var u = uitgang(ctx, k); u.uit.connect(master);
      if (SLAG[k.instrument]) {
        var rij = k.stappen || [];
        for (var j = 0; j < rij.length; j++) {
          if (rij[j] < stappen) SLAG[k.instrument](ctx, u.in, t0 + rij[j] * sd, 1);
        }
      } else {
        var noten = k.noten || [];
        for (var n = 0; n < noten.length; n++) {
          var no = noten[n];
          if (no.stap >= stappen) continue;
          toonKlank(ctx, u.in, k.instrument, t0 + no.stap * sd,
            Math.max(1, no.lengte || 1) * sd, no.toon, 1);
        }
      }
    }
    return stappen * sd;
  }

  // ---- live afspelen: lus met een vooruitblik, zoals de huismotor ----
  var ctx = null, master = null, klok = null, bezig = false, luister = null;
  function zorgCtx() {
    if (ctx) return ctx;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = bus(ctx);
    return ctx;
  }
  function speel(track, opties) {
    stop();
    zorgCtx();
    if (ctx.state === 'suspended') ctx.resume();
    var o = opties || {};
    luister = o.opStap || null;
    var sd = stapDuur(track.bpm);
    var stappen = track.stappen || (16 * track.maten);
    var duur = stappen * sd;
    var start = ctx.currentTime + 0.08;
    var ronde = 0;
    bezig = true;
    plan(ctx, master, track, start);
    klok = setInterval(function () {
      if (!bezig) return;
      var verstreken = ctx.currentTime - start;
      // de volgende ronde tijdig inplannen, zodat de lus niet hapert
      if (o.lus && verstreken > (ronde + 1) * duur - 0.25) {
        ronde++;
        plan(ctx, master, track, start + ronde * duur);
      }
      if (!o.lus && verstreken >= duur) { stop(); return; }
      if (luister) {
        var stap = Math.floor((verstreken / sd)) % stappen;
        if (stap >= 0) luister(stap);
      }
    }, 25);
    return duur;
  }
  function stop() {
    bezig = false;
    if (klok) { clearInterval(klok); klok = null; }
    if (ctx) {
      // een korte demping in plaats van een harde knip: anders klikt het
      try {
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
        var oud = master;
        setTimeout(function () { try { oud.disconnect(); } catch (e) {} }, 120);
        master = bus(ctx);
      } catch (e) { /* context al weg */ }
    }
    if (luister) luister(-1);
  }

  window.RTGStudioMotor = { plan, bus, speel, stop, stapDuur, hz,
    speelt: function () { return bezig; },
    context: function () { return ctx; } };
})();
