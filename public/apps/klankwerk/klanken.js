/* RTG Klankwerk: de instrumenten.

   Elke klank wordt hier opgewekt uit oscillatoren en ruis -- er wordt niets
   ingeladen, want er is niets om in te laden (zie server/kern/muziek-
   instrumenten.js). Dezelfde klanktaal als RTG Sound (shared/geluid.js), maar
   dan bespeelbaar in plaats van generatief.

   Staat los van de planner (apps/klankwerk/motor.js): daar gaat het over WANNEER
   er iets klinkt, hier over HOE. Wie een instrument wil bijstellen of erbij
   zetten, hoeft alleen dit bestand te openen -- en de naam moet dan ook in
   server/kern/muziek-instrumenten.js staan, want dat is de gedeelde lijst. */
(function () {
  'use strict';
  if (window.RTGStudioKlanken) return;

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
    ride: function (ctx, uit, t0, vol) {
      var n = ruisBron(ctx, 0.5), f = filter(ctx, 'highpass', 5200);
      var g = env(ctx, t0, 0.002, 0.02, 0.46, 0.16 * vol);
      n.connect(f); f.connect(g); g.connect(uit); n.start(t0);
    },
    shaker: function (ctx, uit, t0, vol) {
      var n = ruisBron(ctx, 0.07), f = filter(ctx, 'bandpass', 6500, 1.6);
      var g = env(ctx, t0, 0.006, 0.006, 0.05, 0.2 * vol);
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
    orgel: { golf: 'square', laag: 1600, aan: 0.02, uit: 0.06, vol: 0.22 },
    snaar: { golf: 'sawtooth', laag: 900, aan: 0.16, uit: 0.45, vol: 0.24 },
    koper: { golf: 'sawtooth', laag: 1800, aan: 0.05, uit: 0.20, vol: 0.26 },
    pluk:  { golf: 'triangle', laag: 3200, aan: 0.002, uit: 0.16, vol: 0.34 },
    bel:   { golf: 'sine', laag: 5000, aan: 0.001, uit: 0.9, vol: 0.30 },
    lead:  { golf: 'square', laag: 2600, aan: 0.008, uit: 0.14, vol: 0.20 }
  };
  // De stemkleuren, met dezelfde namen als de server ze kent.
  var STEM = { zang: 'solo', koor: 'koor', fluister: 'zacht' };
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


  window.RTGStudioKlanken = { SLAG: SLAG, TOON: TOON, STEM: STEM, toonKlank: toonKlank, hz: hz };
})();
